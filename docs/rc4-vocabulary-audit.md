# RC4 Vocabulary Audit — v1.0.0-rc4 (unreleased candidate)

- **Audit date:** 2026-10-28
- **Rows inspected:** 5,852 (5,112 headwords + 740 family forms)
- **Status:** no vocabulary row, ID, meaning, level tag, family link or curation decision was changed by this audit; `corrected = 0`, `added = 0`.

## A. Reconciled counts

| Measure | Count |
| --- | --- |
| Inspected rows | 5,852 |
| Inspected headwords | 5,112 |
| Retained (KEEP, in the focus deck) | 3,841 |
| Excluded (EXCLUDE_BASIC, archived) | 1,271 headwords / 1,271 rows |
| Reviewed (REVIEW queue) | 3 |
| Corrected | 0 |
| Added | 0 |

Retained + excluded headwords equal the inspected headword count (3,841 + 1,271 = 5,112), and every excluded row carries exactly one category:

| Category | Rows |
| --- | --- |
| `basic-b1` | 516 |
| `everyday-object` | 403 |
| `food-drink` | 189 |
| `nature-species` | 163 |

## B. Policy replay (the map, not the tags, decides)

`docs/vocabulary-curation.json` was replayed through the shipping engine (`scripts/vocabulary_curation.matched_rows`) against the Markdown table: **1,271 decisions**, **1,271 stored archived rows**.

**Result: reconciled.** No row is tagged archived without a policy decision, no decision is missing a tag, no row carries the wrong category, and the engine reported no problems.

The replay also proves *why* each excluded row is excluded: the decision carries its rule id (`block:<seed>`, `rule:<id>`, or `listed`) and the category whose rationale is in `docs/vocabulary-curation.json`.

## C. Selection-scope proof (exclusion is functional, not cosmetic)

In `index.html` the deck boundary is built once at boot:

```js
const archivedIds = new Set(vocabulary.filter(isArchivedEntry).map(entry => entry.id));
const deck = vocabulary.filter(entry => !archivedIds.has(entry.id));
```

`deck` (not `vocabulary`) feeds every scheduling and question path: `selectSession`, `selectPrioritySession`, `studyGroupCandidates`, `sprintEligibleCount`, `selectSprintSession`, `buildExercisePlan(..., { vocabulary: deck })`, `generateQuestion`, `gradeAnswer`, the weak-word list in the dashboard, the Settings flagged list and the search index's distractor pool. Archived rows remain in `vocabulary` so that IDs, stored progress, favourites, backups and the search screen survive curation.

Curriculum cross-check: **201** curriculum words were transcribed for grades 6-9; **82** of them exist in the bank; **14** are excluded and **68** are still taught.

Every curriculum-level word (A1-B1) that is still taught is a **family root** whose note teaches the derived forms (`Cùng gốc: …`), which is the documented exemption in the curation map. No unexplained retention.

## D. High-quality inclusion standard, as shipped

The standard asks each retained entry to earn its place with an advanced sense, a word family, a collocation, a phrasal verb, an idiom or a confusable. The schema can carry all of these; here is what the rows actually contain:

| Standard signal | Retained headwords carrying it |
| --- | --- |
| Word-formation / advanced-sense type | 79 |
| Academic register type | 1,037 |
| Word-family note (`Cùng gốc:`) | 862 |
| Editorial note | 294 |
| Register or connotation | 8 |
| Idiom entry | 24 |
| Phrasal-verb entry | 13 |
| Collocation entry | 9 |
| Confusable pair entry | 34 |
| Linker entry | 59 |
| Synonym list | 0 |
| Antonym list | 0 |
| Collocation list | 0 |
| Example sentence | 0 |

**Gap, stated plainly:** the shipped bank documents word families and senses well and collocations/idioms/phrasal verbs only as separate headwords; the `synonyms`, `antonyms`, `collocations` and `examples` fields are empty on almost every row. Filling them is authoring work that needs a source per row, so this audit measures the gap and does not invent content to close it.

## E. REVIEW queue

| ID | Word | Level | Why it needs a human |
| --- | --- | --- | --- |
| 4188 | `proton` | C1 | the stored Vietnamese gloss is identical to the English headword, so the card shows no meaning |
| 4492 | `gluten` | C1 | the stored Vietnamese gloss is identical to the English headword, so the card shows no meaning |
| 4494 | `cholesterol` | B2 | the stored Vietnamese gloss is identical to the English headword, so the card shows no meaning |

These rows stay exactly as they are until an editor decides; they were not auto-archived and their IDs and progress are untouched.

## F. Exam attestation of excluded rows (considered, not used)

**843** excluded rows are attested in at least one transcribed exam, and **423** in five or more (maximum 106). The curation map already states why that is not a reinstatement criterion: an exam paper is full of basic words, and their presence is not evidence that the word discriminates between candidates. No row was reinstated on frequency alone.

## G. How to reproduce

```bash
python scripts/rc4_vocabulary_audit.py          # rewrite this report and its JSON
python scripts/rc4_vocabulary_audit.py --check  # fail if the committed report is stale
python -m unittest tests.test_rc4_vocabulary_audit -v
```

## H. What this audit does not claim

- The CEFR level of a row is an editorial tag, not a curriculum mapping; the audit reports it, it does not re-derive it.
- Curriculum words were transcribed from third-party reproductions of the Global Success series; grades 6 and 7 are topic-level only because the retrieved teacher-training documents publish no per-unit word table.
- Exam attestation counts come from the repository's own transcription corpus and are not evidence that a word is worth teaching.
- Vietnamese gloss semantics were not re-edited; the audit only flags a gloss that repeats the headword.
