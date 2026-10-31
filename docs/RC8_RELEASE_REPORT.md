# `v1.0.0-rc8` Release, Provenance, Deployment & `v1.0.0` Stable Gate Report

**Release Date:** 2026-10-31  
**Repository:** `https://github.com/coderunknow/Chuyen-Anh`  
**Prerelease Tag:** `v1.0.0-rc8` (`published_at = 2026-10-31T15:40:43Z`, Release ID `430023753`)  
**Stable `v1.0.0` Decision:** **NO-GO (`v1.0.0` tag NOT created)**

---

## 1. Release Identity & Immutable Git Chain

| Artifact / Reference | Identifier / Value | Verification |
| --- | --- | --- |
| Baseline `main` Commit | `e3a348198cc3ed31120f0f5606f6df2f7e02c7d6` | Verified clean starting state (`docs/RC8_BASELINE_AUDIT.md`) |
| Candidate Pull Request | [PR #73](https://github.com/coderunknow/Chuyen-Anh/pull/73) (`arena/c292bad5-chuyen-anh` → `main`) | Merged `2026-10-31T15:37:16Z` |
| PR #73 Head Commit | `3c04beb74815177728c1beefe4d636edc067a272` | Verified ancestor of `origin/main` |
| Merge Commit on `main` | `df1965c61f183a252c97e57e9e13001774d17d26` | Tagged target commit |
| Annotated Tag `v1.0.0-rc8` | Tag object `1b52e930aba4ff689fb98b45854e527dea619bc5` → `df1965c61f183a252c97e57e9e13001774d17d26` | `git rev-parse v1.0.0-rc8^{commit}` matches merge SHA |
| Shipped `APP_VERSION` / `DEPLOY_HOLD` | `v1.0.0-rc8` / `v1.0.0-rc8` | Verified in `index.html`, `DEPLOY_HOLD`, and live Pages probe |

---

## 2. Exact-SHA CI & Reviewer Ledger on PR #73 (`3c04beb74815177728c1beefe4d636edc067a272`)

### 2.1 GitHub Actions Check-Runs (`7 / 7` Green, `0` Node 20 Deprecation Warnings)

| Workflow | Run ID | Check-Run / Job ID | Job Name | Duration | Conclusion | Node 20 Warnings |
| --- | ---: | ---: | --- | ---: | --- | ---: |
| `Static checks` | `41214991820` | `124577566804` | `checks` | `2m48s` | `success` | `0` |
| `Static checks` | `41214991820` | `124577566650` | `browser (chromium)` | `6m14s` | `success` | `0` |
| `Static checks` | `41214991820` | `124577566868` | `browser (firefox)` | `7m55s` | `success` | `0` |
| `Static checks` | `41214991820` | `124577566807` | `browser (webkit)` | `7m28s` | `success` | `0` |
| `Validate exam archive` | `41214991740` | `124577566028` | `validate` | `10s` | `success` | `0` |
| `Telemetry endpoint smoke test` | `41214991828` | `124577566288` | `probe` | `11s` | `success` | `0` |
| `Pages content smoke test` | `41214991864` | `124577566629` | `probe` | `37s` | `success` | `0` |

Post-merge `Static checks` on `main` (`df1965c61f183a252c97e57e9e13001774d17d26`, run `41215729720`) likewise passed all four jobs (`checks` `124579726506`, `browser (chromium)` `124579726669`, `browser (firefox)` `124579726786`, `browser (webkit)` `124579726812`), alongside `Validate exam archive` (`41215729787`) and `Telemetry endpoint smoke test` (`41215729806`).

### 2.2 Automated & Human Review Accounting on `3c04beb74815177728c1beefe4d636edc067a272`

| Reviewer / App | Observed State on `3c04beb` | Substantive Review Completed? | Notes |
| --- | --- | --- | --- |
| `chatgpt-codex-connector[bot]` | `completed` (`2026-10-31T15:34:59Z`), `has_any_findings: false`, `+1` reaction | **Yes (0 findings)** | Comment `6545396862` on exact head SHA `3c04beb74815177728c1beefe4d636edc067a272` |
| `coderabbitai[bot]` | `skipped` (`124577585698`) | **No (not claimed)** | Auto-skipped (`repository has fewer than 10 stars`) |
| `kilo-code-bot[bot]` | `action_required` (`124577563578`) | **No (not claimed)** | External account out of credits |
| `qodo-code-review[bot]` | Comment `6545395412` (paused) | **No (not claimed)** | Trial ended |
| `copilot-pull-request-reviewer[bot]` | `COMMENTED` (`5723548510`) | **No (not claimed)** | User out of remaining Copilot review quota |
| Independent Human Reviewer | None recorded | **No** | Blocks `v1.0.0` stable under independent review gate |

---

## 3. Release Artifacts & Cryptographic Digest Verification

Workflow `Release artifacts` (`41215742597`) executed from `git archive` of `v1.0.0-rc8` (`df1965c61f183a252c97e57e9e13001774d17d26`), ran source checks/tests on the runner, packaged the three release deliverables, uploaded them to Release `430023753`, and verified round-trip downloads on the runner:

| Asset | Size (Bytes) | SHA-256 Digest (`gh api` & Verified) | Independent Verification |
| --- | ---: | --- | --- |
| `chuyen-anh-v1.0.0-rc8.html` | `16,335,505` | `14914ac43b597be9b4e92ed20b1349667842291b9b0a2eaa0ae8ecbe1c513dc4` | Bit-for-bit identical to `git show v1.0.0-rc8:index.html` and local `release_artifacts.build()` |
| `chuyen-anh-v1.0.0-rc8.zip` | `2,448,473` | `92e66cacb6f46a83e338716b51c91e4fd58a1feb7b6d24b00a8f256b8b097085` | Unpacks to `['index.html', 'README.md', 'LICENSE']`; verified by runner round-trip download and size/manifest check |
| `chuyen-anh-v1.0.0-rc8-checksums.txt` | `185` | `274be2d81552a906d17665599fdb6fa0d6af9ae517c6a86b5680a8f12ecef5dc` | Reconstructed two-line `sha256sum` manifest hashes identically to `274be2d8...` |

---

## 4. `DEPLOY_HOLD` Gate, Prerelease Publication & Live GitHub Pages Verification

1. **Pre-publication hold verified (`Deploy Flashcard` run `41215729765`):** Triggered on merge push `df1965c61f183a252c97e57e9e13001774d17d26` while `v1.0.0-rc8` was still `draft: true`. Steps 1–7 (`Evaluate deploy hold`, data checks, Python & Node unit suites) succeeded; Steps 8–11 (`Stage standalone HTML`, `Configure Pages`, `Upload Pages artifact`, `Deploy`) were `skipped`.
2. **Explicit prerelease publication:** Draft release `430023753` was published as a prerelease (`draft: false`, `prerelease: true`) at `2026-10-31T15:40:43Z` (<https://github.com/coderunknow/Chuyen-Anh/releases/tag/v1.0.0-rc8>).
3. **Post-publication deployment (`Deploy Flashcard` run `41215997247`):** Dispatched automatically by `release-published-dispatch.yml` (`41215991789`). `scripts/deploy_gate.py` evaluated `deploy=true`; all 11 steps succeeded, creating GitHub Pages deployment `7460689711` (status `21066344030` = `success` at `2026-10-31T15:43:48Z`) serving <https://coderunknow.github.io/Chuyen-Anh/>.
4. **Live Pages smoke verification (`Pages content smoke test` run `41215991762`):** Waited for deployment `7460689711` on `df1965c61f183a252c97e57e9e13001774d17d26`, then probed `https://coderunknow.github.io/Chuyen-Anh/` and verified HTTP `200`, `APP_VERSION = 'v1.0.0-rc8'`, `rc8-universal-scoring-v1`, `gradeExamEssayRubric`, `extractExamTranscript`, `exam-ocr-warning`, `rc7` masking guards, and embedded datasets.

---

## 5. Separation of Repository Code, CI & External Cloud State (Telemetry)

- **Repository Code & Tests (`main` @ `df1965c`):** `api/telemetry.js` (`RC8-SEC-001`, `RC8-SEC-002` fail-closed `TELEMETRY_IP_SALT` >= 16 chars + trusted proxy IP precedence) and `supabase/migrations/20261031_telemetry_hardening.sql` (`RC8-SEC-003` 32-hex format check + `client:missing` `5 / 10 min` bucket) are committed, tested (`17/17` Node + `12/12` Python), and merged.
- **CI Live Smoke (`41215729806`):** Verified end-to-end `OPTIONS 204` + `POST 202` + invalid-payload `400` + oversized `413` against `https://chuyen-anh-telemetry.vercel.app/api/telemetry` with `appVersion = "v1.0.0-rc8"`.
- **External Cloud Rollout Note:** Vercel project `prj_YmtevOrE913KuRhJSX9FlQyKi3dO` (`dpl_FbxQncjJru7dSKMWnPnTs1GozMWV`, encrypted `TELEMETRY_IP_SALT` already configured across `production`/`preview`/`development`) and Supabase project `zomeiulaqahyjwhgdemf` were inspected **read-only** and were not mutated from the agent sandbox; applying `supabase/migrations/20261031_telemetry_hardening.sql` and running `vercel deploy --prod` remain explicit maintainer rollout steps prior to `v1.0.0`.

---

## 6. Legal Provenance & Live-DOM Escaping Verification

- **`THIRD_PARTY_NOTICES.md`:** Documents the boundary between the MIT software license (`LICENSE`) and third-party workspace reference files (`Destination-B2.pdf`, `Tieng_Anh_9_Global_success_95621.pdf`, `De-Tieng-Anh-vao-10-Ha-Noi-2026-2027-ma-de-001-co-dap-an-Word-PDF.zip`, `Luyện đề Anh đại trà/*`) plus the 106 exam transcriptions (`De-chuyen-Anh-vao-10/**`), with exact SHA-256 digests and zero file deletions.
- **Live-DOM `rawUnsafeHtml` Audit (`2022/hai-phong/so`):** Confirmed line 199 (`1. (Scientists <studying the species of dolphin called bottlenose dolphins>) ...`) is grammatical angle-bracket notation, escaped to `&lt;studying ...&gt;` by `renderExamMarkdown` with `0` `<studying>` DOM nodes in Chromium, Firefox, and WebKit.

---

## 7. Strict `v1.0.0` Stable Gate Evaluation (`NO-GO`)

| Stable Gate | Requirement | Observed Status | Verdict |
| --- | --- | --- | --- |
| **G1. Official Exam Verification** | Primary official papers/keys (`official_verified`) and complete audio stimuli where claimed | `0 / 106` primary official keys (`official_verified = 0`); `771` listening items lack audio (`483` lack transcripts); `22` HTML/OCR papers reconstructed | **FAIL** |
| **G2. Independent PR Review & Branch Protection** | Protected `main` + independent human/substantive multi-reviewer sign-off on exact head SHA | `main` has `0` active rulesets; Codex passed (`0` findings), 4 bots skipped/quota-blocked, `0` independent human reviews | **FAIL** |
| **G3. Physical Assistive-Tech & Device Pass** | Manual NVDA / VoiceOver / TalkBack verification on physical mobile & desktop hardware | Automated Playwright (`chromium` / `firefox` / `webkit`) + `axe-core` WCAG 2.1 AA passed; manual AT pass not yet performed | **FAIL** |
| **G4. Cloud Migration Parity** | `20261031_telemetry_hardening.sql` + `api/telemetry.js` deployed to production Supabase/Vercel | Merged to `main`; cloud instances deliberately kept read-only during sandbox session | **PENDING** |
| **G5. Software, Data, Offline & Prerelease Pipeline** | 100% deterministic single-file `index.html`, 100% provisional exam scoring (`6,804/6,804`), `0` `REVIEW` focus vocab, 3-engine Node 24 CI, verified `v1.0.0-rc8` assets & Pages deploy | All automated checks, 3-browser suites, artifact hashes, and Pages smoke probe green | **PASS** |

**Final Gate Decision:** Because Gates **G1**, **G2**, **G3**, and **G4** are not yet satisfied, **`v1.0.0` stable is strictly held (`NO-GO`)** and only `v1.0.0-rc8` is published and deployed.
