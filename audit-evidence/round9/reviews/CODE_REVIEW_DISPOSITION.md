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
| 11 | `browser-learning.cjs` | Minor | `freshWorld()` scenarios close `world.ownBrowser` in their own `finally`, so the outer capture photographed a closed page | **Accepted — real bug, same class as finding 6 one level down.** All **8** scenario blocks now capture in their own `catch` before closing, photographing their own tab. Guarded by `test_every_scenario_closes_its_browser_only_after_capturing` (asserts close-count == capture-count) and mutation M14. |
| 12 | `test_ci_workflow_integrity.py` | Minor | `count("failedPage = ")` counted the `let failedPage = null` declaration, so the test passed even with scenario tracking removed | **Accepted — the assertion was vacuous.** It now checks the scenario-specific assignments (freshWorld tab, `rc5`, exams `file://`); mutation M15. |

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

A third review round was deliberately not requested: the round forbids repeatedly
sending identical review requests, and each request consumes the reviewer's own
budget. The remaining delta is a strict subset of what was already reviewed, at the
same design.
