# Review dispositions — Round 9 (PR #86)

Head reviewed: `b8f2c11…` (the Round 9 head). Every comment below was read and
judged on the code, not accepted or dismissed wholesale.

## Review availability — the reasons, inspected

The instruction was to check the *actual* reason a reviewer skipped, and never to
infer quota exhaustion. Here is what the statuses actually said:

| Reviewer | Status | Real reason (read from the bot's own output) |
|---|---|---|
| **CodeRabbit** | first `skipped`, then **reviewed** | `Review skipped: manual review required for this OSS repository`, and the comment: *"This repository does not receive automatic reviews because it has fewer than 10 stars."* **Not quota** — an OSS policy threshold, with a documented manual trigger. Commenting `@coderabbitai review` started a real review, which then **completed successfully** and posted 8 actionable comments. |
| **Copilot** | `COMMENTED` (no findings) | *"Copilot was unable to review this pull request because the user who requested the review has insufficient remaining quota."* Quota, stated explicitly — and Copilot was not the first-choice reviewer anyway. |
| **Codex** (chatgpt-codex-connector) | `failed` | *"You have reached your Codex usage limits for code reviews."* Quota, stated explicitly. |
| **Kilo** | `action_required` | *"Kilo Code Review could not run — your account is out of credits."* It never reviewed. This is **not** approval evidence, as the round requires. |
| **Qodo** | paused | *"Qodo reviews are paused because your trial has ended."* |

Only CodeRabbit's output is treated as a review. The others produced no findings.

## CodeRabbit findings — 8 actionable comments

All eight were accepted. Five were defects in **this round's own work**, which is
the most useful outcome of the review.

Each fix cites **the commit that contains it**, not one shared SHA. Two rounds of
review moved that SHA twice (`b8f2c11` → `80e6248`), and a citation that points at
a commit where the defect still exists is a false claim.

| # | File | Severity | Finding | Disposition |
|---|---|---|---|---|
| 1 | `CHECKLIST.md` | Minor | Asset integrity was marked verified on digest *formatting* alone | **Accepted — real overclaim.** The row is split: `R9-B7` keeps the 106/106 recomputed `contentSha256` (a real check), and a new `R9-B7b` records that the 186 external asset digests were **not** verified against their bytes. `audit-probes.md` narrowed the same way. |
| 2 | `CHECKLIST.md` | Minor | `R9-B10`/`R9-B11` cited `2f686f7`, a commit whose CI had **no browser job** | **Accepted.** Both rows now cite run `43376379586` at `b8f2c11`, where all six engine-suite jobs actually passed. The evidence column says what ran, not just where the assertion lives. |
| 3 | `CHECKLIST.md` | **Major** | Fixed rows cited the **base** SHA, where the defect still existed | **Accepted.** Every row describing a Round-9 fix or run now cites `b8f2c11`, and the checklist header explains what the two SHAs mean. |
| 4 | `TEST_INTEGRITY.md` | Minor | Stale counts (`274`, `279`) after the suite grew | **Accepted.** Recounted, and all documents reconciled to **284** unit / **289** total. The stale-count class was fixed twice in one round, which is why the count tests exist. |
| 5 | `scripts/ci_run_summary.py` | Minor | Reported final metrics for an **unfinished** run; `--latest` did not filter | **Accepted — real bug, observed live.** It printed `wall-clock 0m10s` beside a 7-minute job during this round. Completed runs are now required before any metric is reported; `--latest` picks the newest *completed* run; `SummaryScriptTests` pins it; mutation M11. |
| 6 | `tests/browser-exams.cjs` | Minor | The screenshot ran in `main().catch`, i.e. **after** `finally` closed the browser | **Accepted — my capture was broken on real browsers.** Restructured: capture happens in a `catch` inside `main()`, before cleanup; both suites. Proven with a stub that models Playwright's lifecycle (M10), which the first stub did not. |
| 7 | `tests/browser-learning.cjs` | Minor | The capture targeted the *initial* page, not the failing scenario's | **Accepted.** `failedPage` now tracks the active page: initial, `freshWorld()` tabs, `rc5`, and the exams `file://` page. Guarded by `test_the_capture_tracks_the_page_of_the_failing_scenario`. |
| 8 | `tests/test_ci_workflow_integrity.py` | Minor | `block()` ran one trigger's body into the next, so the parity test could pass over unequal filters | **Accepted — the test was a no-op in the case it existed for.** `block()` stops at the next sibling key; parity is now checked in **both** directions; a fixture test (`BlockExtractionTests`) reproduces the divergence. Mutation M13c. |

### On finding 6, which matters most

My original verification used a stub whose `browser.close()` was a no-op, so the
capture appeared to work. A stub that cannot fail is not evidence — the same class
of mistake this round is meant to eliminate. The stub was rebuilt so that a closed
page's `screenshot()` throws, the **old** arrangement was reproduced as failing
(`Target page, context or browser has been closed`, no file written), and only then
was the new arrangement accepted.

## What was NOT changed in response to review

- No requirement was weakened. The two assertions that changed in this round
  (R9-05, R9-06) were already documented as *harness* defects where the old
  expectation encoded an implementation detail; both were preserved or
  strengthened, and both are mutation-verified.
- No check was made advisory, no `continue-on-error` added, no engine dropped.
- The reverted browser split was **not** re-litigated: CodeRabbit did not ask for
  it, and the measurement stands.

## Residual, honestly

- `R9-B7b` (asset digests over external bytes) is **not verified** and is marked so.
- Screen-reader validation is still `MANUAL_REQUIRED`; it was not performed.
- The exam-answer-key *contents* were cross-checked for bookkeeping consistency,
  not re-derived from the source PDFs.


## Second CodeRabbit review — final head `80e6248`

Four more comments, all accepted. One was another real defect in the screenshot
work, one was a weak assertion, two were citation/claim corrections.

| # | File | Severity | Finding | Disposition |
|---|---|---|---|---|
| 9 | `OPTIMIZATION_REPORT.md` | Minor | The diagnostics claim was too broad: a passing run never exercises failure capture or upload | **Accepted.** The table now says real PNGs locally **under a stub** and marks CI failure capture and artifact upload as **unverified**; the report has a "what this does not show" paragraph. |
| 10 | `CODE_REVIEW_DISPOSITION.md` / `CHECKLIST.md` | **Major** | `R9-C8` cited `b8f2c11`, where the screenshot bug still existed; the fix is in `80e6248` | **Accepted.** The row cites `80e6248`; rows generally no longer demand one shared SHA; the disposition document says each fix cites the commit that contains it. |
| 11 | `browser-learning.cjs` | Minor | `freshWorld()` scenarios close `world.ownBrowser` in their own `finally`, so the outer capture photographed a closed page | **Accepted; the earlier correction required follow-up.** The PR #86 follow-up wraps all **8** fresh-world scenarios in `withFreshWorldScenario`: on failure it awaits capture before its `finally` closes the scenario browser, then rethrows the original error. `fresh-world-failure.test.cjs` asserts this order and rejects a close-before-capture negative control; `test_ci_workflow_integrity.py` checks all eight call sites. This implementation is in the PR #86 follow-up, not attributed to `80e6248`. |
| 12 | `test_ci_workflow_integrity.py` | Minor | `count("failedPage = ")` counted the `let failedPage = null` declaration, so the test passed even with scenario tracking removed | **Accepted.** The current test checks actual page assignments for the fresh-world tab, `rc5`, and the exams `file://` page, and verifies each suite's outer capture precedes cleanup. The earlier M15 caught the declaration-count defect; no new mutation result is claimed for this follow-up version. |

### Lesson recorded

Findings 6, 11 and 12 are one failure mode: **a check that cannot fail**. A stub
whose `close()` did nothing, a capture placed after cleanup, and a count that
included a declaration all looked green. Every one of them was caught by review,
not by the tests, which is why the mutations were re-run against realistic
behaviour before the fixes were accepted.


## Coverage of the final head — stated precisely

CodeRabbit reviewed the **code** twice: at `b8f2c11` (8 comments) and at `80e6248`
(4 comments). Every one of the 12 was fixed.

The commits after `80e6248` are `c8b22d8` and `074c48c`. Their delta contains the
fixes for the second review round plus documentation:

```
tests/browser-learning.cjs            (freshWorld capture, 8 sites)
tests/test_ci_workflow_integrity.py   (stronger tracking + scenario-close tests)
CHANGELOG.md, audit/v100/…, audit-evidence/round9/**   (evidence only)
```

So the test-code changes made *in response to* CodeRabbit's second review have not
themselves been re-reviewed by CodeRabbit. They are small, mechanical, and guarded
by mutations M14 and M15, and CI is green at the final head — but the honest
statement is "the reviewed code plus a small, mutation-verified follow-up", not
"CodeRabbit approved the final head".

A third review round was deliberately not requested at that checkpoint: repeated
identical requests consume review budget. The statement above about the remaining
delta describes only the Round 9 checkpoint; it does not cover the later PR #86
sharding follow-up below.

---

## PR #86 follow-up — agent self-review and external-review status

**Source reviewed:** `6179b9a5b52ba2f4d143e9e2bf85c17ffd0477c5` (the code head before
this evidence-only closeout update). Its full matrix run `43552772561` completed
successfully, including the 15 browser cells and the `checks` job.

### Agent self-review scope and disposition

- **Exact-once partition:** reviewed `scripts/shard_browser_suite.mjs` against the
  checked 1-based ranges, phase-marker assertions, 3,418-line coverage, and
  missing/overlap negative controls. No source region is silently dropped by the
  generator; shared setup/helpers are explicitly regenerated per shard.
- **Coverage and local default:** reviewed the `3 × 5` engine/shard matrix and the
  wrapper's `PART` handling. All five learning regions run on each engine; part 5
  then runs the complete exam suite once on that engine. With `PART` unset, the
  wrapper still runs the complete unsharded learning suite followed by exams.
- **Failure lifecycle:** reviewed the fresh-world helper's `catch → capture →
  finally close` ordering, the eight wrapper call sites, and page targeting for
  fresh-world tabs, `rc5`, and the standalone exam page. The lifecycle test's
  negative control verifies that moving close before capture fails. No
  `continue-on-error` or engine omission was introduced.
- **Final-code verification:** Python `unittest` **291/291**, archive tests **5/5**,
  workflow integrity **23/23**, release-artifact tests **22/22**, shard/lifecycle
  Node tests **7/7**, and all eight workflow YAML files parsed. Four successful
  full-matrix runs are recorded in `actions/OPTIMIZATION_REPORT.md`; each was under
  600 seconds.

No additional issue was identified in this focused agent self-review. This is not
an independent human or third-party approval.

### External review checks on the reviewed code head

| Reviewer | Reviewed head / status | Observed reason | Disposition |
|---|---|---|---|
| Kilo Code Review | `6179b9a5`; `action_required` / failed | **“Insufficient credits to run review”** — “Review could not start because the account has insufficient credits.” | No review was performed; not approval or code-test success. [Check details](https://app.kilo.ai/code-reviews/cae5d019-ca6a-4b06-8e90-573050ec196d) |
| CodeRabbit | `6179b9a5`; `skipped` | **“Review skipped: manual review required for this OSS repository”** | No new CodeRabbit review of the sharding delta; earlier reviews at `b8f2c11` and `80e6248` are not evidence of approval for it. [Check details](https://github.com/coderunknow/Chuyen-Anh/pull/86/checks) |
| GitHub Copilot PR reviewer | Earlier head `b8462be6`; `COMMENTED` | “Copilot was unable to review this pull request because the user who requested the review has insufficient remaining quota.” | Comment reports no review; it predates the final code head and is not approval. [Reviewed commit](https://github.com/coderunknow/Chuyen-Anh/commit/b8462be6b628935d54f72bd2bbba745fd577be86) |

The prior CodeRabbit comments about fresh-world cleanup and active-page assertions
were rechecked and the disposition above is updated to the current helper and test
implementation. GitHub reports no review decision (`reviewDecision` is empty) and
`mergeStateStatus=UNSTABLE`. The final PR still needs a maintainer/independent
review; blocked, skipped, or quota-limited reviewers are recorded, not counted as
approvals or successful tests.

PR #86 remains open and non-draft. No merge, tag, release, publication, or
deployment occurred.


## PR #86 follow-up findings rechecked — code/test commit `316b5f9`

CodeRabbit's comments `4561322722` (the R9-C8 citation) and `4561322728` (the
`freshWorld()` cleanup path) were checked against the current implementation rather
than accepted from the review text alone.

- **R9-C8 citation and evidence:** `80e6248` contains the top-level
  capture-before-cleanup correction and the M10 lifecycle-stub evidence;
  `c8b22d8` contains the eight `freshWorld()` wrappers and the tested
  capture-before-close helper. The checklist now names both fix commits and the
  strengthened regression-test commit `316b5f9`. It continues to say that failure
  capture and artifact upload on an actual failing CI run are unverified: the
  successful GitHub jobs skip the upload step.
- **`freshWorld()` failure path:** `withFreshWorldScenario` invokes capture in its
  `catch` before its `finally` closes `world.ownBrowser`, then rethrows the original
  scenario error. All eight browser-learning scenarios use the helper. The updated
  test models a page that throws from `screenshot()` after close and writes a PNG
  signature only while open; its close-before-capture negative control fails. On
  code commit `316b5f9`, `node --test tests/fresh-world-failure.test.cjs
  tests/shard-browser-suite.test.mjs` passed **7/7**, and
  `python -m unittest tests.test_ci_workflow_integrity` passed **23/23**.
- These findings are addressed in the code and evidence, but no independent
  maintainer approval is inferred. The latest PR state still requires an
  independent review; green automation, a skipped bot, and an `action_required`
  reviewer are not approval.
