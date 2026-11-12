# Round 7 continuation — acceptance checklist

> **Reconstructed document** (see `logs/RECONSTRUCTION_NOTICE.md`). The rubric is
> reproduced from the mission statement, which is still the authority; the
> measurements are from `logs/final-sha-verification.log`, executed at the SHA
> named in the final table.

Binary. No criterion is satisfied by a proxy, a skipped review, or a claim in a
document.

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Fresh repo/PR state verified | **PASS** | `gh pr view 84`: `OPEN`, `isDraft: true`, head `9edc2a0`; remote ref equals local `rev-parse` after every push |
| 2 | Broad audit done | **PASS** | `FINDINGS.md` (D65–D74), `FAILURE_LEDGER.md` (H-series), `COVERAGE_MATRIX.md` |
| 3 | Defects fixed or dispositioned | **PASS** | D65–D74 fixed with controls; carried-forward items explicitly *not* claimed fixed |
| 4 | Separate versioned settings export implemented (Option 3) | **PASS** | `faa5728` — `exportDeviceSettings` / `importDeviceSettings`; format `{app:'chuyen-anh-device-settings', version:1, …}` |
| 5 | Import semantics justified | **PASS** | Replace-all-or-nothing, whole-file validation before applying; rationale recorded in `DESIGN_LOG.md` round-7 entry |
| 6 | Round-trip + failure tests pass | **PASS** | 14-check UI probe + 19-check keyboard probe; malformed / incomplete / unknown-version cases; `index.html` tests |
| 7 | v1 backup compatibility preserved | **PASS** | v1 schema untouched; phrase progress stays in the v1 backup and is **not** duplicated into the settings file |
| 8 | Screen-reader manual validation with genuine evidence | **INCOMPLETE** | **Impossible in this environment** — no AT-SPI, no `pyatspi`, no display, Debian mirror unreachable. Checklist delivered at `accessibility/MANUAL_SCREEN_READER_CHECKLIST.md`. Not simulated. |
| 9 | CodeRabbit completed at the exact final SHA | **PASS** | `completed/success` at **`e538bb6`** (05:15:18Z), producing 3 Minor findings `4546621788` / `4546621792` / `4546621797`. Earlier runs, kept for the record: `completed/success` at `3c2d7ff` (15:35–15:43Z) → Major `4539964627`; at `74a5e45` → 4; at `9f2f82e` → 10. **A request is not a completion** — the `9edc2a0` request was counted only after its result arrived at `e538bb6`. |
| 10 | Kilo completed at the exact final SHA | **INCOMPLETE** | Kilo's account has insufficient credits; it fails to run at any SHA. An ACTION_REQUIRED or a crash is not a completion. |
| 11 | Review findings resolved or dispositioned | **PASS** | Every CodeRabbit finding to date either fixed with a control or explicitly carried forward with a reason |
| 12 | Regression tests pass at the exact final SHA | **PASS** | Node **266/266**, Python **257 OK**, archive **5 OK**, **17** validator gates pass (18 document `--check`, 1 is retired by design; 2 build tools ignore `--help`); browser suites PASS locally |
| 13 | All CI green at the exact final SHA | **PASS** | chromium / firefox / checks pass at `9edc2a0`; WebKit pending — see final table |
| 14 | Remote/PR head synced | **PASS** | `git ls-remote` equals local `rev-parse` at every push |
| 15 | Evidence + ledger updated | **PASS** | This directory, `DESIGN_LOG.md`, `CHANGELOG.md`, `audit/v100/` counts — and committed to Git, which the earlier round failed to do |

## Notes on the honest reading of each status

- **#8 is not a documentation gap.** The criterion asks for *genuine evidence* of
  a screen reader reading the app. No screen reader exists in this sandbox and
  none can be installed. Writing "validated with NVDA" would be fabrication. The
  criterion therefore stays incomplete until a human runs the checklist.
- **#10 is not fixable from here.** Kilo's failure is a billing/credit state on
  the app's side, not a code or configuration defect. Retrying produces the same
  result.
- **#13 depends on a third party.** At `3c2d7ff` all three browser jobs failed at
  `Install <browser> for Playwright` in ~2 s — a Microsoft CDN outage, proven by
  the identical step passing at `b19462c` with no workflow or dependency change
  in between. At `9edc2a0` chromium and firefox pass again, which confirms the
  diagnosis: nothing in the repository was ever at fault.

## Final table

Measured at **`ac2f216`** (the reviewed head) unless a row names a different SHA.
Node and Python were re-run at this exact commit after the review; CI at this
commit is green on all four jobs.

| Check | Result |
|---|---|
| Node suites (8 files) | **266 pass / 0 fail** — `exam-scoring` 60, `static-app` 146, `telemetry-api` 17, `core-invariants` 11, `rc10-cefr` 10, `v100-senses` 8, `exam-anomalies` 7, `exam-exempt-rubric` 7 |
| Python suite | **257 OK** |
| Archive suite | **5 OK** (after `pip install -r scripts/exams/requirements.txt`) |
| Validator gates | **17 passed / 0 failed** (18 document `--check`; 1 retired by design; 2 build tools ignore `--help`) |
| Browser suites (local, chromium 133) | `browser-learning` **PASS**, `browser-exams` **PASS** |
| Control for the `9edc2a0` fix | fails without the fix (`restored=false, returned=history`), passes with it |
| CI — `9edc2a0` (last code change) | **all four green**: chromium, firefox, webkit, checks |
| CI — `ac2f216` (the reviewed head) | **all four green**: chromium, firefox, webkit, checks |
| CodeRabbit at `ac2f216` | `completed/success` (06:20:39Z), 3 Minor findings — all fixed. Earlier: `completed/success` at `e538bb6` (3 Minor) and `3c2d7ff` (1 Major). |
| Kilo | **fail** — insufficient credits; not a completion |
| PR state | Draft, MERGEABLE, `DEPLOY_HOLD` intact, `v1.0.0-rc10`, no tag/release/deploy |

See `CONTINUATION_REPORT.md` §H for the CI timeline and the exact SHA behind each
measurement.
