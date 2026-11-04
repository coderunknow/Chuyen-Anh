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
| D5 | rc4 audit counted Phase III A1/A2 curriculum words as "unexplained retentions", and its initial exemption matched B1 rows too | `test_rc4_vocabulary_audit` failed; then 13 B1 rows moved out of `pendingCurationReview` | **FIXED** in `2e33735` and tightened in review round: `attestedByPublishedLevel` is restricted to A1/A2 rows (13 rows), restoring the 13 B1 rows to `pendingCurationReview`; `unexplained` stays 0 |
| D6 | Stale count pins across test suites after Phase III (+1,000 headwords) and hierarchy fix | node/python/browser suites failed on old count pins | **RE-PINNED** in `2e33735`/`8626f27` and review round to measured values (8,852 rows / 8,112 headwords / 6,841 deck / 3,032 default B2+C1 eligible); no assertion removed or loosened |
| D7 | Chromium ≥ ~150 reports `outline-width: 3px` on `#content` even when `.content:focus` sets `outline-style: none` (nothing is painted) | `browser-learning.cjs` focus assertion failed on chromium 153.0.8010.0 | **RE-PINNED** in `8626f27`: assertion now accepts `outline-style: none` (no paint) or width `0px`; verified in-engine that the style is `none` |
| D8 | Skip-rotation pin compared the whole flashcard head, whose CEFR badge legitimately follows the rotated card (seeded words 298/2 sit at C1/C2) | `browser-learning.cjs` failed after the sense-level badges landed | **RE-PINNED** in `8626f27`: the invariant now compares the turn counter (`n / m lượt · k còn lại`), which is what "without adding a turn" means |
| D9 | 8 exam papers claim "Có nội dung đáp án trong bản chép" but the stored transcription contains no answer section (`answerClaimWithoutSectionIds`) | provenance audit flags them | **DOCUMENTED, NOT RECOVERED**: recovering keys from the source claim without the section in hand would be fabrication; items stay `missing_answer` / `insufficient_evidence` (exempt, documented). List: 2022/ha-noi/so, 2022/hai-duong/so, 2022/dong-thap/so, 2023/ba-ria-vung-tau/so, 2023/phu-yen/so, 2023/dong-nai/so, 2024/tp-ho-chi-minh/so, 2026/quang-tri/so |
| D10 | 0/106 papers have an official primary source bundled | `officialScore` can never be non-null | **BY DESIGN**: runtime emits `officialScore: null` (summary) / `false` (attempt); no item is labelled official_verified; inference lexicon stays fail-closed (`tests/test_exam_inference_fail_closed.py`) |
| D11 | `scripts/cefr_senses.py`: combined-POS Oxford cells (`v. A1, n. B2`) leaked another POS's level; word-level Oxford outranked CEFR-J/Octanove in `_resolve_level`; multi-sense `cross_validated` accepted same-publisher agreement; `validate_senses` did not enforce `needsIndependentValidation=true` on `editorial_estimate` | sense distribution skewed high (e.g. `scope` resolved C1 instead of B1) and validator missed missing-flag estimates | **FIXED** in PR #82 review round: `_oxford_pos_levels` maps per-POS levels; `_resolve_level` order set to `["cefrj", "octanove", "oxford"]` matching documented hierarchy; `cross_validated` requires non-Oxford agreement; `validate_senses` enforces `needsIndependentValidation === true`; `POS_ALIASES`/`OXFORD_POS_LABELS` cover `be-verb`/`do-verb`/`have-verb`/`definite article`/`exclam.` |
| D12 | `data/vocab-seed/22-a1a2-stable.tsv` carried 67 POS/gloss mismatches, 4 `(A2 bản)` editor notes, parenthetical POS hints, 1 duplicated gloss (`action`), and 113 `level-source` cells naming CEFR-J where Oxford 3000 attested the target level | learner-visible POS/meaning mismatches and inaccurate `level-source` tags | **FIXED** in PR #82 review round: all POS/gloss mismatches, editor notes, POS hints, duplicate gloss, and `level-source` tags cleaned (0 mismatches across 1,144 rows; `zero` added so accepted stays 500 A1 + 500 A2 after `strange`→`adj` skips `stranger` as comparative) |
| D13 | `audit/v100/refs/acquire-references.sh` fetched floating `master`/`main` heads and printed `sha256sum` without checking digests | upstream branch drift could overwrite committed reference snapshots without failing | **FIXED** in PR #82 review round: pinned 40-char upstream commit SHAs and staged `sha256sum -c` verification before moving files |
| D14 | `tests/browser-exams.cjs` axe `runOnly` selected `wcag2a,wcag2aa` without `wcag21a,wcag21aa`; `scripts/migrate_senses.py` docstring showed unsupported `--backup` flag | S21 WCAG 2.1 AA rules omitted; documented backup migration example failed | **FIXED** in PR #82 review round: added `wcag21a,wcag21aa` (suite re-run clean) and corrected positional `.tgz` usage example |

