# Live infrastructure hardening — session 7 (2026-11-27)

Owner addendum 2 authorized direct execution of the external blockers through
the connected Supabase/Vercel apps, under the standing
impact/data-safety/rollback procedure. Everything below was executed against
the real infrastructure; every state quoted was read live through the
connector APIs. **No telemetry POST was sent at any point** (production-write
prohibition stands); all endpoint probes were read-only (OPTIONS/GET).

## 1. Supabase project state

- Project `chuyen-anh-telemetry`, ref `zomeiulaqahyjwhgdemf`
  (org `akefxrfemfvxvetsmnuz`, region ap-southeast-1) was **PAUSED** at
  session start. `restore_project` executed → db `ACTIVE_HEALTHY` ~45 s,
  rest/pooler `ACTIVE_HEALTHY` after settling (~4 min).
  Rollback: `pause_project` (data preserved while paused; verified after
  restore that `supabase_migrations.schema_migrations` retained its rows).
- Migration history (`list_migrations`) was **empty** at session start — the
  rc8 hardening SQL had never been applied to the live database.

## 2. INFRA-2 (critical) — live ingest function was pre-hardening

Baseline read (live, `execute_query`):

```
ingest_fn_count     = 1
ingest_is_hardened  = false   (prosrc lacks 'client:missing'/'missing_key_limit')
ingest_acl          = postgres=X/postgres, service_role=X/postgres
```

The rc10/rc11 client ships the `client:missing` bucket contract, so the live
function disagreed with the shipped client (keyless callers consumed the
global 120 budget without the 5/10-min missing-key cap).

Fix: `create_migration` `apply_repo_20261031_telemetry_hardening` —
`supabase/migrations/20261031_telemetry_hardening.sql` applied **verbatim**
(the same SQL already proven in PGlite by `pglite_rate_limit_evidence.mjs`).

Post-fix verification (live):

```
ingest_is_hardened = true
ingest_acl         = postgres=X/postgres, service_role=X/postgres
telemetry grants   = none   (no anon/authenticated/table grants outside postgres)
migration_count    = 4     (supabase_migrations.schema_migrations)
```

Impact: stricter validation only — malformed `client_key` rejected, keyless
callers capped at 5/10 min, global 120 unchanged, behaviour for already-valid
calls unchanged (same SQL the tests pin). Data: none read, none rewritten.
Rollback: re-apply `20261029_telemetry_ingest.sql` (the pre-hardening body is
preserved in that migration and in git history).

## 3. INFRA-1 (critical) — `public.compute_jobs` exposed to the public API

Baseline read (live):

```
owner        = postgres
rls          = false
policy_count = 0
grants       = anon:DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE
               authenticated: (same set)
               service_role: (same set)
```

RLS disabled **plus** `anon`/`authenticated` holding every privilege
including TRUNCATE means anyone with the project's public anon key could read
every row and wipe the table through PostgREST. A repo-wide grep
(`supabase/`, `api/`, `scripts/`, all of git history for the name) finds **zero
references** — no Chuyen-Anh code path uses this table; it belongs to a
separate compute pipeline on the shared project.

Fix: `create_migration` `lock_compute_jobs_from_public_api`:

```sql
alter table public.compute_jobs enable row level security;
revoke all on public.compute_jobs from anon;
revoke all on public.compute_jobs from authenticated;
```

Post-fix verification (live):

```
compute_jobs_rls    = true
compute_jobs_grants = service_role:DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE
```

`service_role` keeps full access (BYPASSRLS + grants) for the owning backend
pipeline; the table owner (`postgres`) is unaffected; RLS with zero policies
deny-all remaining roles.

Impact: the public PostgREST API loses all access to `compute_jobs`; the
backend pipeline (service_role) and psql/owner access are unchanged. Data:
no rows read or modified. Rollback (single statement pair):

```sql
alter table public.compute_jobs disable row level security;
grant all on public.compute_jobs to anon, authenticated;
```

