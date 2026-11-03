# rc10 — gate table (G1–G15)

Evaluated against the pushed branch head of `arena/0eb61237-chuyen-anh`.
Baseline before rc10: `c427be25c9be`. PR **#81** — merged, released as `v1.0.0-rc10`, Pages deployed.

| Gate | Requirement | Evidence | Verdict |
| --- | --- | --- | --- |
| G1 | P3: every vocabulary row carries a final disposition naming the reference consulted | **7,852 of 7,852** rows: `verified_agree` 576 · `verified_precedence` 1,006 · `verified_corrected` 915 · `verified_below_scope` 1,010 · `pending_ledger` 425 · `no_reference` 1,920 · **`verified_new_reference` 2,000** (the P5 rows, each naming its list entry). 1,921 corrections written with per-row source. `machine_assessed` = 0. | **PASS (with the dispositions stated)** |
| G2 | P4: every phrase row carries a final disposition naming the reference consulted | **1,094 of 1,094** rows: `phrase_listed` 6 (`agree` 2 · `corrected` 2 · `precedence` 2) · `no_phrase_reference` 774 · **`verified_constituent_bound` 314** (the P6 rows, each naming its hardest constituent's published entry and the papers that contain the whole phrase). `machine_assessed` = 0. | **PASS (with the dispositions stated)** |
| G3 | P5: exactly 2,000 accepted unique new headwords | `evidence/new-headword-evidence.jsonl` — 2,251 authored seed rows, **2,000 land as new headwords** (0 rows removed, bank 5,852 → 7,852). Levels B1 261 · B2 739 · C1 642 · C2 358; POS n 1,084 · adj 499 · v 341 · adv 76; level source Oxford 3000/5000 610 · CEFR-J 1.5 734 · Octanove C1/C2 656; 1,206 also exam-attested, 794 list-only. Pool: `evidence/new-word-pool.json` (3,068 candidates). | **PASS** |
| G4 | P6: ≥300 accepted new phrases incl. ≥200 distinct phrasal verbs | `evidence/new-phrase-evidence.jsonl` — **314 accepted**: phrasal-verb **228** · idiom 52 · collocation 18 · dependent-preposition 15 · fixed-expression 1. Levels B1 275 · B2 23 · C1 16. Pool `evidence/new-phrase-pool.json` (343 candidates from 1,192 checked); every accepted row occurs in ≥1 transcribed paper and names its constituents' published entries. Bank 780 → 1,094 rows; phrasal verbs 184 → 412. | **PASS** (228 ≥ 200, 314 ≥ 300) |
| G5 | Individual reference lookup per required entry | **PASS** — every one of the 7,852 vocabulary rows and 1,094 phrase rows names the reference consulted. Vocabulary: 5,852 pre-rc10 rows resolved via `reference-resolutions.jsonl` (Oxford/CEFR-J/Octanove lanes); 2,000 new rows each carry `levelWork` + `levelLocator` in `new-headword-evidence.jsonl` (2,251 authored rows). Phrases: 314 new rows each name their hardest constituent's published entry and corpus locators in `new-phrase-evidence.jsonl`. 6 manual inspections recorded in `manual-verifications.jsonl` (Cambridge CALD lookups with URL and retrieved date). 1,921 corrections written with per-row source; `machine_assessed == 0`. | **PASS** |
| G6 | Individual examination-evidence record per entry | **8,946 records** in `exam-occurrences-{vocabulary,phrases}.jsonl` — 7,852 vocabulary rows and 1,094 phrase rows, each with its `source.paper`, `questionNumber` and retrieval timestamp. Archive class is `archive_transcription_repost` for all 106 papers; 4,502 vocabulary and 617 phrase rows have a real occurrence, the rest are recorded as not found. | **PASS** |
| G7 | No fabricated evidence counted as verified | every row names source, locator and retrieval; tier rule keeps a frequency index from promoting a label | PASS |
| G8 | No unintended duplicates | 0 duplicate headword+POS, 0 duplicate phrase text | PASS |
| G9 | Existing vocabulary and progress preserved | No row deleted or renumbered: the 5,852 pre-rc10 rows keep IDs 1–5,852 (now 7,852 rows, IDs sequential 1–7,852); **archived stays 1,271**, deck 3,841 → 5,841 = 3,841 + the 2,000 new taught headwords; the 843 untagged legacy headwords stay Unclassified | PASS |
| G10 | Every CEFR study path obeys the selection | `tests/rc10-cefr.test.js`: 3,072 configurations | PASS |
| G11 | No unselected level leaks | same suite + browser probe | PASS |
| G12 | Words Only / Words + Phrases correct and persistent; phrase data unchanged by words-only work | tests 7–9 + phrase-bank hash | PASS |
| G13 | Lifetime stats and priority order unchanged | `stats()` path untouched | PASS |
| G14 | Full suites pass (Python, Node, Chromium, Firefox, WebKit) | **CI green on the final head `72afdc7` — `41622636566` (checks + chromium/firefox/webkit, all success) and `41622636304` (Validate exam archive, success)**, plus workflow run `41610896238` "Validate exam archive" success. Local: Python **176 OK** · `static-app.test.js` **144 pass** · `rc10-cefr.test.js` **9 pass** · `browser-learning.cjs` **PASS on chromium 131.0.6778.0** · `browser-exams.cjs` **PASS on chromium 131.0.6778.0**. Firefox and WebKit run only in CI. Four stale count assertions in `browser-learning.cjs` were found and repinned to the measured values by running it (780 → 1094 phrases, 3.841 → 5.841 focus words, 780 → 1094 phrase records); no assertion was removed or loosened | **PASS** (CI + local) |
| G15 | PR updated, pushed, accurate, merged and released | head **`72afdc7`** on `arena/0eb61237-chuyen-anh`; PR #81 merged into `main` (merge commit `a6c1ca6`), tag `v1.0.0-rc10` at `72afdc7`, prerelease published 2026-11-03T13:58:24Z, Pages deployed at https://coderunknow.github.io/Chuyen-Anh/ (run `41649172113` deploy success, smoke test `41648090805` success). Body lists every phase with its measured numbers. | **PASS** |

**Overall: G1–G4 (P3–P6) are closed with measured numbers**; the table's own G5,
G6, G8, G10–G13 keep their earlier verdicts but were re-checked against the
rebuilt data, because the figures three of them name (row count, deck count,
phrase count) moved: 7,852 rows / 7,112 headwords / 5,841 taught / 1,094 phrases.
Nothing in this table is claimed before it is measured on the pushed head, and
the PR stays Draft until the browser-engine CI on the final head is read.

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

## G4 — how the 314 new phrases were reached, and what was refused

The phrase bank had 780 rows and no phrasal verbs beyond the original 184. P6 adds
**314 rows: 228 phrasal verbs, 52 idioms, 18 collocations, 15 dependent
prepositions and 1 fixed expression**, so the bank now carries 412 phrasal verbs.

Two facts decided the method:

1. **No open phrase-level CEFR reference covers English phrasal verbs.** Measured
   on the sources this audit already pins: the Oxford 3000/5000 TSV carries 10
   multi-word entries (`all right`, `next to`, `per cent`…), CEFR-J 1.5 carries
   144 (mostly compounds such as `bus stop`), Octanove C1/C2 carries 10 — of which
   only seven are verb + particle (`apt to`, `bulk up`, `dole out`, `eke out`,
   `glory in`, `mull over`, `pertain to`). Nothing in the legal-and-citable pool
   grades `get up` or `turn a blind eye`.
2. **A phrase level is not the level of its words, in either direction.**
   `get up` is two A1 words and a B1 item; `turn a blind eye` contains three basic
   words and is C1 in practice. So the rule used for new *words* (reject anything
   with an A1/A2 constituent) would have been wrong here and is deliberately not
   applied.

What each new row therefore claims, and nothing more:

* **the whole phrase occurs in a transcribed exam paper** — proven with file and
  line, ≥1 paper required, and the count of distinct papers is stored per row
  (`corpusPapers`, `corpusLocators`);
* **its level is bounded by its hardest constituent**, whose published entry
  (work + locator) is named per row; the B1 floor is declared editorial, because
  the bank teaches B1–C2 and no consulted list grades the phrase itself;
* the Vietnamese meaning and usage note are **authored** and say so
  (`meaningAuthorship`).

1,192 candidate phrases were checked; 549 were refused for having no occurrence in
any transcribed paper, 284 for already being in the bank, 4 for already being a
legacy vocabulary headword (`rule out`, `write off`, `in the face of`), 9 for a
constituent with no published entry at all, and 6 for having no content word. The
refusals are listed by phrase in `evidence/new-phrase-pool.json`.

Reproducing the step, in this order (the bank and the phrase JSON must be restored
first, or the pool sees the expanded bank and refuses everything):

```sh
git checkout -- Learned_Phrase_List.md data/phrases.json
rm -f data/phrase-seed/07-rc10-expansion.tsv evidence/new-phrase-evidence.jsonl
python3 audit/rc10/tools/new-phrase-pool.py
python3 audit/rc10/tools/add-phrases.py evidence/phrase-batches/batch1.txt evidence/phrase-batches/batch2.txt
python3 scripts/build_phrases.py && python3 scripts/embed_phrases.py
python3 audit/rc10/tools/phrase-resolve.py && node audit/rc10/tools/build-audit.mjs
```

## A defect rc10 introduced and then removed: exam inference must not grow with the bank

`scripts/exams/build_answer_keys.mjs` infers a provisional key for a paper that has
no key of its own by scoring each option against the **teaching bank** (the phrase
bank and the vocabulary list). rc10 added 2,000 words and 314 phrases to that bank,
so the score of every option rose a little — and eight items that had *no* key at
all crossed the threshold and became "scorable" answers:

| Paper | Item | Inferred | Confidence | Review |
| --- | --- | --- | --- | --- |
| `2022/bac-kan/so` | 33 | A. way | LOW | **wrong** — the transcription's own gloss reads `get/fall/settle into a routine`, so the key is C. routine |
| `2022/tay-ninh/so` | 23 | D. steer | MEDIUM | right — `steer clear of` (a phrase rc10 added) genuinely fits |
| `2023/da-nang/so` | 7 | C. test | MEDIUM | unverified |
| `2023/dak-nong/so` | 32 | B. achieve | MEDIUM | unverified |
| `2023/ha-noi/chuyen-su-pham` | 35 | C. touch | MEDIUM | unverified |
| `2023/hung-yen/so` | 5 | B. practice | MEDIUM | unverified |
| `2025/quang-ninh/so` | 5 | B. rise | MEDIUM | unverified |
| `2026/lao-cai/so` | 3 | A. together | MEDIUM | unverified |

That is not an acceptable trade: a learner would be graded against a machine guess
that only appeared because the vocabulary list got longer. A word added to the
teaching bank is not evidence about a 2022 exam paper.

**Fix, and why it is a boundary rather than a tweak:** inference now reads
`scripts/exams/inference-lexicon.json` — the vocabulary and phrases that existed
when the keys were last reviewed (`c427be2`: 5,852 words, 780 phrases). Extending
that pin is a human decision recorded in the file, made with the diff of
`data/exam-answer-keys.json` in front of the reviewer.

Measured after the fix: the regenerated `data/exam-answer-keys.json`,
`docs/exam-scoring-audit.json` and `.md` are **byte-identical to the pre-rc10
artifacts** (3,011 of 6,804 scorable, 3,793 missing), i.e. rc10 changed no answer
key. The eight items above are recorded in
`evidence/exam-inference-impact.jsonl` with their review, and
`tests/test_exam_inference_pin.py` (4 tests) holds the three properties that keep
the pin honest: it names its revision, every pinned row still exists, and the rc10
additions are genuinely outside it while the builder reads it.

This is also why `--check` on `build_answer_keys.mjs` failed on the previous heads:
the enlarged bank had changed the generated keys, and the workflow was right to
refuse them.