Open / accepted limitations (not defects, stated honestly):

- Scorable exam coverage is 3,011/6,804 (44.25%); the 3,793 ungradeable items each carry
  a documented exempt reason (no-source-answer 3,228 · stimulus-incomplete 488 ·
  key-not-an-option 22 · letter-with-mismatched-text 11 · option-overflow 21 ·
  multiple-letters-for-single-item 23). **Unresolved non-exempt blockers: 0.**
- Firefox/WebKit browser suites run in CI (playwright install), not in this sandbox;
  locally both suites pass on chromium 153.0.8010.0.

## 2026-11-04 — renewed stable-release audit (open findings)

- **D15 — BLOCKED, critical:** an already-published `DEPLOY_HOLD` (`v1.0.0-rc10`)
  authorized the `v1.0.0` candidate (`python3 scripts/deploy_gate.py --repo
  coderunknow/Chuyen-Anh` returned `deploy=true`). An additional exact-application
  release gate and workflow conditions are implemented with local regression tests;
  live workflow behavior is not yet verified. The hold file is unchanged.
- **D16 — IN PROGRESS, critical:** `lie` and `rock` were reproduced with incorrect
  gloss mappings. Explicit source-row-keyed editorial mappings now cover all eight
  formerly split entries, preserve their original gloss text, and omit unsupported
  homographs instead of duplicating a meaning; stale or absent mappings fail closed.
  Regression tests cover row reordering and level filtering. These alignments and
  all vocabulary pathways still require independent review; S10 is not yet passed.
- **D17 — IN PROGRESS:** stable artifact tagging and draft-channel support added with local tests.
  A separately confirmed manual stable dispatcher is implemented without changing deploy gates;
  live workflow behavior, independent review and exact-head CI remain unverified. No publication authorized.
- **D18 — OPEN:** source-capability and locator validation, generated audit prose,
  comprehensive individual evidence review and the other current-head review findings
  remain to be verified and remediated. `build_senses.py` outside-repository output
  summary failure was reproduced and corrected with path regression tests.

- **D19 — IN PROGRESS:** Oxford POS-level parser lowercased its input but matched
  uppercase levels; multi-sense rows also ignored POS-specific levels. Fail-first
  regressions now cover both and the selected-row source locator. Rebuilt data and
  embedded payload; independent CEFR and mapping review remains open. The heuristic
  review queue flags 107 disputed rows where the selected level differs from an
  Oxford POS level; these are not automatically defects, because the documented
  hierarchy may select another source. Eight editorial mapping records remain unverified.
  A headword-level vote no longer claims to cross-validate an individual sense;
  all 12 retained mapped senses are flagged for independent mapping validation.

- **D20 — IN PROGRESS:** 173 entries have at least one reference lookup that falls
  back to a nonmatching POS. Classification now excludes those votes from direct
  evidence and cross-validation; when only different-POS references exist, the
  generated classification is explicitly an unverified LOW-confidence editorial
  proxy. All 52 proxies require independent validation. The lookup queue still flags
  every unmatched candidate; no independent per-entry audit has been completed.
- **D21 — IN PROGRESS:** legacy CEFR audit prose incorrectly described all labels as
  editorial, asserted no references were fetched, ignored sense arrays, and presented
  identical current data as before/after. The generated report and regressions now
  distinguish legacy tags from unverified sense claims; independent review remains.

- **D22 — IN PROGRESS:** standalone validation previously accepted registered sources
  incapable of supporting CEFR claims, including Cambridge as a CEFR level source.
  Capability/publisher-group and nonempty-locator checks are now implemented, but they
  do not prove locator content or POS matches. A preliminary simulation flags 31
  source-supported and 26 cross-validated claims for further investigation.

- **D23 — IN PROGRESS:** a source-row locator review found 57 `source_supported` or
  `cross_validated` claims with insufficient matching POS/reference groups. After
  excluding different-POS votes from direct evidence, the regenerated heuristic queue
  finds 4,775 such claims with matching groups and 4,081 senses not assessed under
  this check; none has been independently verified. The standalone validator checks
  source capability and nonempty locator, not that locator content matches the claim.

- **D24 — IN PROGRESS, critical:** the pinned inference lexicon still powered an
  automatic solver that supplied 203 provisional exam answers, contrary to the
  no-inference requirement. The solver is removed, missing keys are ungraded, and
  runtime hint injection is rejected; pin validation remains fail-closed. Complete
  per-question evidence and independent scoring review remain outstanding.

- **D25 — IN PROGRESS, critical:** three papers with a handful of secondary-source
  anchor checks had every extracted answer labelled independently cross-checked
  and sometimes HIGH confidence without item-level evidence. Reproduced with a
  synthetic item using a paper ID; removed the paper-wide upgrade. Sixty-seven
  answer records now say single-source transcription, pending individual review.