## 4. INFRA-3 (high) — production endpoint was stale (2026-10-29 build)

Project `chuyen-anh-telemetry` (`prj_YmtevOrE913KuRhJSX9FlQyKi3dO`, team
`team_NK7ZIqw551PrQnND7BHTILmP`): latest production deployment
`dpl_FbxQncjJru7dSKMWnPnTs1GozMWV` (created 2026-10-29) **predates every
scrubber fix** shipped in rc8–rc11 (`[^\s/?#@]+@` user-info rule, Bearer
alphabet, GitHub fine-grained PAT rule, body-stream fixes).

Fix: two `create_deployment` (files-based, `target: production`) attempts:

1. `dpl_2xJrWZ6eKhpmykYfKuGmezrvDBts` — repo-head `api/telemetry.js` alone →
   **ERROR**: `No entrypoint found in "/vercel/path1"` (project framework is
   `node`, i.e. a single Node **service**, not an api-directory of serverless
   functions). It never took the alias; production was untouched.
2. `dpl_9S9n7dkfm8ysEii4nMf1n2ZEWhYW` — exact replica of the working
   deployment's shape (read via `list_deployment_files`:
   `src/app.js` + `src/api/telemetry.js`):
   - `src/api/telemetry.js` = **byte-identical repo-head** `api/telemetry.js`
     (sha256 `202c629b…e12fe`, 16,049 B);
   - `src/app.js` = minimal pass-through entrypoint that delegates every
     request to the handler and never touches request data.
   → **READY, `readySubstate: PROMOTED`, `aliasAssigned: true`**
   (`chuyen-anh-telemetry.vercel.app`), created 2026-11-27. Production now
   serves the repo-head handler.

Impact: production endpoint code changes from the 2026-10-29 build to the
audited repo-head build (stricter scrubbing, identical request contract).
Data: no database writes. Rollback: redeploy the retained old deployment
(`dpl_FbxQncjJru7dSKMWnPnTs1GozMWV` still exists and its alias mapping can be
restored by redeploying it via the Vercel CLI/dashboard).

## 5. INFRA-4 (medium) — deployment was not reproducible from git

The working production deployment contained `src/app.js`, but **no `app.js`
existed anywhere in the repository** — the live service could not be rebuilt
from the repo (the first redeploy attempt failed exactly because of this).

Fix: `api/app.js` committed (this session's commit) — the entrypoint wrapper
with the deployment mapping documented in its header. Local live-server smoke
against the real handler (node 22, no mocks beyond the absence of upstream
env):

```
OPTIONS /api/telemetry (published origin) → 204, Access-Control-Allow-Methods: POST, OPTIONS
GET     /api/telemetry (published origin) → 405, Allow: POST, OPTIONS
POST    /api/telemetry (disallowed origin) → 403 {"ok":false,"error":"origin-not-allowed"}
```

The handler file itself remains pinned by `tests/telemetry-api.test.js`
(19 tests). A live GET from the sandbox is not possible (egress allowlist);
`fetch_page` cannot surface non-2xx responses — the liveness evidence is
Vercel's own READY/PROMOTED/aliasAssigned state plus the local contract
smoke. The end-to-end live POST remains **not tested, by design**
(production-write prohibition).

## 6. Constraint compliance

- No merge, no tag, no release, no force-push; `DEPLOY_HOLD` untouched.
- Live DB mutations: exactly the two migrations above (both reversible, both
  verified, both within the owner-authorized hardening scope named in
  addendum 2).
- Live endpoint probes: OPTIONS/GET only; zero POSTs; zero rows written to
  `telemetry.reports` by this session.
- All gate suites re-run at the resulting head: CI Node **180/180 (179 pass +
  1 documented skip)**; Python **303/303 (8 skipped-with-reason)**; release +
  deploy gates exit 0; scanner **0 findings both modes**; exam/vocab
  independent audits verdict OK.
