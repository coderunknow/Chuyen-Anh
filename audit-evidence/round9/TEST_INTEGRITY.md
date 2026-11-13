# Round 9 — test integrity

A test that has never been seen to fail is a hypothesis. Every test added or
changed this round was mutation-verified: the fix it guards was reverted, the test
was run, and the failure was recorded. All reverts were restored and re-run green.

## Suites run at this head

| Suite | Command | Result |
|---|---|---|
| Python unit | `python3 -m unittest discover -s tests -p 'test_*.py'` | **285 OK** |
| Node | `node --test tests/*.test.js` | **304 pass / 0 fail** |
| Archive conversion | `python scripts/exams/test_archive.py` (with `scripts/exams/requirements.txt`) | **5 OK** |
| Vocabulary + exam validators | the 21 commands in `ci.yml`'s "Check vocabulary sources and embedded HTML" | **all exit 0** |
| Gates | `scripts/deploy_gate.py`, `scripts/app_release_gate.py` | both `deploy=false … held` (correct under `DEPLOY_HOLD`) |
| Browser suites | `tests/run-browser-suites.sh` on 3 engines | **not run in this sandbox**, but **run on real runners**: 6/6 engine-suite jobs passed in `43376379586` (chromium/learning 7 m 04 s, firefox/learning 12 m 37 s, webkit/learning 13 m 14 s) |

Full transcripts: `audit-evidence/round9/application/local-verification.log`.

## Mutation table

Each mutation was applied to the real file, the guarding test was run, and the
file was restored. "Caught by" names the test that failed.

| # | Mutation | Expected | Observed |
|---|---|---|---|
| M1 | Re-type the 77-entry path list under `push:` instead of `paths: *ci-paths` | `AnchorAliasTests` fails | `FAILED (failures=1)` — `ci.yml declares anchor(s) ['ci-paths'] but never aliases them` |
| M2 | Change the browser job back to `bash tests/run-browser-suites.sh` (both suites, one job) | `test_a_job_runs_one_suite_not_both` fails | `FAILED (failures=1)` |
| M3 | Restore `path: \|` + `**/*.png` on the screenshot upload | `FailureArtifactTests` fails | `FAILED (failures=1)` |
| M4 | Delete the four workflow files from the CI path filter | `WorkflowFileCoverageTests` fails (2 tests) | `FAILED (failures=2)` |
| M5 | Neuter the failure capture in `browser-learning.cjs` (`const dir = null`) | `test_both_suites_honour_the_screenshot_directory_on_failure` fails | `FAILED (failures=1)` |
| M6 | Remove the `if [ "$#" -gt 0 ]` suite-argument handling from `run-browser-suites.sh` | `test_the_runner_script_accepts_a_single_suite` fails | `FAILED (failures=1)` |
| M7 | Remove `- "DEPLOY_HOLD"` from the shared path filter | `test_every_paths_filter_mentions_the_hold_marker` fails | `FAILED (failures=2)` (one per workflow filter block) |
| M8 | Delete `persist-credentials: false` from the `deploy.yml` checkout | `CheckoutCredentialTests` fails (2 tests) | `FAILED (failures=2)` |
| M9 | Remove the recorded measurement from the browser job comment | `OptimizationRegressionTests` fails | `FAILED (failures=1)` |
| M10 | Capture the screenshot from `main().catch` (after `finally` closed the browser) | a realistic stub shows the capture throwing | `could not capture a failure screenshot: Target page, context or browser has been closed` — **no file written**. Restored → the PNG is written |
| M11 | Report final metrics for an unfinished run | `SummaryScriptTests` fails | `FAILED (failures=1)` |
| M12 | Move the exams capture back outside `main()`'s try block | ordering test fails | `FAILED (errors=1)` |
| M13c | Make `block()` stop only at column 0 | `BlockExtractionTests` fails (2 tests) | `FAILED (failures=2)` |
| M14 | Remove the capture from the `freshWorld()` scenario blocks (8 sites) | `test_every_scenario_closes_its_browser_only_after_capturing` fails | `FAILED (failures=1)` |
| M15 | Delete the `failedPage = rc5` assignment | the strengthened tracking test fails | `FAILED (failures=1)` |
| M16 | Make the exam denominator `summary.total` instead of the scorable count | the new scorer-agreement test fails | `FAILED` — `not ok 14 - the real scorer agrees with every manifest count, all 106 papers` (plus two pre-existing tests, `pass 59 / fail 3`) |
| M17 | Count an exempt item as `incorrect` | the scorer-agreement test fails | `FAILED` (`pass 61 / fail 1`) |
| M18 | Award `1.5` credit for a correct item | the ceiling test fails | `FAILED` — caught by the pre-existing "choose two" partial-credit test (`pass 61 / fail 1`) |

After each restore: `Ran 22 tests … OK` / `Ran 28 tests … OK` / `node --test … 62 pass / 0 fail`.

**Two mutations initially reported green, and both were informative.** The first M8 attempt edited the wrong
slice and removed nothing, so the suite passed — indistinguishable from a broken
guard. It was re-run against a verified edit (`occurrences: 1` → `remaining: 0`)
and then failed as expected. Recorded here because a mutation that does not mutate
is the most dangerous kind of "proof".

