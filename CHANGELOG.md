# Changelog

## v1.0.0-beta2 — 2026-10-21 (unreleased)

### “Học cấp tốc” — hand-off without the fixed dwell

- Removed the 1.6 s auto-advance timer. `SPRINT_AUTO_ADVANCE_MS`, the pending-timer variable, `scheduleAutoAdvance()`/`cancelAutoAdvance()`, their call sites and the “tự chuyển sau 1,6 giây” hint (plus its translation) are gone, not merely set to zero. A correct first-pass answer in sprint now advances within the same turn.
- The graded answer is carried onto the next card instead of holding the old one still: a `.handoff-strip` live region (`role="status"`, `aria-live="polite"`) shows the word, its meaning and `Đã trả lời đúng` / `Chưa đúng`, and it also appears after the first-look introduction so that path keeps its answer too.
- Skipping a card rotates the queue, which breaks the adjacency the strip describes, so a skip clears it. Previously the strip survived the rotation and labelled an unrelated word with an older verdict.
- Nothing about the learning work was shortened: a wrong answer still never advances and keeps its full correction, the single practice retry still waits for acknowledgement, and first-pass accuracy, scheduling and mastery are computed as before. Self-assessment after a reveal does not hand off.
- The rule is now a pure exported function, `shouldHandOffImmediately({ mode, correct, practice, revealed })`, and `lastAnswer` is cleared on every reset, on a skip, and before any detailed feedback panel so a strip cannot outlive its card. Skip ignores the second click of a double-click.

### Measured against beta1 on identical work

Method: `node tests/speed-benchmark.cjs --matrix` with `APP_BETA1` = `index.html` from `main` at the beta1 commit (`8661916`) and `APP_BETA2` = this tree; three rounds per scenario, median reported. Every latency is measured **inside the page** with `performance.now()` — a capture-phase listener stamps the answer when the app receives it and a `MutationObserver` stamps when the visible card actually changes. The earlier 1,322–1,328 ms figure came from a harness that stamped the answer before Playwright clicked and the card after the click promise resolved, so it under-reported beta1's dwell by roughly the click overhead; the corrected harness reports ~1,611 ms, which agrees with a separate in-page probe (1,622–1,636 ms).

All twelve runs graded ten words plus exactly one corrective retry, in the same order, with no page errors; the harness asserts these conditions and exits non-zero otherwise.

| scenario | beta1 standard | beta1 sprint | beta2 standard | beta2 sprint | sprint vs standard (beta2) | sprint vs beta1 sprint |
|---|---|---|---|---|---|---|
| think 600 ms / react 450 ms | 14,020 ms | 23,910 ms | 13,806 ms | 9,766 ms | −29.3 % | −59.2 % |
| think 1200 ms / react 450 ms | 21,662 ms | 31,920 ms | 21,646 ms | 17,466 ms | −19.3 % | −45.3 % |
| think 600 ms / react 250 ms | 11,780 ms | 23,646 ms | 11,790 ms | 9,486 ms | −19.5 % | −59.9 % |

Mean hand-off latency: 9 × 1,611–1,612 ms in beta1 sprint versus 9 × 9–10 ms in beta2 sprint; the standard flow needs eleven manual continues and no hand-off. These are synthetic-browser timings of one fixed workload — not learner outcomes. No retention, learning-quality or equivalence claim is made.

### Tests

- `tests/static-app.test.js` (54 tests) covers `shouldHandOffImmediately` across every non-sprint mode, wrong answers, practice retries and revealed answers, asserts the retired dwell timer is gone, and exercises `tests/benchmark-contract.cjs` so an invalid benchmark run is rejected.
- `tests/test_sprint_exam_features.py` pins beta2, asserts the retired constant is absent and that no `setTimeout(… advanceCard` survives.
- `tests/browser-learning.cjs` drives the real sprint in Chromium: hand-off under 800 ms, strip content and live-region roles, no strip after a wrong answer, the strip dropped on a skip, and the queue/navigation state machine across another screen.
- `tests/speed-benchmark.cjs` runs one scenario or the full `--matrix`, never clicks on the hand-off path, and fails on any workload invariant breach; `tests/benchmark-contract.cjs` holds those invariants without depending on Playwright.


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
