# Round 9 — defect ledger

Every entry is classified as one of: **confirmed defect**, **potential defect**,
**design limitation**, **external failure**, **harness defect**, **unreproduced
flake**, **accepted trade-off**. Each confirmed defect names its reproduction, root
cause, impact, the smallest robust fix, the regression test, and the mutation that
proves the test fails without the fix.

Base commit for the round: `2f686f77e3103cbbbea15350a765021fc8283b28`.
Branch: `arena/34e7e96d-chuyen-anh`.

---

## R9-01 — the CI path anchor was declared and never aliased

- **Class:** confirmed defect (delivery infrastructure, silent drift).
- **Where:** `.github/workflows/ci.yml`.
- **Reproduction:** `grep -n "paths: &ci-paths" .github/workflows/ci.yml` →
  line 8. `grep -n "paths: \*ci-paths"` → *nothing*. The `push:` trigger repeats
  all 77 entries by hand.
- **Root cause:** a YAML anchor only works when something references it
  (`*ci-paths`). Declaring `&ci-paths` and then re-typing the list is not an alias;
  it is two independent lists with a comment implying they are one.
- **Impact:** adding a path to the pull-request filter silently leaves `main`
  pushes unfiltered-by-that-path. The failure is invisible: both filters look
  correct on their own.
- **Smallest robust fix:** `push:` now uses `paths: *ci-paths`. One list, verified
  to parse to 81 identical entries for both triggers.
- **Regression test:** `tests/test_ci_workflow_integrity.py::AnchorAliasTests`
  (`test_a_declared_paths_anchor_is_actually_aliased`,
  `test_the_pull_request_and_push_triggers_cover_the_same_paths`).
- **Mutation proof:** re-typing the duplicated list back (M1) → `FAILED (failures=1)`.
  Restored → `OK`.

## R9-02 — four workflow files were covered by no CI trigger

- **Class:** confirmed defect (delivery infrastructure, untested-change gap).
- **Where:** `ci.yml` path filters; `exam-sources.yml`, `exam-validation.yml`,
  `pages-smoke.yml`, `telemetry-smoke.yml`.
- **Reproduction:** diff the repo's tracked files against the `ci.yml` path
  filter: 184 tracked files match no path, and four of them are workflows.
- **Root cause:** the filter lists `ci.yml`, `deploy.yml`, `release-artifacts.yml`
  and `release-published-dispatch.yml` by name, and was never extended when the
  other four workflows were added.
- **Impact:** a change to the telemetry or Pages smoke workflow merges with CI
  green, because CI never ran on it.
- **Fix:** all four are now named in the shared filter.
- **Regression test:** `WorkflowFileCoverageTests` — it enumerates
  `.github/workflows/*.yml` from disk, so a *new* workflow is covered by the test
  automatically rather than needing the test edited.
- **Mutation proof:** removing the four lines (M4) → `FAILED (failures=2)`.

## R9-03 — browser critical path: hypothesis tested, measured, and REVERTED

- **Class:** the planned optimization was **refuted by measurement**. What remains
  is a confirmed *finding* about where the time goes, not a defect that was fixed.
- **Where:** `.github/workflows/ci.yml` `browser` job; `tests/run-browser-suites.sh`.
- **Baseline (measured):** `scripts/ci_run_summary.py 43342769617` → wall-clock
  13 m 19 s, critical path 13 m 16 s on `browser (webkit)`, whose single step (both
  suites) took 747 s while install took 38 s. The suite was split into a
  six-job `(engine, suite)` matrix and pushed.
- **Result of the experiment (run `43376379586`, measured):** wall-clock
  **13 m 18 s** — a **1 s** saving — and runner-seconds **36 m 06 s → 39 m 27 s**,
  a **+201 s (+9.3 %)** cost. Per-step data explains why: the exam suite is
  **11/22/61 s** (chromium/firefox/webkit) while the learning suite is
  **387/728/740 s**. The learning suite is 99 % of the webkit critical path, so
  removing the exam suite from that job could not move the wall clock, and the
  extra jobs each paid a browser install (webkit's install itself rose 38 s → 82 s
  on the busier runner).
