# Round 9 — audit checklist

Statuses: `[x]` done and verified · `[ ]` not done (reason given) ·
`EXTERNALLY_BLOCKED` · `MANUAL_REQUIRED` · `UNREPRODUCED`.

Evidence column points at a file in this tree or a named command. Every row names
the SHA it was verified at.

The SHA column is commit-specific; there is no single SHA shared by every row:

- `2f686f7…` — the **base** the audit started from. A row carrying it was verified
  by inspection or measurement *of that base*, and the property still holds.
- `80e6248…` — an original Round 9 review-fix commit containing the top-level
  screenshot capture-before-cleanup correction. It is **not** the final original
  Round 9 code head, and does not contain later fixes.
- `b687b86…` — the final code head for the original Round 9 checkpoint, checked by
  run `43434146112` and followed by the documentation-only freeze `97acf97`.
- Later PR #86 follow-up fixes have their own citations: `c8b22d8…` contains the
  eight `freshWorld()` wrappers, and `316b5f9…` contains the behavioral regression
  that exercises capture before close. The R9-C8 row lists each applicable SHA.

## A. Preflight

| ID | Requirement | Status | Evidence | SHA |
|---|---|---|---|---|
| R9-A1 | Read `AGENTS.md` / `DESIGN_LOG.md` / `AGENTS_LOG.md` / `FAILURE_LEDGER.md` and round-8 evidence before acting | `[x]` | `audit-evidence/round8/*`, appended to `AGENTS_LOG.md` | `2f686f7` |
| R9-A2 | Confirm PR #85 state, head SHA, base, draft flag from live data (not the snapshot) | `[x]` | PR #85 OPEN, not draft, head `2f686f7`, base `arena/dedd1942-chuyen-anh` @ `e663295` | `2f686f7` |
| R9-A3 | Confirm PR #84 untouched (Open / Draft / same SHA) | `[x]` | `e663295`, updatedAt unchanged | `e663295` |
| R9-A4 | Confirm `DEPLOY_HOLD` and that no release/tag/deploy is triggered by this round | `[x]` | `DEPLOY_HOLD` = `v1.0.0-rc11`; both gates return `deploy=false … held` | `2f686f7` |
| R9-A5 | Establish a measured Actions baseline from the API | `[x]` | `actions/BASELINE.md`, `actions/logs/jobs-baseline-43342769617.json` | `80e6248` |

## B. Application audit

| ID | Requirement | Status | Evidence | SHA |
|---|---|---|---|---|
| R9-B1 | Architecture / correctness review of the app module | `[x]` | `application/audit-probes.md`; 8,852-entry parse + boot path inspected | `2f686f7` |
| R9-B2 | A word must not inherit another sense's CEFR level | `[x]` | probe: 0 violations over 8,928 senses; `entryCefrLevel`/`senseViewEntry` read | `2f686f7` |
| R9-B3 | A phrase must not inherit a constituent word's level | `[x]` | probe: 0 unclassified-free phrases of 1,094; `phraseCefrLevel` uses own tags only | `2f686f7` |
| R9-B4 | All supported exam question types score correctly | `[x]` | 106 papers / 6,708 questions probed; bookkeeping 0 mismatches | `2f686f7` |
| R9-B5 | Exemptions are never graded as normal questions | `[x]` | probe: 0 exempt items marked incorrect; 1,553 exemptions excluded from the denominator | `2f686f7` |
| R9-B6 | Partial credit never over-credits and all-correct reaches 100 % | `[x]` | probe: 0 items > 1.0 credit, 0 all-correct-but-not-100 | `2f686f7` |
| R9-B7 | SHA-256 integrity of the 106 papers | `[x]` | `contentSha256` recomputed from the embedded markdown: **106/106 match** | `2f686f7` |
| R9-B7b | 186 downloaded asset digests match their contents | `[ ]` **not verified** | Only format and uniqueness were checked (all 64-hex, all distinct). Recomputing them needs the external files this sandbox cannot fetch. Reported as narrowing, never as verified | `80e6248` |
| R9-B8 | Persistence: tombstones, generation, cross-tab merge, unreadable store | `[x]` | probes: no resurrection after delete, no re-add after Clear, `generation` bumps | `2f686f7` |
| R9-B9 | Security/privacy: user-supplied backups cannot inject markup | `[x]` | probe: crafted `<img onerror>`/`<script>` escaped; import validated | `2f686f7` |
| R9-B10 | Accessibility (WCAG AA, axe-core, keyboard) | `[x]` (automated, **run**) / `MANUAL_REQUIRED` (screen reader) | RT-03 now runs the **full** `wcag2a/wcag2aa/wcag21a/wcag21aa` set on all six views in both themes (R9-22), with a three-defect positive control; 12 audits × 3 engines clean. R9-21 (nameless exam headers) and R9-23 (two contrast failures axe files as `incomplete`) were found and fixed. No screen-reader session was performed and none is claimed | `b687b86` |
| R9-B11 | UX / visual consistency across viewports and themes | `[x]` (automated, **run**) | Suite assertions plus an independent 120-combination sweep (6 views × 2 themes × 2 skins × 5 viewports): **0** horizontal-overflow pages, **0** clipped text nodes. One apparent WCAG 2.2 target-size hit (`#cefr-narrow`, 13×13) was a probe artifact — its real target is the 239×19.7 px label | `b687b86` |

