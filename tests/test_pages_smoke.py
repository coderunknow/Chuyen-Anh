"""Contract tests for tests/pages_smoke.py.

The Pages probe is the only check that reads what GitHub Pages actually serves,
so its own rules are pinned here with a local HTTP server: a page that declares
the held version and carries the rc5 controls passes, and the rc4-shaped page
fails for the reasons rc5 exists.
"""

from __future__ import annotations

import http.server
import importlib.util
import io
import os
import pathlib
import sys
import threading
import unittest
from contextlib import redirect_stdout

ROOT = pathlib.Path(__file__).resolve().parents[1]
PROBE = ROOT / "tests" / "pages_smoke.py"
HOLD = ROOT / "DEPLOY_HOLD"


def load_probe():
    spec = importlib.util.spec_from_file_location("pages_smoke_under_test", PROBE)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def held_version() -> str:
    import re

    match = re.search(r"v\d+\.\d+\.\d+(?:-[a-z]+\d+)?", HOLD.read_text(encoding="utf-8"))
    assert match, "DEPLOY_HOLD must name a tag"
    return match.group(0)


def modern_page(version: str) -> str:
    return (
        "<!doctype html><html><head><meta charset=\"utf-8\"></head><body>"
        '<script id="vocabulary-data" type="application/json">[]</script>'
        '<script id="phrase-data" type="application/json">[]</script>'
        '<script id="exam-data" type="application/json">[]</script>'
        "<div id=\"start-quiz\"></div>"
        '<div class="vocab-list--no-gloss">'
        '<button data-meanings="show"></button><button data-meanings="hide"></button></div>'
        "<button id=\"telemetry-send\"></button>"
        "<button id=\"exam-history-export\"></button>"
        "<span>Trọng tâm phiên học</span>"
        "<script>const EXAM_SCORING_RULE_VERSION = \"rc6-equal-weight-v1\"; const answerKeySchemaVersion = 1;</script>"
        f"<script type=\"module\" id=\"app-script\">const APP_VERSION = '{version}';"
        "function previewStageVisible() { return true; }</script>"
        "</body></html>"
    )


def masked_page(version: str) -> str:
    """What rc4 served: the mask, no preference controls, an older version."""
    return (
        "<!doctype html><html><head><meta charset=\"utf-8\"></head><body>"
        '<script id="vocabulary-data" type="application/json">[]</script>'
        '<script id="phrase-data" type="application/json">[]</script>'
        '<script id="exam-data" type="application/json">[]</script>'
        "<span class=\"meaning-masked\">\u2022\u2022\u2022\u2022\u2022</span>"
        "<script>const MASKED_MEANING = '\u2022\u2022\u2022\u2022\u2022'; const revealedMeanings = new Set();</script>"
        "<script type=\"module\" id=\"app-script\">const APP_VERSION = 'v1.0.0-rc4';</script>"
        "</body></html>"
    )


class Fixture:
    def __init__(self, body: str):
        payload = body.encode("utf-8")

        class Handler(http.server.BaseHTTPRequestHandler):
            def do_GET(self):  # noqa: N802 - http.server API
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)

            def log_message(self, *args):  # keep the test output clean
                return

        self.server = http.server.HTTPServer(("127.0.0.1", 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)

    def __enter__(self) -> str:
        self.thread.start()
        host, port = self.server.server_address
        return f"http://{host}:{port}/"

    def __exit__(self, *exc_info) -> None:
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=5)


class PagesSmokeTest(unittest.TestCase):
    def run_probe(self, url: str) -> tuple[int, str]:
        previous = os.environ.get("PAGES_URL")
        os.environ["PAGES_URL"] = url
        try:
            module = load_probe()
            buffer = io.StringIO()
            with redirect_stdout(buffer):
                code = module.main()
            return code, buffer.getvalue()
        finally:
            if previous is None:
                os.environ.pop("PAGES_URL", None)
            else:
                os.environ["PAGES_URL"] = previous

    def test_a_page_that_matches_the_held_release_passes(self):
        with Fixture(modern_page(held_version())) as url:
            code, output = self.run_probe(url)
        self.assertEqual(code, 0, output)
        self.assertIn("pages probe passed", output)

    def test_the_rc4_page_fails_for_the_reasons_rc5_exists(self):
        with Fixture(masked_page(held_version())) as url:
            code, output = self.run_probe(url)
        self.assertEqual(code, 1, output)
        self.assertIn("still contains the rc4 five-dot mask", output)
        self.assertIn("still contains the mask constant", output)
        self.assertIn("does not declare version", output)
        self.assertIn("missing the meaning segmented control", output)
        self.assertIn("missing the diagnostics send button", output)

    def test_a_page_from_a_different_candidate_is_not_accepted(self):
        with Fixture(modern_page("v1.0.0-rc1")) as url:
            code, output = self.run_probe(url)
        self.assertEqual(code, 1, output)
        self.assertIn("does not declare version", output)

    def test_the_probe_refuses_to_guess_when_the_hold_file_has_no_tag(self):
        module = load_probe()
        previous = os.environ.get("DEPLOY_HOLD_FILE")
        empty = ROOT / "tests" / ".pages-hold-fixture"
        empty.write_text("no version here\n", encoding="utf-8")
        os.environ["DEPLOY_HOLD_FILE"] = str(empty)
        try:
            buffer = io.StringIO()
            with redirect_stdout(buffer):
                code = module.main()
        finally:
            os.environ.pop("DEPLOY_HOLD_FILE", None)
            empty.unlink()
            if previous is not None:
                os.environ["DEPLOY_HOLD_FILE"] = previous
        self.assertEqual(code, 1)
        self.assertIn("no version tag found", buffer.getvalue())


if __name__ == "__main__":
    unittest.main()


class ExpectedVersionTests(unittest.TestCase):
    def test_expected_version_override_is_validated_and_used(self):
        text = (ROOT / "tests" / "pages_smoke.py").read_text(encoding="utf-8")
        self.assertIn("EXPECTED_VERSION", text)
        self.assertIn("invalid EXPECTED_VERSION override", text)
        workflow = (ROOT / ".github" / "workflows" / "pages-smoke.yml").read_text(encoding="utf-8")
        self.assertIn("newest published release", workflow)
        self.assertIn("EXPECTED_VERSION: ${{ steps.expected.outputs.expected }}", workflow)