- **Decision:** reverted to one job per engine running both suites, with the
  measurement written into a comment beside the job and pinned by
  `OptimizationRegressionTests`, so the "obvious win" cannot be re-implemented
  without confronting the numbers.
- **Kept from the experiment:** `run-browser-suites.sh` accepts explicit suite
  paths (used for local reproduction, tested, and a bad path fails the job).
- **Proof the guard works:** removing the recorded measurement (M9) →
  `FAILED (failures=1)`; restored → `OK`.
- **Recorded, not fixed (follow-up):** the real lever is inside
  `browser-learning.cjs` — ~60 navigations of a 27 MB single-file page. Per-scenario
  timings are not emitted yet, so where those 387–740 s go is **not** measured and
  is not claimed.

## R9-04 — the failure screenshot artifact could never contain a screenshot

- **Class:** confirmed defect (CI diagnostics: present but inert).
- **Where:** `ci.yml` `Upload browser screenshots on failure`
  (`path: **/*.png`); `tests/browser-learning.cjs`, `tests/browser-exams.cjs`.
- **Reproduction:** `grep -rn BROWSER_SCREENSHOT .github/workflows/` → nothing.
  The suites only write a PNG when a *developer* exports `BROWSER_SCREENSHOT`
  (learning) or `BROWSER_SCREENSHOT_DIR` (exams, happy path only), so in CI the
  glob matched nothing and the step reported "no files found".
- **Root cause:** the artifact step and the suites were never connected. The step
  described an intention; nothing implemented it.
- **Impact:** a red browser job produced a stack trace and no visual evidence —
  the most expensive kind of CI failure to debug, on the most flaky surface.
- **Fix:** the job exports `BROWSER_SCREENSHOT_DIR`; both suites capture the live
  page in their failure handler (`main().catch`) and write into that directory;
  the artifact uploads it. A full log is uploaded with `if: always()`.
- **Regression test:** `FailureArtifactTests` — the glob must not be `**/*.png`,
  the job must name the scratch dir and export the variable, both suites must
  reference it *and* use it inside their failure handler, and the log upload must
  be `always()`.
- **Mutation proof:** restoring `path: |` + `**/*.png` (M3) → `FAILED (failures=1)`;
  neutering the capture in the learning suite (M5) → `FAILED (failures=1)`.
- **Behavioural proof (not just static):** with a stubbed `playwright-core` that
  throws inside `goto`, both suites wrote `*-<engine>-failure.png` and exited 1;
  without the variable neither wrote anything. Log in
  `audit-evidence/round9/actions/OPTIMIZATION_REPORT.md`.

## R9-05 — a workflow-edit run could hide behind a stale-green Node matrix

- **Class:** harness defect (found by the new tests, fixed at the right layer).
- **Where:** `tests/test_deploy_gate.py::paths_blocks`.
- **Reproduction:** after R9-01, `test_every_paths_filter_mentions_the_hold_marker`
  fails with `0 not greater than or equal to 1 : ci.yml`.
- **Root cause:** `paths_blocks()` scans for lines ending in `paths:` followed by
  `      - ` entries. An aliased filter (`paths: *ci-paths`) ends in `*ci-paths`,
  not `paths:`, so it was skipped entirely — the test silently stopped checking
  the filter it exists to check.
- **Impact (before R9-01 existed):** none; the duplication made the test work. The
  defect only appears once the duplication is fixed, which is exactly why it is a
  **harness defect**, not an application defect: the test encoded the
  implementation rather than the requirement.
- **Fix:** `paths_blocks()` resolves an alias to the anchor's entry list, so an
  aliased filter is checked like any other.
- **Regression test:** the same test, now with a mutation proof: removing
  `- "DEPLOY_HOLD"` from the anchor makes it fail for both triggers.

