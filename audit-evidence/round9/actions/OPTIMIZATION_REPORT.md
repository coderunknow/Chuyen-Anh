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
| `43396115217` | `c8b22d8` | 4 | **15 m 08 s** | 15 m 04 s (`browser (webkit)`) | **36 m 07 s** |
| `43402014715` | `a82c3f7` | 4 | **16 m 10 s** | 16 m 07 s (`browser (webkit)`) | **35 m 01 s** |
| `43404388721` | `8572aaa` | 4 | **19 m 37 s** | 19 m 34 s (`browser (webkit)`) | **40 m 57 s** |
| `43409142506` | `ab35c98` | 4 | **20 m 11 s** | 20 m 09 s (`browser (webkit)`) | **40 m 15 s** |

**The split saved 1 second and cost 201 runner-seconds.** It has been reverted.

The post-revert rows sit between **35 m 01 s and 40 m 57 s** of runner-seconds,
around the 36 m 06 s baseline (the baseline is the lowest observed, not a floor).

The wall-clock columns matter more than any of my changes. Six runs of the **same
four-job shape** produced **13 m 19 s, 13 m 18 s, 15 m 08 s, 16 m 10 s, 19 m 37 s and
20 m 11 s**. The spread is 7 minutes on unchanged work.

The cause is visible in the per-step data and is **not** the code: the browser
suites were byte-identical between `a82c3f7` and `ab35c98`, yet webkit's run step
went 907 s → 1150 s while chromium stayed in 387–458 s. Recorded as **R9-20**, an
unreproduced drift with runner contention as the leading hypothesis — not as a fact,
and not as something this round fixed.

The consequence for the optimization work is the point: **any speed claim smaller
than a seven-minute spread is unmeasurable on this runner setup.** That is why the
one optimization tried was judged on runner-seconds (the stable number) as well as
wall-clock, and why it was reverted instead of celebrated.

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

---

## PR #86 follow-up: exact-once learning-suite sharding

This section records the follow-up that tested the *inside-the-suite* lever
identified above. The `(engine, suite)` split remains reverted. Instead, the
learning suite is partitioned into five disjoint scenario regions, and the full
five-shard matrix runs on each of Chromium, Firefox, and WebKit. This changes the
parallelism unit while keeping the original scenarios and assertions.

The generator verifies a **3,418-line exact partition**: prologue, leading
scenarios, helpers, the five scenario regions, separators, and teardown are
accounted for once; the original **3,123 scenario lines** are assigned to exactly
one region. Shared setup/helpers are regenerated in each isolated shard by design.
The ranges are:

| Shard | Original source lines | Lines |
|---|---:|---:|
| 1 | 281–948 | 668 |
| 2 | 949–1542 | 594 |
| 3 | 1543–2336 | 794 |
| 4 | 2337–2914 | 578 |
| 5 | 2915–3403 | 489 |

`node scripts/shard_browser_suite.mjs --check` is a required CI gate, including
negative controls for a missing and an overlapping range. The browser job is a
3-engine × 5-part matrix (`fail-fast: false`, 9-minute per-cell timeout); part 5
runs `browser-exams.cjs` after its learning region, once per engine. With `PART`
unset, the local wrapper still runs the complete, unsharded learning suite and
then exams. Thus the exam suite is neither partitioned nor dropped.

### CI measurements

All values below are from `scripts/ci_run_summary.py` over **completed** GitHub
Actions runs. Each qualifying row had the 15 browser cells and the `checks` job
successful. The older sequential result is shown as context, not as a controlled
before/after experiment: the commits and runner conditions differ.

