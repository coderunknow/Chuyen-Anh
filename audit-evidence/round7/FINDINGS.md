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

| **R1** | Criterion 9 claimed **PASS** on a *request* at `9edc2a0`, not a completion at the SHA being assessed | `e538bb6` | Evidence now cites `completed/success` at `e538bb6` |
| **R2** | The coverage matrix cited lost probes for rows that committed tests actually cover, and claimed unknown keys were *refused* when the test proves they are *ignored* | `e538bb6` | Matrix rebuilt row by row against `exam-scoring` test names |
| **R3** | The reproduction recipe's gate loop reported only its last iteration, so an early failure could pass — and the documented total was **17**, actually **16** | `e538bb6` | Recipe rewritten with a failure counter and `[ "$fail" -eq 0 ]`; number corrected in four files |

R1–R3 were raised by CodeRabbit on `e538bb6` (`4546621788`, `4546621792`,
`4546621797`). All three were about **this audit's own evidence documents**, not
the application, and all three were valid. R3 is the instructive one: fixing it
proved the number it documented had been wrong, because the old loop counted the
retired script as a pass.

| **R4** | Criteria 12/13 cited results from `ac445f4`, not the reviewed `ac2f216` — and criterion 13 said WebKit "pending" while the table said pass | `ac2f216` | Node and Python re-run **at `ac2f216`**; CI green on all four jobs at that commit; table reconciled |
| **R5** | The expected gate total (16) did not match the recorded per-script PASS lines | `ac2f216` | Both were wrong. The real figure is **18 document `--check`, 17 pass**: the 16 omitted `scripts/exams/embed_archive.py`. Recipe now prints exactly `17 passed, 0 failed, 2 no-arg-parse` |
| **R6** | The `--help` sweep cannot distinguish a non-validator from a `--check` validator that crashes before argparse | `ac2f216` | Loop classifies such scripts as `NO-ARG-PARSE` and reports the count instead of dropping them |

| **R7** | The `NO-ARG-PARSE` branch tolerated **any** script whose help crashed, not just the two known build tools, so a broken validator could shrink the gate set and still report success | `0c8587a` | Skip list is now explicit by name; every other help failure is `HELP-FAIL` and exits non-zero; final assert requires `pass -eq 17`. Control: broken import → `HELP-FAIL`, exit 1, 16 passed |

R7 was raised as a **Major** (`4547516961`) and it was the best finding of the
session: my previous fix for R6 had replaced one silent-drop with another. The
lesson is specific — *a tolerance must be enumerated, never inferred from the
symptom*. "It crashed, so it must not be a validator" is the same reasoning that
lets a broken gate pass, and the two build tools are the only scripts entitled to
that excuse, by name.

## D75 — build tools that ignore `--help`

`scripts/exams/build_archive.py` and `scripts/release_artifacts.py` have no
argument parser. They do not recognise `--help`; they **execute**, and the help
sweep therefore *runs them*: the first tries to build the archive and dies on a
missing fixture, the second requires an asset host.

Not a security or data problem, and not a failing gate — they are build tools,
and the loop now classifies them rather than counting them. But a tool that
answers `--help` by doing the work is a real hazard: any sweep, wrapper or future
verification step that probes scripts for flags will execute them. Recorded as
**D75, open**, with the disposition that the gate loop tolerates it explicitly.

**Why R5 matters more than its size suggests:** this was the second time in one
session that a number in these documents was wrong, and both times the error was
found by *executing the documented recipe* rather than by re-reading it. The first
correction (17 → 16) was itself wrong. That is the argument for making every number
reproducible by a command in this directory, which is what `EVIDENCE_MANIFEST.md`
now does.

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
