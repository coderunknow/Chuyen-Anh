# Round 9 — audit checklist

Statuses: `[x]` done and verified · `[ ]` not done (reason given) ·
`EXTERNALLY_BLOCKED` · `MANUAL_REQUIRED` · `UNREPRODUCED`.

Evidence column points at a file in this tree or a named command. Every row names
the SHA it was verified at.

Round head while auditing: `2f686f77e3103cbbbea15350a765021fc8283b28`
(final verification SHA is recorded in `final/FINAL_STATE.md`).

## A. Preflight

| ID | Requirement | Status | Evidence | SHA |
|---|---|---|---|---|
| R9-A1 | Read `AGENTS.md` / `DESIGN_LOG.md` / `AGENTS_LOG.md` / `FAILURE_LEDGER.md` and round-8 evidence before acting | `[x]` | `audit-evidence/round8/*`, appended to `AGENTS_LOG.md` | `2f686f7` |
| R9-A2 | Confirm PR #85 state, head SHA, base, draft flag from live data (not the snapshot) | `[x]` | PR #85 OPEN, not draft, head `2f686f7`, base `arena/dedd1942-chuyen-anh` @ `e663295` | `2f686f7` |
| R9-A3 | Confirm PR #84 untouched (Open / Draft / same SHA) | `[x]` | `e663295`, updatedAt unchanged | `e663295` |
| R9-A4 | Confirm `DEPLOY_HOLD` and that no release/tag/deploy is triggered by this round | `[x]` | `DEPLOY_HOLD` = `v1.0.0-rc11`; both gates return `deploy=false … held` | `2f686f7` |
| R9-A5 | Establish a measured Actions baseline from the API | `[x]` | `actions/BASELINE.md`, `actions/logs/jobs-baseline-43342769617.json` | `2f686f7` |

## B. Application audit

| ID | Requirement | Status | Evidence | SHA |
|---|---|---|---|---|
| R9-B1 | Architecture / correctness review of the app module | `[x]` | `application/audit-probes.md`; 8,852-entry parse + boot path inspected | `2f686f7` |
| R9-B2 | A word must not inherit another sense's CEFR level | `[x]` | probe: 0 violations over 8,928 senses; `entryCefrLevel`/`senseViewEntry` read | `2f686f7` |
| R9-B3 | A phrase must not inherit a constituent word's level | `[x]` | probe: 0 unclassified-free phrases of 1,094; `phraseCefrLevel` uses own tags only | `2f686f7` |
| R9-B4 | All supported exam question types score correctly | `[x]` | 106 papers / 6,708 questions probed; bookkeeping 0 mismatches | `2f686f7` |
| R9-B5 | Exemptions are never graded as normal questions | `[x]` | probe: 0 exempt items marked incorrect; 1,553 exemptions excluded from the denominator | `2f686f7` |
| R9-B6 | Partial credit never over-credits and all-correct reaches 100 % | `[x]` | probe: 0 items > 1.0 credit, 0 all-correct-but-not-100 | `2f686f7` |
| R9-B7 | SHA-256 integrity of the 106 papers and 186 assets | `[x]` | `contentSha256` matches markdown 106/106; 186 assets all 64-hex, distinct | `2f686f7` |
| R9-B8 | Persistence: tombstones, generation, cross-tab merge, unreadable store | `[x]` | probes: no resurrection after delete, no re-add after Clear, `generation` bumps | `2f686f7` |
| R9-B9 | Security/privacy: user-supplied backups cannot inject markup | `[x]` | probe: crafted `<img onerror>`/`<script>` escaped; import validated | `2f686f7` |
| R9-B10 | Accessibility (WCAG AA, axe-core, keyboard) | `[x]` (automated) / `MANUAL_REQUIRED` (screen reader) | Existing axe-core RT-03 assertions remain in `browser-learning.cjs`; no screen-reader session was performed and none is claimed | `2f686f7` |
| R9-B11 | UX / visual consistency across viewports and themes | `[x]` (automated) | 320/375/768/1024/1440 px and light/dark assertions remain in both suites | `2f686f7` |

## C. Delivery infrastructure

