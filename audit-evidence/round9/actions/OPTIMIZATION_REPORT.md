# GitHub Actions optimization — Round 9

This report leads with the result because the result was not what was expected.
The optimization was **tried, measured, and reverted**. The defects found on the
way are kept and fixed.

Measured with `scripts/ci_run_summary.py` (new this round), so the before and after
numbers come from the same code reading the same API.

| Run | Head | Jobs | Wall-clock | Critical path | Runner-seconds |
|---|---|---|---:|---:|---:|
| `43342769617` | `2f686f7` | 4 | **13 m 19 s** | 13 m 16 s (`browser (webkit)`) | **36 m 06 s** |
| `43376379586` | `b8f2c11` | 7 | **13 m 18 s** | 13 m 14 s (`browser (webkit / learning)`) | **39 m 27 s** |

**The split saved 1 second and cost 201 runner-seconds.** It has been reverted.

## What was tried

The hypothesis, from the baseline: each browser job ran both suites sequentially,
so one job per `(engine, suite)` would put the exam suite on its own runner and
shorten the critical path. The plan was written into `BASELINE.md` as a
*plan*, not a result, precisely so it could be tested rather than asserted.

The change was implemented (six-job matrix, explicit suite argument), pushed, and
run as `43376379586`. Two new jobs in the matrix were visible immediately:

```
browser (chromium / exams)   pass   45s
browser (firefox  / exams)   pass   50s
```

That was the first sign the premise was wrong. The per-step timings settled it:

| Engine | Old: both suites, one step | New: learning step | New: exams step | Saved |
|---|---:|---:|---:|---:|
| chromium | 437 s | 387 s | **11 s** | 50 s |
| firefox | 730 s | 728 s | **22 s** | 2 s |
| webkit | 747 s | 740 s | **61 s** | **7 s** |

The exam suite is **11–61 s**. The learning suite is **387–740 s** — it is *99 %*
of the webkit critical-path step. Splitting off a 7-second tail from a 12-minute
step cannot move the wall clock, and the wall clock is set by webkit, which was
already the slowest job before the change.

Meanwhile the split added three jobs, each paying its own browser install — and
the webkit install itself went from **38 s to 82 s** on the busier runner:

| Engine | Install before | Install after |
|---|---:|---:|
| chromium | 23 s | 24 s |
| firefox | 16 s | 19 s |
| webkit | 38 s | **82 s** |

So the honest conclusion is the opposite of the plan: **the browser work is
dominated by the learning suite's interaction time, and adding runners cannot
divide it.** The correct lever would be inside `browser-learning.cjs` (it drives
~60 page loads of a 27 MB single-file page), not in the workflow's job graph.

## What was reverted, and what was kept

**Reverted:** the `(engine, suite)` matrix. The job is again one per engine,
running both suites sequentially — and now carries a comment recording the
measurement so the "obvious win" is not re-implemented unmeasured.

**Kept (all measured or mechanically verified, none of them speed claims):**

1. **R9-01** — `push` uses `paths: *ci-paths` instead of a hand-copied 77-line
   duplicate. Correctness, not speed.
2. **R9-02** — all eight workflow files are now covered by a trigger. This
   *adds* CI runs (that is the point: those files were unverified).
3. **R9-04** — failure diagnostics collect real files. Verified end to end below.
4. **R9-14** — the `deploy.yml` checkout no longer leaves the token in
   `.git/config`.
5. **`run-browser-suites.sh` accepts explicit suite paths.** Not used by CI now,
   but it is how a developer reproduces one suite, it is covered by a test, and a
   non-existent path fails the job instead of running nothing.

Net effect on the workflow's runtime: **none, and that is the honest number.**
The gains this round are correctness, security and diagnostics.

## Measurement table (required format)

