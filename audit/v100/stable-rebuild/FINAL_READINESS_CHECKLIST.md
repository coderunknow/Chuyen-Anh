# FINAL READINESS CHECKLIST — `v1.0.0` stable candidate (`build/v100-stable-rebuild`)

Every row names the evidence that backs it. Binary checkboxes; an unticked row
means the check was not honestly completed. States: VERIFIED / FAILED /
BLOCKED / INCOMPLETE / NOT TESTED / EXTERNALLY BLOCKED.

| Category | Check | Evidence | Status |
| --- | --- | --- | --- |
| Baseline | Starting SHA verified live, branch cut from it | `BASELINE.md`; `git log -1 main` = `948f6f9` | `[x] VERIFIED` |
| Baseline | Mission premise "v1.0.0 tag exists" checked | API: 24 tags, none `v1.0.0` → collision N/A | `[x] VERIFIED` |
| Protected files | `AGENT.md`, `De-chuyen-Anh-vao-10/*.md` untouched; logs append-only | `git diff main --stat` (16 files, none of the protected set; log diffs are appends) | `[x] VERIFIED` |
| Tests — Python | 294/294 at the candidate head | session run log | `[x] VERIFIED` |
| Tests — Node | 306/306 (incl. 2 new tests + reconciled pins) | `/tmp` runs + checklist row `306/306` | `[x] VERIFIED` |
| Tests — archive | 5/5 | `scripts/exams/test_archive.py` | `[x] VERIFIED` |
| Validators | 21-command ci.yml block all exit 0 | validator run log | `[x] VERIFIED` |
| Tests — browser | Both suites green on Chromium 133 at baseline and at candidate head | `browser-exams-run.log`, `browser-learning-run.log`, `browser-suites-candidate.log` (session workspace) | `[x] VERIFIED (chromium only)` |
| Tests — Firefox/WebKit | Local run | sandbox cannot download engine libraries | `[ ] EXTERNALLY BLOCKED (CI covers at PR head)` |
| Defect D-SR1 | Repro → fix → mutation controls → post-fix green | `DEFECTS.md` D-SR1; `MUTATION-CONTROLS: OK` | `[x] VERIFIED` |
| Defect D-SR2 | Baseline repro (client+server) → fix → tests → mutation controls | `DEFECTS.md` D-SR2 | `[x] VERIFIED` |
| Security — XSS/renderer | 106 transcriptions, 0 script tags / inline handlers; live-DOM escaping asserted | `audit_rendering.mjs --check`; browser-exams assertions | `[x] VERIFIED` |
| Security — telemetry | Scrub hardening; allow-list rebuild; prototype-pollution keys dropped; origin/CORS contract | `telemetry-api.test.js` 18 tests; `rt_scrub_baseline.mjs` outputs | `[x] VERIFIED (mocked upstream)` |
| Security — live endpoint | Preflight 204 for published origin; GET 405; **no POST sent** | curl transcripts in session evidence | `[x] VERIFIED (read-only)` |
| Security — live telemetry POST end-to-end | Not sent (production-writing) | mission prohibition | `[ ] NOT TESTED (by design)` |
| Supabase — old vs hardened ingest | Real SQL of both migrations executed in PGlite; old exhaustion path + hardened behaviour demonstrated | `pglite_rate_limit_evidence.mjs`; `FAILURE_LEDGER.md` F-SR3 | `[x] VERIFIED (local DB)` |
| Supabase — live function version | Is the hardened function applied remotely? | no credentials; read-only metadata inaccessible | `[ ] EXTERNALLY BLOCKED` |
| Supabase — `compute_jobs` exposure | RLS-disabled table on shared project; owner decision required | mission finding; not modified, not read | `[ ] EXTERNALLY BLOCKED` |
| Vercel — deployment identity/settings/logs | Project inspection | no credentials in this environment | `[ ] EXTERNALLY BLOCKED` |
| Exam data — coverage recomputed | 106 / 6,708 / 5,155 / 1,553; 100% non-exempt; exact category split | `work/evidence/independent-exam-audit.json` | `[x] VERIFIED` |
| Exam data — curated hash bindings | 2,146/2,146 re-derived, 0 mismatches | same | `[x] VERIFIED` |
| Exam data — independent solving | 10-item deterministic sample: 8/8 verifiable agree; 2 listening/context items unclaimed | session transcript | `[x] VERIFIED (sample)` |
| Exam policy — listening contradiction | Mission text vs shipped behaviour (307 transcript-fallback items, LOW) | `FINAL_READINESS.md` §Open decisions | `[ ] BLOCKED (owner decision)` |
| Vocabulary — CEFR sample | 201/201 agree with pinned references | `work/evidence/independent-vocab-audit.json` + 3 manual checks | `[x] VERIFIED (sample)` |
| Vocabulary — full-sense audit | Every one of 8,928 senses independently re-checked | beyond this session's scope; `audit_sense_sources.py --check` (4,844/4,844) re-confirmed | `[ ] INCOMPLETE (validator-based, plus independent sample)` |
| Performance | Sizes unchanged; benchmark baseline vs candidate | 28,273,009 B raw / 3,093,228 B gzip both heads; 23.66 s vs 24.22 s median (~2%, noise); 0 page errors | `[x] VERIFIED (software-rendered sandbox)` |
| Performance — physical devices | Low-memory phone measurement | no device | `[ ] NOT TESTED` |
| Accessibility — automated | axe WCAG 2.1 AA suites in browser runs | browser-exams/browser-learning PASS | `[x] VERIFIED (chromium only)` |
| Accessibility — screen reader | Manual pass | no screen reader in sandbox | `[ ] EXTERNALLY BLOCKED` |
| Release gates | `deploy_gate` open on published hold; `app_release_gate` holds stable; release pipeline accepts exactly `v1.0.0` | gate runs; `release_artifacts.py` read | `[x] VERIFIED` |
| Release identity | `APP_VERSION='v1.0.0'`, `DEPLOY_HOLD='v1.0.0-rc11'`, dual-gate tests reconciled | diff; `HoldMarkerLifecycleTests` | `[x] VERIFIED` |
| CI on PR head | All required GitHub Actions jobs green on the exact head | pending push | `[ ] INCOMPLETE (runs after push)` |
| Code review | CodeRabbit status on the exact PR head | pending push | `[ ] INCOMPLETE` |
| Compliance | No merge/tag/release/deploy; no remote config or DB mutation; no production POST | session log | `[x] VERIFIED` |
