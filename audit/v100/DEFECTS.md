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

## 2026-11-08 — candidate completion & remediation ledger (`arena/2a533bbc-chuyen-anh`)

| # | Defect / Finding | Resolution & Verification | Disposition |
| --- | --- | --- | --- |
| D15 | `DEPLOY_HOLD` (`v1.0.0-rc10`) alone could authorize deploying a newer `APP_VERSION` (`v1.0.0`) on `main` | `DEPLOY_HOLD` remains `v1.0.0-rc10` (untouched); `scripts/app_release_gate.py` holds Pages until `v1.0.0` is published as a non-draft stable release; `release-published-dispatch.yml` requires manual `workflow_dispatch` on `main` with `stable_deploy_authorized: true`; `pages-smoke.yml` release-deployment polling restricted to `github.event.release.prerelease == true` so stable release publication never races manual Pages deployment; `tests/test_deploy_gate.py`, `tests/test_app_release_gate.py`, `tests/test_pages_smoke.py`, and `tests/test_stable_release_path.py` (`61/61` tests) pass | **MITIGATED IN CODE & WORKFLOWS** (live post-merge workflow execution awaits future maintainer approval) |
| D16 / D19 | Sense-level gloss mappings, multi-POS splits, and Oxford POS-level scoping | Added `audit/v100/refs/cambridge-evp-verified.tsv` (`72` printed English Vocabulary Profile sense badges verified directly on Cambridge Dictionary Online, SHA-256-checked by `acquire-references.sh` and registered as `cambridge-evp`); mapped `8174` (`March`) and `72` multi-POS / polysemous `posSplits` in `docs/sense-gloss-mappings.json`; rebuilt `8,852` entries / `8,928` senses (`75` multi-sense, `UNCLASSIFIED: 0`, `unresolved: 0`). All `1,945` editorial estimates and sense-gloss alignments carry `needsIndependentValidation: true` | **FIXED IN PIPELINE; EDITORIAL ESTIMATES TRANSPARENTLY FLAGGED** |
| D17 | Stable artifact packaging, channel separation, and release check parity | `scripts/release_artifacts.py` builds deterministic `v1.0.0` HTML/ZIP/SHA-256 checksums (`--draft`, no `--prerelease`), runs `verify_curated_keys.mjs` + all Python/Node suites against `git archive`, and refuses mismatched asset overwrites | **READY FOR POST-MERGE TAGGING** (no tag/release created per instruction) |
| D18 / D21 / D22 / D23 | Source-capability validation, row-level locator verification, numeral/proper-noun POS mismatches, and generated CEFR review prose | Fixed `27` numeral seed rows (`n -> number`) and `24` proper-noun capitalizations in `data/vocab-seed/*.tsv`; `scripts/audit_sense_sources.py --check` verifies headword, POS, and CEFR level for `4,844 / 4,844` (`100%`) source-backed senses; regenerated `docs/vocabulary-cefr-review.{json,md}`, `docs/vocabulary-evidence-review.{json,md}`, `docs/vocabulary-quality-audit.{json,md}`, and `audit/v100/evidence/{cefr-sense-audit,source-locator-review,sense-integrity-review-queue}.json` | **FIXED** |
| D20 | Non-matching POS fallback classification | `39` cross-POS fallback proxies remain explicitly marked `editorial_estimate`, `confidence: LOW`, `needsIndependentValidation: true`, and never count as `source_supported` or `cross_validated` | **FIXED & TRANSPARENTLY DISCLOSED** |
| D24 | Automatic lexicon-based exam inference vs ungraded missing-key items (`3,431` `no-source-answer`) | Automatic teaching-bank inference remains completely disabled (`inferred_unverified = 0`). Refined parser/alignment (`6,708` genuine questions across `106` papers, `3,748` transcription keys) and authored SHA-256-pinned `data/exam-curated-keys.json` (`2,146` entries: `1,407` scorable `curated_verified` + `739` formal exemptions), achieving `5,155 / 6,708` (`76.85%`) scorable = **100% of non-exempt items** (`missing = 0`). Caught and fixed `13` MCQ secondary-candidate entries via live `gradeExamQuestion` self-grading in `scripts/exams/verify_curated_keys.mjs` | **FIXED** |
| D25 | Paper-level cross-check anchor promotion & `officialScore` boundaries | Blanket paper-level promotion remains removed (`official_verified = 0`, `HIGH = 0`, `officialScore = null`); open-ended essays (`157` items) formally exempted from `scorableTotal` (`exempt_open_ended`) while retaining advisory 4-criterion rubric feedback (`advisoryRubricEvaluation`); fixed in-progress status bar `summary.scorableTotal` / `summary.ungradeable` display and added `#exam-exemption-breakdown` | **FIXED** |
| D26 (new, `W008`) | `distractors()` O(N) per-turn pool filtering and stale `speed-benchmark.cjs` seed pool | Added `WeakMap` `distractorPoolCache` in `index.html` (`3 ms` median consolidation/retry DOM latency) and updated `tests/speed-benchmark.cjs` seed script to skip `family:merged`/`status:archived` rows and enable full CEFR scope | **FIXED** |

