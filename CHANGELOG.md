# Changelog

## v1.0.0-beta3 — 2026-10-21

Release state — whether a `v1.0.0-beta3` tag, prerelease and assets exist, and which build Pages serves — must be verified on GitHub; this file records contents, not publication status.

### “Học cấp tốc” — an adaptive retrieval ladder plus one delayed re-retrieval

Beta2 made the sprint faster by removing a wait. Beta3 changes what the sprint *asks*, because removing waiting time is not the same as reducing the time needed to learn a word.

- **Retrieval format now follows the learner's own record, not the attempt count.** `sprintRetrievalDemand(progress)` picks the level from stored state: `mastered` → spelling, `review` → spelling after a 3+ streak, `learning` → recall, anything else (including `weak`, i.e. the last answer was wrong) → recognition. Every other session keeps the old rotation, so their behaviour is unchanged. The ladder is exported as `RETRIEVAL_LADDER = [recognition, recall, spelling]`.
- **One delayed re-retrieval per word.** After a first pass that was missed or only recognised, the word is queued again at least `SPRINT_CONSOLIDATION_GAP = 3` other cards later (`queueConsolidation`), at one level higher after a success and never below recall after a miss (`consolidationDemand`). A correct spelling needs no reminder, so it is not re-queued (`needsConsolidationTurn`). The check is inserted ahead of trailing corrective retries so it is not starved at the end of the queue, and it is bounded to once per word.
- **Consolidations are practice-class, never evidence of first-pass knowledge.** They do not call `updateProgress`, do not change `state`, `streak`, `ease`, `interval`, `lastReviewed` or `nextReview`, and are counted in their own `consolidationCorrect` / `consolidationWrong` / `consolidationTotal` counters. The summary reports them on a separate “Củng cố” line with an explicit “Không tính vào độ chính xác lần đầu hay lịch ôn”, and the session history entry still reports `{total: 10, correct: 9, wrong: 1, accuracy: 90, mode: 'sprint'}` for the same run.
- **Session size and corrective work are untouched.** The sprint still queues the configured 10/20/30/50 distinct words from the whole eligible pool in the same priority order, and a miss still queues exactly one corrective retry in every mode. The new cap is a *ceiling on extra turns*: `sprintTurnBudget(size) = size * 3` (first pass + consolidation + one correction), and the queue model is simulated in tests to prove no path can exceed three turns for one word or the budget for the session.
- **The hand-off gained two guards.** `shouldHandOffImmediately` now also refuses a consolidation or a revealed self-assessment, so a delayed check always keeps its feedback panel and cannot be answered and skipped in one keystroke. `skipCard`, `repeatCurrent`, `queuePractice` and `needsFirstLook` all refuse consolidation turns, and a consolidation is never re-introduced as a new word.
- **The explanation of a turn is interface copy, so it is translated.** The consolidation and retry notes used `.sub-prompt`, which the English localizer deliberately protects because it also carries prompt content, so an English interface showed a Vietnamese sentence. They now render in a `.turn-note` class with identical styling and are translated; the protected prompt content is unchanged. Regression: `tests/browser-learning.cjs` drives a sprint with the English interface and asserts the note is English and outside the protected class.
- **Copy, not just behaviour.** The sprint banner says each word gets a first retrieval plus one delayed re-retrieval that is not counted as first-pass accuracy; the card label shows `Củng cố · …`, the summary and the feedback line explain that the schedule still follows the first answer; Vietnamese copy and its English translations were added together, so no string leaks untranslated.

### What this does *not* do

- No vocabulary row, exam transcription, storage key, backup schema or import/export validation changed; existing `localStorage` data keeps working and no new field is persisted (the level is derived from state that already exists).
- No timer returned, no click was removed, no session size was reduced, no word was silently dropped, and no accuracy, progress or mastery number is computed differently for first-pass turns.
- No learner study was run. The 30 %/50 % active-time target and the ≤ 5 percentage-point delayed-recall safety margin from the design review remain **unverified**; nothing here proves retention.

