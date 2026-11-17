# WORK LOG — stable-rebuild session (2026-11-17) — append-only

### Session start

- Cloned `coderunknow/Chuyen-Anh`; verified live baseline via REST API and local
  git (`948f6f9` on `main`, no `v1.0.0` tag, no open PRs/issues, latest main CI
  green). Token used only at runtime via a credential helper reading the upload
  file; never stored or printed.
- Branch `build/v100-stable-rebuild` cut from verified `main`.
- Read `AGENT.md`, `README.md`, `SECURITY.md`, `PRIVACY.md`,
  `HANDOFF_NEXT_AGENT.md`, the tails of `DESIGN_LOG.md`/`AGENTS_LOG.md`
  (append-only), `audit/v100/*`, `api/telemetry.js`, both Supabase migrations.

### Suites run on the untouched baseline

- Python 294/294 OK; Node 304/305 (one failure → D-SR1); archive 5/5; 21
  validators pass; browser-exams PASS; browser-learning PASS (Chromium 133,
  in-sandbox); speed benchmark OK (68 ms median card latency).
- Installed test tooling in `/tmp` only (playwright-core 1.55.1, axe-core,
  @sparticuz/chromium 133, @electric-sql/pglite); repo dependency-free.

### Defect work

- D-SR1 (`NODE-LOCKS-ENV`): baseline repro → test fix → mutation controls →
  suite green. Evidence: `audit/v100/stable-rebuild/DEFECTS.md` D-SR1.
- D-SR2 (`TELEMETRY-NOTE-SECRETS`): baseline repro (client+server) → scrubber
  hardening in both files → tests in both suites → meta-test count reconciliation
  (telemetry-api 17→18, Node total 305→306) → mutation controls → suites green.

### Data audits (independent, fresh code)

- Exam: re-parsed all 106 papers with the production parser; recomputed
  coverage (106/6,708/5,155/1,553; 100% non-exempt) and re-derived all 2,146
  curated SHA-256 bindings (0 mismatches). Independently solved a deterministic
  10-question curated sample: 8/8 verifiable agree, 2 listening/context items
  unverifiable in-harness and left unclaimed.
- Vocabulary: deterministic sample of source-backed senses verified against the
  five pinned reference snapshots (198 automatic + 3 manual = 201/201 agree).

### Infrastructure evidence

- PGlite (in-memory Postgres): executed the real SQL of both migrations;
  demonstrated the old global-quota-exhaustion path and the hardened behaviour
  (5 stored rows, client:missing bucket, injection-shaped client_key rejected;
  refused attempts still count toward the global attempt budget — disclosed).
- Read-only live probes: telemetry preflight `204` (published origin), GET
  `405` + `Allow: POST, OPTIONS`; Pages deployment `7798610277` (rc11) success.
  No production-writing request was sent.

### Stable identity reconciliation

- `APP_VERSION = 'v1.0.0'`; `DEPLOY_HOLD` unchanged (`v1.0.0-rc11`); dual-gate
  tests reconciled (`test_deploy_gate.py`, `test_sprint_exam_features.py`,
  `static-app.test.js`, browser suites, checklist totals, PRIVACY/SECURITY/
  README/CHANGELOG). Gates verified: `app_release_gate` holds the stable
  candidate (`deploy=false (application release v1.0.0 not verified; held)`).
- Post-bump verification: Python 294/294, Node 306/306, validators 21/21,
  browser suites re-run (see below).

### Candidate browser suites (re-run after the version bump)

- `run-browser-suites.sh` (both suites, sequential, Chromium 133): executed at
  the candidate head; log `work/evidence/browser-suites-candidate.log`
  (session workspace). Speed benchmark re-run at the head for the comparison
  table in `FINAL_READINESS.md`.

### Documentation and evidence

- `CHANGELOG.md` stable-candidate section; `PRIVACY.md`, `SECURITY.md`,
  `README.md` version paragraphs; `DESIGN_LOG.md` + `AGENTS_LOG.md` appended
  (append-only); this evidence directory created.
- `git diff --check` clean; no secrets, artifacts or unrelated files committed
  (checked before push).
