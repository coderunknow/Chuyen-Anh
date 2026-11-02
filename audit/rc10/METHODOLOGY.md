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