| R9-B12 | Every exam document actually renders correctly, not just the one paper CI opens | `[x]` → fixed (R9-21) | sweep of all 24 openable records: 791 tables, 2 330 headers, 0 nameless; was 8 papers / 17 cells. Mutation M19, and M19b which proves the old coverage was blind | `b687b86` |
| R9-B13 | Contrast is verified where axe cannot decide it (gradients, translucent chips) | `[x]` → fixed (R9-23) | pixel-sampled all 126 nodes axe left `incomplete` across theme × skin × viewport; two real failures found and fixed, each with a mutation (M20, M21) | `b687b86` |
| R9-B14 | The audit's own new tests can fail for the reason they claim | `[x]` → fixed (R9-24) | the R9-23 loop audited dark twice under a "light" label; it now asserts the resolved theme first, and both mutations fail the correct theme | `b687b86` |

## C. Delivery infrastructure

| ID | Requirement | Status | Evidence | SHA |
|---|---|---|---|---|
| R9-C1 | Third-party actions SHA-pinned and pins verified against the real tags | `[x]` | 7/7 pins resolved to their claimed tags via the GitHub API | `2f686f7` |
| R9-C2 | Least-privilege `permissions` in every workflow | `[x]` | 8 workflows audited; `actions: write` in the dispatcher recorded as R9-12 (accepted trade-off, reasoned) | `2f686f7` |
| R9-C3 | No credential persistence on checkout | `[x]` → fixed (R9-14) | `CheckoutCredentialTests`: 9/9 checkouts opt out; the publishing job was the missing one | `80e6248` |
| R9-C4 | No cache poisoning surface introduced | `[x]` | no cache added this round; reasoning in `actions/OPTIMIZATION_REPORT.md` | `2f686f7` |
| R9-C5 | Every workflow file is covered by a CI trigger | `[x]` → fixed (R9-02) | `tests/test_ci_workflow_integrity.py::WorkflowFileCoverageTests` | `80e6248` |
| R9-C6 | Path filters cannot drift between triggers | `[x]` → fixed (R9-01) | `AnchorAliasTests`, mutation M1 | `80e6248` |
| R9-C7 | All three engines and both suites still gate | `[x]` | `BrowserMatrixTests`: 3 engines, both suites, no `continue-on-error` | `80e6248` |
| R9-C8 | Failure diagnostics actually collect something | `[x]` for local capture; **CI failure/upload unverified** | M10's Playwright-lifecycle stub replay covered the fixed snapshot committed as `80e6248` (old order: no PNG; fixed order: PNG written). `c8b22d8` wraps all 8 `freshWorld()` scenarios; the regression test at `316b5f9` models a page that throws after close, writes a PNG before close, and rejects the close-before-capture negative control. Green CI runs skip the screenshot-upload step; no failing CI run has verified capture/upload | `80e6248` / `c8b22d8` / `316b5f9` |
| R9-C9 | Measure the optimization on a real run | `[x]` | Run `43376379586`: 13 m 18 s vs 13 m 19 s, runner-seconds +201 s ⇒ **the split was reverted**; numbers in `actions/OPTIMIZATION_REPORT.md` | `80e6248` |
| R9-C10 | Pages smoke fixed-delay re-examined | `[x]` | release path already waits on deployment status; R9-13 keeps the bounded sleep, reasoned | `2f686f7` |
| R9-C11 | Telemetry smoke failure diagnosed (not guessed) | `[x]` (diagnosed as external) | R9-10: `api/`+`supabase/` unchanged across green→red; 503 is not a version error | `2f686f7` |
| R9-C12 | Telemetry smoke green | `EXTERNALLY_BLOCKED` | No sandbox egress to `vercel.app`/`supabase.co`; changing repo code cannot fix an upstream/config outage | `2f686f7` |

## D. Evidence and honesty

