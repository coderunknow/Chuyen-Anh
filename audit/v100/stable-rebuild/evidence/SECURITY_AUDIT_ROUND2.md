# Security audit — round 2 (review-response + threat review)

Scope: the whole application surface at the round-2 head — the telemetry chain
(`index.html` client telemetry → `api/telemetry.js` → Supabase RPC), the
repository automations (`.github/workflows/*.yml`), the local-storage/backup
paths, and the exam/vocabulary rendering surface. Every control listed here is
backed by a tracked test or a tracked script, not by an assertion in prose.

## 1. Credential leakage through telemetry notes (review round 2)

Threat: an error note quotes a credential verbatim (a failed `fetch` prints its
own `Authorization` header; a request error can carry a token in a URL), and a
diagnostics note becomes the way a secret leaves the device.

Controls, in the order the scrubber applies them:

| # | Threat shape | Control | Regression evidence |
| --- | --- | --- | --- |
| 1 | Classic GitHub tokens (`ghp_/gho_/ghu_/ghs_/ghr_…`) | pattern → `…` | existing suites, untouched |
| 2 | Fine-grained GitHub tokens (`github_pat_` + 22 + `_` + 59) | added to the GitHub pattern, both scrubbers | new tests (19 server / 147 client); mutant "github_pat pattern removed" killed |
| 3 | OpenAI-style keys (`sk-[proj-]…`) | pattern → `…` | existing tests |
| 4 | Bearer credentials with the full RFC 6750 alphabet (`+ / ~`, trailing `=`), any length | pattern → `…`, no minimum length | new tests; mutant "alphabet restricted again" killed |
| 5 | URL user-info with an empty username (`https://:password@host`) | user-info redacted, host kept | new tests; mutant "username required again" killed |
| 6 | Apostrophe inside URL user-info (RFC 3986 allows it) that previously survived the quote-split | secret patterns run BEFORE the quote split, both scrubbers | new tests; mutant "order swapped back" killed |

Mutation controls: `node scripts/mutation_cr_scrub.mjs` — 8/8 mutants killed
(one per fix per implementation); the clean tree passes both regression tests
first, so a kill means the test genuinely guards the fix
(`evidence/review-round/mutation_controls.log`).

Independence: the server re-scrubs every note (`scrub()` in
`api/telemetry.js`) so a client bypass does not reach the database; the two
pattern tables are kept textually in sync and both suites assert the same
cases.

## 2. Telemetry ingestion endpoint (`api/telemetry.js`)

| Threat | Control | Evidence |
| --- | --- | --- |
| Stored-payload tampering (client sends extra fields) | the stored payload is rebuilt from validated fields only; nothing is copied through | `telemetry-api.test.js` allowlist tests |
| Origin abuse | allow-list (`coderunknow.github.io`, documented localhost origins, `null` for `file://`); 403 otherwise | origin tests; live probe transcripts (preflight 204, foreign origin 403) |
| SQL injection | the function never composes SQL: the only privileged reach is the PostgREST RPC `telemetry_ingest`, called with a JSON body over HTTPS; the database function parameterises internally | PGlite harness runs the REAL SQL: the old function accepted an injection-shaped `client_key`, the hardened one rejects it (`pglite_rate_limit_evidence.mjs`) |
| Rate-limit exhaustion | hardened SQL function caps per-client (salted HMAC key, 5 stored for a keyless flood vs 120 stored on the old function) | same PGlite harness, both migrations |
| IP exposure | the address is only used to derive a truncated HMAC with `TELEMETRY_IP_SALT`; the stored/returned payload never carries it; missing/weak salt fails closed (503) | `telemetry-api.test.js` (salted-hash test, fail-closed test) |
| Prototype-pollution keys in counters | `TOKEN` regex rejects `__proto__`/`constructor` shapes; both suites assert | existing tests; `rt_scrub_baseline.mjs` section 3 |
| Oversized/malformed bodies | 16 KiB cap enforced while streaming (read stops at the cap), JSON parse failure → 400, non-JSON content-type → 415 | handler tests incl. streaming harness |
| Log leakage | no request body, header or IP is ever written to logs (grep `console.` in `api/telemetry.js` returns no request logging) | manual review, this round |

## 3. Repository automations (`.github/workflows/*.yml`)

| Threat | Control | Evidence |
| --- | --- | --- |
| Automatic production writes | `telemetry-smoke.yml` no longer triggers on `push` or `pull_request`; dispatch-only with a required boolean confirmation and a required deployment identity; checkout/probe steps additionally conditional; concurrency group serialises dispatches | `tests/test_telemetry_smoke_gate.py` (8 tests, parse the real YAML); negative control: re-adding a `pull_request` trigger fails the suite |
| Script injection via `${{ }}` in `run:` bodies | `scripts/scan_workflow_injection.mjs` scans all 8 workflows; interpolations of matrix keys whose values are scalar literals **defined in the same file** are the only allowlisted form (verified by parsing, not by trust); the clean tree passes; negative control injects `github.head_ref` and `github.event.pull_request.title` (block + inline forms) and both are detected | `evidence/review-round/workflow-injection-scan.json` |
| Mutable action refs | every `uses:` pins the repository's Node-24 40-char SHA; `tests/test_deploy_gate.py` enforces repo-wide | existing suite |
| Over-privileged tokens | each workflow declares `permissions:` (telemetry smoke: `contents: read`); PR #88 head reviewed this round | manual review + structural test |
| Duplicate production probes | concurrency group `telemetry-smoke-production`, `cancel-in-progress: false` (a queued duplicate stays visible and cancellable instead of racing) | structural test |

## 4. Local storage, backups and rendering

| Threat | Control | Evidence |
| --- | --- | --- |
| XSS through 106 exam transcriptions | transcription renderer escapes; no script tags / inline handlers in any transcription; browser suites assert escaping in a real DOM | `audit_rendering.mjs --check`; browser-exams assertions |
| XSS through vocabulary/phrase data | data is embedded JSON, rendered as text; the scrubber drops control characters | static-app tests |
| Corrupt / hostile localStorage | progress, exam history and prefs load through validators; unreadable stores fail closed to defaults (consent off, empty log) | static-app + exam-persistence tests |
| Backup/restore smuggling | restore validates structure and re-derives IDs; export contains learner data only (no credentials to leak) | exam-persistence tests; manual review this round |
| Telemetry consent | nothing is recorded or sent before an explicit opt-in; the report is a click-gated manual export | static-app telemetry tests |

## 5. Remaining externally-blocked security items (unchanged, disclosed)

* whether the **live** Supabase database runs the hardened `telemetry_ingest`
  function — needs live credentials (owner);
* the shared-project `compute_jobs` RLS exposure — owner/DBA action;
* Vercel project settings (env vars, deployment identity) — owner action.

These are environment dependencies, not code defects on this branch.
