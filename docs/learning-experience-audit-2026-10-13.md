# Learning experience audit — 2026-10-13

## Baseline and scope

Task intent: “Toàn diện; agent tự audit và chọn nâng cấp đáng giá nhất.” Independently audit the complete vocabulary-learning journey, implement and test the selected improvement, and open one PR against `main`; leave it unmerged.

The initial working tree was clean on `arena/6a907b50-chuyen-anh`, at `c394054`. Read the complete root instructions and design log, README, learning module and markup/styles, Python/Node tests, vocabulary build/embed pipeline, and all CI/deployment/exam workflows. Fetched `main` and unshallowed history without changing branches. The starting branch already contains the due/new/mixed selection fix (`fd1bb74`, also proposed in open PR #14); that work is inherited, not newly authored in this pass. A PR against `main` therefore includes those two inherited commits as well as this task's commits. Existing PRs were not modified or closed.

Baseline commands all passed: source build check, vocabulary validator (913 entries), embed check, 13 Python tests, 11 Node tests, and whitespace check. Protected `AGENT.md`, vocabulary records, exam archives, and deployment workflows remain unchanged.

## Journey findings and decision

| Area | Repository-backed observation | Decision |
| --- | --- | --- |
| Choosing a session / appropriate review | Starting checkout's `isDue` excludes new cards, explicit due sessions do not fill from future reviews, quick mixed sessions do fill. Existing deterministic tests cover fresh profiles, limits, ordering, and future timestamps. | Preserve inherited corrections, not redesign the scheduler. |
| Learning / retrieval | Recognition, reverse multiple-choice recall, typed spelling, and cloze are generated from existing fields; missing examples fall back without inventing data. | Preserve modes and vocabulary. |
| Error correction | `handleAnswer` previously updated progress and showed feedback but did not enqueue failed words. `advanceCard` removed them; only an undiscoverable-in-feedback keyboard `R` could repeat. Real baseline browser check confirmed an incorrect last word immediately ended the session. | Add one automatic, explicit typed corrective retrieval after remaining cards. |
| Feedback / statistics | `repeatCurrent` duplicated work without incrementing `sessionStats.total`; `finishSession` divided all correct answers by the original total. Real baseline browser reproduction produced **200%** for a one-word repeated session. Repeating also advanced the scheduler immediately after exposing the answer. | Keep immediate practice separate from original review evidence and first-pass accuracy. |
| Reliability / backups | Existing v1 progress/preferences/history import validation runs before mutation. Storage writes return failure and the app shows an error toast. Current sessions and questions are not persisted. | No storage migration or format change; exercise export, valid/invalid import and reload. Interrupted practice remains ephemeral, as sessions already were. |
| Keyboard / focus | Feedback replaces the clicked answer control. Global Enter/Space intercepted focused buttons, conflicting with native activation. | Focus Continue after feedback and leave focused-button Enter/Space native; retain numeric, R and input shortcuts. |
| Theme / reduced motion | Real baseline Chromium reproduction with reduced motion showed dark background/custom properties but light-theme inherited text. The global reduced-motion rule assigned a nonzero transition duration to **all** elements. This can introduce transitions where none otherwise existed. | Set reduced-motion transition duration to zero. Browser regression asserts actual prompt color, not merely theme attribute. |
| Search / dashboard / broader opportunities | Search/index/filter/pagination, favorites, dashboard state counts, session history and settings exist. Another open PR (#13) addresses broader reliability/search fixes. Richer analytics or configurable schedulers would add more state and validation cost without repairing the observed error-correction gap. | Defer unrelated changes; no claim every existing issue has been eliminated. |

The selected coherent improvement closes feedback → retrieval → accurate summary. It has higher direct study value than visual redesign or more analytics, and avoids scheduler complexity. **Hypothesis**, not an empirically established result: another unaided retrieval opportunity helps students correct mistakes. This audit verifies the opportunity exists and behaves consistently; it does not measure long-term retention.

## Implemented behavior

- Each incorrectly answered original word queues one spelling practice attempt behind the remaining queue. With other cards available, those intervene; a final/single word has no guaranteed delay.
- Correct original answers do not automatically add work. `R` after feedback can queue the same kind of practice voluntarily. An already-queued word is not duplicated; practice cannot queue itself, even if wrong. Skipping rotates the queue without adding work.
- Each original answer still calls the existing scheduler and persists its result. Practice answers never call `updateProgress`: all persisted counters, streak-within-card, difficulty, ease, state and review dates remain exactly as produced by the original answer. A failed word remains weak/due after successful immediate practice.
- Session progress uses total attempts (originals plus queued practice) and labels them as attempts. Final accuracy/correct/wrong and existing history fields describe original answers only; practice results appear separately in the current summary. Practice totals are transient, not added to the v1 backup schema. Historical data is not rewritten.
- Clear Vietnamese copy labels practice and explains that it does not change review schedules or first-pass accuracy. Feedback moves keyboard focus to Continue. The reduced-motion one-line CSS fix preserves immediate light/dark text changes.

## Executed verification

- `python scripts/build_vocabulary.py --check` — 913 source records match JSON.
- `python scripts/validate_vocab.py` — 913 entries valid, no duplicate IDs/words.
- `python scripts/embed_vocabulary.py --check` — all embedded records synchronized.
- `python -m unittest discover -s tests -p 'test_*.py'` — 13 passed.
- `node --test tests/static-app.test.js` — 14 passed (11 inherited, 3 new deterministic queue regressions).
- `node tests/browser-learning.cjs` — real Chromium 133.0.6943.0 passed, with a controlled Date clock. Covered session selection, incorrect/correct original answers, intervening cards, spelling retries, last-card/repeated failures, multiple errors, skip, manual R, progressbar, summary/history accuracy, persisted weak/due state and unchanged review fields, reload/preferences/favorites, actual export download, valid import, invalid import preserving every storage key, native Space/Enter, feedback focus, dark text color and 375px mobile layout with reduced motion. No page errors observed.
- `git diff --check` — passed.
- Reviewed the final application diff and screenshot. Screenshot: [dark-mode corrective practice](learning-practice.png). Optional browser packages live only in ignored `node_modules`; no package manifest, lockfile, runtime dependency, CI dependency, or build system was added.

Initial browser setup failed because the sandbox had no Chromium/NSS libraries. Optional npm-hosted Chromium and its included libraries enabled actual interaction checks. Early fixture assumptions (word #2, CSS uppercase, favorite ordering) were corrected; the reduced-motion color assertion failed against baseline and was fixed in the application. Final suite passes, rather than ignoring the color assertion.

## Limitations and risks

- Session workload can double (at most one extra attempt per original word). Students can still exit; interrupted practice queues are not resumed. Persisted progress is saved after each original answer, not lost with the queue.
- Practice results are only in the current summary, not exported or retained as history fields. History and dashboard keep their existing compatible review-answer meaning.
- No retention study, screen-reader session, iOS/Safari/Firefox interaction, physical mobile-device test, storage-quota simulation, or production Pages deployment was performed. Deployment is deliberately outside this task's delivery boundary.
- Broader pending fixes in PR #13 are not incorporated; no exhaustive claim of defect-free import/reset/navigation during an active session is made.