| ID | Requirement | Status | Evidence | SHA |
|---|---|---|---|---|
| R9-D1 | Every confirmed defect has repro, cause, impact, fix, test, mutation proof | `[x]` | `DEFECTS.md` R9-01…R9-07; mutations M1–M7 in `TEST_INTEGRITY.md` | `2f686f7` |
| R9-D2 | Defects classified distinctly (confirmed / potential / limitation / external / harness / flake / trade-off) | `[x]` | `DEFECTS.md` summary table, 13 entries across 6 classes | `2f686f7` |
| R9-D3 | No existing test expectation changed merely to pass | `[x]` | 2 changed, both documented (R9-05, R9-06); one tightened, none deleted | `2f686f7` |
| R9-D4 | Stale totals in the readiness documents corrected | `[x]` → fixed (R9-07) | 263→274, 268→279, changelog; verified by the repo's own count tests | `80e6248` |
| R9-D5 | `AGENTS_LOG.md` append-only | `[x]` | round-9 entry appended; no history rewritten | `2f686f7` |
| R9-D6 | No claim of "fully audited" / "all bugs fixed" / "production-ready" | `[x]` | wording reviewed across this tree | `2f686f7` |
| R9-D7 | Full local suite green at this head | `[x]` | 285 Python OK, 302 Node, 5 archive, 21 validators, gates held | `80e6248` |
| R9-D8 | CI green on the round-9 head | `[x]` | Run `43434146112` at `b687b86`: **4/4** (chromium 8 m 14 s, firefox 10 m 39 s, webkit 13 m 54 s, checks 2 m 25 s). An earlier head `24bfad5` went red on a stale generated artefact — R9-25 | `b687b86` |
| R9-D9 | A refuted hypothesis is reported as refuted, not quietly dropped | `[x]` | R9-03 records the 1 s saving and the 201 s cost, and the revert | `80e6248` |

## E. Review and delivery

| ID | Requirement | Status | Evidence | SHA |
|---|---|---|---|---|
| R9-E1 | CodeRabbit review of the exact final SHA, reason inspected if `SKIPPED` | `[x]` for the reason / see note | At `3ba0da6` CodeRabbit's check run reports **`skipped`** with title *"Review skipped: manual review required for this OSS repository"* and the body *"This repository does not receive automatic reviews because it has fewer than 10 stars."* That is a repository-policy threshold, **not** quota. Both `@coderabbitai review` commands (`06:27:19`, `08:37:13`) were honoured with "Review finished." and produced the 12 findings already dispositioned. A third identical command was **not** sent, per instruction | `3ba0da6` |
| R9-E2 | Copilot only if CodeRabbit is provably exhausted | `[x]` (not required) | CodeRabbit is **not** exhausted — it reviewed on request twice and its skips are a star threshold, so the Copilot fallback condition was never met. Copilot's own status says *"insufficient remaining quota"*, which is not a code review and is not treated as one | `3ba0da6` |
| R9-E3 | Kilo not invoked; its `ACTION_REQUIRED` not cited as approval | `[x]` | not invoked | `2f686f7` |
| R9-E4 | PR OPEN, non-draft, body updated with this round | `[x]` | PR #86 `draft=false`, `state=OPEN`, `mergeable=MERGEABLE`, base `arena/chuyen-anh-r8-ready-review` (not retargeted); PR #85 also open and non-draft at `2f686f7` | `3ba0da6` |
| R9-E5 | No merge, no tag, no release, no deploy in this round | `[x]` | gates held; no release/tag command issued | `2f686f7` |
| R9-E6 | Maintainer asked whether the audit is accepted | `[ ]` | asked in the final message | — |

## Summary

- **Verified at this head:** 33 items.
- **Fixed this round (were failing):** R9-01, R9-02, R9-04, R9-07, R9-14, R9-21,
  R9-23, plus three harness defects in the checks themselves (R9-19, R9-22, R9-24).
- **Refuted and reverted:** R9-03 (the browser-job split).
- **Open with a reason:** R9-B7b (external asset digests), R9-C8 upload path,
  R9-E2 (Copilot — not reached, and not needed), R9-E6 (asked in the final message).
- **Externally blocked:** R9-C12 (telemetry upstream).
- **Manual required:** R9-B10 screen-reader validation — not performed, not claimed.
- **Unreproduced, recorded not fixed:** R9-11, R9-20.

For the original Round 9 rows, `b687b86` denotes the final code head checked by
run `43434146112` and frozen in docs commit `97acf97`. PR #86 follow-up evidence
names its applicable fix and test commits separately in the row's SHA column.
