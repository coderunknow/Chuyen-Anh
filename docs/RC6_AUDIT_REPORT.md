# v1.0.0-rc6 audit and stable-readiness report

Status: **published prerelease `v1.0.0-rc6`; stable readiness NO-GO.**

## 1. Release and Git evidence

- Starting `main`/HEAD: `c5928d95dfc3daf3954e6d4a08da8303f3e4df1c`; no open PR at preflight.
- Candidate PR: #69 merged 2026-10-29T15:45:11Z at `6d9f29574f5aa352d6f137c061272fd370801421`.
- Tag `v1.0.0-rc6` resolves to `6d9f29574f5aa352d6f137c061272fd370801421`.
- Release: published prerelease at 2026-10-29T15:48:09Z, three assets. HTML 13,999,832 bytes, SHA-256 `5c18c6d5…` equals the tagged `index.html`; ZIP SHA-256 `0ff741d9…`; checksum manifest `9a630b41…`.
- Artifact workflow: `40904757402` success; it re-downloaded and byte-compared all assets. Deploy workflow: `40905243112` success, all four publish steps followed the published-release gate; deployment `7417081331` status success with `https://coderunknow.github.io/Chuyen-Anh/`.
- The first release-event Pages probe failed because it ran before that deployment replaced rc5; the follow-up workflow waits for a successful deployment with an environment URL. This was a probe race, not a failed deploy.
- Published baseline: `v1.0.0-rc5`, prerelease, tag commit `b47d9d1db14cf8724210d954d8b0e3e927977eaa`, three assets; latest Pages deployment at that same commit (`7410642916`).
- rc5 review status: Copilot returned a quota error, CodeRabbit skipped, Kilo reported action required. These are not substantive approvals.
- Tagged candidate hash: `index.html` SHA-256 `5c18c6d54d8d84319def63648e07c1f6923917953cba7587cd0041aaaefff1ee`, 13,999,832 bytes.

## 2. Findings and repairs

| Severity | Defect | Reproduction / root cause | Repair and regression evidence |
| --- | --- | --- | --- |
| High | No real scoring path: `getQuestionVerification` was an isolated boolean stub; practice explicitly said ungraded | Inspect practice mode; old browser suite asserted no score | Runtime answer-key extraction, seven provenance states, equal-weight eligible-only scoring, review/corrections and history. `tests/exam-scoring.test.js`; `tests/browser-exams.cjs` produces a deterministic `3/6 — 50%` provisional result. |
| High | Fenced PDF text was not parsed; 28 records exposed zero practice items; question IDs used source-line/array position | Baseline parser measurement on 106 embedded records | Parser unwraps source fences, keeps question number/section context and derives an ID from exam/content/section, not array position. Audit now finds 6,457 items, none of the 106 records with zero. |
| High | Answer sections were not extracted or mapped to stable question IDs | Existing archive had 66 answer sections, but no scoring data | Build-time manifest `data/exam-answer-keys.json`; answer entries stay `source_transcription_unverified`; ambiguous mappings remain `ambiguous_review`; missing answers remain `missing_answer`. No official upgrade. |
| High | Markdown inline parsing reprocessed escaped delimiters and code spans; entities could be double-escaped | Escaped link/code/image fixtures; table/ordering fixtures | Inline scanner isolates code spans, handles one entity decode, only allows HTTP(S) links, renders images as inert placeholders. `tests/exam-scoring.test.js` 3 markdown regressions. |
| High | Tables lost header/alignment; ordered numbering restarted; hard breaks collapsed; blockquotes flattened | Renderer fixtures and source structures | Header cells, alignment, escaped pipes, `start`/`value`, hard breaks and blockquote structure are now rendered. Same tests. |
| High | “Trọng tâm phiên học” buttons for disabled groups were truly `disabled`, so the global `button:disabled { cursor: not-allowed }` rule was truthful: activation did nothing | Markup had `${enabled ? '' : 'disabled'}` and the click handler returned on `button.disabled` | All focus buttons are operable; choosing an off group explicitly enables that group and makes it the focus, with a visible hint/title and saved config. Keyboard Enter tested in Chromium; no cookie-cutter cursor override. |
| Medium | Opening a saved exam result from Settings before the archive loaded silently did nothing | `openExamHistoryAttempt` called `findExam()` before `ensureExamArchive()` | Handler awaits archive load and reports failure if the paper is unavailable. Found by the new browser suite. |
| Medium | English archive copy still said practice was ungraded after scoring was added | Translation dictionary retained pre-rc6 warning keys | Dictionary entries replaced with the provisional-scoring wording; English browser assertion covers it. |
| Medium | Browser-learning suite crashed after ~9 minutes on the 2-CPU sandbox when opening one more full 14 MB page; rc5 baseline crashed at the same page | Chromium process exhaustion, not an app exception | Finished browser is closed and relaunched before the final scenario; suite now passes. No retry or skipped assertion was added. |
| Low | Existing archive tests needed optional `fitz`; system Python is externally managed | `scripts/exams/test_archive.py` failed only in system env | Pinned requirements installed in ignored `.venv`; 5/5 pass; this is an environment note, not a product dependency. |

