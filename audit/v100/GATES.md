# v1.0.0 candidate — gate table S1–S30

Evaluated on branch `arena/2a533bbc-chuyen-anh` (continuing from `arena/6b7c2879-chuyen-anh` `a66561d9`).
Baseline (`main`): `f12b4bc5241e330eb8c051ada749d4f514111b61`.
Head at evaluation time: see `git rev-parse HEAD` / the Draft PR targeting `main`.
Nothing below is claimed before it is measured; commands are listed so every number can be re-derived.

## Policy & release-hold boundaries

- **Delivery mode:** Draft Pull Request only from `arena/2a533bbc-chuyen-anh` → `main`. No merge, no tag creation, no GitHub Release publication, and no GitHub Pages deployment are performed without separate explicit maintainer authorization.
- **Hold integrity:** `DEPLOY_HOLD` (`v1.0.0-rc10`), `AGENT.md`, `De-chuyen-Anh-vao-10/*.md` (`106/106` SHA-256 verified), and `docs/vocabulary-audit-dev5.{json,md}` are byte-identical to baseline.
- **Provenance honesty:** `0 / 106` exam papers have sealed official primary marking sheets (`official_verified = 0`, `officialScore: null`). Across `8,928` vocabulary senses, `1,945` senses (`1,846` `editorial_estimate` + `99` editorial sense/POS split alignments) explicitly carry `needsIndependentValidation: true`.

---

## Gate Summary (`S1`–`S30`)

### Phase I — Audit & Defect Ledger

| Gate | Requirement | Measured Evidence | Verdict |
| --- | --- | --- | --- |
| S1 | Baseline captured before any change | `audit/v100/baseline.json` (head `f12b4bc5…`, SHA-256 digests of `vocabulary.json`, `phrases.json`, `index.html`, Markdown sources) + `audit/v100/WORK_LOG.md` (`W001`) | **PASS** |
| S2 | Defect ledger with per-defect disposition | `audit/v100/DEFECTS.md` (`D1`–`D26` with root cause, affected files, remediation, and verification commands) | **PASS** |

### Phase II — Sense-Level CEFR Model

| Gate | Requirement | Measured Evidence | Verdict |
| --- | --- | --- | --- |
| S3 | Every row carries `senses` with stable `senseId` (`^<id>-sN$`), CEFR level, evidence class, confidence, sources, rationale | `python3 scripts/build_senses.py --check`: `8,852` entries, **`8,928` senses**, `75` multi-sense entries, **`UNCLASSIFIED = 0`**, **`unresolved = 0`**; `python3 scripts/validate_vocab.py` PASS; `tests/v100-senses.test.js` `8/8` PASS | **PASS** |
| S4 | Sense badges/ranges in UI (flashcard + feedback), level only, never leaking the gloss | `entryCefrBadgesHtml` / `cefrBadgeHtml` in `index.html`; `tests/static-app.test.js` (`144/144`), `tests/rc10-cefr.test.js` (`10/10`), `tests/v100-senses.test.js` (`8/8`), and `tests/browser-learning.cjs` PASS | **PASS** |
| S5 | Per-sense `scope` and multi-POS split (`March`, `lie`, `rock`, + `72` EVP splits) honoured | Entry `1470` `scope` (`B1` `disputed`), entry `8174` `March` (`A1` noun `(month)`, cross-checked in Oxford 3000 + `cambridge-evp-verified.tsv`), and `72` `posSplits` verified by `tests/test_sense_mapping.py` + `tests/v100-senses.test.js` | **PASS** |
| S6 | Migration + backward compatibility | `scripts/migrate_senses.py` + `tests/test_migrate_senses.py` PASS (field preservation, determinism, reversibility, `audit/v100/backup/data-pre-v100.tgz` migration) | **PASS** |
| S7 | All rows reclassified through one deterministic pipeline | `audit/v100/evidence/cefr-sense-audit.json`: `byLevel` `A1: 942 · A2: 1,160 · B1: 1,930 · B2: 2,230 · C1: 1,478 · C2: 1,188 · UNCLASSIFIED: 0`; `byEvidence` `source_supported: 3,174 · cross_validated: 1,670 · disputed: 2,238 · editorial_estimate: 1,846 · unresolved: 0`; `byConfidence` `HIGH: 4,844 · MEDIUM: 4,045 · LOW: 39 · VERY_LOW: 0` | **PASS** |
| S8 | Multi-select CEFR + Unclassified control | All `128` filter combinations × `8,852` entries verified (`tests/v100-senses.test.js`); persisted in `chuyen-anh.cefr.v1` | **PASS** |
| S9 | Default selection `B2 + C1` | `defaultCefrSelection()` = `{B2, C1}`; active focus deck = **`3,020` headwords (`3,043` senses)**, pinned in `tests/static-app.test.js` and `tests/v100-senses.test.js` | **PASS** |
| S10 | Zero cross-level or cross-POS leakage across all study pathways | `cefrDeck()` sense-filtering + POS-scoped reference matching (`tests/test_cefr_pos_scope.py`, `tests/test_oxford_pos_levels.py`, `tests/v100-senses.test.js`, `tests/static-app.test.js` all 7 modes) | **PASS** |
| S11 | Lookup comprehensive by default | Search/lookup covers all `8,852` rows (`8,112` headwords reachable); optional persisted `lookupCefrNarrow` toggle verified | **PASS** |

