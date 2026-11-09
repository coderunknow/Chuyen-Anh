# Chuyên Anh `v1.0.0` — Final Stable-Candidate Readiness Report

- **Date:** `2026-11-08`
- **Repository:** `coderunknow/Chuyen-Anh`
- **Candidate Branch:** `arena/2a533bbc-chuyen-anh` (continuing from `arena/6b7c2879-chuyen-anh` `a66561d9` over `main` `f12b4bc5`)
- **Declared Application Version (`index.html`):** `v1.0.0` (`28,189,194` bytes standalone HTML)
- **Live Hold Marker (`DEPLOY_HOLD`):** `v1.0.0-rc10` (untouched)
- **Release Action Status:** **Draft Pull Request only** — NOT merged, NOT tagged, NOT published as a GitHub Release, NOT deployed to GitHub Pages.

---

## 1. Executive Summary

Engineering workstreams `W001`–`W010` are complete and locally verified; `W011` (`Draft PR CI & review convergence`) remains active until final-head GitHub Actions CI and review checks complete on Draft PR #83 prior to human review:

1. **Sense-Level CEFR & Lexical Integrity (`W002`–`W004`):**
   - **Inventory:** `8,852` rows (`8,112` active headwords + `740` merged word-family rows; `6,841` focus study words + `1,271` archived rows) and `1,094` standalone phrases (`P001`–`P1094`).
   - **Phase III A1/A2 Expansion:** `1,000` everyday headwords — `506 A1 + 493 A2 + 1 B1` — with `892` `cefrj-vocabulary-profile-1.5` + `108` `oxford-3000-wordlist` and `0` editorial. Corrected on `2026-11-09` (audit finding `BUG-001`): the report previously stated `500 A1 + 500 A2`, but seven rows claimed a band that their reference work prints for a *different* part of speech of the same headword; each corrected row now states the band printed for its own POS (`neither` adv `A2→B1`; `ride`, `run`, `stay`, `talk`, `welcome` v and `star` n `A2→A1`) and `tests/test_seed_level_provenance.py` re-checks all `5,316` published-level seed rows.
   - **Sense Model (`8,928` senses across `8,852` entries, `75` multi-sense):**
     - `byLevel`: `A1: 942 · A2: 1,160 · B1: 1,930 · B2: 2,230 · C1: 1,478 · C2: 1,188 · UNCLASSIFIED: 0` (active `6,841` focus deck: `A1: 631 · A2: 809 · B1: 1,299 · B2: 1,768 · C1: 1,253 · C2: 1,100`; default `B2+C1` focus selection: `3,020` headwords / `3,043` senses).
     - `byEvidence`: `source_supported: 3,174 · cross_validated: 1,670 · disputed: 2,238 · editorial_estimate: 1,846 · unresolved: 0`.
     - `audit_sense_sources.py --check`: **`4,844 / 4,844` (`100%`)** source-backed senses verified for exact headword, POS, and CEFR level against SHA-256-pinned reference snapshots (`cefrj`, `octanove`, `oxford-3000`, `oxford-5000`, and `audit/v100/refs/cambridge-evp-verified.tsv` with `72` printed EVP sense badges verified on Cambridge Dictionary Online).

2. **Exam Scoring Coverage, SHA-256 Curated Keys & Formal Exemptions (`W005`–`W007`):**
   - **Inventory:** `106` exam papers (`2022–2026`), `6,708` genuine parsed questions (after eliminating section-header/answer-grid pseudo-questions).
   - **100% Non-Exempt Coverage (`missing = 0`):** **`5,155 / 6,708` (`76.85%`) scorable** (`3,748` `source_transcription_unverified` + `1,407` `curated_verified`) and **`1,553` formally exempt** (`nonExemptCoveragePct = 100%`, `inferred_unverified = 0`, `official_verified = 0`, `officialScore = null`).
   - **Curated Manifest (`data/exam-curated-keys.json`):** `2,146` audited records (`1,407` scorable `curated_domain_verified` keys + `739` item-level exemptions), each cryptographically bound to `promptSha256` and `optionsSha256` and verified end-to-end through `gradeExamQuestion` by `scripts/exams/verify_curated_keys.mjs`.
   - **Exemption Categories (`1,553` items):**
     - `structural_transcription_defect`: `768` (`ocr-structural-defect: 749`, `option-overflow: 12`, `key-not-an-option: 7`)
     - `missing_stimulus`: `627` (`stimulus-incomplete: 627` — absent audio without transcript or absent diagram/figure)
     - `open_ended_writing_or_speaking`: `158` (`essay-open-ended-exempt: 158` — excluded from `scorableTotal` denominator while still returning advisory 4-criterion rubric feedback `advisoryRubricEvaluation` when answered)

3. **Runtime Performance, Accessibility, Offline & Release Gate Hardening (`W008`–`W010`):**
   - Added `WeakMap` `distractorPoolCache` in `index.html` (`tests/static-app.test.js` `144/144` runs in `19s`; `tests/speed-benchmark.cjs` achieves `3 ms` median consolidation/retry DOM latency).
   - Passed sequential real-browser suites (`tests/run-browser-suites.sh`: `browser-learning.cjs` + `browser-exams.cjs`) covering `axe-core` WCAG 2.1 AA (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`), viewports `320/375/768/1024/1440 px`, VI/EN, Classic/Modern, light/dark, reduced motion, XSS DOM escaping, and `file://` standalone execution with zero network requests and zero page errors.
   - Wired `node scripts/exams/verify_curated_keys.mjs` into `ci.yml`, `deploy.yml`, and `scripts/release_artifacts.py`, and scoped `pages-smoke.yml` release-deployment polling to prereleases (`github.event.release.prerelease == true`) so future stable release publication never races manual `dispatch-stable-deploy` authorization.

---

## 2. Honest Residual Disclosures (Non-Blocking, Explicitly Surfaced)

- **No Primary Official Marking Sheets (`official_verified = 0`):** All `106` exam papers originate from reposted public transcriptions (`tailieudieuky.com`, `106/106` SHA-256 verified). Runtime results and JSON exports maintain `officialScore: null` / `officialScore: false` and explicit provisional-score disclaimers.
- **Editorial CEFR Estimates & Alignments (`needsIndependentValidation = 1,945`):** `1,846` senses lacking a matching-POS entry in the five pinned reference wordlists (`39` of which are cross-POS `LOW`-confidence proxies) plus `99` editorial sense/POS split alignments carry `needsIndependentValidation: true` in `data/vocabulary.json` and `index.html`.
- **Maintainer Release & Deployment Hold (`DEPLOY_HOLD = v1.0.0-rc10`):** Publishing `v1.0.0` after human review requires explicit maintainer steps: (1) merge Draft PR to `main`, (2) push annotated tag `v1.0.0` so `release-artifacts.yml` builds and verifies the draft stable release (`chuyen-anh-v1.0.0.{html,zip}` + `chuyen-anh-v1.0.0-checksums.txt`), (3) publish the `v1.0.0` GitHub Release, and (4) manually authorize Pages deployment (`release-published-dispatch.yml` `stable_deploy_authorized: true` / `DEPLOY_HOLD` update).