| Run | Head | Wall-clock | Critical path | Runner-seconds | Result |
|---|---|---:|---:|---:|---|
| Sequential context [`43439798628`](https://github.com/coderunknow/Chuyen-Anh/actions/runs/43439798628) | `40823f69` | 14 m 24 s | 14 m 22 s (`browser (webkit)`) | 34 m 54 s | Success; old one-job-per-engine workflow |
| [`43549976351`](https://github.com/coderunknow/Chuyen-Anh/actions/runs/43549976351) | `8f9ece25` | **6 m 24 s** | 6 m 21 s (`browser (webkit shard 4)`) | 48 m 48 s | **Success; < 600 s** |
| [`43550897165`](https://github.com/coderunknow/Chuyen-Anh/actions/runs/43550897165) | `cc6337f3` | **6 m 56 s** | 6 m 53 s (`browser (webkit shard 4)`) | 48 m 54 s | **Success; < 600 s** |
| [`43552001904`](https://github.com/coderunknow/Chuyen-Anh/actions/runs/43552001904) | `a54f899a` | **5 m 50 s** | 5 m 30 s (`browser (webkit shard 4)`) | 49 m 35 s | **Success; < 600 s** |
| [`43552772561`](https://github.com/coderunknow/Chuyen-Anh/actions/runs/43552772561) | `6179b9a5` | **6 m 28 s** | 6 m 25 s (`browser (webkit shard 4)`) | 48 m 04 s | **Success; < 600 s** |

**Acceptance met:** four completed, successful full-matrix runs were under the
10-minute wall-clock limit (the requirement was three). All 15 `(engine, shard)`
cells passed in each qualifying run; the exams suite ran in part 5 for each
engine. Latest code head `6179b9a5` passed Static checks run
[`43552772561`](https://github.com/coderunknow/Chuyen-Anh/actions/runs/43552772561),
including all 15 shards and `checks`; companion archive validation
[`43552772560`](https://github.com/coderunknow/Chuyen-Anh/actions/runs/43552772560)
and Pages smoke
[`43552772552`](https://github.com/coderunknow/Chuyen-Anh/actions/runs/43552772552)
also passed. This run validates the final active-page capture assertions at that
code head.

Run `43551811190` at `b52cca37` was **cancelled**, not counted: a newer PR-head
run superseded it under `static-checks-refs/pull/86/merge` concurrency. Its
cancellation is not reported as a test failure. The later complete runs above are
the qualifying evidence.

### Runtime / runner-cost trade-off

The wall-clock target is now met with WebKit's slowest shard in 5 m 30 s–6 m 53 s
across the four qualifying runs. The sum of runner time is higher: **48 m 04 s–49 m
35 s** versus **34 m 54 s** in the earlier, sequential context run. This is the
cost of fifteen isolated browser jobs (including repeated browser installs). The
change is a wall-clock optimization, **not** a runner-cost or billable-minutes
optimization; the old and new runs are not a controlled experiment, so no precise
causal percentage is claimed.

### Local and cross-engine verification

- Chromium 133.0.6943.0: all five learning shards passed locally in **128, 62,
  88, 139, and 100 s**; shard 5 also ran exams. The full local default, unsharded
  learning-plus-exams path passed in **512 s**.
- CI: the full 5 × 3 learning matrix and exams-on-part-5 passed on Chromium,
  Firefox, and WebKit in each qualifying run. Firefox and WebKit were not run in
  this sandbox.
- The exact-once/failure-lifecycle Node tests passed **7/7**; full Python discovery
  passed **291/291**, the release-artifact tests **22/22**, workflow-integrity
  tests **23/23**, archive tests **5/5**, and all eight workflow YAML files parsed.
- A green run does **not** verify failure screenshot upload. The screenshot upload
  step is correctly skipped on success; capture-before-close is covered by the
  lifecycle regression test, while a failing GitHub Actions upload remains
  unobserved.

### Review status and limits

The final code head's automated reviewer checks did not provide external
approval: Kilo reported **“Insufficient credits to run review”**; CodeRabbit was
**skipped** with **“manual review required for this OSS repository.”** A Copilot
review request on earlier head `b8462be6` also said it could not review because
of insufficient remaining quota. These are not approvals or code-test results.
The prior CodeRabbit reviews at `b8f2c11` and `80e6248` are historical and did not
review this sharding delta. A separate manual disposition is recorded in
`audit-evidence/round9/reviews/CODE_REVIEW_DISPOSITION.md`; it must not be read as
bot approval.

No merge, tag, release, publication, or deployment occurred. The PR remains open.

## 2026-11-14 revalidation (stable release PR)

Re-run on the stable release PR head with the full local release gate (all
green) after the PR #86 review dispositions landed:

- **The reverted browser split stays reverted.** No new job split was
  introduced; the measured wall-clock / runner-seconds reasoning above is
  unchanged and the recorded measurement beside the job remains the authority.
- **Diagnostics path still holds:** `node scripts/shard_browser_suite.mjs
  --check` passes (exact-once partition, blank separators validated), and the
  shard/lifecycle suite is **9/9** including the new per-shard page-error
  assertion tests (shards 1–4 now assert their collected errors before PASS —
  the PR #86 major finding) and the separator negative control.
- **Workflow integrity 26/26** after the ordered path-pattern comparison and the
  active `persist-credentials` validation were added.
- **CI failure capture/upload on a failing run remains unverified** — every CI
  run has been green, exactly as the narrowed claims above state. This has not
  changed and is not claimed.
- Review status is unchanged in kind: CodeRabbit reviews on the chain are
  COMMENTED (its incremental review check on `eb7690d` completed **success**
  with 14 dispositioned threads), Kilo reported insufficient credits, Copilot
  was quota-blocked. None of these is an approval.