| Metric | Before | After | Basis |
|---|---|---|---|
| Wall-clock, whole workflow | 13 m 19 s | **13 m 18 s** | `ci_run_summary.py` on runs `43342769617` / `43376379586`; both real |
| Critical path | 13 m 16 s (`browser (webkit)`) | **13 m 14 s** (`browser (webkit / learning)`) | same |
| Browser jobs | 3 | 3 (was 6 mid-experiment, reverted) | `ci.yml` |
| Suites per browser job | 2 | 2 | `ci.yml`; reverted to the measured-better shape |
| Exam suite cost | unknown (bundled) | **11 / 22 / 61 s** per engine | per-step API data |
| Learning suite cost | unknown (bundled) | **387 / 728 / 740 s** per engine | per-step API data |
| Browser runner-seconds | 2 026 s | **2 367 s** (experiment) | measured; the experiment's extra cost |
| Runner-seconds after revert | 2 026 s | **N/A** — not re-measured | would need another run; the job graph is back to the baseline shape plus the reverted changes' diagnostics, which add no steps to the suite run |
| `checks` job | 2 m 20 s | **2 m 23 s** | +3 s from 13 new Python tests; unchanged steps |
| Failure screenshot artifact | Always empty by construction | Real PNGs **locally, under a stub** | The capture path is proven locally; CI failure capture and artifact upload are **not** verified, because no failing run has exercised them |
| Failure log artifact | 40-line console tail | Full log on every outcome | `if: always()` |
| Workflow files covered by a trigger | 4 of 8 | **8 of 8** | `tests/test_ci_workflow_integrity.py` |
| Duplicated trigger path lines | 77 | **0** | same |
| Checkouts that persist the token | 1 (the one with `pages: write`) | **0** | `CheckoutCredentialTests` |
| Billable minutes | not exposed | `N/A` | public repository; the API reports no billing |

## Why nothing else was "optimized"

- **No cache was added.** `checks` needs one Node setup (~5 s) and installs no
  packages. The browser jobs' `npm install` of two packages is dwarfed by the
  browser download, so a cache would add state to invalidate for no measured gain.
  A cache introduced without a measurement is exactly the stale-cache-as-evidence
  failure this round forbids.
- **No Python setup was added to `checks`.** The job uses the runner's Python,
  and the validator step is 24 s of a 143 s job.
- **`npm ls`/lockfile pinning was left alone.** The install is
  `--no-save --package-lock=false` on purpose: `playwright-core` and `axe-core`
  must not become application dependencies.
- **The 27 MB `index.html` was not split.** The single-file, `file://`-operable
  design is asserted by the browser suites. It *is* the reason the learning suite
  is slow, and that is recorded as R9-09 with the follow-up rather than "fixed"
  by breaking a shipped requirement.

## The real lever, for the next round

`browser-learning.cjs` performs ~60 navigations of a 27 MB document and takes
387–740 s. A future round should measure where that time goes *inside* the suite
(per-scenario timings are not currently emitted) before changing anything. That is
a follow-up, not a claim.

## Verification of the diagnostics path

Run in the sandbox with a stubbed `playwright-core` that throws inside `goto()`:

```
$ BROWSER_SCREENSHOT_DIR=/tmp/shots  node tests/browser-learning.cjs
Error: simulated navigation failure for the failure-capture test
failure screenshot written to /tmp/shots      → learning-chromium-failure.png   (exit 1)

$ node tests/browser-learning.cjs             → exit 1, no directory touch      (negative control)

$ BROWSER_SCREENSHOT_DIR=/tmp/shots3 node tests/browser-exams.cjs
failure screenshot written to /tmp/shots3     → exams-chromium-failure.png      (exit 1)
```

**What this does not show.** A passing run never enters the failure path. The
`skipped` screenshot step in CI is the correct outcome for a green run, but it is
not evidence that uploads work: the artifact upload on failure, and the capture on a
real browser inside CI, remain **unverified** until a failing run exercises them.
The local stub proves the code path and its ordering; it cannot prove GitHub's
artifact step.

## Actions security

- All seven third-party actions are SHA-pinned and each pin was re-resolved
  against its claimed tag through the GitHub API (7/7 match): `checkout v7.0.1`,
  `setup-node v7.1.0`, `setup-python v7.0.0`, `upload-artifact v7.0.1`,
  `upload-pages-artifact v5.0.0`, `deploy-pages v5.0.1`, `configure-pages v6.0.0`.
- `permissions` audited in all eight workflows: every one declares a top-level
  block (no inherited default). The only broad grant is `actions: write` in
  `release-published-dispatch.yml`, which exists to POST `workflow_dispatch`; it
  is recorded as an accepted trade-off (R9-12) with the reasoning, not silently
  left.
- Nine of nine checkouts set `persist-credentials: false` (R9-14 fixed the last).
- No cache was introduced, so no cache-poisoning surface was added.
