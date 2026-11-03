# rc10 — gate table (G1–G15)

Evaluated against the pushed branch head of `arena/0eb61237-chuyen-anh`.
Baseline before rc10: `c427be25c9be`. PR **#81**, Draft, open — never merged,
tagged, released or deployed.

| Gate | Requirement | Evidence | Verdict |
| --- | --- | --- | --- |
| G1 | P3: every existing vocabulary row individually revalidated with a final disposition | `evidence/reference-resolutions.jsonl` — **5,852 of 5,852 rows** carry a disposition naming the reference consulted: `verified_agree` 576 · `verified_precedence` 1,006 · `verified_corrected` 915 · `verified_below_scope` 1,010 · `pending_ledger` 425 · `no_reference` 1,920. 1,921 corrections written with per-row source. | **PASS (with the dispositions stated)** |
| G2 | P4: every existing phrase row individually revalidated with a final disposition | **780 of 780 rows** carry a disposition: `phrase_listed` 6, `no_phrase_reference` 774; of the 6 attested rows `agree` 2 · `corrected` 2 · `precedence` 2. See `evidence/phrase-resolutions.jsonl` and `§ Phrase policy` below | **PASS (with the dispositions stated)** |
| G3 | P5: exactly 2,000 accepted unique new headwords | `evidence/new-headword-evidence.jsonl` — 2,251 authored seed rows, **2,000 land as new headwords** (0 rows removed, bank 5,852 → 7,852). Levels B1 261 · B2 739 · C1 642 · C2 358; POS n 1,084 · adj 499 · v 341 · adv 76; level source Oxford 3000/5000 610 · CEFR-J 1.5 734 · Octanove C1/C2 656; 1,206 also exam-attested, 794 list-only. Pool: `evidence/new-word-pool.json` (3,068 candidates). | **PASS** |
| G4 | P6: ≥300 accepted new phrases incl. ≥200 phrasal verbs | | |
| G5 | Individual reference lookup per required entry | | |
| G6 | Individual examination-evidence record per entry | 6,632 records in `exam-occurrences-{vocabulary,phrases}.jsonl` | PASS (archive class) |
| G7 | No fabricated evidence counted as verified | every row names source, locator and retrieval; tier rule keeps a frequency index from promoting a label | PASS |
| G8 | No unintended duplicates | 0 duplicate headword+POS, 0 duplicate phrase text | PASS |
| G9 | Existing vocabulary and progress preserved | No row deleted or renumbered: the 5,852 pre-rc10 rows keep IDs 1–5,852 (now 7,852 rows, IDs sequential 1–7,852); **archived stays 1,271**, deck 3,841 → 5,841 = 3,841 + the 2,000 new taught headwords; the 843 untagged legacy headwords stay Unclassified | PASS |
| G10 | Every CEFR study path obeys the selection | `tests/rc10-cefr.test.js`: 3,072 configurations | PASS |
| G11 | No unselected level leaks | same suite + browser probe | PASS |
| G12 | Words Only / Words + Phrases correct and persistent; phrase data unchanged by words-only work | tests 7–9 + phrase-bank hash | PASS |
| G13 | Lifetime stats and priority order unchanged | `stats()` path untouched | PASS |
| G14 | Full suites pass (Python, Node, Chromium, Firefox, WebKit) | Python **172 OK** · `static-app.test.js` **144 pass** · `rc10-cefr.test.js` **9 pass** on the rebuilt data; counts repinned to measured values only (no assertion loosened) | PASS locally / CI re-read per head |
| G15 | PR updated, pushed, accurate, stays Draft while gates are open | | |

**Overall: not complete yet.** The table is filled in as each gate closes; nothing
is claimed before it is measured on the pushed head.

## Evidence tiers used by G1

1. `publisher_entry` — a dictionary entry page read for this headword and part of speech (25 rows, and the Oxford list pages transcribed by hand).
2. `oxford_list` / `cefrj_1_5` / `octanove_c1c2` — published CEFR lists, cited per row with work, version, licence and locator.
3. `cefrpy` — frequency-derived index; cross-check only, never a level source.

A match requires headword **and** part of speech. 104 rows have the headword under a
different POS only: recorded as `posMismatchOnly`, and they grant nothing.

## Phrase policy