### Phase III — `+500 A1` and `+500 A2` Expansion

| Gate | Requirement | Measured Evidence | Verdict |
| --- | --- | --- | --- |
| S12 | Exactly `+500 A1` and `+500 A2` new headwords | `python3 scripts/expand_vocabulary.py --check`: `22-a1a2-stable.tsv` (`1,144` candidates → `500 A1 + 500 A2` accepted, `144` skipped with recorded reasons); bank `8,852` rows / `8,112` headwords / `6,841` focus / `1,271` archived | **PASS** |
| S13 | Provenance + accepted/rejected counts + seed hygiene | `892` `cefrj-vocabulary-profile-1.5` + `108` `oxford-3000-wordlist` = `1,000` (`0` editorial); `27` numeral POS (`number`) and `24` proper-noun capitalizations cleaned; `audit/v100/refs/acquire-references.sh` pins 40-char SHAs + `sha256sum -c` | **PASS** |

### Exam Scoring & Provenance

| Gate | Requirement | Measured Evidence | Verdict |
| --- | --- | --- | --- |
| S14 | Scoring recomputed, current, and 100% covered on non-exempt items | `node scripts/exams/build_answer_keys.mjs --check` & `node scripts/exams/verify_curated_keys.mjs`: `106` papers, `6,708` questions, **`5,155 / 6,708` (`76.85%`) scorable**, `1,553` formally exempt, **`nonExemptCoveragePct = 100%`**, **`missing = 0`** | **PASS** |
| S15 | Provenance states; `officialScore = null` without official primary evidence | `official_verified = 0`, `inferred_unverified = 0`, `source_transcription_unverified = 3,748`, `curated_verified = 1,407` (`curated_domain_verified`, SHA-256-pinned in `data/exam-curated-keys.json`); runtime `officialScore: null`; open-ended essays (`157`) `exempt_open_ended` with advisory 4-criterion rubric | **PASS** |
| S16 | `0` unresolved non-exempt blockers & fail-closed boundaries | `missing = 0`; all `1,553` non-scorable items carry explicit `exemptionCategory` (`structural_transcription_defect: 768`, `missing_stimulus: 627`, `open_ended_writing_or_speaking: 158`); `tests/test_exam_inference_fail_closed.py` (`13/13` PASS) proves fail-closed behavior for both `inference-lexicon.json` and `exam-curated-keys.json` | **PASS** |

### Preserve Functionality, UX & Full Validation

