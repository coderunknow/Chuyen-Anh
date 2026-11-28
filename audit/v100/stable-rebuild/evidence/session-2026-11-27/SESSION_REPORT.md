# Session 5 — 2026-11-27 owner-review fix round (fresh evidence)

Operating base: session branch created from `main` `948f6f9`, fast-forwarded to
the PR head `2fd29c2ab20c43ba8a3091b9dc3b46a24fb10fa6` (session-4 evidence
intact), then fixed on top. Input: the owner's independent "Review By ChatGPT"
comment on PR #88 (2026-11-26) naming two confirmed code findings at `2fd29c2`.
Both were reproduced live before fixing; dispositions in
`audit/v100/stable-rebuild/DEFECTS.md` (CR-SR5-1..CR-SR5-4).

## 1. Reproductions (before any edit)

- **CR-SR5-1** — extracting the pre-fix scrubbers from `git 2fd29c2`:
  `https://alice-secret@localhost/api` and `https://alice-secret:@localhost/api`
  passed through client-side `scrubTelemetryText` unchanged (the e-mail rule
  cannot catch a single-label host); the server-side `SECRET_SHAPES` had the
  same gap, so no defence in depth. Raw output:
  `url-userinfo-scrub-evidence.txt` (§BASELINE).
- **CR-SR5-2** — running the pre-fix scanner (`git 2fd29c2`) without a `yaml`
  module: the poisoned multiline fixture (`run: |` body with
  `${{ github.event.pull_request.title }}`) produced **no** finding while the
  clean tree's safe inline `${{ matrix.browser }}` (ci.yml:212 at that head)
  WAS flagged — exit 1 on a clean tree, false negative on the poison. Raw
  output: `workflow-injection-negative-controls.txt`.

## 2. Fixes (full root causes in DEFECTS.md)

1. `api/telemetry.js` + `index.html` — URL user-info rule is now the whole
   component: `/([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+@/gi` (kept byte-identical in
   both files, comments in sync). Path `@` untouched (negative control).
2. `scripts/scan_workflow_injection.mjs` — exported `scanWorkflows()`
   (importable, no import-time side effects; CLI JSON + exit codes unchanged);
   no-parser fallback scans the FULL run text (block-scalar bodies with
   chomping/indent indicators, blank lines, comments, inline continuations)
   and applies the parsed walk's literal-matrix allowlist through a strict
   line scan that can never allowlist more than the parsed path; alias-valued
   `run:` flagged. New suite `tests/workflow-injection-scan.test.mjs` (10
   tests) wired into `ci.yml`.
3. `scripts/mutation_cr_scrub.mjs` — fixtures mirror the new rule; 2 new
   mutants per side; a load-breaking mutant is now LOAD-FAILURE (inconclusive)
   instead of a false kill.
4. `tests/requirements.txt` (PyYAML==6.0.4) — declared dependency of
   `tests/test_telemetry_smoke_gate.py`; installed by `ci.yml`/`deploy.yml`
   before `unittest discover`; the module skips with the reason when absent;
   new coverage contract test keeps both workflows honest.

## 3. Fresh verification at the session head (Node v22.22.3, Python 3.11.2)

| Check | Result |
|---|---|
| 21 validator commands (ci.yml checks block) | all exit 0 |
| Python `unittest discover` | **303 collected, 0 failures** (8 telemetry-smoke tests skip without PyYAML; with PyYAML in a venv: 303/303 pass) |
| Node static + telemetry suites | **308 pass / 0 fail** |
| Shard partition + failure-capture + injection-scan suites | **18 pass + 1 documented skip** (parsed-walk test without `yaml`) |
| Exam archive conversion (venv, pinned deps) | **5/5 OK** |
| Exam integrity probes (session-4 probe code, re-run) | 106 papers / 6,708 questions / 0 problems; alignment 6,708 unique IDs / 0 failures |
| Independent exam audit + transcript-fallback audit | `verdictOk: true` (2,146/2,146 bindings); 0 violations |
| Workflow-injection scan, fallback mode | 8 workflows, **0 findings** (`workflow-injection-scan-fallback.json`) |
| Workflow-injection scan, parsed walk (yaml@2.6.1 in a disposable venv) | 8 workflows, **0 findings** (`workflow-injection-scan-parsed.json`) |
| Negative controls (both modes) | poisoned block + inline fixtures detected, clean tree passes (`workflow-injection-negative-controls.txt`) |
| Mutation controls | **10/10 killed** after the harness hardening (`url-userinfo-scrub-evidence.txt`) |

## 4. Honest environment notes

- No browser binaries / no Playwright CDN egress in this sandbox: the browser
  suites did NOT run locally this session. Cross-engine coverage is delegated
  to CI on the pushed head (15 shards). The `index.html` delta is confined to
  the telemetry scrubber (2 comment lines + 1 regex literal) — no browser
  journey touches it.
- No screen reader / no physical low-memory device (unchanged residual).
- No Vercel/Supabase credentials (unchanged owner actions: redeploy
  `api/telemetry.js` so the scrub fix ships live; verify the Supabase
  hardening; remediate `compute_jobs`).
- No production telemetry POST was sent by this session; the live-endpoint
  probes remain read-only.