## Phrase policy

The phrase bank is a separate store, so rc10-vocabulary evidence never promotes a
phrase row and vice versa. `tools/phrase-resolve.py` gives every one of the 780
rows a disposition, and only whole-phrase lanes (`list lane`) may change a label:

| Disposition | Rows | Meaning |
| --- | --- | --- |
| `no_phrase_reference` | 774 | No consulted list or transcription attests the whole phrase. The row keeps its editorial level and is **not** counted as verified. |
| `phrase_listed` | 6 | The whole phrase is a listed item in a consulted source: `agree` 2 (stored level already matches), `corrected` 2 (stored level replaced by the listed level, written with its source), `precedence` 2 (the stored level wins because it comes from a higher-tier source than the list that attests the phrase). |

Constituent words never carry a phrase level: a phrase made of B1 words can be C1,
and the resolver refuses to derive one from the other. The two corrections are in
`evidence/corrections-applied.jsonl` (kind `phrase`) and in
`data/phrase-seed/*.tsv`; `data/phrases.json` is rebuilt from those seeds
(`scripts/build_phrases.py` → `scripts/embed_phrases.py`), 780 rows before and
after.

`exam-evidence.mjs` walked the transcription archive separately: 397 of 780
phrases occur verbatim in at least one transcribed paper (a **corpus** fact, kept
apart from the *level* evidence and never used to grant a level).

## G3 — how the 2,000 were reached, and what was refused

The 2,000 are not padding: every row names a published reference work, a locator
inside it, and (where it exists) the exam papers that use the word. What the
script could not know — the Vietnamese gloss and the topic — is authored per word
in `evidence/gloss-batches/batch1…8.txt` (2,251 rows; the submitted batches are
committed verbatim so the gloss for any headword can be traced back to its batch
and line).

Selection rules in `tools/new-word-pool.py`, all of them refusing rather than
inventing:

* the word must exist in an independent lexicon (`english-words` gcide+web2,
  264,494 entries) **or** be a derived/hyphenated form whose base or parts are in
  it — this is what rejected the Octanove list's non-word `porten` (noun, C2);
* it must not be in the bank and must not be an inflection of a bank headword;
* it must carry a content POS (n/v/adj/adv) and must not be a function word;
* it must not be A1/A2 in **any** consulted list (an elementary word never becomes
  an advanced headword because one publisher files it higher);
* its level must be B1–C2, and the recorded level is the highest tier available
  (Oxford list first).

Pools that were measured and **rejected** as not defensible, with the samples that
justify the rejection:

| Pool | Size | Why rejected |
| --- | --- | --- |
| Single-source words with no second source (pre-lexicon-gate run) | 3,303 | dominated by function words and closed-class items: `that`, `more`, `will`, `through`, `while`, `found`, `god` |
| Mixed-band A1/A2 words (elementary in one list, B1+ in another) | 149 | all basic vocabulary: `very`, `even`, `man`, `state`, `good` |
| Different-POS entries for existing headwords | 0 | every content-POS/level combination is already covered |

Two authoring defects were caught by the suites rather than by eye and are fixed:
`flip` was glossed `lật`, which is also a UI-translation key, so the app printed
`reveal` as its meaning (test 70/84 caught it); the gloss is now
`búng, trở (đồng xu, trang)`. Sixteen single-list entries of very low study value
(`emolument`, `munificence`, `divination`, `exorcism`, `exorcist`, `mystique`,
`neophyte`, `impresario`, `portraiture`, `pathos`, `maelstrom`, `zany`,
`farcical`, `emulsification`, `mundanity`, `taciturn`) were dropped on the record
to keep the count at exactly 2,000 instead of letting the batch overshoot.

Reproducing the whole step, in this order (the bank must be restored first, or
`add-headwords.py` refuses every row it already finds in it):

```sh
git checkout -- Learned_Vocabulary_List.md data/vocabulary.json
rm -f data/vocab-seed/21-exam-corpus-expansion.tsv evidence/new-headword-evidence.jsonl
python3 audit/rc10/tools/add-headwords.py audit/rc10/evidence/gloss-batches/batch*.txt
python3 scripts/expand_vocabulary.py && python3 scripts/build_vocabulary.py && python3 scripts/embed_vocabulary.py
```
