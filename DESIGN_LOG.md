# DESIGN_LOG

> Source of truth for design intent + append-only work log.
> Rules: read before every task; verify against the real project; append new entries, avoid editing old entries.

## Design Intent
- User: “Change the [https://github.com/coderunknow/Chuyen-Anh/blob/main/Learned_Vocabulary_List.md](https://github.com/coderunknow/Chuyen-Anh/blob/main/Learned_Vocabulary_List.md) for right the format.”
- User: “And also make [app.js](https://github.com/coderunknow/Chuyen-Anh/blob/main/app.js "app.js"), [index.html](https://github.com/coderunknow/Chuyen-Anh/blob/main/index.html "index.html"), [style.css](https://github.com/coderunknow/Chuyen-Anh/blob/main/style.css "style.css"),... to become 1 file html only.”
- User: “Make no misktakes, think carefully, maximum effort.”

## Constraints & Decisions

> Resolution: The following bullets preserve the initial open questions; they are historical notes, not current constraints. Later explicit user decisions supersede them: entry #3 defines the expanded schema, entry #4 chooses a self-contained HTML file with all 913 records, entry #5 supersedes the earlier 613-record limit, and entry #7 resolves the ID 448 meaning. The former “not yet verified/not yet specified” questions are therefore resolved; see those entries for the authoritative decisions.
>
> Field-preservation reconciliation: entries #8 and #10 remain verbatim as historical summaries; their overbroad preservation wording is corrected by entry #18, which records the exact field-level comparison and current account.

- The requested deliverable should use a single HTML file in place of the app's separate HTML, JavaScript, CSS, and related front-end files; exact scope of “...” is not yet verified.
- The intended “right the format” for `Learned_Vocabulary_List.md` is not yet specified and needs to be inferred from the project's own conventions or clarified if ambiguous.

## Log
<!-- Append new entries below. Do not edit old entries. -->

### #1 — 2026-10-06 — NOTE
Log created because no `DESIGN_LOG.md` existed. Initial project state noted from the repository root: `Learned_Vocabulary_List.md`, `app.js`, `index.html`, and `style.css` are present. Their contents and the rest of the front-end structure have not yet been examined.

### #2 — 2026-10-06 — NOTE
Verified the repository's existing format and runtime before making changes. `Learned_Vocabulary_List.md` declares `ID|WORD|POS|MEANING` and contains IDs 1–913; the list-format tests and legacy converter consume that structure. `data/vocabulary.json` contains the first 613 records, and `docs/vocabulary-300-review.md` explicitly says the 300 appended records must not replace that app dataset. The app currently fetches that JSON and separately loads `style.css` and `app.js`; the deploy workflow stages all four runtime resources. Existing vocabulary validation, Python tests (7), and Node tests (5) pass. The requested replacement format and whether “1 file html only” includes the vocabulary data are still unclear, so those decisions need confirmation before editing.

### #3 — 2026-10-06 — INTENT
User clarification: “Expanded vocabulary format — Extend the schema to include WORD_FAMILY, SYNONYMS, ANTONYMS, COLLOCATIONS, REGISTER, CONNOTATION, and NOTES, while keeping it structured, machine-readable, and preserving all existing data. Do not guess missing information.”

### #4 — 2026-10-06 — DECISION
User selected “Standalone HTML, all 913 words”: the deployed app should be one self-contained HTML file containing the existing app functionality and all 913 vocabulary records. Keep source data, tests, and documentation in the repository. Missing vocabulary fields must remain explicitly empty rather than inferred.

### #5 — 2026-10-06 — CONTRADICTION
The prior `README.md` and `docs/vocabulary-300-review.md` state that the app dataset has 613 words and the 300 appended records must not replace `data/vocabulary.json`. The user's current selection explicitly expands the app to all 913 records and overrides that earlier project constraint for this task. Update affected data, validation, workflow, and documentation rather than silently retaining the old limit.

### #6 — 2026-10-06 — CONTRADICTION
Self-verified a conflicting existing definition for ID 448 (`Menial task`): the Markdown list says “công việc tay chân tầm thường, ít được coi trọng”, while `data/vocabulary.json` and its README example say “công việc lao dịch, tay chân vất vả, ít được coi trọng”. These cannot both be the single canonical `MEANING`; no vocabulary data has been changed pending the user's choice.

### #7 — 2026-10-06 — DECISION
User chose the Markdown wording as canonical for ID 448. Use “công việc tay chân tầm thường, ít được coi trọng” as `MEANING` and retain the prior app JSON wording (“công việc lao dịch, tay chân vất vả, ít được coi trọng”) in `NOTES`, explicitly labeled as the previous app definition.

### #8 — 2026-10-06 — DONE
Reformatted `Learned_Vocabulary_List.md` as a 12-column Markdown table with JSON arrays for list-valued fields and explicit blanks for unknown data. IDs 614–913 now have their explicitly labeled word-family text in `WORD_FAMILY` and their original comparison/source material in `NOTES`; synonyms, antonyms, collocations, register, connotation, examples, difficulty, and creation dates were not invented. Converted the app data to 913 entries, preserving the original 613 records' existing app metadata; the user-confirmed ID 448 meaning and prior-wording note are recorded. Inlined app CSS, JavaScript, and all vocabulary into `index.html`; removed standalone `app.js`/`style.css` and the obsolete legacy converter. Updated the validator, source/HTML sync scripts, tests, README, review note, and Pages workflow to publish only `index.html`. Verified exact preservation of the original 913 list records through field splitting, the prior 613 JSON fields (apart from the confirmed ID 448 resolution), source counts, JSON/HTML synchronization, 12 Python tests, 8 Node tests, HTML structure, and an HTTP preview smoke test.

### #9 — 2026-10-06 — NOTE
Started a local preview server on port 4173 for the standalone app. No headless browser is installed in the workspace, so an automated visual/browser interaction test was not run; the live preview and runtime logic tests are available.

### #10 — 2026-10-06 — NOTE
Preservation detail: ID 448 also retains its original `work` and `daily-life` tags and adds `easy`, the explicit mapping of that row's legacy `-` marker. All other pre-existing app fields for IDs 1–613 match the prior JSON exactly; the only other existing-record change is the user-confirmed ID 448 meaning.

### #11 — 2026-10-07 — INTENT
User: “Final check audit. open PR.” User also asked to inspect and handle root `AGENT.md`: check existence first; if absent, create it from verified repository facts only; do not change project source/configuration/behavior outside that file; if it exists, read it and ask before modifying it.

### #12 — 2026-10-07 — DONE
Checked for root `AGENT.md` first; it was absent. Audited the README, data pipeline, app entry point, tests, and GitHub Actions, then created a concise `AGENT.md` with only verified repository context and commands. Re-ran vocabulary synchronization/validation, evidence audit, 12 Python tests, 8 Node tests, Python compilation, HTML structure checks, and an HTTP preview smoke test; all passed. This task made no source-code, configuration, or runtime-behavior edits.

### #13 — 2026-10-07 — DONE
Committed and pushed this work on the session branch, then opened PR #12 against `main`: https://github.com/coderunknow/Chuyen-Anh/pull/12. The PR is open.

### #14 — 2026-10-07 — INTENT
User: “Tôi muốn nó phải cho agent khi đọc vào sẽ biết workflow cần làm gì (ví dụ: đọc DESIGN_LOG.md,... và chỉ dẫn tốt nhất).”

### #15 — 2026-10-07 — DONE
Expanded root `AGENT.md` with a per-task workflow: read the full design log, verify relevant claims against the repository, surface unresolved conflicts and ask before dependent changes, and append factual dated entries without rewriting prior history. Kept the repository-specific data pipeline and test guidance. No source code, app configuration, or runtime behavior changed; this update is documentation-only.

### #16 — 2026-10-07 — NOTE
`git diff --check` passed for this documentation update. Python/Node tests and browser/runtime checks were not run because no application code or behavior changed. After pushing the update, PR #12 remained open; its Kilo Code Review check was pending at the last status check.

### #17 — 2026-10-07 — INTENT
User requested a review and direct correction of PR #12 based on the current repository and four findings: reconcile the initial unresolved notes with later explicit decisions without rewriting log history; protect `AGENT.md` from unsolicited edits; report the ID 448 `easy`-tag migration accurately; and make CI/deploy validation consistent with the standalone HTML deliverable. The user required repository-backed assertions, relevant automated checks, a reviewed final diff, and an updated PR.

### #18 — 2026-10-07 — CORRECTION
A field-by-field comparison of the original `origin/main:data/vocabulary.json` with the current app data for IDs 1–613 found exactly two changed pre-existing fields, both for ID 448: `meaning` uses the user's selected Markdown wording (entry #7; the former app meaning remains in `NOTES`), and `tags` change from `["work", "daily-life"]` to `["work", "daily-life", "easy"]`. The original Markdown row marked ID 448 with legacy `-`; `easy` is its intentional tag migration, while the old tags and numeric `difficulty: 2` remain. Every other pre-existing key/value for IDs 1–613 matches the original JSON. This qualifies the broad preservation wording in historical entries #8 and #10; those entries remain unchanged, and this entry is the current field-level account.

### #19 — 2026-10-07 — DONE
Clarified that the initial open-question bullets are historical and superseded by explicit decisions #3–#5 and #7, while preserving entries #1–#16 verbatim; entry #18 records the exact ID 448 field comparison. Added an explicit opt-in-only edit rule for `AGENT.md`. Documented the ID 448 tag conversion in the README and added a regression test that requires `work`, `daily-life`, and `easy` while retaining numeric difficulty 2. CI now runs when the deploy workflow changes, and the deploy job repeats source/JSON/HTML checks plus Python and Node tests before staging only the standalone HTML. CI and deploy name Node setup and Node test steps separately. Verified 913-row source→JSON→embedded-HTML synchronization, 13 Python tests, 8 Node tests, YAML parsing and workflow-order assertions, ID 448 field-level differences against `origin/main`, unchanged historical entries, and `git diff --check`. No vocabulary source, JSON, embedded HTML, or runtime behavior changed. Not run locally: a live GitHub Pages deployment or interactive browser session.