| ID | Requirement | Status | Evidence | SHA |
|---|---|---|---|---|
| R9-C1 | Third-party actions SHA-pinned and pins verified against the real tags | `[x]` | 7/7 pins resolved to their claimed tags via the GitHub API | `2f686f7` |
| R9-C2 | Least-privilege `permissions` in every workflow | `[x]` | 8 workflows audited; `actions: write` in the dispatcher recorded as R9-12 (accepted trade-off, reasoned) | `2f686f7` |
| R9-C3 | No credential persistence on checkout | `[x]` → fixed (R9-14) | `CheckoutCredentialTests`: 9/9 checkouts opt out; the publishing job was the missing one | `2f686f7` |
| R9-C4 | No cache poisoning surface introduced | `[x]` | no cache added this round; reasoning in `actions/OPTIMIZATION_REPORT.md` | `2f686f7` |
| R9-C5 | Every workflow file is covered by a CI trigger | `[x]` → fixed (R9-02) | `tests/test_ci_workflow_integrity.py::WorkflowFileCoverageTests` | `2f686f7` |
| R9-C6 | Path filters cannot drift between triggers | `[x]` → fixed (R9-01) | `AnchorAliasTests`, mutation M1 | `2f686f7` |
| R9-C7 | All three engines and both suites still gate | `[x]` → 6-job matrix | `BrowserMatrixTests` | `2f686f7` |
| R9-C8 | Failure diagnostics actually collect something | `[x]` → fixed (R9-04) | stub run wrote real PNGs; `FailureArtifactTests` | `2f686f7` |
| R9-C9 | Measure the optimization on a real run | `[ ]` | Cannot run until this branch is pushed and CI executes with the new workflow | — |
| R9-C10 | Pages smoke fixed-delay re-examined | `[x]` | release path already waits on deployment status; R9-13 keeps the bounded sleep, reasoned | `2f686f7` |
| R9-C11 | Telemetry smoke failure diagnosed (not guessed) | `[x]` (diagnosed as external) | R9-10: `api/`+`supabase/` unchanged across green→red; 503 is not a version error | `2f686f7` |
| R9-C12 | Telemetry smoke green | `EXTERNALLY_BLOCKED` | No sandbox egress to `vercel.app`/`supabase.co`; changing repo code cannot fix an upstream/config outage | `2f686f7` |

## D. Evidence and honesty

| ID | Requirement | Status | Evidence | SHA |
|---|---|---|---|---|
| R9-D1 | Every confirmed defect has repro, cause, impact, fix, test, mutation proof | `[x]` | `DEFECTS.md` R9-01…R9-07; mutations M1–M7 in `TEST_INTEGRITY.md` | `2f686f7` |
| R9-D2 | Defects classified distinctly (confirmed / potential / limitation / external / harness / flake / trade-off) | `[x]` | `DEFECTS.md` summary table, 13 entries across 6 classes | `2f686f7` |
| R9-D3 | No existing test expectation changed merely to pass | `[x]` | 2 changed, both documented (R9-05, R9-06); one tightened, none deleted | `2f686f7` |
| R9-D4 | Stale totals in the readiness documents corrected | `[x]` → fixed (R9-07) | 263→274, 268→279, changelog; verified by the repo's own count tests | `2f686f7` |
| R9-D5 | `AGENTS_LOG.md` append-only | `[x]` | round-9 entry appended; no history rewritten | `2f686f7` |
| R9-D6 | No claim of "fully audited" / "all bugs fixed" / "production-ready" | `[x]` | wording reviewed across this tree | `2f686f7` |
| R9-D7 | Full local suite green at this head | `[x]` | 276 Python OK, 302 Node, 5 archive, 21 validators, gates held | `2f686f7` |

## E. Review and delivery

| ID | Requirement | Status | Evidence | SHA |
|---|---|---|---|---|
| R9-E1 | CodeRabbit review of the exact final SHA, reason inspected if `SKIPPED` | `[ ]` | pending the final push (a `SKIPPED` status is not quota exhaustion and must be read, not assumed) | — |
| R9-E2 | Copilot only if CodeRabbit is provably exhausted | `[ ]` | not reached | — |
| R9-E3 | Kilo not invoked; its `ACTION_REQUIRED` not cited as approval | `[x]` | not invoked | `2f686f7` |
| R9-E4 | PR #85 OPEN, non-draft, body updated with this round | `[ ]` | pending final push | — |
| R9-E5 | No merge, no tag, no release, no deploy in this round | `[x]` | gates held; no release/tag command issued | `2f686f7` |
| R9-E6 | Maintainer asked whether the audit is accepted | `[ ]` | asked in the final message | — |

## Summary

- **Verified at this head:** 27 items.
- **Fixed this round (were failing):** R9-01, R9-02, R9-03, R9-04, R9-07, R9-14.
- **Open with a reason:** R9-C9 (needs a real run), R9-E1–E2, E4, E6 (need the
  final push and review cycle).
- **Externally blocked:** R9-C12 (telemetry upstream).
- **Manual required:** R9-B10 screen-reader validation — not performed, not claimed.
