# v1.0.0 candidate — defect ledger (branch `arena/6b7c2879-chuyen-anh`)

Baseline: `f12b4bc5241e330eb8c051ada749d4f514111b61` (main). Every defect found while
building the v1.0.0 candidate on this branch is listed with its disposition. Nothing
was silently patched: each entry names the file, the symptom, and the fix commit.

| # | Defect | Symptom | Disposition |
| --- | --- | --- | --- |
| D1 | `scripts/cefr_senses.py` `_oxford_sense_pos` stripped trailing dots, so `OXFORD_POS_MAP` keys like `"n."` never matched and every Oxford row fell through to the all-rows fallback | 12 bogus multi-sense splits (kind, counter, mine, …) | **FIXED** in `213eb61`: replaced with longest-first `OXFORD_POS_LABELS` regex over the POS cell; `oxford_sense_rows` now returns only POS-intersected rows (no fallback). Post-fix: 8 evidence-backed multi-sense entries (rest, ring, bank, lie, race, rock, tear, used) |
| D2 | Seed levels whitelisted to B1–C2 in `scripts/expand_vocabulary.py` | Phase III A1/A2 seeds rejected | **FIXED** in `2e33735`: `LEVELS` now admits A1/A2 |
| D3 | `POS_ALIASES` lacked det/modal/number/interj | new A1/A2 function-word entries would lose HIGH-confidence POS matching | **FIXED** in `2e33735`: aliases added (no pre-existing entry uses those POS letters as a tag, so no old classification changed — verified by `build_senses.py --check` after rebuild) |
| D4 | 23 new seed glosses contained their own headword | `maskAnswerInPrompt` masked the correct option in mc4, breaking the four-distinct-options invariant in `tests/static-app.test.js` | **FIXED** in `2e33735`: glosses rewritten (e.g. `video` → "phim ngắn trên mạng"); bank-wide self-masking scan now shows only the 71 pre-existing legacy loanword rows |
| D5 | rc4 audit counted Phase III A1/A2 curriculum words as "unexplained retentions" | `test_rc4_vocabulary_audit` failed; report review queue non-empty | **FIXED** in `2e33735`: rows whose `level-source:` names a published reference (CEFR-J / Oxford 3000, never `editorial`) are documented as `attestedByPublishedLevel` (27 rows); `unexplained` is 0 again |
| D6 | Stale count pins across test suites after Phase III (+1,000 headwords) | node/python/browser suites failed on 7,852/7,112/5,841/3,642 pins | **RE-PINNED** in `2e33735`/`8626f27` to measured values (8,852/8,112/6,841/3,724); no assertion removed or loosened |
| D7 | Chromium ≥ ~150 reports `outline-width: 3px` on `#content` even when `.content:focus` sets `outline-style: none` (nothing is painted) | `browser-learning.cjs` focus assertion failed on chromium 153.0.8010.0 | **RE-PINNED** in `8626f27`: assertion now accepts `outline-style: none` (no paint) or width `0px`; verified in-engine that the style is `none` |
| D8 | Skip-rotation pin compared the whole flashcard head, whose CEFR badge legitimately follows the rotated card (seeded words 298/2 sit at C1/C2) | `browser-learning.cjs` failed after the sense-level badges landed | **RE-PINNED** in `8626f27`: the invariant now compares the turn counter (`n / m lượt · k còn lại`), which is what "without adding a turn" means |
| D9 | 8 exam papers claim "Có nội dung đáp án trong bản chép" but the stored transcription contains no answer section (`answerClaimWithoutSectionIds`) | provenance audit flags them | **DOCUMENTED, NOT RECOVERED**: recovering keys from the source claim without the section in hand would be fabrication; items stay `missing_answer` / `insufficient_evidence` (exempt, documented). List: 2022/ha-noi/so, 2022/hai-duong/so, 2022/dong-thap/so, 2023/ba-ria-vung-tau/so, 2023/phu-yen/so, 2023/dong-nai/so, 2024/tp-ho-chi-minh/so, 2026/quang-tri/so |
| D10 | 0/106 papers have an official primary source bundled | `officialScore` can never be non-null | **BY DESIGN**: runtime emits `officialScore: null` (summary) / `false` (attempt); no item is labelled official_verified; inference lexicon stays fail-closed (`tests/test_exam_inference_fail_closed.py`) |

Open / accepted limitations (not defects, stated honestly):

- Scorable exam coverage is 3,011/6,804 (44.25%); the 3,793 ungradeable items each carry
  a documented exempt reason (no-source-answer 3,228 · stimulus-incomplete 488 ·
  key-not-an-option 22 · letter-with-mismatched-text 11 · option-overflow 21 ·
  multiple-letters-for-single-item 23). **Unresolved non-exempt blockers: 0.**
- Firefox/WebKit browser suites run in CI (playwright install), not in this sandbox;
  locally both suites pass on chromium 153.0.8010.0.
