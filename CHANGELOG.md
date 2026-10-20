# Changelog

## v1.0.0-beta1 — 2026-10-20 (release candidate; not published by this change)

### “Học cấp tốc” — semantics corrected

- Removed the fixed seven-word cap (`SPRINT_SIZE = 7` and the sprint-only seven-word selection). On a 30-word eligible pool the sprint used to queue 7 words while a mixed session with the same settings queued 20; it now queues the learner’s configured session size (10/20/30/50) from the whole eligible pool, so choosing “Học cấp tốc” never silently teaches fewer words.
- Sprint keeps deterministic priority: due cards first (weak before learning), then weak-but-not-due, learning, new, review, mastered.
- A wrong answer in sprint now queues exactly one corrective retry. Previously the feedback said a retry had been queued while the sprint path skipped it.
- Throughput now comes from the interaction budget: a correct first-pass answer advances automatically after 1.6 s (Enter advances immediately), while an incorrect answer never auto-advances and keeps the answer, metadata and one bounded correction on screen. Practice turns stay excluded from first-pass accuracy, scheduling and mastery.
- The banner and session header report the true eligible count, queued count and remaining turns; the retired “7 từ · ~5 phút” copy and its stale translations were removed. Settings now state that the session-size target also covers the sprint.

### Tests

- `tests/static-app.test.js` imports the real module and covers sprint volume (30-word pool → 20, explicit 7 → 7, pool smaller than target, zero/empty/unknown ids, mixed-state priority, determinism), verified-only exam grading and the exported exam result JSON (counters, `ungraded`, null accuracy, provenance, ASCII-safe filename, `APP_VERSION`).
- `tests/browser-learning.cjs` drives the real sprint in Chromium: 10 seeded eligible words are all graded in priority order, the third answer is wrong, exactly one spelling correction follows, correct answers auto-advance and a wrong answer does not, first-pass accuracy is 90% with the retry reported separately, and storage survives a reload.
- `tests/test_sprint_exam_features.py` no longer asserts the retired cap or the sprint practice exemption; it now pins the beta1 version constant and the absence of the removed cap.

### Release and deployment tooling

- `APP_VERSION` is `v1.0.0-beta1` and is displayed in Settings → data information.
- `scripts/release_artifacts.py` accepts the requested candidate: pushed tags must match `vMAJOR.MINOR.PATCH-(dev|beta|rc)N`; `v1.0.0-beta1` is supported and final/arbitrary refs are still refused before any release is touched. `release-artifacts.yml` triggers on `v1.0.0-*` instead of `v1.0.0-dev*`.
- `DEPLOY_HOLD` now names `v1.0.0-beta1`. The gate is fail-closed and tag-specific, so it stays closed until that exact prerelease is published even though `v1.0.0-dev5` is already published; no semver-precedence assumption was added.
- Fixed `.github/workflows/exam-validation.yml`, whose `push` trigger named a stale feature branch instead of `main`, so exam-archive validation now runs on main pushes as documented.

### Data scope and limits

- No vocabulary row, exam transcription, audit ledger or historical release record was modified. The dev5 evidence ledger still records 145 dictionary-evidence entries and 768 pending entries; this change makes no new dictionary claim and does not assert full verification.
- Local artifact generation, tag creation, release publication and Pages deployment were not performed from this change; the candidate is prepared and verified locally only.

## v1.0.0-dev5 — 2026-10-20

### Vocabulary and audit

- Corrected 16 evidence-backed source rows, then rebuilt `data/vocabulary.json` and the embedded standalone-app vocabulary payload.
- Read all 913 source rows in ascending ID order before dictionary research. This is source-level coverage, **not** a claim that all 913 entries were dictionary-verified.
- Recorded 145 dictionary-evidence entries: 127 carried forward from the dev4 ledger without revalidation in this pass, plus 18 exact-headword checks directly inspected in this pass. Five legacy excerpts were replaced with exact Cambridge text; ID 448 was changed to pending because its candidate URL did not resolve to a standalone phrase entry.
- Kept 768 entries pending exact-headword dictionary verification: 765 were not targeted for dictionary lookup in this pass; IDs 448, 456, and 579 received only non-exact phrase/component/grammar review.
- Added a versioned JSON Schema and source-led dev5 JSON/Markdown audit. Retired the dev4 generator because it could restore unsupported verification claims; aligned its historical report and tests to 132 verified / 781 pending.

### Release and deployment

- Advanced the app version and sprint-version assertion to `v1.0.0-dev5`.
- Set `DEPLOY_HOLD` to `v1.0.0-dev5`; GitHub Pages is gated until the release-ordering check confirms a published prerelease.
- Route `release.published` through a minimal dispatcher that invokes the gated deploy workflow on `main`, respecting the GitHub Pages environment's main-only branch policy.
- Updated the README checksum example and documented the dev5 evidence limits. Verify GitHub tag, release, and asset state independently; this changelog records contents, not publication status.
