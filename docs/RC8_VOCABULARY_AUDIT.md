# RC8 Vocabulary & Phrase Bank Audit Report (`v1.0.0-rc8`)

- **Audit Date:** `2026-10-31`
- **Canonical Pipeline Verified:** `data/vocab-seed/*.tsv` → `scripts/expand_vocabulary.py` → `Learned_Vocabulary_List.md` (`5,852` rows) → `scripts/build_vocabulary.py` → `data/vocabulary.json` (`5,852` rows) → `scripts/embed_vocabulary.py` → `index.html` (`#vocabulary-data`)
- **Phrase Pipeline Verified:** `data/phrase-seed/*.tsv` → `scripts/build_phrases.py` → `Learned_Phrase_List.md` & `data/phrases.json` (`780` phrases) → `scripts/embed_phrases.py` → `index.html` (`#phrase-data`)
- **Active Focus Priority Deck:** **`3,841` headwords** (`100%` audited; **`0` `REVIEW` blockers remaining**)

---

## 1. Corpus Partition & Structural Reconciliation

| Partition | Row Count | Role in Runtime & Audits | Verification Check |
| --- | ---: | --- | --- |
| Total table / JSON rows | `5,852` | `913` pre-beta7 legacy rows + `4,939` curated seed rows (`1,285` duplicate/inflected/variant seed candidates deterministically skipped) | `expand_vocabulary.py --check`, `build_vocabulary.py --check` |
| Active headwords (root rule) | `5,112` | Rows without `family:merged`; exactly one headword per word root | `validate_vocab.py` (`0` duplicate IDs, `0` duplicate words) |
| Merged word-family forms | `740` | Tagged `family:merged` + `family-head:<id>`; surfaced under their root's `WORD_FAMILY` (`Cùng gốc: ...`) note rather than double-counted as separate cards | `test_every_family_form_points_at_a_headword_or_an_archived_head` |
| **Active Focus Deck (`KEEP`)** | **`3,841`** | Active headwords without `curation:archived`; scheduled in priority order `due → weak → learning → new → review → mastered` | `rc4_vocabulary_audit.py --check` (`reconciled: true`) |
| Archived Deck (`curation:archived`) | `1,271` | `basic-b1` (`516`), `everyday-object` (`403`), `food-drink` (`189`), `nature-species` (`163`); searchable & progress-preserving, excluded from study sessions and distractors | `test_archived_rows_are_absent_from_the_study_deck` |
| Dedicated Phrase Bank | `780` | Idioms, phrasal verbs, collocations, and prepositional phrases with cloze examples and Vietnamese glosses | `build_phrases.py --check`, `validate_phrases.py`, `embed_phrases.py --check` |

---

## 2. Resolution of All `REVIEW` & Provenance Findings (`RC8-VOC-001..004`)

### 2.1 `RC8-VOC-001` — Identical English/Vietnamese Glosses Eliminated (`3` → `0` `REVIEW` Items)
In `v1.0.0-rc7`, three active focus-deck entries stored an English loanword string identical to the English headword as their Vietnamese `meaning`, causing `glossEqualsWord(entry)` to suppress them across 6 of 8 exercise modes (`MC_EN_VI`, `MC_VI_EN`, `MC4`, `FILL_VI`, `FILL_EN`, `MATCH`) and leaving `3` unresolved `REVIEW` items in `docs/rc4-vocabulary-audit.json`:

| ID | Headword | POS | Level / Topic | `rc7` Gloss (Defective) | `rc8` Gloss (Corrected in Seed TSV & Rebuilt) |
| ---: | --- | :---: | --- | --- | --- |
| `4188` | `proton` | `n` | `C1` · `science` | `proton` | `hạt mang điện tích dương trong hạt nhân nguyên tử` |
| `4492` | `gluten` | `n` | `C1` · `health` | `gluten` | `chất đạm kết dính có trong lúa mì và ngũ cốc` |
| `4494` | `cholesterol` | `n` | `B2` · `health` | `cholesterol` | `chất béo dạng sáp có trong máu và tế bào` |

- **Result:** `docs/rc4-vocabulary-audit.json` `counts.reviewed` decreased from `3` to **`0`**, and all 3 entries are now playable across `MC_EN_VI`, `MC_VI_EN`, `MC4`, `FILL_VI`, `FILL_EN`, `MATCH`, and `FLASHCARD` with zero headword leakage.