## 3. Exam archive and rendering

- All **106/106** records were rendered through the shipped renderer and structurally audited; 106 rendered without exception.
- **6,457** question items extracted (choice 3,639; text 2,569; multiple 46; true/false 12; essay 191). This is an extraction count, not a verified official question count.
- 1,151 tables, 558 code blocks, 0 unclosed fences, 0 malformed table blocks, 0 rendered script/iframe tags, 0 rendered event handlers, 0 unsafe link schemes.
- One source contains an explanatory angle-bracket phrase (`2022/hai-phong/so`); it is escaped as text and preserved, not rewritten.
- The 22 HTML/OCR records remain read-only for interactive practice; the other records expose extracted items with warnings.
- Reader still displays every stored Markdown byte, including source answer material; that is intentionally separate from practice and does not prove fidelity to the original.
- Evidence: `docs/exam-rendering-audit.{json,md}`; `docs/exam-scoring-audit.{json,md}`.

## 4. Answer-key verification

Denominator is **questions**, not exams. Totals across 6,457 extracted items:

| Status | Questions | Meaning |
| --- | ---: | --- |
| `official_verified` | 0 | No official primary answer key was actually checked |
| `independently_cross_checked` | 0 | No extracted answer received independent two-source confirmation |
| `source_transcription_unverified` | 1,769 | Structurally extracted from the reposted transcription |
| `inferred_unverified` | 0 | No answer guessed from an option or prompt |
| `user_confirmed` | 0 at build time | Only created by an explicit learner correction at runtime |
| `missing_answer` | 3,216 | No defensible answer entry mapped |
| `ambiguous_review` | 1,472 | Number/section mapping or key shape is ambiguous |

Of these, **1,269** items are eligible for provisional scoring after excluding listening without audio, writing without a rubric, HTML/OCR read-only records and missing/ambiguous keys. Official-source checks remain **0/106 exams**. Three archive reproductions remain manually cross-checked at anchor level (Hải Phòng 2025, Đắk Lắk 2023, Bình Dương 2025), but no official primary paper was obtained; those anchors do not upgrade all questions in a paper.

## 5. Scoring functionality

- Supports single choice, multiple choice, true/false, short text/fill-in, completion with accepted alternatives, and explicitly unscorable essays/writing.
- Grading normalizes Unicode NFC, case and whitespace; punctuation only under an explicit contract; choices compare IDs or sets. No fuzzy string matching.
- Unanswered, invalid option IDs, duplicate responses, missing keys, ambiguous keys and listening/writing constraints remain ungraded and never inflate the denominator.
- Summary shows total, answered, graded, correct, incorrect, provisional, ungraded, unanswered and percentage with denominator = graded. Official score is always `null`; UI says “not an official exam score”.
- User corrections create `user_confirmed` provenance, recalculate all attempts for that exam/question, and are labelled user-provided.
- Answer keys are absent from DOM/options before submission; browser asserts no correction/key UI and no success pill until submit.
- Listening items without audio and writing without a rubric are not automatically graded even when a transcription contains a written answer.