### Measured interaction throughput (synthetic, not a learning claim)

Method: `node tests/speed-benchmark.cjs` with `ROUNDS=3`, one build (`index.html`), think 600 ms / reaction 450 ms, ten words, `wrongAt` word 3. Every latency is measured inside the page with `performance.now()`; `tests/benchmark-contract.cjs` asserts the workload of each flow and exits non-zero on any deviation (turn counts, word order, consolidation order, hand-off counts, page errors).

| flow | turns | elapsed (median of 3) | per turn | hand-offs | manual continues |
|---|---|---|---|---|---|
| standard | 11 (10 graded + 1 retry) | 13,831 ms (14,163 / 13,831 / 13,809) | 1,257 ms | 0 | 11 |
| sprint | 21 (10 graded + 10 consolidation + 1 retry) | 20,905 ms (21,163 / 20,857 / 20,905) | 995 ms | 9 | 12 |

The matrix run (`--matrix`, one round per scenario, single build) gave standard/sprint 14,316/21,197 ms at 600/450, 21,904/34,859 ms at 1200/450, and 12,211/19,313 ms at 600/250.

Read honestly: the sprint is **20.8 % faster per turn** (the beta2 hand-off still removes a click on nine of its turns) but **51.1 % slower per session**, because it performs ten more graded retrievals for the same ten words. That is the intended trade — more retrieval work per word, not less. A beta2-vs-beta3 cross-version table is no longer meaningful: the workloads differ (11 vs 21 turns), so comparing their elapsed times would be exactly the mistake the design review warned about. Sprint timing is **not** a speed claim, and no result here supports or refutes the 30 %/50 % study-time target.

### Tests

- `tests/static-app.test.js` (62 tests) covers the ladder, the consolidation decision, insertion distance and once-per-word bound, the three-turns-per-word simulation, first-look and persistence isolation, the summary/feedback translations, the benchmark contract (per-flow workloads, consolidation order, hand-off counters, median and page-error rejection) and the absence of the retired dwell timer.
- `tests/test_sprint_exam_features.py` pins `v1.0.0-beta3`, the ladder and consolidation exports, the practice-class grading branch, and the absence of the seven-word cap.
- `tests/browser-learning.cjs` drives the real 21-turn sprint in Chromium 133.0.6943.0 (per-turn mode and word mapping, consolidation distance, immediate hand-off only on correct first passes), plus a sprint in the English interface that asserts a consolidation's explanatory note is translated, then navigation/skip regressions; `tests/browser-exams.cjs` re-runs the exam surface. Both PASS with no page errors.
- `python3 -m unittest discover -s tests -p 'test_*.py'` 70 OK; vocabulary 913 records, 0 duplicates, 106 transcriptions (4,169,772 text bytes).

### Release and deployment state

- `APP_VERSION` is `v1.0.0-beta3` and is shown in Settings → data information.
- `DEPLOY_HOLD` names `v1.0.0-beta3`. The gate is unchanged and fail-closed: it reads the live state of that exact tag, so it stays held for `missing`, `draft` and `not-prerelease` and opens only when `v1.0.0-beta3` is a published prerelease. No workflow was disabled, no trigger was changed and `force_deploy` was not used.
- At candidate time `scripts/deploy_gate.py --repo coderunknow/Chuyen-Anh` printed `deploy=false (release v1.0.0-beta3 is missing; deployment held)`; the same command is the only way to read the gate's current decision, and it prints `deploy=true (release v1.0.0-beta3 is published)` only after that prerelease exists.
- Tag, release assets and the build Pages actually serves must be confirmed on GitHub: this file records contents, not publication or deployment status.

## v1.0.0-beta2 — 2026-10-21

Release state — whether the tag, the prerelease and its three assets are published, and which build Pages serves — must be verified on GitHub; this file records contents, not publication status.

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