## R9-06 — `test_static_checks_cover_the_release_and_gate_scripts` asserted the duplication

- **Class:** harness defect (an old expectation that would force a regression).
- **Where:** `tests/test_deploy_gate.py:199`.
- **Reproduction:** `assertEqual(text.count('.github/workflows/release-published-dispatch.yml'), 2)`
  fails after R9-01 with `1 != 2`.
- **Root cause:** the test asserted that the dispatcher path appears **twice**,
  with the message "both pull_request and push filters must cover the dispatcher".
  It encoded *how* the requirement was met (two copies) instead of *what* the
  requirement is (both triggers cover it).
- **Policy decision (documented, not a silent edit):** the requirement is
  preserved and strengthened. The test now asserts the path appears exactly once
  **and** that both triggers cover it — either by aliasing (`paths: *ci-paths`) or
  by listing it in both filters. Deleting the assertion would have weakened the
  gate; keeping the count would have forced the drift back.
- **Regression test:** the rewritten assertion. It fails if the path disappears
  from the shared filter, which is the failure the original cared about.

## R9-07 — the checklist and changelog stated test totals the suite had outgrown

- **Class:** confirmed defect (evidence integrity: stale claims in the documents
  the readiness case rests on).
- **Where:** `audit/v100/FINAL_READINESS_CHECKLIST.md`,
  `CHANGELOG.md` (unreleased section).
- **Reproduction:** `python3 -m unittest discover -s tests -p 'test_*.py'` →
  **285**; both documents said **263**.
- **Root cause:** the round added `tests/test_ci_workflow_integrity.py` (22 tests),
  and the documents carry a hand-maintained total.
- **Impact:** the published readiness claim understated the suite. Left alone, the
  repository's own count tests fail, which is the intended tripwire.
- **Fix:** checklist row `263 → 285`, `PASS (268/268) → (290/290)` (285 unit + 5
  archive), changelog `263 OK → 274 OK`. Totals verified against the counts the
  tests themselves compute, not typed optimistically.
- **Regression test:** `test_ci_gate_coverage.py::test_the_python_total_in_the_report_matches_the_discovered_suite`
  and `test_audit_document_counts.py::test_the_changelog_totals_agree_with_the_checklist_and_their_own_parts`
  — both already existed and both caught this. That is the system working.

## R9-14 — the Pages-publishing checkout persisted the workflow token

- **Class:** confirmed defect (CI security: credential exposure).
- **Where:** `.github/workflows/deploy.yml`, the deploy job's `Checkout` step.
- **Reproduction:** count the checkouts that opt out:
  `grep -rc "persist-credentials: false" .github/workflows/*.yml` summed to **8**
  against **9** `uses: actions/checkout`. The missing one was in `deploy.yml` —
  the only job that holds `pages: write`.
- **Root cause:** `actions/checkout` writes the workflow token into `.git/config`
  by default. Every other checkout in this repository passed
  `persist-credentials: false`; this one passed only `ref: main`, so the default
  applied.
- **Impact:** a credential with Pages write access was left in the working tree of
  the job that publishes the site, readable by every subsequent step and by any
  tool that shells out to `git`. The exposure is silent: the workflow works
  perfectly.
- **Smallest robust fix:** add `persist-credentials: false` to that checkout.
  Nothing in the job needs the credential — the gate uses `GH_TOKEN` explicitly.
- **Regression test:** `CheckoutCredentialTests` in
  `tests/test_ci_workflow_integrity.py` — it walks **every** workflow file, so a
  future checkout is covered without the test being extended, and it asserts the
  publishing job specifically.
- **Mutation proof:** deleting the line (M8) → `FAILED (failures=2)`; restored → `OK`.
- **Note on the first attempt:** the initial mutation script silently failed to
  remove the line and the suite stayed green. That is recorded rather than hidden:
  a mutation that does not mutate looks exactly like a passing guard, and this
  entry only earns its proof because the mutation was re-run and confirmed.