The second (M13) removed a one-way parity assertion and nothing failed — because the
*bug that assertion was meant to catch* (an over-reaching `block()` helper) had
already been fixed. Deleting a redundant check proves nothing, so the mutation was
redone as M13c, reverting the helper itself, which the new fixture test catches.

## The screenshot proof that was initially wrong

The first version of the failure capture was verified with a stub whose
`browser.close()` did nothing, so the capture "worked" in the sandbox while being
guaranteed to fail on a real browser: Playwright closes pages on `browser.close()`,
and the capture ran in `main().catch`, i.e. *after* the `finally` that closes it.
CodeRabbit caught the ordering (PR #86); the stub was rebuilt to model the real
lifecycle — a closed page's `screenshot()` throws — and the old arrangement was
reproduced as failing (M10) before the new one was accepted. A stub that cannot
fail is not evidence.

## Probes promoted to permanent tests

Round 9's application checks were ad-hoc probes. Two of them are now tests, because
a probe proves a property today and a test proves it tomorrow:

- `rc9/r9: the real scorer agrees with every manifest count, all 106 papers` — the
  existing manifest test recomputed "usable" with its **own predicate**, so it
  checked the manifest against a second implementation of the same idea: both could
  drift from the grader and agree with each other. The new test asks
  `scoreExamSession` itself. It also asserts the archive totals (6,708 questions,
  5,155 scorable, 1,553 exempt) and that blanks are never reported as incorrect.
- `rc9/r9: answering every scorable item correctly reaches 100%, never more` — the
  ceiling and the floor on real data: no item may award more than full credit and
  an exempt answered item may never be marked wrong.

Mutations M16–M18 show both tests fail when the grader is broken.

## Behavioural (not just static) proofs

Static assertions on YAML are cheap; where a runtime claim was available it was
proven at runtime too.

1. **YAML actually parses and the alias resolves.** `yaml.safe_load` on the
   edited `ci.yml` yields `pull_request.paths == push.paths`, 81 entries each,
   with all eight workflow files present. A declared-but-broken anchor would raise
   a parser error here rather than in GitHub's UI.
2. **The failure screenshot is really written.** A stubbed `playwright-core` whose
   `goto()` throws was installed, then:
   - `BROWSER_SCREENSHOT_DIR=/tmp/shots node tests/browser-learning.cjs` →
     `failure screenshot written to /tmp/shots`, `learning-chromium-failure.png`
     created, exit 1.
   - Same for `browser-exams.cjs` → `exams-chromium-failure.png`, exit 1.
   - **Negative control:** without the variable, exit is still 1 and **no**
     directory or file is created — the default behaviour is unchanged.
3. **A bad suite path fails the job.** `bash tests/run-browser-suites.sh tests/nope.cjs`
   → `no such browser suite: tests/nope.cjs`, exit 1. A typo in a matrix value
   cannot produce a green job that ran nothing.
4. **Single-suite mode reaches the suite.** `bash tests/run-browser-suites.sh tests/browser-exams.cjs`
   prints `---- tests/browser-exams.cjs (chromium)` and then fails on the stub,
   which proves the argument is honoured (with a real browser it would run it).

## Changed expectations — and why

Two existing tests had to change. Neither was changed to make a red build green;
both were changed because the assertion encoded an implementation detail, and the
requirement was preserved or strengthened. Full reasoning in `DEFECTS.md`
(R9-05, R9-06).

| Test | Old assertion | New assertion | Requirement held? |
|---|---|---|---|
| `test_static_checks_cover_the_release_and_gate_scripts` | the dispatcher path appears **twice** | appears **once**, and both triggers cover it (alias or both lists) | Yes — strengthened: it now fails if the path leaves the shared filter |
| `paths_blocks()` helper | only recognised inline `- "…"` lists | also resolves `paths: *anchor` | Yes — it now checks the aliased filter it used to skip |

Test-count documents were updated (`263 → 285`, `268 → 290`, changelog
`263 OK → 285 OK`) because the suite genuinely grew by 22 tests; the repository's
own count tests compute the number rather than trusting the document, which is how
these rows were caught twice in one round.

## Tests NOT added, and why

- **No browser assertion was added.** The suites cannot run in this sandbox, so a new
  browser test would be unverified locally. The screenshot capture is the one
  browser change; it is proven with a stub plus a negative control, and the suites
  themselves were subsequently run green on all three engines by CI.
- **No test asserts a wall-clock number.** Timing assertions are flaky by nature.
  The optimization is measured by `scripts/ci_run_summary.py` on real runs and
  reported in `OPTIMIZATION_REPORT.md`, with the after-value marked `N/A` until a
  run exists.
- **No test hard-codes the workflow job count.** The matrix test asserts
  properties (all engines, both suites, one suite per job, `fail-fast: false`), so
  adding an engine or a suite does not require editing the test.

## Guardrails that remained intact

- No `continue-on-error` was added anywhere.
- No required check was made advisory.
- No assertion was deleted; one was tightened.
- No cache was introduced, so no stale-cache evidence path exists.
- `fail-fast: false` is asserted by test, not just present by accident.
