# CodeRabbit review of PR #85 — thread disposition

**Review state.** `CodeRabbit` ran on `6db5ce3` after an explicit
`@coderabbitai review` comment and completed **green** (check conclusion `pass`,
not `SKIPPED` — the earlier skip was the workflow's default path; a requested
review is a real review). It opened **16 threads**, all unresolved at review time.
Raw payload: `logs/pr85-review-threads.json` (fetched from the GraphQL API).

**Standing rule for this table.** A thread is `FIXED` only when a test in the tree
fails without the fix. Rows marked `DOC` changed only prose. No thread was resolved
on GitHub by this session (that is PR #85's own review UI, and the repository
cannot be mutated without review); the table is the disposition record.

| # | Thread | Where | Disposition | Evidence |
|---|--------|-------|-------------|----------|
| 1 | Import replaces same-id corrections instead of failing | `index.html` | **FIXED** — an import drops stored corrections only for ids the file carries, so a chosen backup is restorable | test "an import replaces a same-id correction instead of failing"; mutation `no-import-unTombstone` |
| 2 | A newer correction from another tab is dropped by a stale one | `index.html` | **FIXED** — the stored copy wins when this tab did not touch it; both-sides-edited returns `conflicting-correction` | test "a newer correction from another tab is not overwritten"; mutation `no-stale-correction-rule` |
| 3 | An empty stored string is treated as an absent key | `index.html` | **FIXED** — only `null`/`undefined` is empty; `''` fails parsing and the write is refused | test "an empty string in the store is unreadable"; mutation `empty-string-is-empty` |
| 4 | A lost Clear is invisible to write verification | `index.html` | **FIXED** — a store whose `generation` went *backwards* is reported as `lost-clear` instead of merged | test "a Clear that is overwritten by a stale tab is detected"; mutation `no-generation-guard` |
| 5 | Legacy over-limit **accepted alternatives** are still rejected | `index.html` | **FIXED** — the same `legacyOverLimit` exception and tag now covers alternatives, so old histories load and import | test "a legacy over-limit accepted alternative is preserved" |
| 6 | The 1,000-character limit is applied to the whole field, not per answer | `index.html` | **FIXED** — `examCorrectionAnswerParts` splits first; two 700-character answers are valid, and a refusal reports the offending answer's length | test "two 700-character answers are accepted" |
| 7 | `maxlength="1000"` counts UTF-16 units on a code-point-limited answer | `index.html` | **FIXED** — `maxlength` removed; an input handler refuses an edit with the same model functions the save uses, plus a live measured-length hint | test "the 1,000-character limit is visible and enforced at the input" (asserts **no** `maxlength`); checklist item 20 corrected |
| 8 | The checklist claims code-point enforcement "at the input" | `audit-evidence/round8/CHECKLIST.md` | **DOC** — item 20 now states the mechanism (handler + shared functions) and why `maxlength` cannot express the rule | this file, row 7 |
| 9 | FINDINGS NEW-2 says imports merge "with tombstone precedence" | `audit-evidence/round8/FINDINGS.md` | **DOC** — states the actual rule: precedence for records the file does not carry, explicit restore for the ids it does | F6 in `FAILURE_LEDGER.md` |
| 10 | The "can never win" guarantee ignores tombstone compaction | `DESIGN_LOG.md` | **DOC** — qualified: the guarantee holds while the tombstone is retained (bounded at 500 or 4× retained attempts) | this file, row 10 |
| 11 | `sharedStore`'s `onWrite` hook passes an undeclared `api` | `tests/exam-persistence.test.js` | **FIXED** — the store object is built before the hook and passed to it; the helper returns `{ store, snapshot, raw }` | whole suite exercises `makeStore`; the Web Locks test supplies no hook, the rest would throw |
| 12 | No test covers the Web Locks path | `tests/exam-persistence.test.js` | **FIXED** — a controllable `navigator.locks` facade asserts the lock name, `exclusive` mode, `mode: 'locked'`, and that critical sections never overlap | test "the Web Locks path is exercised"; mutation `no-lock-request` |
| 13 | The repro script compares a Promise with `false` | `logs/repro-score-mismatch-before.mjs` | **FIXED** — kept verbatim as history with a header saying so; new `repro-score-mismatch-await.mjs` awaits and reports `ok`/`reason` | `logs/repro-score-mismatch-await-{at-start-sha,after-fix}.log` |
| 14 | The probe hard-codes `/tmp/r8/node_modules/jsdom` | `ui-flow-probe.mjs` | **FIXED** — `JSDOM_PATH` env var, and a missing install exits `2` with an instruction | run with a bogus path exits `2` with the message |
| 15 | The probe is labelled a "UI-flow" check but drives the model | `ui-flow-probe.mjs` | **FIXED** (labels) — header and success line now say model-API probe, not a browser result | `logs/ui-flow-probe.log` regenerated |
| 16 | CHANGELOG says 284 Node tests; the checklist says 289 | `CHANGELOG.md` | **FIXED** — both now state the measured total, with the per-suite counts the runner reports (currently **301**, after the Copilot fixes) | `logs/node-rc11.log` |

## Mutation checks

Each `FIXED` row above whose fix is a code guard was re-run with that guard
disabled, and exactly the intended test failed:

```
no-lock-request          -> 1 failing: the Web Locks path is exercised…
empty-string-is-empty    -> 1 failing: an empty string in the store is unreadable…
no-generation-guard      -> 1 failing: a Clear that is overwritten by a stale tab…
no-stale-correction-rule -> 1 failing: a newer correction from another tab…
no-import-unTombstone    -> 1 failing: an import replaces a same-id correction…
```

## What this review did not cover

Rows 5–7 and 1–4 are the review's real value: three of them are data-loss paths
that no local test asserted before, and one (row 7) is a UI rule that was stated
correctly in prose while the attribute contradicted it. The review did **not**
look at browser behaviour, and its green check is not browser evidence — the
engine matrix is still read only from CI (§ `CONTINUATION_REPORT.md`).
