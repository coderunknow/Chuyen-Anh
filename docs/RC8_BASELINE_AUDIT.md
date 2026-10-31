# RC8 Baseline Audit (`docs/RC8_BASELINE_AUDIT.md`)

Audit date: `2026-10-31` (UTC)
Target release: `v1.0.0-rc8` (working branch `arena/c292bad5-chuyen-anh`, branched from `origin/main` at `e3a348198cc3ed31120f0f5606f6df2f7e02c7d6`)

---

## 1. Repository, Branch, Tag, and Release Baseline

All baseline facts from the user's Section 2 specification were independently verified against the local Git checkout and live GitHub API (`api.github.com`):

| Baseline Claim / Surface | Expected / Claimed | Live Verified Value | Verdict |
| --- | --- | --- | --- |
| Working repository & branch | `coderunknow/Chuyen-Anh`, session branch | `/home/user/Chuyen-Anh` on `arena/c292bad5-chuyen-anh` (clean working tree) | Verified |
| `main` HEAD SHA | `e3a348198cc3ed31120f0f5606f6df2f7e02c7d6` | `e3a348198cc3ed31120f0f5606f6df2f7e02c7d6` (PR #72 merge, `2026-10-31T09:55:31Z`) | Exact match |
| Latest release tag | `v1.0.0-rc7` | Annotated tag `v1.0.0-rc7` (`1ae43b97d88da8484232aac8ba830ab91eed1669`) peeling to `77189fc3737994ca348cced34bec7006ec98eaac` (PR #71 merge, `2026-10-31T09:41:17Z`) | Exact match |
| GitHub Release `v1.0.0-rc7` | Published prerelease with HTML, ZIP, checksums | `isDraft: false`, `isPrerelease: true`, `publishedAt: 2026-10-31T09:44:48Z`, 3 assets attached | Exact match |
| Open Pull Requests / Issues | None | `0` open PRs, `0` open issues | Exact match |
| Remote branch count | Stale `arena/*` branches exist (`~48`) | `48` remote heads (`origin/main` + historical branches; left untouched per safety rules) | Verified |
| Branch protection / rulesets on `main` | Check actual enforcement | `protected: false`, `rulesets: []` (verified via `repos/coderunknow/Chuyen-Anh/branches/main` and `/rulesets`) | Verified |
| `DEPLOY_HOLD` marker | Currently holding for `v1.0.0-rc7` | `v1.0.0-rc7` (matches `APP_VERSION = 'v1.0.0-rc7'` in `index.html`) | Exact match |

### 1.1 Bit-for-Bit Reproducibility of `v1.0.0-rc7` Release Assets

Rebuilding `v1.0.0-rc7` locally from `git archive 77189fc3737994ca348cced34bec7006ec98eaac` through `scripts/release_artifacts.py` logic reproduced every published GitHub Release asset digest byte-for-byte:

| Asset | Size (bytes) | GitHub Release Asset SHA-256 | Locally Rebuilt SHA-256 | Match |
| --- | ---: | --- | --- | --- |
| `chuyen-anh-v1.0.0-rc7.html` | `14,015,037` | `2567dfbc743839c4314d754b78b66482be9a8d99587f015b8fe7b8c6cfbf42ac` | `2567dfbc743839c4314d754b78b66482be9a8d99587f015b8fe7b8c6cfbf42ac` | Identical |
| `chuyen-anh-v1.0.0-rc7.zip` | `2,249,464` | `94ab31d72783b497754ff007652123731427876c4835a11ff671f72af0e9aba0` | `94ab31d72783b497754ff007652123731427876c4835a11ff671f72af0e9aba0` | Identical |
| `chuyen-anh-v1.0.0-rc7-checksums.txt` | `185` | `c62c66bf38d72ae239d27345f92c6f3db7ab3220a13e0f00735bff0d2f574c81` | `c62c66bf38d72ae239d27345f92c6f3db7ab3220a13e0f00735bff0d2f574c81` | Identical |

---

## 2. CI, Workflows, Reviewer Bots, and Deployment Baseline

### 2.1 GitHub Actions Workflows (`.github/workflows/`)

| Workflow File | Trigger(s) | Action Pinning / Runtime Baseline | Status on `main` / `rc7` |
| --- | --- | --- | --- |
| `ci.yml` (`Static checks`) | `push` (`main`), `pull_request` (`main`) | Unpinned Node 20 tags (`actions/checkout@v4`, `actions/setup-node@v4`, `actions/upload-artifact@v4`) — emits GitHub Node 20 deprecation warnings; runs Chromium only | `success` (run `41190644991` on `e3a3481`) |
| `deploy.yml` (`Deploy Flashcard`) | `push` (`main` paths), `workflow_dispatch` | Unpinned tags (`checkout@v4`, `configure-pages@v5`, `upload-pages-artifact@v4`, `deploy-pages@v4`) — Node 20 warning on `checkout@v4` / `configure-pages@v5` | `success` (run `41189938999`, deployment `7456996191` to `https://coderunknow.github.io/Chuyen-Anh/`) |
| `release-artifacts.yml` (`Release artifacts`) | `push` tags `v*`, `workflow_dispatch` | Unpinned `actions/checkout@v4` — Node 20 warning | `success` (run `41189725390` on `v1.0.0-rc7`) |
| `release-published-dispatch.yml` | `release: [published]` | Built-in `run:` step using `gh workflow run deploy.yml --ref main` (no external action) | `success` (run `41189935577`) |
| `pages-smoke.yml` (`Pages content smoke test`) | `push` (`main`), `pull_request` (`main`), `release: [published]`, `workflow_dispatch` | Unpinned `actions/checkout@v4` — Node 20 warning; hardcoded `v1.0.0-rc6`/`v1.0.0-rc7` branches in `tests/pages_smoke.py` | `success` (run `41189935591`) |
| `telemetry-smoke.yml` (`Telemetry endpoint smoke test`) | `push` (`main` telemetry paths), `pull_request`, `workflow_dispatch` | Unpinned `actions/checkout@v4` — Node 20 warning | `success` (run `41189704646`) |
| `exam-validation.yml` | `push`/`pull_request` (`De-chuyen-Anh-vao-10/**`) | SHA-pinned Node 24 v7 actions (`checkout@3d3c42...`, `setup-python@5fda3b...`) | Configured |
| `exam-sources.yml` | `workflow_dispatch` | SHA-pinned Node 24 v7 actions (`checkout@3d3c42...`, `setup-python@5fda3b...`, `upload-artifact@043fb4...`) | Manual only |

**Verified CI Warning Annotation on `e3a3481` (checks `124506566347` and `124506566575`):**
> `Node.js 20 is deprecated. The following actions target Node.js 20 but are being forced to run on Node.js 24: actions/checkout@v4, actions/setup-node@v4.`

**`punycode` Deprecation Verification:**
Running all shipped Node suites and scripts (`tests/static-app.test.js`, `tests/exam-scoring.test.js`, `tests/telemetry-api.test.js`, `scripts/exams/build_answer_keys.mjs`, `scripts/exams/audit_rendering.mjs`, `tests/browser-learning.cjs`, `tests/browser-exams.cjs`) under `NODE_OPTIONS="--trace-deprecation"` on Node `v22.22.3` produced **zero** `DEP0040` / `punycode` warnings. Historical `punycode` warnings came only from ad-hoc `jsdom`/`whatwg-url` usage outside the repository's zero-dependency Node test harness.

### 2.2 Reviewer Bot State on PR #71 (`a4a013aa26918db7ae53bb77c69c00bf2fb9d916`)

Live GitHub API verification confirms the exact reviewer availability caveats noted in the user prompt:
- `copilot-pull-request-reviewer[bot]`: Completed review (`COMMENTED`) on head SHA `a4a013aa...`.
- `chatgpt-codex-connector[bot]`: Completed summary comment (`has_any_findings: false`) on head SHA `a4a013aa...`.
- `coderabbitai`: Check run conclusion `skipped` (`Review skipped`).
- `kilo-code-bot`: Check run conclusion `action_required` (`Insufficient credits to run review`).
- `qodo-code-review[bot]`: Comment `Qodo reviews are paused because your trial has ended.`

### 2.3 Live Telemetry Infrastructure Baseline (Vercel + Supabase Connectors)

Both `vercel` and `supabase` connectors are active and were inspected read-only (no secret values read):
- **Vercel (`prj_YmtevOrE913KuRhJSX9FlQyKi3dO` / `chuyen-anh-telemetry`):** Team `team_NK7ZIqw551PrQnND7BHTILmP`, Node `24.x`, active `READY` production deployment `dpl_FbxQncjJru7dSKMWnPnTs1GozMWV` aliased to `chuyen-anh-telemetry.vercel.app`. Environment keys `SUPABASE_URL` (`encrypted`), `SUPABASE_SECRET_KEY` (`sensitive`), and `TELEMETRY_IP_SALT` (`sensitive`) are present for `production` and `preview`.
- **Supabase (`zomeiulaqahyjwhgdemf` / `chuyen-anh-telemetry`):** Region `ap-southeast-1`, status `ACTIVE_HEALTHY`, PostgreSQL `17.11.0.003`. Applied migrations: `20261029093328` (`telemetry_ingest`) and `20261029093429` (`telemetry_ingest_fix`). Catalog audit confirmed:
  - `telemetry.reports` and `telemetry.rate_limits` both have `rls_enabled: true`, `0` RLS policies, and table privileges granted exclusively to `postgres` (`0` grants to `PUBLIC`, `anon`, `authenticated`, or `service_role`).
  - `public.telemetry_ingest(jsonb, text)` is `SECURITY DEFINER` with `search_path=telemetry, public, pg_temp` and `EXECUTE` granted only to `postgres` and `service_role`.
  - Code-level defects confirmed for Phase 6 remediation: `api/telemetry.js` falls back to `'chuyen-anh-telemetry'` when `TELEMETRY_IP_SALT` is unset, trusts `x-forwarded-for[0]` ahead of platform IP headers, and sends `client_key: null` when IP headers are missing; `public.telemetry_ingest` increments the `global` rate-limit counter before checking `per_client_limit` and skips per-client rate limiting when `client_key` is `null`.

---

## 3. Data, Exam Archive, Vocabulary, and Third-Party File Baseline

### 3.1 Vocabulary & Phrase Bank Baseline
- `Learned_Vocabulary_List.md` / `data/vocabulary.json` / `index.html`: **5,852** rows = **5,112** active headwords + **740** merged word-family rows (`389` families).
- Curation split: **3,841** retained focus headwords (`deck`) + **1,271** archived headwords (`basic-b1`: 516, `everyday-object`: 403, `food-drink`: 189, `nature-species`: 163).
- `rc4_vocabulary_audit.py`: **3** `REVIEW` rows (`4188 proton`, `4492 gluten`, `4494 cholesterol`) where Vietnamese loanword gloss equals English headword.
- `vocabulary-quality-audit.md`: **33** entries with legacy exam-attestation count mismatches (`examCountMismatch: 33`); `vocabulary-evidence-review.md`: **13** `no-basis` multi-word structures/idioms noted for scope transparency.
- Phrase bank (`data/phrases.json`): **780** phrases, tracked in isolated store `chuyen-anh.phrases.v1`.

### 3.2 Exam Archive Baseline (`De-chuyen-Anh-vao-10/`, 106 Papers)
- Total papers: **106** (`2022`–`2026`), all sourced from secondary reposts (`tailieudieuky.com`), **0** primary official department/school publications in repo (`0` `official_verified`), **3** independently cross-checked against a second public repost (`2025/hai-phong/so`, `2023/dak-lak/so`, `2025/binh-duong/so`).
- Source formats: `PDF-text` (49), `DOCX` (28), `HTML/OCR-cần-soát` (22), `PDF-text/DOCX` (5), `DOCX/PDF-text` (2).
- Listening material breakdown: **23** papers have no listening section; **83** have listening sections (**23** full written transcript, **4** truncated transcript: `2023/dak-lak/so`, `2026/an-giang/so`, `2026/bac-ninh/so`, `2026/hue/chuyen-khoa-hoc-hue`; **56** omit both audio and transcript).
- Missing visual/chart stimuli: **8** papers (`2022/ha-nam/so`, `2022/ha-noi/so`, `2022/tien-giang/so`, `2024/ben-tre/so`, `2025/nghe-an/so`, `2025/vinh-phuc/so`, `2026/ha-tinh/so`, `2026/hue/chuyen-khoa-hoc-hue`).
- Current `rc6-equal-weight-v1` extraction baseline:
  - Total extracted questions across all 106 papers: **6,457**
  - Currently gradable in UI: **1,269** (`19.65%` of extracted questions; all 22 HTML/OCR papers are blocked read-only, 718 listening items blocked, 191 writing/essay items blocked, 3,216 `missing_answer`, 1,472 `ambiguous_review`).
- Rendering anomaly (`rawUnsafeHtml: 1`): Verified at `De-chuyen-Anh-vao-10/2022/hai-phong/so.md` body line 186:
  `1. (Scientists <studying the species of dolphin called bottlenose dolphins>) (has made) (an interesting discovery.)`
  The angle brackets are grammar clause delimiters in source commentary, escaped to `&lt;...&gt;` by `renderExamMarkdown` with `0` script tags and `0` event handlers.

### 3.3 Third-Party Files Present in Repository Working Tree
Per user instructions, no source/reference files are deleted; all third-party artifacts are inventoried for Phase 8 provenance separation from the MIT software license (`LICENSE`):
- Root files:
  - `Destination-B2.pdf` (`1.1 MB`) — third-party textbook reference PDF.
  - `Tieng_Anh_9_Global_success_95621.pdf` (`4.6 MB`) — third-party textbook reference PDF.
  - `De-Tieng-Anh-vao-10-Ha-Noi-2026-2027-ma-de-001-co-dap-an-Word-PDF.zip` (`393 KB`) — third-party exam reference archive.
- `Luyện đề Anh đại trà/`:
  - `thi đề TP HCM lần 1 - 6,5-7.txt`
  - `Đáp án chính thức môn Tiếng Anh thi lớp 10 TPHCM 2026.pdf`
- `De-chuyen-Anh-vao-10/`: 106 Markdown transcriptions + index/manifest files derived from `tailieudieuky.com` secondary reposts.
- Note: Release ZIP (`scripts/release_artifacts.py`) packages **only** `("index.html", "README.md", "LICENSE")` — root PDFs/ZIPs and `Luyện đề Anh đại trà/` are never included in release ZIP bundles, while `index.html` embeds the 106 Markdown exam transcriptions with explicit source attribution and non-official disclaimers.

---

## 4. Baseline Verification Command Battery Results

All existing baseline checks and test suites were executed on the unmodified `e3a3481` tree:

| Check / Suite | Result | Details |
| --- | --- | --- |
| 15 data/build/audit `--check` scripts | `PASS` | 5,852 vocab rows, 780 phrases, 106 exams, 6,457 questions, all audits byte-current |
| Python `unittest` (`tests/test_*.py`) | `PASS` | `157` tests in `10.39s` (`OK`) |
| `node --test tests/exam-scoring.test.js` | `PASS` | `11/11` passed (`0` deprecation warnings) |
| `node --test tests/telemetry-api.test.js` | `PASS` | `16/16` passed (`0` deprecation warnings) |
| `node --test tests/static-app.test.js` | `PASS` | `131/131` passed in `181.4s` (`0` deprecation warnings) |
| `node tests/browser-exams.cjs` | `PASS` | Real Chromium `133.0.6943.0` (`40.2s`, `0` page/network errors) |
| `node tests/browser-learning.cjs` | `PASS` | Real Chromium `133.0.6943.0` (`563.0s`, `0` page/network errors) |
