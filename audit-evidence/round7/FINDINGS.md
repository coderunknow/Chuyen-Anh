# Round 7 — findings

> **Reconstructed document.** The original `FINDINGS.md` was never committed and
> was lost with the working tree (see `logs/RECONSTRUCTION_NOTICE.md`). This
> rewrite keeps the finding identifiers that later commits and PR replies cite
> (`D65`–`D72`) and adds the one finding this session produced. Every claim here
> is checkable against the commits it names; where a detail could not be
> re-derived it is marked **lost** rather than guessed.

Status legend: **FIXED** = committed with a regression test whose control fails
without the fix · **OPEN** = carried forward, with the reason it is not fixed.

## Fixed in round 7

| ID | Finding | Fix commit | Regression test |
|----|---------|-----------|-----------------|
| D65 | Import controls were unreachable by keyboard (no focusable trigger for the hidden file input) | `9f2f82e` | `r7-import-keyboard` probe, 19/19 checks |
| D66 | `applyDeviceSettings` reported `ok` after a partial write | `32ad30e` | staging probe asserts `writes.has(key)` per expected key |
| D67 | An oversized settings file was read into memory before being refused | `99859e3` | byte-cap test at the 64 KB boundary |
| D68 | The documented suite totals were stale (claimed 246/18; measured 246 node before the later additions) | `9cd1a65` | `test_ci_gate_coverage` recomputes each row from the files |
| D69 | A concurrent tab could overwrite an exam-history write; the common (fast) path skipped verification entirely | `43c5352` | two-tab and unrepairable-race tests |
| D70 | A successful save returned `next` rather than the merged history actually stored, hiding other tabs' records until reload | `2624a20` | merge-return test |
| D71 | An operable chip carried `aria-disabled="true"`, so assistive tech announced it as disabled | `74a5e45` | `r7-chip-state` (rewritten — the first version enforced the bug) |
| D72 | An unconfirmed save returned a partial history, which the caller treated as success | `caacb74` | unrepairable-overwrite test |
| D73 | The read-back compared attempt **summaries** only, so an attempt replaced under the same id was adopted | `50fd918` | `an attempt replaced under the same id is not adopted as our save` |
| **D74** | **The read-back never compared the `papers` map**, so a snapshot replaced under the same key was adopted while every attempt still matched | **`9edc2a0`** | **`a paper snapshot replaced under the same key is not adopted as our save`** |

## D74 — detail (this session)

Raised as a **Major** by CodeRabbit on `3c2d7ff` (comment `4539964627`) and
confirmed by execution rather than by reading.

`verifyOrRepairExamResultHistory` is the only thing standing between a submitted
attempt and a silent lie. It checked attempts (id + identity + summary) and
corrections, but not `papers`. That is the one field that makes a stored score
reproducible.

The replacement is not detectable from the attempts. `questionResults` is
**stored**, not recomputed from the prompt text (`examRecomputeResultHistory`
only re-derives it when a caller asks, and the shipped path stores it), so an
attempt whose paper now holds a different question still reproduces its own
summary. Identity is unchanged because the learner's responses did not change.
Every check above therefore passes and the read-back returns the store's history
as if it were ours.

Consequence: the learner is told the attempt is saved, and the history now holds
a paper whose question set is not the one they sat. Any later re-score, export or
re-import is done against foreign questions.

The fix applies the rule the merge already enforces. `mergeExamResultHistory`
refuses to combine two different snapshots for one key (`conflicting-paper`), so
a lost snapshot is **unrecoverable by that same rule** — the correct behaviour is
to report failure, not to adopt it. The comparison is full canonical JSON rather
than `contentSha256` alone, because `examPaperMetadataIsValid` explicitly allows
extra keys, so two snapshots can share a hash and still differ.

Control (in `logs/final-sha-verification.log`): with the block removed the test
fails with `restored=false, returned=history`; with it, `0 fail`.

## Carried forward — not fixed

| ID | Finding | Why it is open |
|----|---------|----------------|
| `4537334892` | **Major** — a score mismatch can be reported on `unseen` attempts during a merged history | Merging records scored against another tab's corrections is now handled by re-scoring the union (`43c5352`), but the reported case concerns attempts the user has never seen. Dispositioned as *out of scope for this continuation*; round 1 covered it. **Not fixed; not claimed fixed.** |
| `4514659122` | **Minor** — multiword seed headwords | Scope: touching the seed data changes the vocabulary corpus, which the user limited to settings-export work. Carried forward unchanged. |
| — | Screen-reader validation (acceptance criterion 8) | **Cannot be done here.** No AT-SPI bus, no `gi`/`pyatspi`, no display, and the Debian mirror is unreachable, so no screen reader can be installed. Fabricating it is forbidden by the standing rules. The executable human checklist is at `accessibility/MANUAL_SCREEN_READER_CHECKLIST.md`; the criterion stays **INCOMPLETE**. |
