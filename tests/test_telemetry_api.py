"""Static invariants for the rc5 telemetry pipeline.

The runtime behaviour of the Vercel function is pinned by
``tests/telemetry-api.test.js``; this module pins the parts that a Node test
cannot see: the database migration (the schema the project was actually
migrated with) and the wiring between the three pieces
(index.html → api/telemetry.js → Supabase).

It runs in the normal Python suite, needs no network and no credentials, and
fails if a future change weakens one of the security decisions below.
"""

from __future__ import annotations

import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MIGRATION = ROOT / "supabase" / "migrations" / "20261029_telemetry_ingest.sql"
API = ROOT / "api" / "telemetry.js"
APP = ROOT / "index.html"


class TelemetryMigrationTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.sql = MIGRATION.read_text(encoding="utf-8")
        cls.api = API.read_text(encoding="utf-8")
        cls.html = APP.read_text(encoding="utf-8")
        # Only the script block matters; the embedded vocabulary is 4 MB of JSON.
        start = cls.html.index("/* =============================")
        cls.script = cls.html[start:]

    def test_migration_is_shipped_and_non_destructive(self) -> None:
        self.assertTrue(MIGRATION.exists())
        lowered = self.sql.lower()
        for forbidden in ("drop table", "truncate", "delete from telemetry.reports where true"):
            self.assertNotIn(forbidden, lowered, f"the migration must not contain {forbidden}")
        self.assertIn("create schema if not exists telemetry", lowered)

    def test_tables_are_private(self) -> None:
        self.assertEqual(self.sql.count("enable row level security"), 2,
                         "both tables enable RLS")
        self.assertNotIn("create policy", self.sql.lower(),
                         "no policy is defined, so no client role can read the tables")
        for statement in (
            "revoke all on schema telemetry from public",
            "revoke all on function telemetry.purge_expired() from public",
        ):
            self.assertIn(statement, self.sql)
        # The privileged entry point keeps a fixed search_path and runs as definer.
        self.assertIn("security definer", self.sql.lower())
        self.assertIn("set search_path = telemetry, public, pg_temp", self.sql)

    def test_only_the_ingest_function_is_exposed(self) -> None:
        exposed = re.findall(r"create or replace function (public\.\w+)", self.sql)
        self.assertEqual(exposed, ["public.telemetry_ingest"])
        self.assertIn("grant execute on function public.telemetry_ingest(jsonb, text) to service_role", self.sql)
        for role in ("anon", "authenticated"):
            self.assertIn(f"revoke all on function public.telemetry_ingest(jsonb, text) from {role}", self.sql)

    def test_limits_agree_with_the_endpoint(self) -> None:
        self.assertIn("max_bytes constant integer := 16384", self.sql)
        self.assertIn("max_events constant integer := 50", self.sql)
        self.assertIn("per_client_limit constant integer := 10", self.sql)
        self.assertIn("global_limit constant integer := 120", self.sql)
        # A ten-minute window, claimed per bucket.
        self.assertIn("/ 600", self.sql)
        self.assertIn("/ 3600", self.sql, "retention is purged at most hourly")
        # The endpoint's own numbers must match.
        self.assertIn("const MAX_BODY_BYTES = 16384;", self.api)
        self.assertIn("const MAX_EVENTS = 50;", self.api)

    def test_retention_is_ninety_days(self) -> None:
        self.assertRegex(self.sql, r"interval\s+'90 days'")
        self.assertIn("retention_expires_at", self.sql)
        self.assertIn("purge_expired", self.sql)

    def test_function_refuses_to_echo_input(self) -> None:
        # The exception handler returns a fixed token: a SQL error can quote the
        # stored values, so it must never reach the caller.
        self.assertIn("when others then", self.sql)
        self.assertRegex(self.sql, r"reason',\s*'rejected'")
        self.assertNotIn("sqlerrm", self.sql.lower())
        self.assertNotIn("sqlstate", self.sql.lower())


class TelemetryWiringTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.api = API.read_text(encoding="utf-8")
        cls.html = APP.read_text(encoding="utf-8")

    def test_endpoint_calls_the_privileged_rpc_only(self) -> None:
        self.assertIn("/rest/v1/rpc/telemetry_ingest", self.api)
        self.assertIn("SUPABASE_URL", self.api)
        self.assertIn("SUPABASE_SECRET_KEY", self.api)
        self.assertIn("TELEMETRY_IP_SALT", self.api)
        # No direct table access and no other Supabase endpoint.
        for table in ("/rest/v1/reports", "/rest/v1/rate_limits", "telemetry.reports"):
            self.assertNotIn(table, self.api)

    def test_no_secret_is_shipped(self) -> None:
        for path, text in (("api/telemetry.js", self.api), ("index.html", self.html)):
            self.assertNotRegex(text, r"eyJhbGciOi", f"{path} must not contain a JWT")
            self.assertNotIn("sb_secret_", text, f"{path} must not contain a secret key")
            self.assertNotIn("service_role", text, f"{path} must name no privileged role")

    def test_the_client_posts_to_the_documented_endpoint(self) -> None:
        self.assertIn("export const TELEMETRY_ENDPOINT = 'https://chuyen-anh-telemetry.vercel.app/api/telemetry'",
                      self.html)
        # One transport call site, POST only, credentials never included.
        self.assertEqual(self.html.count("await transport(endpoint"), 1)
        self.assertIn("credentials: 'omit'", self.html)
        self.assertIn("method: 'POST'", self.html)

    def test_the_events_vocabulary_is_shared(self) -> None:
        match = re.search(r"const KINDS = Object\.freeze\(\[([^\]]+)\]\)", self.api)
        self.assertIsNotNone(match)
        server = sorted(re.findall(r"'([a-z-]+)'", match.group(1)))
        client_match = re.search(r"export const TELEMETRY_KINDS = Object\.freeze\(\[([^\]]+)\]\)", self.html)
        self.assertIsNotNone(client_match)
        client = sorted(re.findall(r"'([a-z-]+)'", client_match.group(1)))
        self.assertEqual(server, client)

    def test_repository_documents_the_deployment_files(self) -> None:
        # The Vercel deployment contains exactly these two files; vercel.json and
        # .vercelignore describe how they are picked up by a CLI deploy.
        self.assertTrue((ROOT / "app.js").exists())
        config = json.loads((ROOT / "vercel.json").read_text(encoding="utf-8"))
        self.assertIn("api/telemetry.js", config["functions"])
        ignore = (ROOT / ".vercelignore").read_text(encoding="utf-8")
        self.assertIn("!app.js", ignore)
        self.assertIn("!api/telemetry.js", ignore)


if __name__ == "__main__":
    unittest.main()