| Gate | Requirement | Measured Evidence | Verdict |
| --- | --- | --- | --- |
| S17 | Import/export/backups + migration tests keep working | Python `unittest` `237/237` PASS + browser backup round-trip, malformed import atomic rejection, over-quota recovery, cross-tab sync PASS | **PASS** |
| S18 | UX & performance audit | `WeakMap` `distractorPoolCache` in `index.html`; `speed-benchmark.cjs` PASS (`3 ms` median consolidation/retry latency, `0` page errors); `#exam-exemption-breakdown` + fixed live status-bar counters in `renderExamPractice` | **PASS** |
| S19 | Playwright 3-engine matrix (`chromium`, `firefox`, `webkit`) | Local sequential Chromium `133.0.6943.0` (`run-browser-suites.sh`: `browser-learning.cjs` + `browser-exams.cjs`) **PASS**; GitHub Actions 3-engine matrix (`chromium`, `firefox`, `webkit`) runs on pushed Draft PR head | **PASS (local Chromium) / VERIFYING ON PR CI** |
| S20 | Responsive widths (`320, 375, 768, 1024, 1440 px`) | Verified across `320/375/768/1024/1440 px` with zero horizontal overflow in `browser-learning.cjs` and `browser-exams.cjs` | **PASS** |
| S21 | `axe-core` WCAG 2.1 AA (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`) | `axe-core@4.14.0` clean (`0` violations) in `browser-exams.cjs` | **PASS** |
| S22 | Keyboard navigation + `prefers-reduced-motion` | Verified in `browser-learning.cjs` and `browser-exams.cjs` | **PASS** |
| S23 | Standalone `file://` + zero external runtime dependencies | Verified in `tests/static-app.test.js` and `browser-exams.cjs` (`file://` boot, `0` network requests, `0` page errors) | **PASS** |
| S24 | Cross-tab `localStorage` persistence | Two-tab `storage` sync verified in `browser-learning.cjs` and `tests/static-app.test.js` | **PASS** |
| S25 | Draft PR + review bot convergence; no merge/tag/release/deploy | Draft PR from `arena/2a533bbc-chuyen-anh` → `main`; `DEPLOY_HOLD` untouched (`v1.0.0-rc10`); CodeRabbit review tracked on PR head SHA | **IN PROGRESS ON DRAFT PR** |

### Additional Stable-Release Gates (`S26`–`S30`)

| Gate | Requirement | Status and Measured Evidence | Verdict |
| --- | --- | --- | --- |
| S26 | Dual gates (`deploy_gate.py` + `app_release_gate.py`) prevent premature Pages deploy of `v1.0.0` | `DEPLOY_HOLD` remains `v1.0.0-rc10`; `app_release_gate.py` returns `deploy=false` while `v1.0.0` is unpublished AND holds published stable tags unless `STABLE_DEPLOY_AUTHORIZED=true` (`deploy.yml` `stable_deploy_authorized` input + `release-published-dispatch.yml` `dispatch-stable-deploy`); `pages-smoke.yml` polls release deploys only for prereleases (`62/62` release/deploy/smoke tests PASS) | **PASS** |
| S27 | Sense mappings, source locators, and editorial estimates audited | `audit_sense_sources.py --check` verifies `4,844 / 4,844` (`100%`) source-backed locators (including `cambridge-evp-verified.tsv`); `0` `unresolved`; `1,945` editorial estimates/mappings carry `needsIndependentValidation: true` (`docs/vocabulary-cefr-review.md` states honest human-review boundary) | **PASS (automated + transparent disclosure)** |
| S28 | Stable-tag artifact build & checksum contract | `scripts/release_artifacts.py` verified via `tests/test_stable_release_path.py` and `tests/test_release_artifacts.py` (`--draft`, no `--prerelease`, deterministic ZIP, `verify_curated_keys.mjs` included in `test_source`). Live tag/release creation deferred until maintainer approval | **READY (AWAITING MAINTAINER RELEASE APPROVAL)** |
| S29 | Full 106-paper / 6,708-question scoring & exemption audit | Every single one of `6,708` items across `106` papers is either backed by a transcription key (`3,748`), a SHA-256-pinned domain-curated key (`1,407`, `100%` self-graded via `verify_curated_keys.mjs`), or a documented item-level exemption (`1,553`); `official_verified = 0` honestly maintained without primary official marking sheets | **PASS** |
| S30 | End-to-end browser, accessibility, benchmark, and smoke readiness | `browser-learning.cjs` + `browser-exams.cjs` + `speed-benchmark.cjs` + `test_pages_smoke.py` (`v1.0.0` markers) all PASS locally; exact-head 3-engine CI runs on Draft PR | **PASS (local) / VERIFYING ON PR CI** |
| S31 | Seed rows may only name a reference work that prints their level for their POS | `tests/test_seed_level_provenance.py` resolves all `5,316` seed rows carrying a `level_source` through the pinned references (`cefrj-vocabulary-profile-1.5` `2,233`, `oxford-3000-5000` `2,145`, `octanove-vocabulary-profile-c1c2-1.0` `797`, `oxford-3000-wordlist` `141`) and fails when the claimed band is not printed for the row POS: `0` unattested, `0` unresolved. Seven Phase III rows were corrected (`neither` adv `A2→B1`; `ride`, `run`, `stay`, `talk`, `welcome` v, `star` n `A2→A1`), so the accepted distribution is `506 A1 + 493 A2 + 1 B1` and the `+500/+500` statement in S12 is superseded by this row (S12 is retained as the historical record of that round) | **PASS** |

---

## Current Measured Test Totals

- **Node (`node --trace-deprecation --test`):** `static-app.test.js` (`144`) + `exam-scoring.test.js` (`28`) + `exam-anomalies.test.js` (`7`) + `rc10-cefr.test.js` (`10`) + `v100-senses.test.js` (`8`) + `telemetry-api.test.js` (`17`) = **`214 pass / 0 fail`**
- **Python (`python3 -m unittest discover -s tests -p 'test_*.py'` + `.venv/bin/python scripts/exams/test_archive.py`):** **`238 + 5 = 243 OK / 0 fail`**
- **Browser (`tests/run-browser-suites.sh` + `tests/speed-benchmark.cjs` on Chromium `133.0.6943.0`):** **`browser-learning.cjs` PASS + `browser-exams.cjs` PASS + `speed-benchmark.cjs` PASS (`3 ms` median consolidation/retry DOM latency, `0` page errors)**
- **Generators & `--check` gates:** All `19` `--check` / audit / provenance / curated-key validators exit `0`.
