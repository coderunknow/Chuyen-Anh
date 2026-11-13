# GitHub Actions optimization — Round 9

Measured baseline: `BASELINE.md` (run `43342769617`, log
`logs/jobs-baseline-43342769617.json`). Measurement tool:
`scripts/ci_run_summary.py` (new this round), so the "after" number is produced
by exactly the same code that produced the "before" number.

**Nothing in this report is a speed claim without a measurement.** Where the
after-value could not yet be measured on a real run it is marked `N/A` with the
reason, and the expected mechanism is described as a mechanism, not a result.

## What changed

### 1. One job per (engine, suite) instead of one job per engine

Before, each of three jobs ran **both** suites sequentially via
`tests/run-browser-suites.sh` with no argument. The wrapper still defaults to
sequential, but the job now passes exactly one suite file from the matrix, so
`browser (webkit) / learning` and `browser (webkit) / exams` run on **separate
runners at the same time**.

Per-engine suite split is only observable in the old run's totals (both suites
were logged under one step); the step took 437 s (chromium), 730 s (firefox) and
747 s (webkit). Summing is all we can say without the per-suite figures: the two
suites together took that long, so moving one of them onto its own runner takes
the critical path from `both` to `whichever is longer`. The measured after-value
is the point of the first post-change run.

### 2. The `push` path filter is an alias again

`paths: &ci-paths` was declared, then re-typed as 77 manual lines under `push:`
(never as `*ci-paths`), so the anchor did nothing and the two lists could drift
silently. `push` now uses `paths: *ci-paths`. This is a correctness fix, not a
speed fix — it has no effect on runtime.

### 3. Four workflow files are now covered by a trigger

`.github/workflows/{exam-sources,exam-validation,pages-smoke,telemetry-smoke}.yml`
were covered by no CI trigger path: editing them ran nothing. That is a defect in
both directions — it adds the runs that were missing (slightly more CI, which is
the point) and removes the "edited a workflow, CI stayed green" gap.

### 4. Failure diagnostics are collected, not pretended

The screenshot artifact globbed `**/*.png` while nothing set `BROWSER_SCREENSHOT`,
so it could only ever report *"no files found"*. Now the job exports
`BROWSER_SCREENSHOT_DIR` to a scratch directory, both suites capture the live page
in their failure handler, and the log is uploaded with `if: always()`.

### 5. `run-browser-suites.sh` accepts explicit suites

`bash tests/run-browser-suites.sh tests/browser-exams.cjs` runs one suite; no
argument keeps the old sequential default. A suite path that does not exist is a
hard failure, so a typo in a matrix value cannot silently run nothing.

## Before / after metrics

| Metric | Before (measured) | After | Basis |
|---|---|---|---|
| Wall-clock, whole workflow | **13 m 19 s** (range over 6 runs: 13 m 19 s – 17 m 49 s) | `N/A` — not yet measured | Needs one post-change run; the report is updated with the real number, not an estimate |
| Critical path (slowest job) | **13 m 16 s** (`browser (webkit)`) | `N/A` — not yet measured | Same |
| Browser jobs | 3 | 6 | Counted in `ci.yml` |
| Suites per browser job | 2 (sequential) | 1 | `ci.yml` passes `${{ matrix.suite.file }}` |
| Browser runner-seconds (sum of job durations) | **2,026 s** | `N/A` — expected to *rise* | Splitting adds per-run install cost; this is a trade of total compute for latency |
| Browser install time per job | 16–38 s | `N/A` — same steps per job | `npx playwright install --with-deps` per job, unchanged |
| `checks` job | 2 m 20 s | `N/A` — unchanged by design | No step added; the new test file is inside the existing `unittest discover` |
| Failure screenshot artifact | Always empty by construction | Real PNGs on failure | Verified locally (below) |
| Failure log artifact | Only a 40-line `tail` in console | Full log uploaded on every outcome | `if: always()` |
| Workflow files covered by a trigger | 4 of 8 | 8 of 8 | `tests/test_ci_workflow_integrity.py` |
| Duplicated trigger path lines | 77 (drifted copy) | 0 (aliased) | Same test |
| Billable minutes | not exposed | `N/A` | Public repository; the API reports no billing |

**The honest expectation**: wall-clock should drop toward the longer of the two
suites per engine, and total runner-seconds should rise because six jobs each pay
the browser-install cost. That is a latency/compute trade, and the report says so
rather than pretending the split is free.

## How the rules of this round were kept

- All three engines still run: `matrix.browser: [chromium, firefox, webkit]`.
- Both suites still run, on every engine: `matrix.suite` names both files.
- No `continue-on-error` anywhere; `fail-fast: false` was already present and is
  required so one engine's failure cannot hide the other five verdicts.
- No assertion was weakened. The two harness files that had to change are
  documented in `DEFECTS.md` (`R9-06`, `R9-07`) with the reasoning.
- No cache was added. The `checks` job takes ~5 s to set up Node and installs no
  packages; the browser jobs' `npm install` of two packages is bounded by the
  browser download, not the registry, so caching would add state to invalidate
  for no measured gain. Adding a cache and calling it faster would be the
  stale-cache-as-evidence failure this round forbids.

## Local verification of the diagnostics path

Run in the sandbox with a stubbed `playwright-core` that throws inside `goto`:

```
$ BROWSER_SCREENSHOT_DIR=/tmp/shots  node tests/browser-learning.cjs
Error: simulated navigation failure for the failure-capture test
failure screenshot written to /tmp/shots            → learning-chromium-failure.png
$ node tests/browser-learning.cjs                    → exit 1, no screenshot directory touched
$ BROWSER_SCREENSHOT_DIR=/tmp/shots3 node tests/browser-exams.cjs
failure screenshot written to /tmp/shots3           → exams-chromium-failure.png   (exit 1)
```

The negative control matters: without `BROWSER_SCREENSHOT_DIR` the suite behaves
exactly as before and writes nothing.
