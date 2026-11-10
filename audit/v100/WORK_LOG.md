# Chuyên Anh `v1.0.0` — Autonomous Release Engineering Work Ledger

- **Repository:** `coderunknow/Chuyen-Anh`
- **Base branch:** `main` (`f12b4bc5241e330eb8c051ada749d4f514111b61`)
- **Starting commit (inherited from PR #82 `arena/6b7c2879-chuyen-anh`):** `a66561d9859960aa60e2e643f284263c2628ce39`
- **Active session branch (Arena-fixed):** `arena/2a533bbc-chuyen-anh`
- **Delivery target (user-confirmed):** Open and maintain a **Draft PR** from `arena/2a533bbc-chuyen-anh` targeting `main`, leaving PR #82 open in draft and untouched. Never merge, push to `main`, tag, publish releases, deploy Pages, modify `DEPLOY_HOLD`, or modify `AGENT.md`.

---

## Work Items

### `W001` — Mandatory Reconnaissance, Baseline Audit & Policy Confirmation
- **Problem statement:** Reconcile actual branch state (`a66561d9859960aa60e2e643f284263c2628ce39`), PR #82 review history, CI/workflow configuration, data counts, and user-approved policies before editing any repository files.
- **Affected files / scope:** Read-only inspection across `AGENT.md`, `DESIGN_LOG.md`, `AGENTS_LOG.md`, `DEPLOY_HOLD`, `.coderabbit.yaml`, `.github/workflows/*.yml`, `audit/v100/*`, `scripts/**`, `tests/**`, `data/**`, and GitHub PR #82 metadata; creation of `audit/v100/WORK_LOG.md`.
- **Expected result:** Complete factual baseline with zero unverified assumptions; explicit user confirmation on Arena branch delivery and Workstream C exam policy reconciliation.
- **Acceptance criteria:**
  1. All mandatory documents read in full (`AGENT.md`, `DESIGN_LOG.md`, `DEPLOY_HOLD`, `.coderabbit.yaml`, `audit/v100/GATES.md`, `audit/v100/DEFECTS.md`, `README.md`, `SECURITY.md`, `PRIVACY.md`, workflows, and PR #82 reviews/threads).
  2. Exact baseline data counts computed directly from committed JSON/TSV/Markdown files:
     - Vocabulary: `8,852` rows (`8,112` headwords + `740` merged family rows; `6,841` focus deck + `1,271` archived), `8,856` senses (`4` multi-sense entries emitted from `8` homograph mappings in `docs/sense-gloss-mappings.json`), `source_supported=3,133`, `cross_validated=1,642`, `disputed=2,184`, `editorial_estimate=1,897`, `unresolved=0`, `needsIndependentValidation=1,909`.
     - Phrases: `1,094` phrases (`B1=387, B2=324, C1=304, C2=79`).
     - Exams: `106` papers, `6,804` questions, `2,808` scorable (`41.27%`, currently including `216` heuristic-rubric `essay` items), `3,996` ungradeable (`no-source-answer=3,431`, `stimulus-incomplete=488`, `multiple-letters-for-single-item=23`, `key-not-an-option=22`, `option-overflow=21`, `letter-with-mismatched-text=11`).
  3. Baseline test status verified: `232` Python unit tests pass; `exam-anomalies`, `exam-scoring`, `rc10-cefr`, `telemetry-api`, `v100-senses`, and `scripts/exams/test_archive.py` pass; `distractors()` in `index.html` identified as an O(N) full-deck shuffle bottleneck causing `tests/static-app.test.js` to exceed 6 minutes on `8,852` rows.
  4. User confirmed: (a) push to `arena/2a533bbc-chuyen-anh` and open successor Draft PR targeting `main`; (b) exempt genuine `essay` (`manual-review`) and audio-without-transcript (`audio`) items from automatic score denominators while curating per-question solutions with calibrated confidence for all non-exempt questions.
- **Validation method:** Direct CLI inspection (`git`, `gh api`, Python/Node baseline runs) and `ask_user` response record.
- **Status:** `VERIFIED`
- **Commit SHA:** _(to be recorded on initial ledger commit)_

---

### `W002` — Workstream A (Part 1): Exhaustive Investigation & Honest Reduction of Editorial CEFR Estimates
- **Problem statement:** `1,897` of `8,856` senses are currently classified as `editorial_estimate` (`1,819` headwords in `docs/vocabulary-evidence-review.json`). Every editorial estimate must be investigated against authoritative/published CEFR profiles, POS normalization rules, spelling/inflection relationships, and vetted open-licensed reference sources so genuine source-backed items are upgraded with verifiable citations while remaining estimates stay transparently flagged (`editorial_estimate`, `needsIndependentValidation: true`).
- **Affected files / scope:** `audit/v100/refs/*`, `docs/vocabulary-sources.json`, `scripts/cefr_senses.py`, `scripts/cefr_editorial_map.py`, `scripts/build_senses.py`, `scripts/vocabulary_evidence_review.py`, `scripts/vocabulary_cefr_review.py`, `data/vocabulary.json`, `audit/v100/evidence/cefr-sense-audit.json`, `docs/vocabulary-*.{json,md}`.
- **Expected result:** Substantial, 100% honest, reproducible reduction in `editorial_estimate` senses backed by pinned, SHA-256-verified snapshots and exact row locators; zero fabricated citations; zero disguised cross-POS or frequency proxies; zero `UNCLASSIFIED` senses in shipped learner bank.
- **Acceptance criteria:**
  1. Every `editorial_estimate` row audited by failure reason (missing headword, British/American orthographic variant, composite/alias POS mismatch, multi-word phrase/phrasal verb, inflected/derived family row, genuinely unattested advanced word).
  2. Any newly added reference dataset is open-licensed, acquired reproducibly in `audit/v100/refs/acquire-references.sh` with pinned commit SHA + SHA-256 verification, registered in `docs/vocabulary-sources.json` with accurate `independenceGroup` (never treating derived compilations as independent!), and validated row-by-row.
  3. All remaining `editorial_estimate` senses preserve `evidence: "editorial_estimate"`, `needsIndependentValidation: true`, and explicit rationale explaining why no published reference established the sense+POS level.
- **Validation method:** `python3 scripts/build_senses.py --check`, `python3 scripts/audit_sense_sources.py --check`, `python3 scripts/validate_vocab.py`, unit tests.
- **Status:** `VERIFIED`
- **Outcome:** Added `audit/v100/refs/cambridge-evp-verified.tsv` (`72` printed EVP sense badges verified on Cambridge Dictionary Online, registered as `cambridge-evp` in `docs/vocabulary-sources.json` and SHA-256-pinned in `acquire-references.sh`), fixed `27` numeral POS rows (`n -> number`) and `24` proper nouns in `data/vocab-seed/*.tsv`, upgraded source-backed senses from `4,775` (`3,133 + 1,642`) to `4,844` (`3,174 source_supported + 1,670 cross_validated`), reduced `editorial_estimate` from `1,897` to `1,846` (`UNCLASSIFIED = 0`, `unresolved = 0`), and kept `needsIndependentValidation: true` on all `1,945` editorial estimates/mappings.

---

### `W003` — Workstream A (Part 2): Multi-Sense Homograph Integrity, Standalone Source-Locator Validator & UI Evidence Quality
- **Problem statement:** Multi-sense homographs and polysemous rows must never attach an unrelated gloss to the wrong CEFR sense, leak across POS boundaries, or fail silently. Standalone source validation must verify vendored file SHA-256 digests, row existence, headword, POS, sense/annotation, level support, and publisher independence. Learner UI surfaces must present sense-specific CEFR badges and learner-friendly evidence quality labels in both VI and EN.
- **Affected files / scope:** `docs/sense-gloss-mappings.json`, `scripts/cefr_senses.py`, `scripts/audit_sense_sources.py`, `scripts/sense_integrity_audit.py`, `scripts/validate_vocab.py`, `audit/v100/evidence/{source-locator-review,sense-integrity-review-queue}.json`, `index.html`, `tests/test_validate_vocab.py`, `tests/test_evidence_reports.py`, `tests/v100-senses.test.js`, `tests/rc10-cefr.test.js`.
- **Expected result:** Zero silent gloss/POS/level mismatches across all multi-sense entries; fail-closed standalone validator checking SHA-256 + row + headword + POS + level + independence; clear VI/EN evidence quality labels in learner surfaces without answer leakage; expanded CEFR regression tests.
- **Acceptance criteria:**
  1. All multi-sense entries (`lie`, `rock`, `bank`, `race`, `rest`, `ring`, `tear`, `used`, plus full scan of all `8,852` rows for semicolon/multi-sense candidates and Oxford homographs) verified for exact Vietnamese gloss-to-sense alignment, POS isolation, stable `senseId`, and fail-closed validation.
  2. `validate_senses()` and `audit_sense_sources.py` enforce `editorial_estimate => needsIndependentValidation === true`, `source_supported => >=1 valid cefr-reference supporting level`, `cross_validated => >=2 distinct independenceGroups supporting level`, and SHA-256 snapshot integrity.
  3. Study cards, search results, and detail views show sense-specific CEFR level and evidence-quality badge/label cleanly in VI and EN across all 128 CEFR filter combinations.
- **Validation method:** `python3 scripts/audit_sense_sources.py --check`, `python3 scripts/sense_integrity_audit.py`, `node --test tests/v100-senses.test.js tests/rc10-cefr.test.js`, `python3 -m unittest tests/test_validate_vocab.py tests/test_evidence_reports.py`.
- **Status:** `VERIFIED`
- **Outcome:** Mapped `8174` (`March`) + `72` `posSplits` in `docs/sense-gloss-mappings.json` (`75` multi-sense entries, `8,928` senses); `audit_sense_sources.py --check` verifies `4,844 / 4,844` (`100%`) source-backed locators; added regression tests in `tests/test_sense_mapping.py` and `tests/test_sense_source_audit.py`.

---

### `W004` — Workstream B: Revalidation of +500 A1 and +500 A2 Everyday Vocabulary Expansion & Curation Audit
- **Problem statement:** Re-audit every accepted A1 and A2 headword in `data/vocab-seed/22-a1a2-stable.tsv` (`IDs 7853..8852`) for exact counts (`+500 A1`, `+500 A2`), POS-to-gloss accuracy, natural Vietnamese meanings, clean examples, CEFR provenance, zero duplicate/inflection/family collisions, and resolve `rc4_vocabulary_audit.py` B1 curation-queue policy (`PRRT_kwDOUZBbI86zgU5h`) and `vocabulary_cefr_review.py` prose consistency (`PRRT_kwDOUZBbI86zjJcr`).
- **Affected files / scope:** `data/vocab-seed/22-a1a2-stable.tsv`, `Learned_Vocabulary_List.md`, `data/vocabulary.json`, `scripts/expand_vocabulary.py`, `scripts/rc4_vocabulary_audit.py`, `scripts/vocabulary_cefr_review.py`, `docs/rc4-vocabulary-audit.{json,md}`, `docs/vocabulary-cefr-review.{json,md}`, `docs/vocabulary-quality-audit.{json,md}`, `index.html`.
- **Expected result:** Exactly `+500` A1 and `+500` A2 clean, learner-appropriate everyday headwords with zero POS/gloss mismatches, zero editor notes, zero self-masking leaks, accurate curation queue reporting, and full preservation of existing IDs `1..7852` and learner progress.
- **Acceptance criteria:**
  1. Programmatic + manual audit of all `1,000` rows in `22-a1a2-stable.tsv` confirms 500 A1 + 500 A2, accurate POS, natural Vietnamese glosses, clean examples, and valid `level-source:*` provenance summing to 1,000.
  2. `rc4_vocabulary_audit.py` policy/report alignment resolved cleanly and tested.
  3. `vocabulary_cefr_review.py` generated prose and tables account for all `8,852` rows accurately.
- **Validation method:** `python3 scripts/build_vocabulary.py --check`, `python3 scripts/rc4_vocabulary_audit.py --check`, `python3 scripts/audit_vocabulary_quality.py --check`, `python3 scripts/vocabulary_cefr_review.py --check`, `python3 scripts/validate_vocab.py`.
- **Status:** `VERIFIED`
- **Outcome:** Verified `500 A1 + 500 A2` (`892` CEFR-J + `108` Oxford 3000 = `1,000`), regenerated `docs/vocabulary-quality-audit.{json,md}`, `docs/vocabulary-evidence-review.{json,md}`, `docs/vocabulary-cefr-review.{json,md}`, and `audit/v100/evidence/cefr-sense-audit.json` while keeping `docs/vocabulary-audit-dev5.{json,md}` byte-identical.

---

### `W005` — Workstream C (Part 1): Exam Archive Audit, Exemption Classification & Parser/Key-Extraction Fixes (106 Papers / 6,804 Questions)
- **Problem statement:** Audit all 106 exam papers (`6,804` questions) to enforce the user-approved policy: only genuinely audio-dependent items lacking usable audio/transcript (`audio`) and subjective essay/composition items (`manual-review`) are exempt from automatic grading; parser/extractor defects causing `invalid_key` (`56`), `ambiguous_review` (`21`), `option_overflow` (`21`), or missed embedded keys/transcripts must be investigated and fixed cleanly without fabricating corrupted source text.
- **Affected files / scope:** `index.html` (`parseExamQuestions`, `extractExamAnswerKeys`, `gradeExamQuestion`, `summarizeExamPractice`), `scripts/exams/build_answer_keys.mjs`, `scripts/exams/classify_anomalies.mjs`, `De-chuyen-Anh-vao-10/**` (read/verify against provenance hashes).
- **Expected result:** Every single one of the `6,804` questions has an accurate response type, clean exemption classification (`none`, `audio`, `manual-review`, or explicit irrecoverable stimulus blocker), and recovered source keys wherever the paper transcription already contains them.
- **Acceptance criteria:**
  1. All `216` `essay` items audited to ensure genuine essay/composition tasks are exempt (`manual-review`) and no short-answer/sentence-transformation item is misclassified as `essay` (nor any genuine essay left as `text`).
  2. All `771` listening items audited to verify which have usable transcripts vs genuinely audio-only (`audio` exemption).
  3. All `invalid_key` (`56`), `ambiguous_review` (`21`), `missing_diagram_or_figure` (`4`), and `option_overflow` (`21`) items inspected individually and resolved or explicitly documented as irrecoverable stimulus blockers.
- **Validation method:** `node scripts/exams/classify_anomalies.mjs --check`, `node scripts/exams/audit_rendering.mjs --check`, `.venv/bin/python scripts/exams/test_archive.py`.
- **Status:** `VERIFIED`
- **Outcome:** Filtered section-header/answer-box pseudo-questions (`6,804 -> 6,708` genuine questions across `106` papers), recovered `3,748` transcription keys via multi-section alignment, classified all `1,553` formal exemptions (`structural_transcription_defect = 768`, `missing_stimulus = 627`, `open_ended_writing_or_speaking = 158`), and verified `0` renderer/XSS issues + `5/5` `test_archive.py`.

---

### `W006` — Workstream C (Part 2): Comprehensive Per-Question Exam Solution Curation, Cross-Checking & Confidence Calibration
- **Problem statement:** Under the user-approved policy, ordinary objective, short-answer, word-formation, cloze, reading, error-identification, sentence-transformation, and transcript-backed listening questions must NOT be left ungraded merely because an official answer key is unavailable (`3,431` `no-source-answer` items). Each non-exempt item lacking a source key requires a carefully solved, independently cross-checked answer record with calibrated confidence, accepted alternatives, rationale, and limitations, while keeping automatic teaching-bank frequency guessing disabled and `officialScore: null` without primary official keys.
- **Affected files / scope:** `data/exam-curated-keys.json` (new auditable per-question curated dataset with SHA-256 prompt pinning), `scripts/exams/build_answer_keys.mjs`, `scripts/exams/verify_curated_keys.mjs` (new cross-check validator), `index.html`, `data/exam-answer-keys.json`, `docs/exam-scoring-audit.{json,md}`.
- **Expected result:** ~100% of recoverable non-exempt questions across all 106 papers are automatically gradable with defensible, cross-checked answers, accepted variants, explicit rationale/limitations, and calibrated confidence (`HIGH`/`MEDIUM`/`LOW`/`VERY_LOW`); zero unearned `official_verified` claims; `inference-lexicon.json` fail-closed boundary preserved.
- **Acceptance criteria:**
  1. Every curated key in `data/exam-curated-keys.json` pins `paperId`, `questionId`, and `promptSha256` (fail-closed if question text changes), and records `candidates`, `acceptedAlternatives`, `confidence`, `sourceStatus`, `rationale`, and `limitations`.
  2. Programmatic + linguistic cross-check verifies: choice keys exist in the question's parsed options; multi-select count matches prompt; true/false matches option set; word-formation answers are valid English morphological derivatives; sentence transformations preserve meaning/grammar/keyword; reading/cloze answers align with passage text.
  3. `officialScore` remains `null` unless primary official keys back all scorable items; `provisional-inference` teaching-bank heuristic remains at `0`.
- **Validation method:** `node scripts/exams/build_answer_keys.mjs --check`, `node scripts/exams/verify_curated_keys.mjs`, `python3 -m unittest tests/test_exam_no_lexicon_inference.py tests/test_exam_inference_fail_closed.py`.
- **Status:** `VERIFIED`
- **Outcome:** Assembled SHA-256-pinned `data/exam-curated-keys.json` (`2,146` entries: `1,407` scorable `curated_verified` + `739` formal exemptions), achieving `5,155 / 6,708` (`76.85%`) scorable = `100%` of non-exempt items (`missing = 0`, `inferred_unverified = 0`, `official_verified = 0`). Created `scripts/exams/verify_curated_keys.mjs`, caught and fixed `13` MCQ secondary-candidate entries (including `2023/bac-ninh/so` Eldorado Valley Q10 `choice-B` `therefore`), and passed `13/13` fail-closed tests.

---

### `W007` — Workstream C (Part 3): Exam Grading Engine, Results UI & Comprehensive Exam Test Suite
- **Problem statement:** Ensure the exam grading engine and learner UI clearly distinguish official-source keys, source-transcribed keys, curated-estimated keys (`HIGH`/`MEDIUM`/`LOW`/`VERY_LOW`), `audio` exemptions, `manual-review` essay exemptions, and irrecoverable stimulus blockers, with complete normalization and regression test coverage.
- **Affected files / scope:** `index.html`, `tests/exam-scoring.test.js`, `tests/exam-anomalies.test.js`, `tests/browser-exams.cjs`, `tests/test_exam_inference_fail_closed.py`, `tests/test_exam_no_lexicon_inference.py`.
- **Expected result:** Accurate grading across MC, multi-select, T/F/NG, word formation, open cloze, error identification, sentence transformation, and transcript-backed listening; clear UI confidence badges, rationale, accepted alternatives, and exemption summaries in both VI and EN.
- **Acceptance criteria:**
  1. Normalization handles case, whitespace, punctuation, smart apostrophes/quotes, contractions vs full forms where grammatically valid, slash/semicolon alternatives, and optional parenthetical segments without accepting wrong answers.
  2. Results summary separates earned automatic score (`provisionalScore` vs `officialScore`), `manual-review` essay count, `audio` exempt count, and any irrecoverable stimulus count.
  3. Unit and browser exam tests cover all response types, confidence tiers, and exemptions.
- **Validation method:** `node --test tests/exam-scoring.test.js tests/exam-anomalies.test.js`, `BROWSER_ENGINE=chromium node tests/browser-exams.cjs`.
- **Status:** `VERIFIED`
- **Outcome:** Added `summary.exemptionCategories` breakdown and `#exam-exemption-breakdown` UI strip, fixed live in-progress status bar `scorableCount` / `ungradeableCount` rendering, attached `advisoryRubricEvaluation` to answered exempt essays without inflating `scorableTotal`, and passed `exam-scoring.test.js` (`28/28`), `exam-anomalies.test.js` (`7/7`), and `browser-exams.cjs`.

---

### `W008` — Workstream D & E: Runtime Performance (`distractors`), Full App UX, Accessibility (WCAG 2.1 AA), Responsive, Offline, Security & Workflow Hardening
- **Problem statement:** Eliminate the O(N) full-array shuffle bottleneck in `distractors()` (`index.html`), and audit every view, navigation path, VI/EN localization string, light/dark/system theme, keyboard/focus flow, `axe-core` WCAG 2.1 AA (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`), responsive layout (`320, 375, 768, 1024, 1440px`), `file://` zero-network execution, storage resilience/XSS defenses, telemetry privacy, and GitHub Actions workflow parity/security.
- **Affected files / scope:** `index.html`, `api/telemetry.js`, `.github/workflows/{ci,deploy,pages-smoke}.yml`, `tests/static-app.test.js`, `tests/browser-learning.cjs`, `tests/browser-exams.cjs`, `tests/telemetry-api.test.js`.
- **Expected result:** Instantaneous distractor selection (`tests/static-app.test.js` runs in seconds instead of >7 minutes with zero assertion loosening), zero WCAG 2.1 AA violations across views/themes, zero horizontal overflow across `320..1440px`, zero untranslated strings in EN mode, zero external runtime dependencies, resilient storage/import handling, and aligned CI/deploy checks.
- **Acceptance criteria:**
  1. `distractors()` uses cached `posTokens` + partial Fisher-Yates sampling (`k = OPTION_COUNT - 1`), preserving exact uniform randomness and every assertion in `tests/static-app.test.js`.
  2. Both `browser-learning.cjs` and `browser-exams.cjs` run `axe-core` with `['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']` across light and dark themes with zero violations, and test responsive viewports `320, 375, 768, 1024, 1440px` + `file://` boot.
  3. Untrusted JSON import, XSS payloads in backup/exam/gloss strings, quota-exceeded storage, corrupt localStorage, and cross-tab `storage` events pass all tests.
  4. `.github/workflows/ci.yml` (`push.paths` parity for `audit/v100/refs/**`) and `.github/workflows/deploy.yml` (`--check` and Node test parity with `ci.yml`) hardened with pinned SHAs and least-privilege `permissions`.
- **Validation method:** `node --test tests/*.test.js`, `BROWSER_ENGINE=chromium tests/run-browser-suites.sh`, `python3 -m unittest discover -s tests -p "test_*.py"`.
- **Status:** `VERIFIED`
- **Outcome:** Added `WeakMap` `distractorPoolCache` in `index.html` (`static-app.test.js` `144/144` runs in `19s`; `speed-benchmark.cjs` `3 ms` median consolidation/retry latency), passed sequential `run-browser-suites.sh` (`browser-learning.cjs` + `browser-exams.cjs` WCAG 2.1 AA + `320–1440px` + `file://`), and aligned `ci.yml` + `deploy.yml`.

---

### `W009` — Workstream F: Stable Release Engineering & Dual-Hold Gate Verification for `v1.0.0`
- **Problem statement:** Verify that `v1.0.0` stable release packaging, checksum manifests, channel separation, `DEPLOY_HOLD` (`v1.0.0-rc10` untouched), `deploy_gate.py`, `app_release_gate.py`, `release-published-dispatch.yml`, and `pages-smoke.yml` behave safely before and after a future stable `v1.0.0` release without ever prematurely deploying Pages or misidentifying prerelease vs stable channels.
- **Affected files / scope:** `scripts/release_artifacts.py`, `scripts/deploy_gate.py`, `scripts/app_release_gate.py`, `.github/workflows/{deploy,release-artifacts,release-published-dispatch,pages-smoke}.yml`, `tests/test_release_artifacts.py`, `tests/test_deploy_gate.py`, `tests/test_pages_smoke.py`.
- **Expected result:** Local/fixture-verified `v1.0.0` HTML/ZIP/SHA-256 packaging, strict non-overwrite of mismatched assets, strict `DEPLOY_HOLD` + `app_release_gate.py` hold when `v1.0.0` is unpublished/draft/mismatched, and clean post-release smoke behavior once `v1.0.0` is eventually published; zero remote tags/releases/deployments created.
- **Acceptance criteria:**
  1. `APP_VERSION === 'v1.0.0'` in `index.html` matches stable packaging contract.
  2. `release_artifacts.py` verified via local temp git archive + mocked `gh` fixtures for `v1.0.0` stable (`--draft` without `--prerelease`, deterministic ZIP, exact 3 root files `index.html`, `README.md`, `LICENSE`, `sha256sum -c` manifest, refusal on asset digest mismatch) and `v1.0.0-rc*` prerelease (`--draft --prerelease`).
  3. Dual deploy gates (`deploy_gate.py` + `app_release_gate.py`) and `pages-smoke.yml` verified across all states (held prerelease, published `rc10` + unpublished `v1.0.0` on `main`, draft `v1.0.0`, wrong-channel `v1.0.0`, published stable `v1.0.0`, manual `force_deploy`). `DEPLOY_HOLD` remains byte-identical (`v1.0.0-rc10\n`).
- **Validation method:** `python3 -m unittest tests/test_release_artifacts.py tests/test_deploy_gate.py tests/test_pages_smoke.py`.
- **Status:** `VERIFIED`
- **Outcome:** Added `verify_curated_keys.mjs` and `v100-senses` / `rc10-cefr` / `exam-anomalies` to `scripts/release_artifacts.py`, scoped `pages-smoke.yml` release-deployment wait to `prerelease == true`, added `v1.0.0` markers to `tests/pages_smoke.py`, verified `DEPLOY_HOLD` untouched (`v1.0.0-rc10`), and passed `61/61` release/deploy/smoke tests.

---

### `W010` — Documentation, Append-Only Project Logs & Audit Deliverables (`GATES.md`, `DEFECTS.md`, `FINAL_READINESS*.md`)
- **Problem statement:** Reconcile stale pre-v1.0.0 counts and instructions in `README.md`, `CHANGELOG.md`, `SECURITY.md`, and `PRIVACY.md`; append factual engineering entries to `DESIGN_LOG.md` and `AGENTS_LOG.md`; update `audit/v100/GATES.md` and `audit/v100/DEFECTS.md` (preserving history); and author `audit/v100/FINAL_READINESS_CHECKLIST.md` and `audit/v100/FINAL_READINESS.md`.
- **Affected files / scope:** `README.md`, `CHANGELOG.md`, `SECURITY.md`, `PRIVACY.md`, `DESIGN_LOG.md` (append-only), `AGENTS_LOG.md` (append-only), `audit/v100/GATES.md`, `audit/v100/DEFECTS.md`, `audit/v100/FINAL_READINESS_CHECKLIST.md`, `audit/v100/FINAL_READINESS.md`.
- **Expected result:** Every count, version, command, security statement, privacy statement, gate status, and defect record matches the exact shipped branch files and test evidence; `DESIGN_LOG.md` and `AGENTS_LOG.md` strictly append-only (`git diff` proves zero deleted/modified historical lines).
- **Acceptance criteria:**
  1. `README.md` accurately states `v1.0.0` source-tree candidate vs `v1.0.0-rc10` live Pages/hold, `8,852` rows (`6,841` focus / `1,271` archived / `740` family), `8,856+` senses, `1,094` phrases, current exam scorable/exempt counts, `build_senses.py` in update commands, and stable `v1.0.0` support in `release_artifacts.py`.
  2. `SECURITY.md`, `PRIVACY.md`, and `CHANGELOG.md` reflect exact current versions, Node/Python versions, and counts.
  3. `git diff f12b4bc5241e330eb8c051ada749d4f514111b61..HEAD -- AGENT.md DEPLOY_HOLD` is empty, and `DESIGN_LOG.md` / `AGENTS_LOG.md` diffs contain only appended lines.
- **Validation method:** Programmatic doc-vs-data consistency assertions + `git diff` verification.
- **Status:** `VERIFIED`
- **Outcome:** Updated `README.md`, `CHANGELOG.md`, `SECURITY.md`, `THIRD_PARTY_NOTICES.md`, `audit/v100/{GATES,DEFECTS,WORK_LOG,FINAL_READINESS_CHECKLIST,FINAL_READINESS}.md`, and appended `2026-11-08` entries to `DESIGN_LOG.md` and `AGENTS_LOG.md` (`9/9` `test_readme_counts.py` PASS; `0` deleted lines in append-only logs; `0` diff on `AGENT.md` and `DEPLOY_HOLD`).

---

### `W011` — Workstream G & H: Full Verification Matrix, Successor Draft PR, CodeRabbit Review Convergence & Final Gate Audit
- **Problem statement:** Push clean commits to `arena/2a533bbc-chuyen-anh`, open the successor Draft PR targeting `main`, reconcile all 16 historical PR #82 review threads + excluded/large-file programmatic audits, obtain fresh CodeRabbit review and green 3-engine GitHub Actions CI (`chromium`, `firefox`, `webkit`) on the exact final head SHA, and verify zero open blockers.
- **Affected files / scope:** Remote branch `origin/arena/2a533bbc-chuyen-anh`, new Draft PR → `main`, `audit/v100/{WORK_LOG,GATES,DEFECTS,FINAL_READINESS_CHECKLIST,FINAL_READINESS}.md`.
- **Expected result:** Open **Draft** PR from `arena/2a533bbc-chuyen-anh` → `main` with all CI checks green on the exact final head SHA, fresh CodeRabbit review completed on the final head SHA with zero unresolved actionable findings, and truthful final readiness report.
- **Acceptance criteria:**
  1. Every local generator `--check`, validator, Python `unittest`, Node `--test`, and local Chromium Playwright suite passes with exit code 0.
  2. All GitHub Actions checks on the Draft PR pass on the exact final head SHA (`Static checks`: `checks`, `browser (chromium)`, `browser (firefox)`, `browser (webkit)`; `Validate exam archive`: `validate`; plus any triggered smoke workflows).
  3. Fresh CodeRabbit review completed on the final head SHA (or reconciled commit-by-commit with final head re-reviewed after any doc-only SHA update); all review threads evaluated, fixed or answered with technical evidence, and resolved; excluded/large files audited programmatically.
  4. PR remains **OPEN** and **DRAFT**; `DEPLOY_HOLD` and `AGENT.md` untouched; zero tags/releases/merges/deployments performed.
- **Validation method:** `gh pr view`, `gh pr checks`, `gh api` review/thread inspection, and local verification suite.
- **Status:** `ACTIVE`
- **Commit SHA:** _pending_

---

### `W012` — Audit finding `BUG-001`: Phase III seed rows named a level their reference does not print for that POS
- **Problem statement:** Seven `data/vocab-seed/22-a1a2-stable.tsv` rows carried `level:A2` with `level-source:oxford-3000-wordlist` while Oxford 3000 prints a different band for the row's part of speech (`neither` adv `B1`; `ride`, `run`, `stay`, `talk`, `welcome` v and `star` n `A1`). The band had been copied from the composite list of a multi-POS entry (`v. A1, n. A2`). Nothing in the pipeline resolved a seed row's `(word, pos, level)` against the work it names, so `rc4_vocabulary_audit.py` counted those rows as `attestedByPublishedLevel`.
- **Affected files / scope:** `data/vocab-seed/22-a1a2-stable.tsv`, `Learned_Vocabulary_List.md`, `data/vocabulary.json`, `index.html` (embedded payload), `docs/{rc4-vocabulary-audit,vocabulary-cefr-review,vocabulary-quality-audit,vocabulary-audit-dev5}.{json,md}`, `README.md`, `CHANGELOG.md`, `tests/test_seed_level_provenance.py` (new).
- **Expected result:** Every seed row that names a reference work states a band that work prints for that POS; the shipped `level:*` tag agrees with the shipped `senses`; the regression test fails on the old data and passes on the new.
- **Acceptance criteria:**
  1. `python3 -m unittest tests.test_seed_level_provenance` fails before the seed edit (7 rows listed) and passes after.
  2. `python3 -m unittest discover -s tests -p 'test_*.py'` passes (`240` tests), all `--check` gates exit `0`, and `tests/static-app.test.js` + `tests/v100-senses.test.js` still pass on the regenerated payload.
  3. `git diff main -- DEPLOY_HOLD AGENT.md De-chuyen-Anh-vao-10 docs/vocabulary-audit-dev5.{json,md} docs/RC1_AUDIT_REPORT.md docs/EXAM_AUDIT_LEDGER.md` remains empty and `DESIGN_LOG.md` / `AGENTS_LOG.md` stay append-only.
- **Validation method:** Test-first reproduction (`FAIL` with the 7 rows, then `OK`), full pipeline regeneration, whole `--check` matrix, Python + Node suites, local Chromium E2E.
- **Status:** `VERIFIED`
- **Outcome:** Corrected the seven rows (`neither` `A2→B1`; `ride`, `run`, `stay`, `talk`, `welcome`, `star` `A2→A1`), regenerated the vocabulary payload and every derived audit artifact, and added `tests/test_seed_level_provenance.py`, which resolves all `5,316` published-level seed rows through the pinned references (`0` unattested, `0` unresolved). Distribution moved from `500 A1 + 500 A2` to `506 A1 + 493 A2 + 1 B1`; the source split is unchanged (`892` CEFR-J + `108` Oxford 3000). Consequence recorded: `neither` (`8605`) is now a B1 row in the focus deck and is queued for a curator decision (`rule:b1-baseline-general`) instead of being archived automatically; deck membership was not changed.

---

### `W013` — Audit finding `BUG-002`: committed sense-integrity evidence had drifted with no gate able to notice
- **Problem statement:** `audit/v100/evidence/sense-integrity-review-queue.json` disagreed with the shipped data on entry `8393` (`bloom`): the committed queue recorded the gloss `nở hoa` while `data/vocabulary.json` (and the same file's own `senses` copy) says `hoa, sự nở hoa`. `scripts/sense_integrity_audit.py` only printed to stdout, had no `--check`, and no workflow ran it, so the evidence could drift silently while every gate stayed green.
- **Affected files / scope:** `scripts/sense_integrity_audit.py` (`build_payload`, `drift`, `--check`, `--artifact`), `audit/v100/evidence/sense-integrity-review-queue.json`, `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `tests/test_sense_integrity_audit_artifact.py` (new), `CHANGELOG.md`.
- **Expected result:** the committed queue equals a fresh rebuild; a stale queue fails both the script and CI; the guard is exercised by a test that can fail.
- **Acceptance criteria:**
  1. `tests/test_sense_integrity_audit_artifact.py` fails before the change, naming `8393 bloom`, and passes after.
  2. `python scripts/sense_integrity_audit.py --check` exits `0` for the current artifact and non-zero for a deliberately drifted copy.
  3. `ci.yml` and `deploy.yml` both run the check, and the CI path filters include the evidence file.
- **Validation method:** fail-first unit test, a negative-control test against a mutated artifact, whole `unittest` suite, `--check` matrix.
- **Status:** `VERIFIED`
- **Outcome:** extracted `build_payload()`/`drift()`, added `--check`/`--artifact`, regenerated the queue (2 lines: `8393` meaning in the entry and in its `senses`), wired the gate into both workflows and their path filters, and pinned it with four new tests. Flag count and issue counts are unchanged (`239` of `8,852`), so this is evidence hygiene, not a change to which entries need review.

---

### `W014` — Audit finding `BUG-003`: the one `text`-typed open-ended exemption never received its advisory rubric
- **Problem statement:** `2022/ha-noi/so` `q-51-9c5133cba3668e8e` is a 250-word academic essay prompt curated as `open_ended_writing_or_speaking`, but the protected `parseExamQuestions` types it `text`. `getQuestionVerification` and `gradeExamQuestion` keyed the 4-criterion rubric on `responseType === 'essay'`, so answering it returned `ungraded` (`essay-open-ended-exempt`) with no `advisoryRubricEvaluation`, while the exemption strip and `FINAL_READINESS.md` promised advisory feedback. The UI also rendered a 3-row textarea.
- **Affected files / scope:** `index.html` (app module only), `.github/workflows/{ci,deploy}.yml` (new test file), `tests/exam-exempt-rubric.test.js` (new), `CHANGELOG.md`.
- **Expected result:** every curated open-ended exemption, whatever its parser response type, keeps its rubric, its essay-shaped input and its exemption semantics.
- **Acceptance criteria:**
  1. The new test fails before the change on exactly this item and passes after.
  2. All `158` exemptions return `ungraded` + `advisoryRubricEvaluation` with four criteria and `earnedCredit = 0`.
  3. `parseExamQuestions` / `extractExamAnswerKeys` are byte-identical; the score denominator is unchanged (`5,155 / 6,708`).
- **Validation method:** data-driven fail-first Node test over the shipped archive, full Python/Node suites, `--check` matrix, both Chromium browser suites.
- **Status:** `VERIFIED`
- **Outcome:** added `examIsEssayItem(question, key)` (essay response type **or** curated `open_ended_writing_or_speaking` / `essay-open-ended-exempt`) and routed eight call sites through it — rubric construction, rubric attachment on the exempt path, candidate label, verdict label, rubric hint, textarea rows, and the override field/label. The protected parser was not touched. `tests/exam-exempt-rubric.test.js` now pins all `158` exemptions and names the `text`-typed case explicitly.

---

### `W015` — Audit finding `BUG-004`: the `243/243` Python claim was not reproducible and not CI-enforced
- **Problem statement:** `FINAL_READINESS_CHECKLIST.md` reported `[x] PASS (243/243)` and gave the command `.venv/bin/python scripts/exams/test_archive.py`, but the repository creates no `.venv`, no workflow ran that suite, and on a clean checkout two of its five tests error with `ModuleNotFoundError` (`fitz`, then `bs4`). The stated coverage therefore exceeded what any reproducible command could show.
- **Affected files / scope:** `.github/workflows/ci.yml`, `audit/v100/FINAL_READINESS_CHECKLIST.md`, `audit/v100/GATES.md` (measured totals), `tests/test_ci_gate_coverage.py` (new).
- **Expected result:** a fresh clone plus CI runs every counted suite; the report states the real totals and the command that produces them.
- **Acceptance criteria:**
  1. `python3 -m venv … && pip install -r scripts/exams/requirements.txt && python scripts/exams/test_archive.py` → `5/5 OK`.
  2. `ci.yml` performs exactly that, so the number is reproducible without a hand-made environment.
  3. `tests/test_ci_gate_coverage.py` fails if the archive suite or its requirements leave CI, if a `tests/*.test.js` file is not named by a workflow, or if the checklist prescribes a `.venv`.
- **Validation method:** full requirements install in a fresh venv, archive suite run, CI config assertions, whole `unittest` discovery.
- **Status:** `VERIFIED`
- **Outcome:** added a "Run exam archive conversion tests" step to `ci.yml` (venv + pinned requirements + suite), corrected the checklist row to `244 + 5 = 249` with the real commands, and updated the measured totals in this file (`Node 218`, `Python 249`). `tests/test_ci_gate_coverage.py` (4 tests) pins the wiring so the claim cannot drift from the workflow again.

---

### `W016` — Audit finding `BUG-005`: the defect ledger carried its own stale count
- **Problem statement:** `DEFECTS.md` D6 recorded the re-pinned totals as "`3,032` default B2+C1 eligible" while `GATES.md` S9, `FINAL_READINESS.md` and `README.md` say `3,020` headwords / `3,043` senses, and the shipped data yields `3,020` / `3,043`. A second count disagreed: D25 said `157` open-ended essays where the exemption taxonomy, the curated manifest and `FINAL_READINESS.md` say `158`.
- **Affected files / scope:** `audit/v100/DEFECTS.md` (D6 figure, D25 wording, new D27/D28 rows), `tests/test_audit_document_counts.py` (new).
- **Expected result:** every document states the count the data produces, and a test recomputes it instead of trusting any document.
- **Acceptance criteria:**
  1. The new test fails before the change, naming `audit/v100/DEFECTS.md: states 3032 headwords, the data has 3020`.
  2. The count is recomputed from `data/vocabulary.json` with the app's rule and agrees with the JavaScript pins (`3,020` headwords / `3,043` senses).
  3. The correction is visible: D27/D28 record what changed and why, so the edit is not silent.
- **Validation method:** fail-first unit test, `unittest` discovery, cross-check against `tests/static-app.test.js` and `tests/v100-senses.test.js` pins.
- **Status:** `VERIFIED`
- **Outcome:** corrected D6 to `3,020` headwords / `3,043` senses and D25 to `158` (`157` `essay` + `1` `text`); appended D27 and D28 describing both corrections; added `tests/test_audit_document_counts.py`, which recomputes the deck and fails on any document that disagrees (it also fails when a document stops stating the size at all).

### `W017` — Independent review of the five fixes: guards hardened, three stale statements corrected
- **Problem statement:** an independent review of `BUG-001`…`BUG-005` found four guards that could pass without proving their claim — a suite *named* in `ci.yml` counted as executed, a `±5` tolerance stood in for the exact discovered count, multiword Oxford headwords were split on whitespace (`according to`, prep A2, also attested `to`, prep A1), and the objective-item guard skipped the very `scorable: false` flag it exists to police — plus three statements that the corrections had left stale: `README.md` (two places) and the `22-a1a2-stable.tsv` header still said `500 A1 + 500 A2`, and `CHANGELOG.md` still claimed `237 OK` / `214 pass`.
- **Affected files / scope:** `tests/test_ci_gate_coverage.py`, `tests/test_seed_level_provenance.py`, `tests/exam-exempt-rubric.test.js`, `tests/test_audit_document_counts.py`, `scripts/sense_integrity_audit.py`, `README.md`, `CHANGELOG.md`, `data/vocab-seed/22-a1a2-stable.tsv` header, `audit/v100/{GATES,DEFECTS,FINAL_READINESS_CHECKLIST}.md`.
- **Expected result:** each guard fails when the thing it guards is broken, and every surface states the measured `506 A1 + 493 A2 + 1 B1` and the real totals.
- **Acceptance criteria:**
  1. `tests/test_ci_gate_coverage.py` requires each Node suite inside a `node --test` run block (YAML comments stripped) and compares the checklist total to `countTestCases()` exactly.
  2. `tests/test_seed_level_provenance.py` indexes multiword headwords whole; the `5,316` published rows resolve to the same bands as before.
  3. `tests/exam-exempt-rubric.test.js` skips only items carrying an `exemptionCategory`; all `739` non-scorable keys carry one.
  4. `tests/test_audit_document_counts.py` uses the app's exact `curation:archived` membership and pins the changelog's totals.
- **Validation method:** fail-first runs plus three negative controls, `unittest` discovery, the seven Node suites, the twenty `--check` gates, and the archive suite in a venv.
- **Status:** `VERIFIED`
- **Outcome:** fail-first — `252 != 250 : checklist states 250 unit tests; discover collects 252` and `250 != 237 : the changelog states a Python total the checklist does not`. Controls: commenting out the telemetry `node --test` line fails with `['telemetry-api.test.js']`; one key flipped to `scorable: false` without a marker fails `not ok 5 … a scorable objective item was treated as an exempt essay`; restoring the whitespace split fails `the multiword headword must be indexed as printed`. Totals are now Python `252 + 5 = 257` and Node `219`; no seed row changed band and no exam item changed verdict.

### `W018` — Independent review, round three: reproduced six findings, fixed five, declined one
- **Problem statement:** the independent reviewer's pass over `4862d0e` reported six findings. Each was reproduced before any edit: `--check` accepted reshaped evidence; the text-typed exempt essay's rubric override was graded as text; the stacked PR ran no CI; the ledger had been rewritten in place; the release source check skipped two Node suites; and the review demanded `500 A1 + 500 A2` by adding replacement rows.
- **Affected files / scope:** `scripts/sense_integrity_audit.py`, `scripts/release_artifacts.py`, `index.html`, `.github/workflows/ci.yml`, `audit/v100/DEFECTS.md`, `tests/{test_sense_integrity_audit_artifact,test_audit_document_counts,test_ci_gate_coverage}.py`, `tests/exam-exempt-rubric.test.js`, plus the count surfaces.
- **Expected result:** every finding that holds is fixed with a reproduction; the one that contradicts a maintainer decision is declined in writing rather than implemented.
- **Acceptance criteria:**
  1. Scope/duplicate/reorder/unknown-field mutants of the evidence file make `--check` exit nonzero.
  2. The shipped Q51 override grades `0 / 0.25 / 0.75 / 1` as rubric credit and `1.5` as `ungraded`.
  3. A stacked PR is covered by CI without weakening any deploy gate.
  4. Release source validation names every Node suite.
  5. `DEFECTS.md` D6/D25 keep their original figures; the correction lives in D27/D28.
- **Validation method:** fail-first reproduction on `4862d0e`, negative controls, full suites, twenty `--check` gates, archive suite in a venv, protected-path diff against `main`.
- **Status:** `VERIFIED` (F1 declined — see below)
- **Outcome:** F2–F6 fixed and pinned; F1 declined because the maintainer chose "correct the levels" over "correct plus seven replacement rows" for `BUG-001`, and this loop does not reopen an approved decision. Totals: Python `254 + 5 = 259`, Node `221`.

## W019 — Round 4: system-wide hunt, import-surface hardening (2026-11-09)

- **Scope:** a systematic pass over the surfaces earlier rounds reasoned about but did not execute: all 106 papers and 5,155 scorable questions (grading soundness), the scoring summary invariants, export → validate → import round trips plus tamper cases, all seven exercise types over a 403-entry sample (2,821 generated questions), the sense-level CEFR model over 8,852 rows / 8,928 senses, an 800-step progress walk and the family fold, and the HTML/escaper helpers.
- **Result:** one confirmed **P2** and one confirmed **P3**, both on the history-import surface (D37, D38); no false accept/reject in grading, no invariant break in scoring, question generation, CEFR narrowing or progress.
- **Fix:** escape `paper.metadata.year` at the render site; type-check paper metadata and correction candidates in `validateExamResultHistory`. Regression test `tests/exam-scoring.test.js` ("rc10 import hardening"); both mutants fail it.
- **Not fixed, reported:** the telemetry client key is derived from request headers the caller can choose (`x-vercel-forwarded-for` → `x-real-ip` → last `X-Forwarded-For` hop → socket), so the per-client 10/600 s limit is advisory while the global 120/600 s cap still bounds abuse; changing key derivation changes deployed behaviour and needs maintainer approval.
- **Totals on the fixed tree:** Python `256 + 5 = 261 OK`, Node `222 / 0 fail`.
- **Status:** `VERIFIED` (local commits only; no push, merge, tag, release or deploy)
- **Follow-up found while fixing the counts (D39):** the F2 mutant pin never ran — it was defined inside the module's own `__main__` guard. It is now collectable and passes; a tree-wide meta-test rejects definitions nested in `__main__` guards and non-collectable `test_*` functions. Python totals `254 → 256`, so the recorded totals here and in `GATES.md`/`CHANGELOG.md` were corrected before the run they describe.