| D27 (new, 2026-11-09) | This ledger itself carried a stale pin: D6 recorded the re-pinned default selection as `3,032` while the shipped data and every other document say `3,020` headwords / `3,043` senses | Corrected to `3,020` / `3,043`; `tests/test_audit_document_counts.py` recomputes the default `B2+C1` deck from `data/vocabulary.json` (`8,112` headwords · `6,841` active · `3,020` eligible · `3,043` senses) and fails if `DEFECTS.md`, `GATES.md`, `FINAL_READINESS.md` or `README.md` disagree with it | **FIXED** |

| D28 (new, 2026-11-09) | D25 counted `157` open-ended essays while the exemption taxonomy, `FINAL_READINESS.md` and the curated manifest all say `158`; the difference is `2022/ha-noi/so` Q51, typed `text` by the protected parser | Wording reconciled to `158` (`157` `essay` + `1` `text`); since the `BUG-003` fix every one of them returns `advisoryRubricEvaluation`, pinned by `tests/exam-exempt-rubric.test.js` (`158/158`) | **FIXED** |
| D29 (new, 2026-11-09) | After S31 corrected seven Phase III levels, three surfaces still described the seed as `500 A1 + 500 A2`: `README.md` (the expansion bullet and the six-level inventory bullet) and the `data/vocab-seed/22-a1a2-stable.tsv` header. The accepted distribution is `506 A1 + 493 A2 + 1 B1` | Recomputed from `data/vocabulary.json`: `1,000` of the `1,143` candidate rows are in the bank (`506 A1 + 493 A2 + 1 B1`, `144` rejected). All three surfaces now state the corrected distribution; the seed header keeps the rejected-candidate note intact | **FIXED** |

| D30 (new, 2026-11-09) | `CHANGELOG.md`'s current-candidate verification paragraph still claimed `237 OK` Python tests and `214` Node assertions after the candidate had grown to `252` and `219`, and omitted the `exam-exempt-rubric` suite entirely | Totals corrected and the suite listed; `tests/test_audit_document_counts.py` now compares the changelog's Python total with the checklist and requires its per-suite numbers to sum to its stated Node total | **FIXED** |

| D31 (new, 2026-11-09) | Four guards added for `BUG-001`/`BUG-003`/`BUG-004`/`BUG-005` could pass without proving their claim: a suite named in a workflow comment counted as "runs in CI"; a `±5` tolerance stood in for the exact discovered count; multiword Oxford headwords were split on whitespace; and the objective-item guard skipped the `scorable: false` flag instead of the curation's exemption markers | All four tightened, each with a reproduction proving it now fails (see `GATES.md` S36 and `WORK_LOG.md` `W017`); no seed row changed band and no exam item changed verdict | **FIXED** |

| D32 (new, 2026-11-09) | `scripts/sense_integrity_audit.py --check` accepted altered release evidence: it compared entries keyed by id plus three named counts, so a rewritten `scope`, an unknown top-level field, a duplicated entry or a reordered list all passed | The gate now compares the complete decoded payload as well as printing field-level drift; four mutants (scope, duplicate, reorder, unknown field) each exit `1`, and `tests/test_sense_integrity_audit_artifact.py` pins them | **FIXED** |

