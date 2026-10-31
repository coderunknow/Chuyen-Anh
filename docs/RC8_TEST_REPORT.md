# `v1.0.0-rc8` Cross-Browser, Accessibility, Security & CI Test Report

**Audit Date:** 2026-10-31  
**Branch:** `arena/c292bad5-chuyen-anh`  
**Shipped Deliverable:** `index.html` (`APP_VERSION = 'v1.0.0-rc8'`, standalone zero-dependency offline HTML)

---

## 1. Static Data, Provenance & Reproducibility Gates (`16 / 16` Passed)

| Check Command | Scope | Result |
| --- | --- | --- |
| `python3 scripts/expand_vocabulary.py --check` | `data/vocab-seed/*.tsv` → `Learned_Vocabulary_List.md` (`5,852` rows) | **PASS** |
| `python3 scripts/build_vocabulary.py --check` | `Learned_Vocabulary_List.md` → `data/vocabulary.json` (`5,112` headwords + `740` merged) | **PASS** |
| `python3 scripts/generate_vocab_audit_dev5.py --check` | Legacy `1–913` baseline audit snapshot (`2026-10-20`) | **PASS** |
| `python3 scripts/validate_vocab.py` | NFC, uniqueness, POS, meaning, family invariants | **PASS** |
| `python3 scripts/embed_vocabulary.py --check` | `data/vocabulary.json` ↔ `<script id="vocabulary-data">` in `index.html` | **PASS** |
| `python3 scripts/build_phrases.py --check` | `data/phrase-seed/*.tsv` → `Learned_Phrase_List.md` + `data/phrases.json` (`780`) | **PASS** |
| `python3 scripts/validate_phrases.py` | Phrase schema, levels, types, duplicates | **PASS** |
| `python3 scripts/embed_phrases.py --check` | `data/phrases.json` ↔ `<script id="phrase-data">` in `index.html` | **PASS** |
| `node scripts/exams/build_answer_keys.mjs --check` | Deterministic `data/exam-answer-keys.json` + `docs/exam-scoring-audit.{json,md}` (`6,804/6,804` scored) | **PASS** |
| `node scripts/exams/audit_rendering.mjs --check` | 106-paper Markdown render audit (`6,804` questions, `0` errors, `0` script tags, `0` event handlers) | **PASS** |
| `python3 scripts/exams/embed_archive.py --check` | 106 transcriptions + universal answer keys ↔ `<script id="exam-data">` in `index.html` | **PASS** |
| `python3 scripts/audit_vocabulary_quality.py --check` | `3,841` focus + `1,271` archived headwords, embedded byte count match | **PASS** |
| `python3 scripts/vocabulary_evidence_review.py --check` | `5,112` provenance claims checked (`0` unexplained mismatches) | **PASS** |
| `python3 scripts/rc4_vocabulary_audit.py --check` | `3,841` focus + `1,271` archived policy reconciliation (`0` `REVIEW` blockers) | **PASS** |
| `python3 scripts/audit_exam_provenance.py --check` | `106 / 106` exam source SHA-256 and ledger reconciliation | **PASS** |
| `git diff --check` | Trailing whitespace / conflict marker cleanliness | **PASS** |

---

## 2. Automated Unit & Contract Suites (`319 / 319` Passed, `0` Deprecation Warnings)

All Node suites were executed under `node --trace-deprecation` (`Node.js v22.22.3`) to verify zero `DEP0040` (`punycode`) or runtime deprecation warnings.

| Suite | Command | Tests | Result | Key `rc8` Regressions Covered |
| --- | --- | ---: | --- | --- |
| Python Unit Suites | `python3 -m unittest discover -s tests -p 'test_*.py'` | `159` | **159 / 159 PASS** | `DEPLOY_HOLD` (`v1.0.0-rc8`), `pages_smoke.py` rc8 markers, `release_artifacts.py` Python 3.12+ `tarfile` filter safety, `README`/ledger table & count consistency, `rc4` `0 REVIEW` policy, telemetry SQL migration + no-fallback-salt contract, workflow 40-char Node 24 SHA pinning & 3-browser matrix |
| Static App Suite | `node --trace-deprecation --test tests/static-app.test.js` | `131` | **131 / 131 PASS** | Single-file offline contract, scheduler invariants, sprint consolidation, multi-tab sync, atomic quota rollback, >30,000-question zero-leakage sweep, `proton`/`gluten`/`cholesterol` data fix + synthetic degenerate guard, full-denominator exam JSON schema, version-pin agreement |
| Exam Scoring Suite | `node --trace-deprecation --test tests/exam-scoring.test.js` | `12` | **12 / 12 PASS** | Universal 100% scoring across `6,804` items in `106` papers, `official_verified = 0`, `confidence` + `sourceStatus` separation, 4-criterion essay rubric fractional credit, listening transcript fallback + `LOW`/`VERY_LOW` confidence cap, legacy `rc6` history migration + anti-tampering |
| Telemetry API Suite | `node --trace-deprecation --test tests/telemetry-api.test.js` | `17` | **17 / 17 PASS** | CORS allowlist (`Origin: null` + GitHub Pages), 16 KB stream cap, schema rebuild, fail-closed `503` on missing/short/placeholder `TELEMETRY_IP_SALT`, `x-vercel-forwarded-for` / rightmost `x-forwarded-for` anti-spoofing |