## 6. Persistence and compatibility

- New store `chuyen-anh.exam-results.v1`; legacy `chuyen-anh.exam-history.v1` timer helpers remain for compatibility, but the new learner UI uses the result store.
- Store is separate from flashcard progress, phrase progress, scheduler, XP and the v1 backup. Import/export validates schema, limits, paper hashes, question/response relationships, corrections and recomputed summaries before a single atomic write.
- Malformed imports and conflicting corrections/attempts/papers are rejected without modifying existing history. Identical records merge idempotently.
- History supports inspect, per-attempt delete, clear-all and export/import in Settings. No exam answer, grade or history is transmitted through telemetry or any network request.
- Regression: `tests/exam-scoring.test.js` history test; Chromium reload/export/import/malformed-import/correction scenario.

## 7. UI, accessibility and controls

- Focus-control defect reproduced from source and real Chromium: disabled buttons, truthful `not-allowed` cursor, no action. Fixed by enabling the action, enabling the group, visible explanation and keyboard activation.
- Exam review exposes submitted response, grade, key candidate, status, locator and limitations; correction controls are labelled.
- VI/EN and Classic/Modern exercised in Chromium; 320/375/768/1024/1440 widths exercised for catalogue/practice/summary with no horizontal overflow. HTML/OCR read-only fallback verified.
- Static and browser tests include safe link/image handling, no script/iframe injection, no page exceptions and no external network requests in the offline flow.
- Not tested: screen reader, physical devices, Safari/Firefox.

## 8. Verification actually run

On the candidate tree before release:

- Python: **157/157 OK**.
- Node static + scoring + telemetry: **151/151 pass**.
- Optional archive conversion tests: **5/5 OK**; coverage regeneration left `DO-PHU.md` unchanged.
- All vocabulary/phrase/archive/evidence/data checks: clean; 5,852 rows, 5,112 headwords, 780 phrases, 106 transcriptions, 106/106 content hashes.
- `node scripts/exams/build_answer_keys.mjs --check`: clean (106 papers, 6,457 items, 1,269 provisional-gradable).
- `node scripts/exams/audit_rendering.mjs --check`: clean.
- Chromium 133.0.6943.0: `browser-learning.cjs` PASS; `browser-exams.cjs` PASS with the scoring/history/focus/VI-EN/Classic-Modern/responsive checks above.
- `git diff --check`: clean.
- PR #69 CI: `checks`, `browser`, archive `validate`, telemetry probe and Pages probe passed; Kilo failed for external account/credit reasons and CodeRabbit skipped, so no substantive bot approval is claimed.
- Post-merge main/tag runs: Release artifacts `40904757402` success; Deploy Flashcard `40904738167` correctly held all publish steps before release; after publication Deploy Flashcard `40905243112` published and deployment `7417081331` succeeded.
- The release-event Pages probe `40905230193` failed only because it raced the deploy; the follow-up workflow fix waits for a successful deployment URL. A post-fix PR run is the remaining live-byte verification to record.

## 9. Remaining risks and limitations

- 0/106 official primary papers and 0 official answer keys; answer quality cannot be claimed.
- 3,216 items missing a defensible answer; 1,472 ambiguous; these are not silently filled.
- OCR/HTML records remain read-only; their questions are not scored.
- Listening audio is absent; listening items are unscorable even when a transcription answer exists.
- Extracted question boundaries may be wrong/incomplete even where a key exists; provisional warning remains.
- No screen-reader/physical-device testing; no Firefox/Safari.
- Pathological Markdown and every CSS layout combination were not exhaustively fuzzed.
- A structural hash/audit proves stored bytes and deterministic rendering, not correctness against the original exam.

## 10. Stable-readiness decision

**NO-GO for stable.** The candidate is suitable for an rc6 prerelease with explicit limitations, but stable would require, at minimum: official primary source coverage or a materially higher manually verified answer/key subset, resolution of ambiguous/missing mappings, and accessibility/device testing not performed here. No evidence supports “all 106 exams verified” or “all answers verified.”