| D33 (new, 2026-11-09) | `2022/ha-noi/so` Q51 is a 250-word essay that the protected parser types `text`. Its correction box offers `0..1` rubric credit, but the save path stored "0.75" as a free-text answer and grading compared it with the learner's essay, returning `incorrect` / `does-not-match-key` for every credit value | `examIsEssayItem()` now decides the override branch, the correction parser and the `(Rubric)` partial label; a verification record carries `essayLike` once a correction makes an exempt item scorable again; an out-of-range credit is `ungraded` / `invalid-rubric-credit`. `tests/exam-exempt-rubric.test.js` drives the shipped question through `0 / 0.25 / 0.75 / 1 / 1.5` | **FIXED** |

| D34 (new, 2026-11-09) | `.github/workflows/ci.yml` filtered `pull_request` to `branches: [main]`; PR #84, stacked on `arena/2a533bbc-chuyen-anh`, ran no CI at all once retargeted, so its "CI verified" claim rested on runs started before the retarget | The filter now includes `arena/**`. No deploy, release or protected gate was touched; `deploy.yml` remains `main`-only | **FIXED** |

| D35 (new, 2026-11-09) | The `BUG-005` correction rewrote `DEFECTS.md` D6 (`3,032`) and D25 (`157`) in place, so the ledger lost what it had recorded even though D27/D28 described the change | Both rows restored verbatim from the base commit; D27/D28 keep the dated correction; `tests/test_audit_document_counts.py` validates the correction row and asserts the historical rows still carry their original figures | **FIXED** |

| D36 (new, 2026-11-09) | `scripts/release_artifacts.py` validated a release source against five of the seven Node suites, while `DEFECTS.md` claimed packaging runs "all Python/Node suites"; a regression in the exempt-rubric fix could have escaped the release check | The list now includes `telemetry-api.test.js` and `exam-exempt-rubric.test.js`, and `tests/test_ci_gate_coverage.py` fails if any `tests/*.test.js` file is missing from it | **FIXED** |

| D37 (new, 2026-11-09) | A history file is untrusted input, but one field of it is rendered as markup: `paper.metadata.year` was interpolated into the history row without `escapeHtml`, and `validateExamResultHistory` accepted any `metadata` shape | An exported history edited to `year: "<img src=x onerror=…>"` imports with `{ok:true}` and the history list renders the tag. Severity **P2**: the learner must import the hostile file, and the script runs on the app origin (local progress and history are readable/writable). The row now escapes the year, and the validator requires `year` to be an integer in `1900…2200` and the paper text fields (`province`, `unit`, `unitLabel`, `source`, `quality`, `answers`, `note`) to be strings of ≤ 500 chars; a genuine export still round-trips. Proven by `tests/exam-scoring.test.js` ("rc10 import hardening") and the `e5-import-xss` probe in the Round-4 evidence directory | `96daa45` + this fix | FIXED |
| D38 (new, 2026-11-09) | `validateExamResultHistory` checked `Array.isArray(correction.candidates)` but never the elements, so a correction could carry numbers or objects into grading and export | `["0.25", 7]` passed validation; the non-string element only failed later, in whichever consumer type-checked it, and it round-tripped through export/import in the meantime. Severity **P3** (no wrong score observed: `examMatchesResponse` never matches a non-string, so the element is inert, but it is unvalidated data in a scored record). Candidates must now be non-empty strings of ≤ 1,000 chars (real maximum 115). Proven by the same test, which also pins `["choice-B", 7]`, `[""]`, a 1,001-char candidate, `"choice-B"` (non-array) and `[null]` as `invalid-correction` | `96daa45` + this fix | FIXED |

| D39 (new, 2026-11-09) | A regression test that `unittest` never collected was recorded as pinning the F2 evidence gate: `tests/test_sense_integrity_audit_artifact.py` defined `test_check_mode_rejects_a_reshaped_artifact` **after** its own `if __name__ == "__main__": unittest.main()` line, at class-body indentation, so it sat inside the guard | The four-mutant proof of `sense_integrity_audit.py --check` existed only as a manual run; the suite reported green without ever executing it — a phantom pin (P2: the assurance was false, not the gate). The method is now a real class method and **passes**: the gate rejects all four mutants (`scope claim`, `duplicate entry`, `reordered entries`, `unknown field`). `tests/test_ci_gate_coverage.py::test_every_test_definition_is_collectable` now fails on any definition nested inside a `__main__` guard anywhere in the tree and on any `test_*` function that is not a `TestCase` method, so this shape cannot come back. Python totals move `254 → 256` (the reclaimed test plus the meta-test) | `cf9f25a` + this fix | FIXED |