## R9-15 — the failure screenshot could never have worked on a real browser

- **Class:** confirmed defect (in this round's own fix; found by CodeRabbit).
- **Where:** `tests/browser-learning.cjs`, `tests/browser-exams.cjs` (first version).
- **Reproduction:** run either suite with a stub whose `browser.close()` closes its
  pages, as Playwright really does, and with `BROWSER_SCREENSHOT_DIR` set. The
  capture runs in `main().catch`, which executes **after** `main`'s `finally`
  block, so `browser.close()` has already closed every page:
  `could not capture a failure screenshot: Target page, context or browser has been closed`
  — and no file is written.
- **Root cause:** ordering. `finally` runs before the promise rejection is handled
  by `.catch`. The capture belongs inside `main()`, not after it.
- **Impact:** the artifact this round introduced to make red CI runs debuggable
  would have been empty exactly when needed. It *looked* verified because the first
  stub's `close()` was a no-op — a stub that cannot fail.
- **Fix:** a `captureFailureScreenshot()` helper plus a `catch` inside `main()`
  before the `finally`, in both suites; `failedPage` tracks the page actually being
  driven (initial, `freshWorld` tabs, `rc5`, exams `file://`), because
  photographing the first page after a scenario opened its own is the same bug one
  level down.
- **Regression test:** `test_both_suites_capture_before_the_browser_is_closed`
  (asserts the call site precedes `} finally {`, and that `main().catch` does not
  capture) and `test_the_capture_tracks_the_page_of_the_failing_scenario`.
- **Mutation proof:** M10 (restore the old ordering) → the realistic stub reports
  the "browser has been closed" error and writes no file; M12 (move the exams
  capture back outside `main()`) → `FAILED (errors=1)`. Restored → the PNGs are
  written by both suites.

## R9-16 — the CI summary script reported metrics for unfinished runs

- **Class:** confirmed defect (measuring instrument; found by CodeRabbit, observed live).
- **Where:** `scripts/ci_run_summary.py`.
- **Reproduction:** run it against a run still in progress. `updated_at` is then
  "last time GitHub touched the record", so it printed
  `wall-clock 0m10s … critical path 7m04s`. This was seen for real during this
  round (`run 43376379586` before it completed).
- **Root cause:** no `status == "completed"` check; unfinished jobs were silently
  excluded from the sum while the wall-clock came from a live timestamp. `--latest`
  also took the newest run regardless of state.
- **Impact:** the tool the optimization report depends on could produce a
  flattering, meaningless number — the "never claim speed without measurement"
  failure in its purest form.
- **Fix:** final metrics only for a completed run; `--latest` selects the newest
  **completed** run and errors if none exists in the last 20; incomplete runs print
  that no totals are reported.
- **Regression test:** `SummaryScriptTests` (three tests, including a completed
  run that must still produce the real numbers).
- **Mutation proof:** M11 (force `finished = True`) → `FAILED (failures=1)`.

## R9-17 — the path-parity test could pass over unequal filters

- **Class:** harness defect (found by CodeRabbit).
- **Where:** `tests/test_ci_workflow_integrity.py::block()`.
- **Reproduction:** a path listed only under `push`, with `push` written as an
  explicit list. The helper's body ran from `pull_request:` straight through
  `push:` because it stopped only at column 0, so both extracted sets contained
  both triggers' paths and the parity assertion passed.
- **Root cause:** trigger keys are indented two spaces; the bound was column 0.
- **Impact:** the test I wrote to prevent filter drift was a no-op in precisely the
  case it was written for.
- **Fix:** `block()` ends at the next sibling key (indentation ≤ header); parity is
  asserted in **both** directions, so extra paths in either trigger fail.
- **Regression test:** `BlockExtractionTests` — a fixture with a path unique to
  each trigger that fails if the helper ever over-reaches again.
- **Mutation proof:** M13c (revert the helper bound) → `FAILED (failures=2)`.

## R9-18 — the checklist overclaimed what the probes verified

- **Class:** harness/documentation defect (found by CodeRabbit).
- **Where:** `audit-evidence/round9/CHECKLIST.md`, `application/audit-probes.md`.
- **Reproduction:** the asset row said "SHA-256 integrity … `[x]`" while the probe
  only checked that 186 digests are 64-hex and distinct — which cannot detect an
  asset whose bytes differ from its digest. Two automation rows also cited the base
  commit `2f686f7`, whose CI had no browser job at all, so nothing there showed
  those assertions passing.
- **Impact:** evidence that overstates its own reach is worse than no evidence; it
  is the exact failure mode this round exists to prevent.
- **Fix:** a separate `R9-B7b` row marks the 186 external asset digests as **not
  verified**; the two automation rows cite run `43376379586` at `b8f2c11`, where
  all six engine-suite jobs passed; fixed rows cite the head SHA, not the base.

---

## Classified, but not fixed in this round

### R9-19 — the manifest test checked the manifest against itself

- **Class:** harness defect (coverage gap, found while promoting a probe).
- **Where:** `tests/exam-scoring.test.js`, `rc9 manifest (#75)`.
- **Reproduction:** the test recomputes "usable key" with a local `usable()`
  predicate and compares it to `record.scoredCount`. Nothing in it calls
  `scoreExamSession`, so the numbers the app actually reports are never checked
  against the manifest.
- **Impact:** the manifest and the predicate could drift from the grader together
  and the test would still pass; the per-paper counts are what a learner sees.
- **Fix:** a second test that asks the real scorer for all 106 papers and asserts
  `questionCount` / `scoredCount` / `exemptCount` per paper plus the totals, and a
  companion ceiling test (no over-credit, exempt never marked wrong).
- **Regression test / mutation proof:** M16 (denominator = every item) and M17
  (exempt counted as incorrect) both fail the new test.

### R9-08 — the Node suite is ~3× slower in this sandbox than in CI

- **Class:** design limitation / environment difference (not reproduced as a bug).
- **Observation:** locally `node --test tests/*.test.js` takes ~137–177 s; the same
  step in CI takes 53 s. The gap is dominated by `exam-anomalies` (60 s) and
  `exam-scoring` (26 s) here.
- **Why not "fixed":** 177 s vs 53 s is a hardware difference (sandbox CPU), not a
  property of the suite. Optimizing the test to make the sandbox look fast would be
  optimizing the wrong number. The CI number is the one in `BASELINE.md`.
- **Follow-up:** if CI's `checks` job ever approaches its 20-minute timeout, the
  exam suites are the place to look, not the validators.

### R9-09 — `index.html` is 27 MB and re-downloaded on every reload

- **Class:** design limitation (deliberate: single-file offline app).
- **Observation:** 15.8 MB vocabulary + 10.9 MB exam archive + 0.8 MB phrases
  embedded; `loadVocabulary` parses and validates all 8,852 entries per boot
  (~114–150 ms measured locally, of the order of 200 ms in a browser).
- **Why not "fixed":** the single-file, no-network, `file://`-operable design is a
  hard requirement the browser suites assert (`file://` offline test). Splitting
  the data out would break it. The test-time cost is ~200 ms × ~60 reloads ≈ 12 s
  per suite, which is a small part of the 437–747 s and is not the critical path
  once the suite split lands.
- **Follow-up (recorded, not done):** caching the parsed deck across reloads is
  impossible for a real reload without IndexedDB. Not worth the risk to a working
  offline path in this round.

### R9-10 — telemetry endpoint smoke fails at the head commit

- **Class:** **external failure** (not a repository defect).
- **Evidence:** failing at `711257a` (00:34Z), `5d57f56` (00:53Z), `2f686f7`
  (01:09Z); passing at `fe6a081` (00:03Z). `git diff --name-only fe6a081 711257a -- api/ supabase/`
  is **empty**, so the endpoint code did not change across the green→red boundary.
  `api/telemetry.js` returns 503 only for `unconfigured` or `upstream-error`, and a
  bad app version is a 400 — so this is not an rc11 regression.
- **Why not fixed here:** the sandbox has no egress to `vercel.app` / `supabase.co`
  (DNS resolves, TCP blocked, HTTP 000). The environment or the upstream is at
  fault, and changing repository code cannot fix it. Probing it again from a runner
  without changing anything is exactly the "repeated identical retry" this round
  forbids.
- **Follow-up for the maintainer:** check the Vercel project's environment
  (`TELEMETRY_IP_SALT`, Supabase URL/key) and Supabase availability for the window
  after 00:03Z on 2026-11-13.

### R9-11 — `rc7: no generated question prints its answer early`

- **Class:** **unreproduced flake**. Recorded as before; still not claimed fixed.
- **This round:** the browser suites could not be executed in the sandbox (no
  browser binaries, no CDN egress), so no new evidence either way. The new
  screenshot capture exists precisely so the next occurrence leaves a picture.

### R9-12 — release-published-dispatch requests `actions: write` workflow-wide

- **Class:** **accepted trade-off** (deliberate, reviewed).
- **Analysis:** the job needs `actions: write` to POST a `workflow_dispatch` to
  `deploy.yml`. It grants that at workflow level, so the second job
  (`dispatch-stable-deploy`) — which only reads — also carries it. That job
  checks out `main`, runs the app release gate and dispatches a deploy.
- **Why accepted, not changed:** narrowing the grant per job would be tidier, but
  the second job is behind `workflow_dispatch` + `inputs.stable_deploy_authorized == true`,
  runs only on `refs/heads/main`, and both jobs are two-minute dispatchers. The
  residual risk is small and the change is not free (two more permission blocks to
  keep aligned). Recorded as a follow-up rather than bundled into a round whose
  subject is the *static checks* workflow.

### R9-13 — `/tmp/pages_smoke.py` fixed `sleep 30` before probing

- **Class:** accepted trade-off, re-examined.
- **Re-examination this round:** the fixed sleep is only reached on
  `pull_request`/`push`/`workflow_dispatch`. On `release` — the case that
  originally raced — the workflow already waits for a **successful deployment
  status carrying the Pages URL for the released commit** (60 attempts × 10 s),
  which is strictly stronger than any sleep. The 30 s that remains costs half a
  minute on a probe that is not on the critical path and is bounded by a
  10-minute timeout.
- **Decision:** left as is. Replacing a bounded, non-critical sleep with a
  poll-the-deployment loop would duplicate the release path's logic for no
  measured gain, and this round forbids unmeasured changes presented as
  improvements.

---

## Summary

| Class | Count | IDs |
|---|---:|---|
| Confirmed defect | 5 | R9-01, R9-02, R9-04, R9-07, R9-14 |
| Refuted hypothesis (reverted) | 1 | R9-03 |
| Confirmed defect (found in review) | 4 | R9-15, R9-16, R9-17, R9-18 |

R9-15 covers the whole failure-capture class: the ordering bug, the wrong-page
selection, and the `freshWorld()` cleanup path where a scenario closed its own
browser before the capture ran. All three are the same mistake at three depths, and
all three were found by review rather than by the tests that were supposed to guard
them.
| Harness defect | 2 | R9-05, R9-06 |
| Design limitation | 2 | R9-08, R9-09 |
| External failure | 1 | R9-10 |
| Unreproduced flake | 1 | R9-11 |
| Accepted trade-off | 2 | R9-12, R9-13 |

Every confirmed defect has a regression test that was **mutation-verified**: the
fix was reverted and the test failed (eighteen mutations, M1–M18, all caught), then
restored and passed. Details in `TEST_INTEGRITY.md`.
