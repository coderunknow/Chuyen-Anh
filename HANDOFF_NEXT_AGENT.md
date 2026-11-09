# Engineering Handoff for Next Agent — `coderunknow/Chuyen-Anh`

- **Prepared:** `2026-11-08` (UTC)
- **Repository:** `coderunknow/Chuyen-Anh`
- **Prepared From Session Branch:** `arena/2a533bbc-chuyen-anh` (Draft PR **#83** -> `main`)
- **Handoff Status:** Committed on `arena/2a533bbc-chuyen-anh` directly atop verified `v1.0.0` candidate commit `34792d6e8a9bc2e8752785377c451a9f03aac2d1` (documentation-only addition; `index.html` and all application/data/test files remain byte-for-byte identical to `34792d6e8a9bc2e8752785377c451a9f03aac2d1`); **nothing** has been merged to `main`, tagged as `v1.0.0`, published as a GitHub Release, or deployed to production GitHub Pages.

---

## 1. Exact Repository, Branch, PR & Live Production State

| Target | Ref / Identifier | Exact SHA / Value | Notes |
|---|---|---|---|
| **`main` branch** | `origin/main` | `f12b4bc5241e330eb8c051ada749d4f514111b61` | Ships `APP_VERSION = 'v1.0.0-rc10'`. `1` commit ahead of `v1.0.0-rc10` (`f12b4bc rc10: record the executed release in audit logs`). |
| **Production `index.html` on `main`** | `origin/main:index.html` | Blob `900c56c140fc07a964b63b37a09cc7ff56610fb2` | `19,000,308` bytes; SHA-256 `bb1a77f96e4ff2feccbda724768d786300fa1f90cb1822be548fa4f31bb84272`. **Byte-for-byte identical** to `v1.0.0-rc10:index.html` (`7,852` vocab rows, `1,094` phrases, `106` exams). |
| **Published `v1.0.0-rc10` tag** | `refs/tags/v1.0.0-rc10` | Tag `9d4a6300b56592497e930012a2c26271cb70dd53` -> Commit `72afdc74576cc725666300c8e95c8b52395ee476` | Published GitHub prerelease (`draft: false`, `prerelease: true`). |
| **Live GitHub Pages (`/`)** | `https://coderunknow.github.io/Chuyen-Anh/` | Deployment `7520697123` (`72afdc74576cc725666300c8e95c8b52395ee476`) | Serving `v1.0.0-rc10` from `main` (`created_at: 2026-11-03T13:58:32Z`). |
| **`github-pages` environment** | Deployment branch policy | `main` only (policy `id: 60770510`) | Protected environment: non-`main` branches **cannot** deploy directly to `github-pages`. |
| **`DEPLOY_HOLD` marker** | `DEPLOY_HOLD` | `v1.0.0-rc10` | Identical on both `main` and `arena/2a533bbc-chuyen-anh`. Because `v1.0.0-rc10` is a published prerelease, `scripts/deploy_gate.py` evaluates `deploy=true` on `main`. |
| **`v1.0.0` Candidate Branch** | `origin/arena/2a533bbc-chuyen-anh` | `34792d6e8a9bc2e8752785377c451a9f03aac2d1` | Open **Draft PR #83** (`https://github.com/coderunknow/Chuyen-Anh/pull/83`, `isDraft: true`), **6/6 GitHub Actions checks PASS**. |
| **Candidate `index.html` on PR #83** | `34792d6e8a9bc2e8752785377c451a9f03aac2d1:index.html` | SHA-256 `27f9f82c923fcdbfc886f5cedf1cbb975b44e791aa47f2694350bcabb0ca611a` | `APP_VERSION = 'v1.0.0'`; `28,189,194` bytes raw (`3,068,035` bytes gzipped); `8,852` vocab rows, `1,094` phrases, `106` exams. |

---

## 2. Standing User Constraints & Non-Negotiable Repository Rules

Before making any change, read `AGENT.md` and `DESIGN_LOG.md` in full (`AGENT.md` Rule #1) and verify against current files.

### 2.1 Explicit User Constraints
1. **No unauthorized merge, tag, release, or production deployment:**
   - Do **not** merge PR #83 (or any new PR), push a release tag, publish a GitHub Release, or trigger a live GitHub Pages deployment until the user explicitly approves.
   - Live production `https://coderunknow.github.io/Chuyen-Anh/` must stay on `v1.0.0-rc10` until explicit user approval.
2. **Do NOT create another GitHub repository:**
   - Creating a separate preview repository was explicitly ruled out by the user (and `POST /user/repos` returns `403 Resource not accessible by integration` under the Arena GitHub App token `Iv23lifFg4c9eT1T6hLC`).
3. **Subpath `/preview/` constraints (if implementing Playbook A below):**
   - Serve `arena/2a533bbc-chuyen-anh` (`34792d6e8a9bc2e8752785377c451a9f03aac2d1`) under `https://coderunknow.github.io/Chuyen-Anh/preview/`.
   - Keep the `github-pages` environment restricted to `main`; run the deployment workflow from `main` while checking out the preview commit as a separate source.
   - Preserve `/preview/` across future normal `main` production deployments.
   - Do **not** modify application source code, `APP_VERSION`, release tags, or `DEPLOY_HOLD`.
   - Do **not** weaken workflow permissions or bypass environment protection.
   - Open the smallest possible PR containing only deployment workflow, smoke-test, and documentation changes, and **wait for user approval before merging or deploying**.

### 2.2 Protected Files & Code Invariants
- **`AGENT.md`:** Never modify unless the user explicitly asks for an `AGENT.md` edit.
- **`DESIGN_LOG.md` & `AGENTS_LOG.md`:** Strictly **append-only**. Never rewrite, edit, or reorder earlier entries. Append a dated, sequential entry after completing approved changes, including what was verified and what was not tested.
- **`DEPLOY_HOLD`:** Keep at `v1.0.0-rc10` unless explicitly instructed otherwise.
- **`De-chuyen-Anh-vao-10/*.md`:** `106` immutable exam source markdown files (`106/106` SHA-256 verified) — never edit.
- **`parseExamQuestions` & `extractExamAnswerKeys` in `index.html`:** Protected parser/extractor functions — never modify.
- **Historical Audit Reports:** Never edit `docs/RC1_AUDIT_REPORT.md`, `docs/EXAM_AUDIT_LEDGER.md`, or `docs/vocabulary-audit-dev5.{json,md}`.

---

## 3. Summary of `v1.0.0` Work Completed on Draft PR #83 (`arena/2a533bbc-chuyen-anh`)

Branch `arena/2a533bbc-chuyen-anh` (`34792d6e8a9bc2e8752785377c451a9f03aac2d1`) contains 4 commits over `a66561d9` (which branched from `arena/6b7c2879-chuyen-anh` over `main` `f12b4bc5`):

1. `a66561d` — `Update exact CEFR deck regression snapshots`
2. `3d3e489` — `feat(v1.0.0): complete sense-level CEFR locators, SHA-256 curated exam keys, and formal exemptions`
3. `e0f9aa4` — `fix(v1.0.0): enforce stable deploy authorization on push, fix 3 A2 glosses, and pin browser CI to ubuntu-24.04`
4. `34792d6` — `fix(v1.0.0): resolve round-2 review findings across app_release_gate, exam status mapping, and audit checks`

### Key Verified Metrics on `34792d6e8a9bc2e8752785377c451a9f03aac2d1`
- **Sense-Level CEFR & Vocabulary (`8,852` entries, `8,928` senses, `75` multi-sense, `1,094` phrases):**
  - `8,112` active headwords (`6,841` focus study words + `1,271` `curation:archived` rows) + `740` merged word-family rows.
  - Phase III expansion (`data/vocab-seed/22-a1a2-stable.tsv`): `500 A1 + 500 A2 = 1,000` everyday headwords (`892` `cefrj-vocabulary-profile-1.5` + `108` `oxford-3000-wordlist`, `0` editorial).
  - `byLevel`: `A1: 942 · A2: 1,160 · B1: 1,930 · B2: 2,230 · C1: 1,478 · C2: 1,188 · UNCLASSIFIED: 0`.
  - `byEvidence`: `source_supported: 3,174 · cross_validated: 1,670 · disputed: 2,238 · editorial_estimate: 1,846 · unresolved: 0`.
  - `scripts/audit_sense_sources.py --check`: **`4,844 / 4,844` (`100%`)** source-backed senses verified for exact headword, POS, and CEFR level against SHA-256-pinned reference snapshots (`cefrj`, `octanove`, `oxford-3000`, `oxford-5000`, and `audit/v100/refs/cambridge-evp-verified.tsv`).
- **Exam Archive & SHA-256 Curated Answer Keys (`106` exams, `6,708` genuine questions):**
  - **`5,155 / 6,708` (`76.85%`) scorable** (`3,748` `source_transcription_unverified` + `1,407` `curated_verified` / `curated_domain_verified`).
  - **`1,553` formally exempt** (`nonExemptCoveragePct = 100.0%`, `missing = 0`, `inferred_unverified = 0`, `official_verified = 0`, `officialScore = null`):
    - `structural_transcription_defect`: `768` (`ocr-structural-defect: 749`, `option-overflow: 12`, `key-not-an-option: 7`)
    - `missing_stimulus`: `627` (`stimulus-incomplete: 627`)
    - `open_ended_writing_or_speaking`: `158` (`essay-open-ended-exempt: 158` — excluded from objective `scorableTotal` denominator while still returning advisory 4-criterion rubric feedback `advisoryRubricEvaluation` when answered)
  - `data/exam-curated-keys.json` (`2,146` entries: `1,407` curated keys + `739` item-level exemptions) is cryptographically bound to `promptSha256` and `optionsSha256` and verified end-to-end through `gradeExamQuestion` by `scripts/exams/verify_curated_keys.mjs`.
- **Release Gate Hardening (`scripts/app_release_gate.py`):**
  - Blocks Pages deploys unless `index.html`'s `APP_VERSION` has a matching published GitHub Release in the proper channel (`prerelease == ('-' in version)`).
  - For stable versions (`v1.0.0`, no `-`), requires **both** a published stable release **and** `STABLE_DEPLOY_AUTHORIZED=true` (`workflow_dispatch` input `stable_deploy_authorized: true`), even if `FORCE_DEPLOY=true`.
- **Audit Evidence Directory:** Full readiness documentation lives in `audit/v100/{GATES,DEFECTS,WORK_LOG,FINAL_READINESS_CHECKLIST,FINAL_READINESS}.md` and `audit/v100/evidence/*.json`.

---

## 4. Playbook A — Implementing the Combined GitHub Pages `/preview/` Subpath PR Off `main`

> **When to use this playbook:** When running in a **new Arena session branched directly from `main`** (`f12b4bc5241e330eb8c051ada749d4f514111b61`) to open the minimal workflow/smoke-test/doc PR that serves `arena/2a533bbc-chuyen-anh` (`34792d6e8a9bc2e8752785377c451a9f03aac2d1`) at `https://coderunknow.github.io/Chuyen-Anh/preview/` while keeping production `/` on `v1.0.0-rc10`.

### 4.1 Why `arena/2a533bbc-chuyen-anh` Must Stay Open & Untouched
- Arena sessions are locked to a single session branch. `arena/2a533bbc-chuyen-anh` (Draft PR #83) carries all 57+ `v1.0.0` app/data files, so it cannot be merged to `main` without modifying `main`'s `index.html` (`v1.0.0-rc10` -> `v1.0.0`), nor reset to `main` without wiping out the `v1.0.0` preview build.
- Keep `arena/2a533bbc-chuyen-anh` and Draft PR #83 open at `34792d6e8a9bc2e8752785377c451a9f03aac2d1` so GitHub retains the commit in `origin` and `actions/checkout` can fetch it by 40-char SHA.

### 4.2 Exact 6 Non-App Files to Create/Edit on the New Branch Off `main`

Verify first that `git rev-parse origin/main` is `f12b4bc5241e330eb8c051ada749d4f514111b61` and that `index.html`, `DEPLOY_HOLD`, `data/**`, and `scripts/**` remain completely untouched (`git diff origin/main -- index.html DEPLOY_HOLD data scripts` must be empty).

#### File 1: `PREVIEW_REF` *(new file at repo root)*
```text
# Optional preview commit staged at /preview/index.html alongside production /index.html.
# Must be a single 40-char commit SHA from this repository (comment out or leave blank to disable).
# Source: arena/2a533bbc-chuyen-anh (Draft PR #83, v1.0.0 candidate)
34792d6e8a9bc2e8752785377c451a9f03aac2d1
```

#### File 2: `.github/workflows/deploy.yml`
1. Add `- "PREVIEW_REF"` under `on.push.paths:` right after `- "DEPLOY_HOLD"`.
2. Keep `permissions:`, `environment: name: github-pages`, `ref: main` checkout, `Evaluate deploy hold`, and all Python/Node test steps unchanged.
3. Replace the `Stage standalone HTML` step with these three gated steps (note the mandatory 40-char Node-24 SHA `actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1` — **never** write `v4` in any workflow comment, as `tests/test_deploy_gate.py` enforces Node-24 action SHAs):

```yaml
      - name: Resolve optional preview commit
        id: preview_ref
        if: steps.gate.outputs.deploy == 'true'
        run: |
          sha=""
          if [ -f PREVIEW_REF ]; then
            raw="$(grep -v '^[[:space:]]*#' PREVIEW_REF | sed '/^[[:space:]]*$/d' || true)"
            if [ -n "$raw" ]; then
              printf '%s\n' "$raw" | grep -Eq '^[0-9a-f]{40}$' || {
                echo "::error::PREVIEW_REF must contain at most one 40-char commit SHA"
                exit 1
              }
              sha="$raw"
            fi
          fi
          echo "sha=${sha}" >> "$GITHUB_OUTPUT"

      - name: Checkout preview source
        if: steps.gate.outputs.deploy == 'true' && steps.preview_ref.outputs.sha != ''
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          ref: ${{ steps.preview_ref.outputs.sha }}
          path: _preview_src
          persist-credentials: false

      # Publish the production standalone HTML at / and, when PREVIEW_REF names a
      # pinned 40-char commit SHA, stage its standalone HTML at /preview/index.html.
      - name: Stage standalone HTML
        if: steps.gate.outputs.deploy == 'true'
        run: |
          rm -rf _site
          mkdir -p _site
          cp index.html _site/index.html
          test "$(find _site -maxdepth 1 -type f | wc -l)" -eq 1
          if [ -n "${{ steps.preview_ref.outputs.sha }}" ]; then
            test -f _preview_src/index.html
            grep -q '<script id="vocabulary-data"' _preview_src/index.html
            grep -q '<script id="phrase-data"' _preview_src/index.html
            grep -q '<script id="exam-data"' _preview_src/index.html
            grep -q '<script type="module" id="app-script"' _preview_src/index.html
            mkdir -p _site/preview
            cp _preview_src/index.html _site/preview/index.html
            rm -rf _preview_src
            test "$(find _site/preview -maxdepth 1 -type f | wc -l)" -eq 1
            test "$(find _site -mindepth 1 -maxdepth 1 -type d | wc -l)" -eq 1
          else
            test "$(find _site -mindepth 1 -maxdepth 1 -type d | wc -l)" -eq 0
          fi
```

#### File 3: `.github/workflows/pages-smoke.yml` — **CRITICAL: Two Timing Edge Cases Must Be Handled!**
Do **not** blindly probe `https://coderunknow.github.io/Chuyen-Anh/preview/` unconditionally in `pages-smoke.yml`:
1. **Edge Case 1 (`pull_request` chicken-and-egg):** `pages-smoke.yml` triggers on `pull_request` when `pages-smoke.yml` or `PREVIEW_REF` changes. Before the PR is merged and deployed from `main`, live `https://coderunknow.github.io/Chuyen-Anh/preview/` does not exist yet (`HTTP 404`)! Therefore:
   - On `pull_request`: probe live production `https://coderunknow.github.io/Chuyen-Anh/` **and** smoke-test `_preview_src/index.html` locally via a temporary `127.0.0.1` HTTP server using `_preview_src/tests/pages_smoke.py`.
   - On `push` / `workflow_dispatch` / `release`: probe **both** live `https://coderunknow.github.io/Chuyen-Anh/` and live `https://coderunknow.github.io/Chuyen-Anh/preview/`.
2. **Edge Case 2 (`push` race with `deploy.yml`):** When merged to `main`, `deploy.yml` runs Python + Node tests (~3.5–4 minutes) before deploying `_site/` to GitHub Pages, whereas `pages-smoke.yml` only sleeps `30s`. Therefore:
   - Increase `timeout-minutes` on `pages-smoke.yml` from `10` to `15`.
   - Add `- "PREVIEW_REF"` to `*pages-paths`.
   - On `github.event_name == 'push'` (when `PREVIEW_REF` is non-empty), wait for the `github-pages` deployment of `${{ github.sha }}` to reach `state == "success"` before probing live `/preview/`:

```yaml
      - name: Resolve optional preview commit
        id: preview_ref
        run: |
          sha=""
          if [ -f PREVIEW_REF ]; then
            raw="$(grep -v '^[[:space:]]*#' PREVIEW_REF | sed '/^[[:space:]]*$/d' || true)"
            if [ -n "$raw" ]; then
              printf '%s\n' "$raw" | grep -Eq '^[0-9a-f]{40}$' || {
                echo "::error::PREVIEW_REF must contain at most one 40-char commit SHA"
                exit 1
              }
              sha="$raw"
            fi
          fi
          echo "sha=${sha}" >> "$GITHUB_OUTPUT"

      - name: Wait for the Pages deployment of the pushed main commit
        if: github.event_name == 'push' && steps.preview_ref.outputs.sha != ''
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          sha="${{ github.sha }}"
          for attempt in $(seq 1 60); do
            deployment="$(gh api "repos/${GITHUB_REPOSITORY}/deployments?sha=${sha}&environment=github-pages&per_page=1" --jq '.[0].id // empty' 2>/dev/null || true)"
            if [ -n "$deployment" ]; then
              record="$(gh api "repos/${GITHUB_REPOSITORY}/deployments/${deployment}/statuses" --jq '.[0] | [(.state // ""), (.environment_url // "")] | @tsv' 2>/dev/null || true)"
              state="${record%%$'\t'*}"
              url="${record#*$'\t'}"
              if [ "$state" = "success" ] && [ -n "$url" ]; then
                echo "deployed preview-enabled commit: $url" >> "$GITHUB_STEP_SUMMARY"
                exit 0
              fi
              if [ "$state" = "failure" ] || [ "$state" = "error" ]; then
                echo "::error::Pages deployment ${deployment} failed"
                exit 1
              fi
            fi
            echo "waiting for Pages deployment of ${sha} (attempt ${attempt}/60)"
            sleep 10
          done
          echo "::error::Timed out waiting for Pages deployment of ${sha}"
          exit 1

      - name: Checkout preview smoke contract
        if: steps.preview_ref.outputs.sha != ''
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          ref: ${{ steps.preview_ref.outputs.sha }}
          path: _preview_src
          persist-credentials: false

      - name: Verify staged /preview/ contract locally on pull_request
        if: github.event_name == 'pull_request' && steps.preview_ref.outputs.sha != ''
        run: |
          python - <<'PY'
          import functools, http.server, os, pathlib, re, subprocess, sys, tempfile, threading
          src = pathlib.Path("_preview_src/index.html")
          ver_match = re.search(r"APP_VERSION = '([^']+)'", src.read_text("utf-8"))
          assert ver_match, "APP_VERSION missing in _preview_src/index.html"
          with tempfile.TemporaryDirectory() as tmp:
              prev_dir = pathlib.Path(tmp) / "Chuyen-Anh" / "preview"
              prev_dir.mkdir(parents=True)
              (prev_dir / "index.html").write_bytes(src.read_bytes())
              handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=tmp)
              srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
              port = srv.server_address[1]
              t = threading.Thread(target=srv.serve_forever, daemon=True)
              t.start()
              try:
                  env = {**os.environ, "PAGES_URL": f"http://127.0.0.1:{port}/Chuyen-Anh/preview/", "EXPECTED_VERSION": ver_match.group(1)}
                  subprocess.run([sys.executable, "_preview_src/tests/pages_smoke.py"], env=env, check=True)
              finally:
                  srv.shutdown()
          PY
          rm -rf _preview_src

      - name: Probe live /preview/ subpath
        if: github.event_name != 'pull_request' && steps.preview_ref.outputs.sha != ''
        run: |
          ver="$(python -c "import pathlib,re; m=re.search(r\"APP_VERSION = '([^']+)'\", pathlib.Path('_preview_src/index.html').read_text('utf-8')); assert m; print(m.group(1))")"
          PAGES_URL="https://coderunknow.github.io/Chuyen-Anh/preview/" EXPECTED_VERSION="$ver" python _preview_src/tests/pages_smoke.py
          rm -rf _preview_src
```
*(Note: Using `_preview_src/index.html` via `actions/checkout` avoids GitHub REST `/contents/` API size limits on the `28.19 MB` HTML file.)*

#### File 4: `.github/workflows/ci.yml`
Add `- ".github/workflows/pages-smoke.yml"` and `- "PREVIEW_REF"` to **both** `on.pull_request.paths` and `on.push.paths` (right next to `- "DEPLOY_HOLD"`). Keep both explicit `paths:` lists intact — do **not** collapse `push.paths` into a YAML alias, because `tests/test_deploy_gate.py` parses explicit `- "..."` lines under `paths:` and asserts `.github/workflows/release-published-dispatch.yml` appears twice.

#### File 5: `tests/test_deploy_gate.py`
Add `PreviewSubpathWorkflowContractTests` asserting:
1. `PREVIEW_REF` exists and contains at most one non-comment line matching `^[0-9a-f]{40}$`.
2. `deploy.yml` triggers on `"PREVIEW_REF"`, gates `Resolve optional preview commit` and `Checkout preview source` behind `steps.gate.outputs.deploy == 'true'`, stages `_site/index.html` from `main`, and copies `_preview_src/index.html` into `_site/preview/index.html`.
3. `pages-smoke.yml` probes both `https://coderunknow.github.io/Chuyen-Anh/` and `https://coderunknow.github.io/Chuyen-Anh/preview/` (on post-deploy events) and runs `_preview_src/tests/pages_smoke.py`.

#### File 6: `DESIGN_LOG.md` *(append-only)*
Append a new sequential dated entry at the very bottom of `DESIGN_LOG.md` documenting `PREVIEW_REF`, combined `_site/` artifact staging from `main`, verification performed, and the same-origin `localStorage` behavior below.

### 4.3 Critical Risk to Keep Disclosed: Same-Origin `localStorage` Sharing
- Browser `localStorage` is scoped to origin (`https://coderunknow.github.io`), **not** URL path (`/Chuyen-Anh/` vs `/Chuyen-Anh/preview/`).
- Both `v1.0.0-rc10` and `v1.0.0` use the identical `chuyen-anh.*.v1` keys (`progress`, `prefs`, `favorites`, `history`, `streak`, `study`, `flagged`, `badges`, `phrases`, `cefr`, `exam-results`, `exam-history`, `language`, `theme`, `presentation`, `telemetry`, `telemetry-consent`).
- **Forward (`/` -> `/preview/`):** 100% lossless (`7,852` `rc10` IDs are a strict subset of `v1.0.0`'s `8,852` IDs; `EXAM_RESULT_SCHEMA_VERSION` is `'2.0.0'` in both).
- **Reverse (`/preview/` -> `/` in the same browser profile):** If a tester studies any of the **1,000 newly added `v1.0.0` A1/A2 words** on `/preview/` and then returns to `/` (`v1.0.0-rc10`) and triggers `persist()`, `v1.0.0-rc10`'s `ensureProgress(progressMap, vocabulary)` rebuilds `progress` over its `7,852`-word list — preserving all `7,852` production words, while pruning progress/favorites/flags for the `1,000` preview-only IDs.
- **Guidance:** Normal production users who never open `/preview/` are 100% unaffected; reviewers comparing `/preview/` and `/` side-by-side should use an Incognito window / separate browser profile or export a JSON backup first.

---

## 5. Playbook B — Promoting `v1.0.0` (Draft PR #83) to Stable Release & Production Pages (Only After Explicit User Approval)

When the user eventually approves promoting `v1.0.0` to `main` and/or production Pages, follow this exact sequence:

1. **Reconcile `deploy.yml` & `pages-smoke.yml` if Playbook A was merged to `main` first:**
   - Merge/rebase `main` into `arena/2a533bbc-chuyen-anh` so `deploy.yml` keeps **both** `steps.gate.outputs.deploy == 'true' && steps.app_release.outputs.deploy == 'true'` (from PR #83) **and** `PREVIEW_REF` support (from Playbook A), and clear/comment out `34792d6e...` in `PREVIEW_REF` if `/preview/` is being retired upon `v1.0.0` cutover.
2. **Merge PR #83 into `main` (only after user approval):**
   - On push to `main`, `deploy.yml` runs all Python + Node checks, and `scripts/app_release_gate.py` **intentionally holds Pages deployment** (`STABLE_DEPLOY_AUTHORIZED` is `false` on `push`, and `v1.0.0` release is not published yet). Production `/` remains on `v1.0.0-rc10`.
3. **Tag `v1.0.0` on `main` (only after user approval):**
   - Push annotated tag `v1.0.0` pointing at the merged `main` commit (`APP_VERSION = 'v1.0.0'`).
   - `.github/workflows/release-artifacts.yml` runs `scripts/release_artifacts.py`, executes the full verification suite, and creates a **draft stable GitHub Release** (`draft=true`, `prerelease=false`) with deterministic assets:
     - `chuyen-anh-v1.0.0.html`
     - `chuyen-anh-v1.0.0.zip`
     - `chuyen-anh-v1.0.0-checksums.txt`
4. **Publish the `v1.0.0` GitHub Release (only after user approval):**
   - Publishing a **stable** release (`prerelease == false`) intentionally does **not** auto-dispatch `deploy.yml` (`dispatch-deploy` in `release-published-dispatch.yml` has `if: github.event.release.prerelease == true`), and `pages-smoke.yml` skips release-deployment polling (`if: github.event.release.prerelease == true`).
5. **Authorize Production GitHub Pages Cutover (requires separate explicit user confirmation):**
   - Trigger `.github/workflows/release-published-dispatch.yml` via `workflow_dispatch` on `main` with `stable_deploy_authorized=true` (which verifies `APP_VERSION == 'v1.0.0'` and published stable release `v1.0.0`, then dispatches `deploy.yml` on `main` with `stable_deploy_authorized=true`).
   - **Important Watchout in `pages-smoke.yml` at Final Stable Cutover:** Look at `Determine the version that should be served` in `.github/workflows/pages-smoke.yml`:
     ```bash
     hold="$(tr -d '[:space:]' < DEPLOY_HOLD)"
     status="$(gh api "repos/${GITHUB_REPOSITORY}/releases/tags/${hold}" --jq '.draft|tostring + " " + (.prerelease|tostring)' 2>/dev/null || true)"
     if [ "$status" = "false true" ]; then
       expected="$hold"
     ```
     While `DEPLOY_HOLD` names `v1.0.0-rc10`, `status` is `"false true"`, so `pages-smoke.yml` expects `v1.0.0-rc10` (which is **correct** until step 5 actually deploys `v1.0.0` to `github-pages`!). Once `v1.0.0` is deployed to live `github-pages`, `pages-smoke.yml` would still compute `expected=v1.0.0-rc10` unless updated to inspect the active `github-pages` deployment SHA's `APP_VERSION` (or `DEPLOY_HOLD` lifecycle is updated for post-`v1.0.0`). Handle this explicitly when preparing final production cutover.

---

## 6. Playbook C — Regeneration Pipelines, CI Traps & Sandbox Recipes

### 6.1 Exact Synchronization Pipelines (on `v1.0.0` / `arena/2a533bbc-chuyen-anh`)
If the user requests any vocabulary, sense, or exam curation fix on `v1.0.0`, always run the full downstream chain so all embedded blocks and checked-in audit manifests stay 100% synchronized:

```bash
# 1. Vocabulary + Sense-Level CEFR + Audit Reports
python3 scripts/build_vocabulary.py
python3 scripts/expand_vocabulary.py --check
python3 scripts/build_senses.py
python3 scripts/audit_sense_sources.py --write
python3 scripts/validate_vocab.py
python3 scripts/embed_vocabulary.py
python3 scripts/audit_vocabulary_quality.py
python3 scripts/vocabulary_cefr_review.py
python3 scripts/vocabulary_evidence_review.py
python3 scripts/rc4_vocabulary_audit.py

# 2. Exam Answer Keys + Curated SHA-256 Verification + Archive Embed
node scripts/exams/build_answer_keys.mjs
node scripts/exams/verify_curated_keys.mjs
node scripts/exams/audit_rendering.mjs
node scripts/exams/classify_anomalies.mjs
python3 scripts/exams/embed_archive.py
python3 scripts/audit_exam_provenance.py

# 3. Read-Only CI Gate Verification
python3 -m unittest discover -s tests -p 'test_*.py'
node --trace-deprecation --test \
  tests/static-app.test.js \
  tests/exam-scoring.test.js \
  tests/exam-anomalies.test.js \
  tests/rc10-cefr.test.js \
  tests/v100-senses.test.js
```

### 6.2 Subtle Code & Test Contract Traps (Do Not Trip Over These!)
1. **Immutable 40-char Action SHAs & No `"v4"` Comments:**
   `tests/test_deploy_gate.py` (`test_all_workflows_pin_immutable_node24_action_shas_and_three_browser_matrix`) scans every `.github/workflows/*.yml` file and fails if **any** `uses:` line lacks a 40-char SHA or contains `"v4"` anywhere in its trailing comment. Always reuse the repo's pinned SHAs:
   - `actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1`
   - `actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0`
   - `actions/configure-pages@45bfe0192ca1faeb007ade9deae92b16b8254a0d # v6.0.0`
   - `actions/upload-pages-artifact@fc324d3547104276b827a68afc52ff2a11cc49c9 # v5.0.0`
   - `actions/deploy-pages@368f82528645a54fb793d4d04e342629a3f51346 # v5.0.1`
2. **`ci.yml` `paths:` Parsing in `tests/test_deploy_gate.py`:**
   `WorkflowTimeoutAndHoldPathsContractTests` checks every block starting with a line ending in `paths:` for `- "DEPLOY_HOLD"`, and `DeployWorkflowContractTests` asserts `ci.yml` contains `.github/workflows/release-published-dispatch.yml` **twice** (`count == 2`). Keep both explicit `paths:` lists in `ci.yml`.
3. **Ubuntu Runner for Browser Matrix in `ci.yml`:**
   Keep `runs-on: ubuntu-24.04` on the `browser` job in `ci.yml` (`ubuntu-latest` / `26.04` broke Playwright WebKit shared libraries).
4. **Exam Data Shapes (`index.html` vs `data/exam-answer-keys.json`):**
   - `summarizeExamPractice(session)` must return `{ total, answered, unanswered }`.
   - Embedded `#exam-data` in `index.html` uses `.answerKey` (singular), whereas `data/exam-answer-keys.json` uses `.answerKeys` (plural).
   - Keep `acceptedAlternatives: []` on `choice` and `true-false` items.
   - `scripts/exams/build_answer_keys.mjs` derives curated exemption `verificationStatus` / `sourceStatus` from `curated.exemptionCategory` (`open_ended_writing_or_speaking` -> `exempt_open_ended` / `open_ended_exempt`; `ambiguous_or_disputed` -> `ambiguous_review` / `invalid_key`).
5. **`scripts/build_senses.py --check`:**
   Also verifies `audit/v100/evidence/cefr-sense-audit.json` when invoked with default `--json` (`data/vocabulary.json`).

### 6.3 Arena Sandbox & Headless Chromium Notes
- **Outbound Network Allowlist:** Inside the Arena sandbox, outbound network access is restricted to `github.com`, `codeload.github.com`, `api.github.com`, `registry.npmjs.org`, `pypi.org`, and `files.pythonhosted.org` (`coderunknow.github.io` cannot be resolved from inside the sandbox; live `github.io` probes run in GitHub Actions `pages-smoke.yml`).
- **Turn-Boundary Git State:** Fresh container restores can occasionally leave an untracked `.coding-latest.patch` or an earlier branch checkout; always check `git status -sb` and `git fetch origin` before starting work.
- **Running Headless Chromium Locally in the Sandbox (`playwright-core` + `@sparticuz/chromium@133.0.0`):**
  The container does not preinstall system `libnss3.so`; inflate `@sparticuz/chromium`'s bundled `al2023.tar.br` into `/tmp/al2023/lib` first (always install in `/tmp` and clean up afterwards so `package.json` / repo root stay dependency-free):
  ```bash
  mkdir -p /tmp/pw && npm install --prefix /tmp/pw --no-save --package-lock=false playwright-core @sparticuz/chromium@133.0.0
  NODE_PATH=/tmp/pw/node_modules node -e '
    const path = require("path"), b = require("@sparticuz/chromium"), lfs = require("@sparticuz/chromium/build/lambdafs").default;
    (async () => { await b.executablePath(); await lfs.inflate(path.join(path.dirname(require.resolve("@sparticuz/chromium")), "../bin/al2023.tar.br")); })();
  '
  # Then launch playwright-core chromium with:
  # env: LD_LIBRARY_PATH=/tmp/al2023/lib
  # launch({ executablePath: '/tmp/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'], headless: true })
  ```
