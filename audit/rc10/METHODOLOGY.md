# rc10 — CEFR and examination-evidence methodology (as actually applied)

This file states what each evidence class means in this repository, what was
measured, and what was **not** done. It exists so a reviewer can check a claim
instead of trusting a summary.

## 1. Reference hierarchy

1. Cambridge English Vocabulary Profile / Cambridge Dictionary (CALD) CEFR badge
   printed on the sense being glossed.
2. Cambridge learner dictionaries (same publisher, different title) when the first
   is silent.
3. Oxford Learner's Dictionaries.
4. Longman Dictionary of Contemporary English.

Only the source's own printed level is recorded as `source_attested`. Frequency,
word length, "looks difficult", and the level of a neighbouring word are never
used to promote a label.

## 2. Evidence classes used in the audit layer

| Class | Meaning | Counts as verified? |
| --- | --- | --- |
| `source_attested` | A named reference prints a CEFR level for the sense the row glosses, and the URL + sense + retrieval date are recorded | **Yes** for that row |
| `unlabelled_in_reference` | The reference has the entry but prints no CEFR level | No — the stored editorial label stands, flagged `editorial_only` |
| `blocked_sense_not_read` | The lookup reached a different sense of the headword than the row stores | No |
| `editorial_only` | The row carries `level-source:editorial`; no reference lookup exists for it | No |
| `unclassified` | The row carries no level tag at all | No |
| `archive_transcription_repost` | The form occurs in one of the 106 transcribed papers under `De-chuyen-Anh-vao-10/` | Exam-occurrence evidence only — **never** an official-paper claim |

## 3. Examination evidence

`audit/rc10/tools/exam-evidence.mjs` indexes the fenced transcription blocks of all
106 papers and writes, per entry, the exact paper id, section anchor, the number of
occurrences in that paper, a short excerpt, and the paper's own provenance fields
(`nguon_trang`, `ngay_truy_cap`, `xac_minh`, `sha256_noi_dung`).

Every record is class `archive_transcription_repost`: the front matter of each
paper states it is a re-post (`xac_minh: ban-dang-lai-*`, source
`tailieudieuky.com`). No row in this repository is an official-paper verification,
and no record here claims the word was a tested answer.

Measured on 2026-11-02: 3,725 of 5,852 vocabulary rows and 397 of 780 phrases occur
at least once in the archive; 2,127 vocabulary rows and 383 phrases do not.

## 4. What the dispositions mean

| Disposition | Meaning |
| --- | --- |
| `inspected_accepted` | An individual lookup was read; the stored level agrees (or no level was stored and none is attested, so nothing changed) |
| `inspected_corrected` | An individual lookup disagrees with the stored level; the record holds the new level and, if it was applied, the dataset carries it |
| `machine_assessed` | Deterministic rule check only (structure, duplicates, exam occurrence, level-source). **Not** a per-entry review and never counted as one |

## 5. Duplicate policy

`take` / `take up` / `take into account` are three entries. A homonym in another
part of speech is a distinct entry (`dice` n vs `dice` v). A spelling variant or a
regular inflection of an existing headword is not a new headword. The audit layer
groups on `lowercase(headword) + POS` for vocabulary and on normalised text for
phrases; both report **0 duplicate rows** on the shipped dataset.

## 6. Known limitations (stated, not hidden)

- Per-entry reference lookups scale at roughly one page fetch per entry. 6,632
  existing rows plus 2,300 new items cannot be reviewed that way inside one
  session, so 5,846 vocabulary rows and all 780 phrases remain
  `machine_assessed`. **They are not claimed as verified.**
- Cambridge does not print a CEFR badge for every entry; `unlabelled_in_reference`
  is therefore a normal outcome, not a failure to look.
- The two attesting corrections found in this session (ids 2 and 3, C2) sit inside
  the frozen dev4 ledger window (ids 1–913). Applying them requires a documented
  ledger revision, which was not made; they are recorded as
  `correct_pending_ledger` in `manual-verifications.jsonl`.
- New-item quotas (2,000 headwords, 300 phrases with 200 phrasal verbs) are **not**
  met: 0 accepted so far. The candidate pipeline exists
  (`audit/rc10/tools/new-word-candidates.mjs`, 1,447 corpus-backed candidates)
  but no candidate has been through an individual reference lookup, and none is
  counted.

## 8. Reference lanes (added in the third round)

Primary attestation — opening one publisher page per entry — is the only evidence
that may change a label, and it costs a network round trip per entry. Two offline
lanes were added so that **no row is left without reference evidence**, and so the
rows worth the round trip are discoverable rather than sampled.

| Lane | Source | Coverage | Authority |
| --- | --- | --- | --- |
| `primary` | publisher pages read per entry (`dictionary.cambridge.org`, the Oxford list HTML) | 25 rows so far | **may change a label** |
| `mirror` | third-party TSV transcription of the official Oxford 3000/5000 lists (`github.com/voothi/20260715190122-oxford-3000-5000`) | 2,835 rows (48.5%) | may **target** attestation, never promote |
| `cefrj` | `cefrpy==1.0.3` (data pinned by sha256), derived from CEFR-J + Google Books 1-gram frequencies | 5,704 rows (97.5%) | cross-check only |

**Measured, not assumed.** The mirror's fidelity is computed against the primary
entries: **42 of 44 exact (95.5%)** on headword + part of speech + level, with two
documented defects — it drops the `about adj B1` sense (it collapses multi-POS
entries into one row) and it omits `accessory n C1` entirely. A 4.5% error rate
disqualifies it from promotion, and its omissions prove the direction of trust:
the mirror proposes, the publisher page decides.

The CEFR-J index is a frequency list, not dictionary annotation, and it shows:
agreement with the stored labels is **968 of 5,704 (17.0%)**, spread across every
stored band (stored C1 → index B2 585, C2 567, B1 417). That is not evidence that
4,736 rows are wrong; it is evidence that an editorial label and a frequency list
are different objects. Its value is coverage and triage, and it is reported as
`crosscheck_conflict`, never as an error count.

### Dispositions produced by the join

`attested` (primary exists) · `confirmed_by_lanes` (≥1 lane agrees) ·
`conflict_primary_needed` (a lane disagrees and no primary record exists) ·
`absent_everywhere` (no lane covers the row, currently 146). Only `attested` rows
count toward G1/G5; `confirmed_by_lanes` is corroboration and is labelled as such
in every record.

### The three reasons a correction is recorded but not written

1. `frozen_ledger` — id ≤ 913 is pinned by `tests/test_vocabulary_audit_dev4.py`.
2. `below_study_scope` — the reference says A1/A2 and the seed set is deliberately
   B1–C2; writing it would silently widen the study surface.
3. `blocked` — `evidence/correction-blocks.jsonl` names a consequence the level
   audit may not decide alone. Current case: `academic` → B1 makes the row match
   the `basic-b1` curation rule and archives it out of the deck.

Blocks and applied corrections are append-only: `correction-blocks.jsonl` for
refusals, `corrections-applied.jsonl` for writes, so a later reader can tell a
correction that was never made from one that was made and later superseded.

### Throughput, measured

One Oxford-list HTML chunk (≈8k tokens) yields ≈44–70 entries → 25 rows matched to
the bank → 16 disagreements → 8 corrections written. The Oxford list can only
ever reach the 2,835 rows it covers (≈113 chunks); the other 3,017 rows need one
dictionary page each. The offline lanes cost 1.2 s for all 5,852 rows. That
asymmetry — cheap reconciliation, expensive attestation — is the real constraint
on G1, and it is why the gates stay FAIL while coverage keeps rising.