### 2.2 `RC8-VOC-002` — Legacy `exam-corpus` Attestation Count Drift Resolved (`33` Unexplained → `0`)
In `v1.0.0-rc7`, `scripts/expand_vocabulary.py` (`legacy_sources`) hardcoded `1` (`form '<word>' occurs in 1 transcribed exam(s)`) when extracting `[paper.md:line]` citations from legacy `NOTES` (`IDs 614–913`), causing `33` unexplained count mismatches against the actual 106-exam corpus index (e.g., `Distinguish` claimed `1` vs `11` measured; `Exceed` claimed `1` vs `5` measured).
- **Fix:** Updated `legacy_sources()` in `scripts/expand_vocabulary.py` to query `exam_locator(index, observed)` for the exact corpus document count while preserving the cited paper/line locator.
- **Result (`docs/vocabulary-quality-audit.json`):**
  - `claimsChecked`: `5,112`
  - `claimsMatched`: **`5,104`** (up from `5,072`)
  - `mismatchUnexplained`: **`0`** (down from `33`; the remaining `8` differences are `100%` explained by inflected surface citations such as `expenditures` for `Expenditure`, `deceived` for `Deceive`, etc.)

### 2.3 `RC8-VOC-003` & `RC8-VOC-004` — Encoding, POS, Answer-Leakage, and Evidence Audit
- **Unicode NFC & Mojibake Check:** `0` non-NFC strings, `0` replacement characters (`U+FFFD`), and `0` empty `word`/`pos`/`meaning` fields across all `3,841` focus entries and `780` phrases.
- **Prompt Answer-Leakage Check:** `16` entries include parenthetical English usage collocations in `meaning` (e.g., `453 Derive`: `bắt nguồn từ (derive from)...`). Runtime `maskAnswerInPrompt()` masks any occurrence of the target headword before rendering recall/spelling prompts; automated testing across all `3,841` focus entries verified **`0` unmasked headword leaks** in `MC_VI_EN`, `FILL_VI`, `FILL_EN`, and `CLOZE`.
- **Non-Corpus Focus Evidence Classification (`docs/vocabulary-evidence-review.json`, `923` items):**
  - `phrase-in-corpus`: `14`
  - `surface-variant` (inflection/derivation attested in exam corpus): `188`
  - `multiword-words-only`: `5`
  - `exam-format-only` (word-formation/linker stems): `5`
  - `dictionary-only` (Cambridge locator + curated gloss, primarily `C1`/`C2` academic lexis): `698`
  - `no-basis` (legacy pre-beta7 idioms/grammar notes kept explicitly for learner continuity, never silently deleted): `13`

---

## 3. All 8 Exercise Modes Availability & Integrity Audit (`3,841` Focus Headwords)

| Mode Constant | Runtime Key | Eligible Focus Cards (`rc7` → `rc8`) | Coverage (`rc8`) | Fallback & Pedagogical Behavior |
| --- | --- | ---: | ---: | --- |
| `MC_EN_VI` | `mc_en_vi` | `3,838` → **`3,841`** | **`100.00%`** | 4-option English → Vietnamese recognition with POS-matched focus distractors (archived rows never used as distractors) |
| `MC_VI_EN` | `mc_vi_en` | `3,838` → **`3,841`** | **`100.00%`** | 4-option Vietnamese → English recall with `maskAnswerInPrompt` protection |
| `MC4` | `mc4` | `3,838` → **`3,841`** | **`100.00%`** | Bidirectional 4-way multiple choice |
| `FILL_VI` | `fill_vi` | `3,838` → **`3,841`** | **`100.00%`** | Vietnamese meaning recall input with normalized grading |
| `FILL_EN` | `fill_en` | `3,835` → **`3,838`** | **`99.92%`** | English headword spelling recall; 3 meta-grammar/slash entries (`Subjunctive structure`, `Lest + S + (should) V-bare`, `Burn one's bridges/boats`) intentionally guarded by `isTypableHeadword` |
| `CLOZE` | `cloze` | `1` (`+ 780 / 780` phrases) |Contextual fallback | Uses curated example sentences (`100%` of the `780`-item Phrase Bank + contextual vocabulary rows); `buildExercisePlan` automatically substitutes an eligible recall/recognition mode when an item has no prose example so sessions never stall |
| `MATCH` | `match` | `3,838` → **`3,841`** | **`100.00%`** | 4-pair matching board (`createMatchState`) with first-look preview for unstudied words |
| `FLASHCARD` | `flashcard` | `3,841` → **`3,841`** | **`100.00%`** | Active recall flip card with spaced-repetition scheduling (`due → weak → learning → new → review → mastered` preserved unchanged) |