---

## 3. Real-Browser, Responsive Viewport, Offline `file://` & Accessibility Matrix

### 3.1 Local Execution (Sandbox Headless Chromium `133.0.6943.0`)

- `node --trace-deprecation tests/browser-learning.cjs`: **PASS** (`0` page errors, `0` deprecation warnings).
  - Verified full session lifecycle (`new`, `due`, `weak`, `favorites`, `sprint`, timed 1-minute session, 8 exercise types including keyboard-driven `MATCH`, 780-phrase bank), multi-tab `storage` race preservation & wipe non-resurrection (`RT-01`), atomic over-quota rollback (`RT-07`), bilingual `vi`/`en` Classic & Modern skins, opt-in diagnostics consent/download/erasure, `rc7` masked gloss prompts, and bilingual About-panel license/provenance notice.
- `node --trace-deprecation tests/browser-exams.cjs`: **PASS** (`0` page errors, `0` external network requests, `0` deprecation warnings).
  - Verified `106`-paper catalogue, `2025/thai-nguyen/so` deterministic `100%` universal full-denominator summary + confidence breakdown (`HIGH` / `MEDIUM` / `LOW` / `VERY_LOW`), pre-submit answer hiding, `user_confirmed` recalculation & persistence, JSON history export/import/malformed rejection, unlocked HTML/OCR interactive practice (`2022/binh-phuoc/so` with `.exam-ocr-warning` and `LOW`/`VERY_LOW` badges), live-DOM HTML escaping on `2022/hai-phong/so` (`<studying the species of dolphin called bottlenose dolphins>` rendered as literal text with `0` `<studying>` elements), and **standalone `file://` execution with the local HTTP server completely shut down**.

### 3.2 Responsive Viewport Matrix (`0` Horizontal Overflow Across All 5 Required Widths)

Verified programmatically (`document.documentElement.scrollWidth <= window.innerWidth`) in both `Classic` and `Modern` interfaces across Study, Exam Catalogue, and Exam Practice views:

| Viewport | Dimensions | Study / Settings | Exam Catalogue (106 papers) | Exam Practice / Summary | Overflow |
| --- | --- | --- | --- | --- | --- |
| Small Mobile | `320 × 720 px` | PASS | PASS | PASS | `0 px` |
| Standard Mobile | `375 × 812 px` | PASS | PASS | PASS | `0 px` |
| Tablet | `768 × 900 px` | PASS | PASS | PASS | `0 px` |
| Small Desktop | `1024 × 900 px` | PASS | PASS | PASS | `0 px` |
| Wide Desktop | `1440 × 1000 px` | PASS | PASS | PASS | `0 px` |

### 3.3 Accessibility (`axe-core` WCAG 2.1 A/AA & Keyboard Navigation)

- **Automated `axe-core` (`4.14.0`):** `0` violations across Learn (Light & Dark), Dashboard badges (`RT-03` contrast regression), and `rc8` Exam Detail / HTML-OCR Warning / Interactive Practice (`wcag2a`, `wcag2aa`, `color-contrast`, `label-content-name-mismatch`).
- **Keyboard & Focus Ring:** Skip link (`.skip-link` → `#content`), programmatic main-region focus suppression (`outlineWidth === '0px'`), explicit `:focus-visible` `3px solid var(--primary)` ring on switches/buttons/inputs, keyboard-operable `MATCH` tiles, and WebKit-compatible `Tab`/`Alt+Tab` traversal verified.
- **Residual Manual Accessibility Scope:** Automated checks do not substitute for human assistive-technology testing with NVDA, JAWS, VoiceOver, or TalkBack on physical mobile/desktop hardware (recorded as a non-waivable `v1.0.0` stable gate in `docs/RC8_RELEASE_REPORT.md`).

### 3.4 GitHub Actions Cross-Browser CI Matrix (`ci.yml`)

- `.github/workflows/ci.yml` executes `tests/run-browser-suites.sh` (`browser-learning.cjs` + `browser-exams.cjs` sequentially with `--trace-deprecation`) across **`matrix.browser: [chromium, firefox, webkit]`** (`fail-fast: false`) using Playwright `1.55.1` on `ubuntu-latest`, with all 19 workflow action steps across `.github/workflows/*.yml` pinned to Node 24 40-character commit SHAs (`0` Node 20 deprecation warnings observed across all check-runs).
- **Observed on PR #73 (`3c04beb74815177728c1beefe4d636edc067a272`, run `41214991820`):**
  - `checks` (`124577566804`): **PASS** (`2m48s`, `0` warnings)
  - `browser (chromium)` (`124577566650`): **PASS** (`6m14s`, `0` warnings)
  - `browser (webkit)` (`124577566807`): **PASS** (`7m28s`, `0` warnings)
  - `browser (firefox)` (`124577566868`): **PASS** (`7m55s`, `0` warnings)
- **Observed on `main` (`df1965c61f183a252c97e57e9e13001774d17d26`, run `41215729720`):**
  - `checks` (`124579726506`): **PASS** (`1m43s`, `0` warnings)
  - `browser (chromium)` (`124579726669`): **PASS** (`6m02s`, `0` warnings)
  - `browser (webkit)` (`124579726812`): **PASS** (`7m40s`, `0` warnings)
  - `browser (firefox)` (`124579726786`): **PASS** (`8m16s`, `0` warnings)
