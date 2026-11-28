# Session 4 — 2026-11-26 product-wide re-verification (fresh evidence)

Head verified: `31b5b64` (`build/v100-stable-rebuild`; base `948f6f9`, unchanged).
Operating mode: read-only audit first; this session changed **no production code**
— every change on the branch is evidence/documentation, recorded below.

## 1. Fresh full-gate baseline at the exact head (all re-run, not assumed)

| Gate | Result (fresh run, 2026-11-26, local sandbox) |
|---|---|
| 21 validator commands (ci.yml `checks` block) | all exit 0 |
| Python unit tests | **302/302 OK** (`python -m unittest discover -s tests -p 'test_*.py'`) |
| Node static suites | **289 tests, 0 fail** (`static-app`, `exam-scoring`, `exam-anomalies`, `rc10-cefr`, `v100-senses`, `exam-exempt-rubric`, `core-invariants`, `exam-persistence`) |
| Telemetry endpoint contract | **19 tests, 0 fail** (`telemetry-api.test.js`) |
| Browser shard partition + failure-capture | **9 tests, 0 fail** (`shard-browser-suite.test.mjs`, `fresh-world-failure.test.cjs`) |
| Exam archive conversion (venv, pinned deps) | **5/5 OK** (`scripts/exams/test_archive.py`) |
| Deploy gates | `deploy_gate.py` held (hold names `v1.0.0-rc11`); `app_release_gate.py` held (stable release not published/authorized) — fail-closed as designed |
| Workflow injection scan (parsed walk, `yaml` available) | 8 workflows, **0 findings**; negative control (fresh): `github.head_ref` (block), `github.event.pull_request.title` (inline), and the masked safe-matrix+title line are **all detected** (3 findings, exit 1) |
| Independent audits re-run | exam totals 106/6,708/5,155/1,553, `verdictOk: true`, 2,146/2,146 curated bindings; transcript fallback exactly 307 scorable / all LOW; vocab deep audit 0 defects (8,852 rows / 8,928 senses / 1,094 phrases) |
| Browser suites (local Chromium 143.0.7499.4) | learning (35 phases incl. WCAG 2.1 AA axe, responsive, backup round-trip) **PASS**; exams (106-record catalogue, grading, history, import/export) **PASS**; 0 page errors |
| CI on the exact head `31b5b64` (before this session's commit) | Static checks run `44098938657`: **16/16 jobs green** (checks + 15 browser shards chromium/firefox/webkit), via API on 2026-11-26 |

Environment: Node v24.22.3, Python 3.12.16, Linux sandbox (software-rendered
Chromium; playwright-core 1.55.1 + axe-core 4.14.0 per the documented harness).

## 2. Independent data-integrity probes (fresh code, this session)

Not derived from the repository's own audit scripts; the app's real parser
(extracted exactly as `build_answer_keys.mjs` does) is used as the oracle where
product behaviour is the question.

1. **`probe_exam_integrity.py` → `exam-integrity.json`** — for all 106 papers:
   source `.md` front-matter body, embedded `markdown`, and `contentSha256`
   agree **106/106** byte-for-byte; **0** cross-paper passage leakage
   (normalised ≥350-char prose blocks, none shared between papers); totals
   106 papers / 6,708 answerKey entries.
2. **`probe_question_alignment.mjs` → `question-alignment.json`** — per paper,
   the app parser's questions and the embedded `answerKey` match **exactly,
   both directions**, for every paper; **6,708** distinct `(examId, questionId)`
   pairs, 0 duplicates, 0 orphans, all display numbers aligned. (Display
   numbers legitimately restart per section; `questionId` is the stable key.)
3. **`probe_reading_lifecycle.mjs` → `reading-lifecycle.log`** — real-browser
   probe of the reported Reading defect class: paper A renders its own parsed
   Reading prompt; switching to paper B renders B's prompt with **no residue of
   A's passage** (question view and full-document region); switching questions
   and returning restores the same prompt (no stale state); reload/resume is
   byte-identical and an answered question stays marked; **0 page errors,
   0 external requests**. Papers exercised: `2026/tp-ho-chi-minh/ptnk`,
   `2026/tay-ninh/so` (19 papers expose parsing-detectable Reading questions).

## 3. External asset digest reconciliation (the R9-B7b gate)

Method (see `browser-session-method.md`): the 24 Google-Drive-hosted PDFs were
fetched directly; the 140 tailieudieuky.com pdf/docx file records were fetched
through a real Chromium session that passes the host's bot challenge, with ZIP
members parsed, inflated and hashed in-browser. The 22 `html` records are
document *pages* (dynamic: live clock, share widgets) — capture-time snapshots,
not byte-re-comparable by design; their content is verified via the
`.md -> contentSha256 -> embedded` chain instead (106/106 above).

**Outcome over the 186 recorded digests (all 64-hex, all distinct):**

| Classification | Count | Detail |
|---|---:|---|
| Verified match — Google Drive, direct bytes | 24 | `drive-digests.json` |
| Verified match — tailieudieuky direct bytes | 6 | `tailieudieuky-recon.json` |
| Verified match — original file intact *inside* a re-packaged ZIP served at the same URL | 133 | host re-packaged multi-file bundles; member digests equal the recorded per-file digests byte-for-byte |
| Verified mismatch (external source drift) | 1 | `2026/ninh-binh/so` answer-key source file (`d0e059c9…`): the ZIP now served at the URL contains the unchanged exam file (sibling record `1dd11f67…` matches member `de-thi-chinh-thuc.docx`) but **no member matches the captured answer-key digest** — the host changed that file after the 2026-09-19 capture. Recorded digest preserved as capture evidence; nothing regenerated or replaced (per mission §11.1). Product data unaffected. |
| Not byte-re-comparable (dynamic page snapshots) | 22 | documented above |

This closes the R9-B7b "186 downloaded asset digests" gap that previous rounds
could only format-check: **163/186 verified, 1 explained external drift, 22
dynamic-page snapshots**. The separate historical figure 2,146 is a different
inventory (curated answer-key content bindings in
`data/exam-curated-keys.json`), re-derived 2,146/2,146 with 0 mismatches —
both inventories are now verified and their meanings distinguished.

## 4. Review threads on PR #88 (verified against current code)

All four automated reviewers are currently quota/billing-limited (CodeRabbit
rate-limited and incremental-only on reviewed commits; Qodo trial ended; Kilo
out of credits — its `action_required` check means "could not run", not
findings; Codex usage-limited). The 9 unresolved CodeRabbit threads were read
in full and verified one by one at `31b5b64`:

- **2 Major (current)**: client (`index.html`) and server (`api/telemetry.js`)
  Bearer alphabet missing `-` (RFC 6750) — **fixed in `31b5b64`**
  (`[A-Za-z0-9._~+/-]+` on both sides) with leading-hyphen and embedded-hyphen
  regression cases on both sides (`static-app.test.js:1221`,
  `telemetry-api.test.js:273`).
- **1 Minor (current)**: `REPRODUCTION_COMMANDS.md` invoked untracked audit
  scripts — **fixed**: all cited scripts are tracked under `scripts/` and the
  document's header explains the clean-checkout contract.
- **6 Minor (outdated)**: scanner hardening (SAFE_CONTEXT filter,
  per-expression allowlisting, blank-line state, block-scalar headers),
  PGlite path portability, mutation-timeout accounting — **all fixed in the
  `31b5b64` rewrite**; verified by reading the current code and by the fresh
  negative control in §1 (three injected forms all detected).

Threads resolved on 2026-11-26 with this evidence (see PR conversation).

## 5. Production telemetry endpoint (read-only probes, 2026-11-26)

- `OPTIONS` preflight (published origin): **204**, allow-origin/headers/methods
  exactly per contract.
- `GET`: **405** with `Allow: POST, OPTIONS`, `no-store`, `nosniff`.
- One empty-body `POST` was sent to confirm fail-closed validation:
  **400** rejected (no row written; validation precedes storage). Disclosed
  here because it is a production request, albeit a refused one.
- The deployed function's *version* (does it contain the round-3 scrub fix?)
  remains unverifiable without Vercel credentials — externally blocked,
  unchanged owner action.

## 6. Performance and accessibility

- Speed benchmark at `31b5b64` (local Chromium 143, software-rendered):
  sprint elapsed **22.25 s median / 22.33 s mean** (min 22.19, max 22.56),
  **26.97 turns/min**, 10/10 words completed, **0 page errors** — within the
  recorded noise band (22.09–24.22 s medians across rounds).
- Accessibility: axe-core WCAG 2.1 A/AA runs are embedded in the green
  browser suites; **no screen reader exists in this sandbox** (checked
  `orca`/`nvda`/speech-dispatcher) — manual screen-reader verification remains
  externally blocked, honestly recorded. Physical low-memory device testing
  likewise unavailable.

## 7. Historical-figure reconciliation (mission §13)

| Figure | Fresh status |
|---|---|
| 106 papers / 6,708 questions / 5,155 scorable / 1,553 exempt | re-derived, matches (`build_answer_keys.mjs --check`, `verify_curated_keys.mjs`, `independent_exam_audit.mjs`) |
| 0 `official_verified` | re-confirmed (`sourceStatuses` in the independent audit output) |
| 8,928 senses | re-confirmed (8,852 rows / 8,928 senses in sync) |
| 4,844 source-supported locators | re-confirmed (`audit_sense_sources.py --check`) |
| 1,945 senses flagged for independent validation | still the documented state (`docs/vocabulary-cefr-review.md` line 30: 1,945 of 8,928) — pending work, not a defect; independent validation explicitly "not established" |
| 186 external asset digests | **163 verified / 1 external drift / 22 dynamic-page snapshots** (this session) |
| 2,146 (separate inventory) | curated answer-key bindings, 2,146/2,146 re-derived, 0 mismatches |
| 302 Python / 308 Node tests | current (the older 294/306 figures were stale documentation, superseded in the checklist rows) |
| 16/16 CI jobs | green at `31b5b64` (run `44098938657`); re-verified via API 2026-11-26 |

## 8. What this session did NOT do

No merge, no tag/release, no Pages/Vercel deployment, no Vercel/Supabase
settings change, no Supabase mutation, no production telemetry POST that
resulted in a stored row (the one empty-body POST above was refused 400). The
stable release remains unpublished; production Pages still serves `v1.0.0-rc11`
behind the dual gate.
