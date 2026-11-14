# Copilot review of PR #85 — disposition

**Review state.** `copilot-pull-request-reviewer[bot]` submitted a **COMMENTED**
review ("Changes recommended") on PR #85, with **10 comments**. Seven are code
findings, three are stale-documentation findings. Raw payload:
`logs/pr85-review-comments.json` (REST `pulls/85/comments`, all 26 review
comments including CodeRabbit's).

**Caveat recorded honestly.** The review *summary* names `4e2b6c3` as the reviewed
commit while every inline comment is anchored to `856d1a1` (the current head at the
time). The comments are what were read and checked; the summary's SHA reference is
stale and is not treated as evidence of what was reviewed.

**Standing rule.** A finding is `FIXED` only when a test in the tree fails without
the fix. Every code fix below was mutation-checked by disabling that guard and
confirming exactly one test fails.

| # | Finding | Where | Verdict | Evidence |
|---|---------|-------|---------|----------|
| 1 | A delete writes a tombstone but not a `generation`, so a stale overwrite erases both the tombstone and the evidence, and the delete reports success | `index.html` | **VALID, FIXED** — a delete now bumps `generation` like a Clear, so a tab that observed the delete reports `lost-clear` instead of re-adopting the record | test "a delete is detectable after a stale overwrite, because it bumps generation"; mutation `delete-no-generation` |
| 2 | `unseenAttempts` excludes every stored attempt whose id existed in `base`, so a store-changed attempt is silently overwritten by a stale tab | `index.html` | **VALID, FIXED (as a conflict)** — see #11. An attempt's identity (paper, timestamps, responses) is immutable; a stored copy whose identity moved is a different record wearing the same id, so it is reported as `conflicting-attempt` rather than adopted or overwritten | test "a stale save keeps the stored attempt, and a substituted one is refused"; mutation `no-attempt-staleness-rule` |
| 3 | A tombstone can filter out a record this operation *changed*, and the save still returns `ok: true` | `index.html` | **VALID, FIXED** — a claim this operation introduced or changed that a tombstone would discard is reported as `tombstoned-claim`; records merely carried from the snapshot still lose to the delete | test "a claim this operation makes is not silently dropped by a tombstone"; mutation `no-claim-check` |
| 4 | The still-exported `saveExamResultHistory` writes over an unreadable store, bypassing the round-8 contract | `index.html` | **VALID, FIXED** — the legacy writer now inspects the store first and refuses, like the async path | test "the legacy writer cannot overwrite an unreadable store"; mutation `legacy-writer-bypass` |
| 5 | The correction input handler does not actually reject an over-limit edit (`replace(/\s+$/,'')` only trims whitespace) | `index.html` | **VALID, FIXED** — the rule is now `examCorrectionAcceptedInput`, which restores the last valid value; the "simply does nothing" claim is now true of the code | test "the correction input actually reverts an over-limit edit"; mutation `input-does-not-revert` |
| 6 | `AGENTS_LOG.md` still reports the pre-review totals (22 new tests / 288 Node) | `AGENTS_LOG.md` | **VALID, FIXED BY APPEND** — the file is append-only, so the stale line is *not* rewritten; a dated correction entry states the current totals and why they moved | this file; `AGENTS_LOG.md` dated entry |
| 7 | `CONTINUATION_REPORT.md` still claims `maxlength="1000"` is the input boundary | `CONTINUATION_REPORT.md` | **VALID, FIXED** — both the prose and the Input row now describe the handler + `aria-describedby` + measured length | `CONTINUATION_REPORT.md` |
| 8 | `CONTINUATION_REPORT.md` still records 288 Node passes | `CONTINUATION_REPORT.md` | **VALID, FIXED** — states 301 with the log it comes from | `logs/node-rc11.log` |
| 9 | `EVIDENCE_MANIFEST.md` says 22 persistence tests / 288 Node passes | `EVIDENCE_MANIFEST.md` | **VALID, FIXED** — states 35 / 301, keeps the superseded logs labelled as history | `logs/node-rc11.log` |
| 10 | The accessibility checklist row asks a human to look for a `maxlength` that intentionally does not exist | `accessibility/EXAM_HISTORY_MANUAL_CHECKLIST.md` | **VALID, FIXED** — the row now describes the handler, `aria-describedby`, the measured-length hint, and that there is no `maxlength` | that file |

## Mutation checks

```
delete-no-generation        -> 1 failing: a delete is detectable after a stale overwrite…
no-attempt-staleness-rule   -> 1 failing: a stale save keeps the stored attempt…
no-claim-check              -> 1 failing: a claim this operation makes is not silently dropped…
legacy-writer-bypass        -> 1 failing: the legacy writer cannot overwrite an unreadable store
input-does-not-revert       -> 1 failing: the correction input actually reverts an over-limit edit
```

## Where Copilot was incomplete (recorded, not used to dismiss it)

Finding #2 proposed "keep the stored copy when this tab did not edit it, report a
conflict when both changed it". That rule is right for *corrections*, where the
same id can legitimately hold newer content (an edit). It is not right for
*attempts*, whose identity is immutable: there is no legitimate "same id, different
answers" record, so there is nothing to keep — the honest answer is a conflict. The
implementation follows the stronger rule, and both behaviours have tests.

## What this review did not cover

It is not browser evidence and not a substitute for the engine matrix, which is read
only from CI. It is also not a CodeRabbit re-review: that request was rate-limited
(see `CONTINUATION_REPORT.md`), and a rate limit is not a review.
