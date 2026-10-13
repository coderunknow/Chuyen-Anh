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

---

# Second pass — 2026-10-13, branch `arena/25926059-chuyen-anh`

Task intent: “Toàn diện; agent tự audit và chọn nâng cấp đáng giá nhất.” (again, on a fresh session branch). The first pass above is kept verbatim as history; this section records the second audit and the change it selected. Starting commit `a188cd80dd9d3c6351516115640e4c8c88dfb929`, clean tree, `git status` showed no local modifications.

## Baseline re-verified before editing

- `python scripts/build_vocabulary.py --check` — 913 Markdown records match `data/vocabulary.json`.
- `python scripts/validate_vocab.py` — 913 entries valid, 0 duplicate IDs, 0 duplicate words.
- `python scripts/embed_vocabulary.py --check` — embedded HTML matches the JSON.
- `python -m unittest discover -s tests -p 'test_*.py'` — 13 passed.
- `node --test tests/static-app.test.js` — 14 passed.
- `node tests/browser-learning.cjs` — real Chromium 133.0.6943.0 passed on the unmodified checkout.
- `git diff --check` — clean.

Dataset facts re-measured from `data/vocabulary.json` rather than assumed: 913 entries; 613 carry `difficulty`/`createdAt`; `wordFamily` on 300; `tags` on 148; `synonyms`, `antonyms`, `collocations`, `register` and `connotation` are empty on all 913; exactly one record (ID 448) has an `examples` array. Therefore “cloze/context” practice, which needs an example sentence, currently applies to 1 of 913 words and cannot be expanded from the existing source without inventing sentences.

## The finding: a once-only scheduler mutation decided by a lucky guess

The journey was inspected end to end (session choice, first exposure, retrieval, feedback, retries, summary, dashboard, search, settings, storage, import/export, keyboard and reduced motion), and the real application was driven in Chromium to confirm each step instead of reading it.

The first pass closed the feedback→retrieval loop but left the *first* retrieval unguarded. `selectSession` schedules every `new` card for immediate study, and `updateProgress` treats the first correct answer — whatever produced it — as evidence of knowledge:

```
current.state === STATES.NEW → state = learning, interval = 1, nextReview = now + 1 day,
                               correctCount +1, streak +1, ease +0.1
```

A never-studied card, however, was asked as an unscaffolded multiple-choice question — word → “pick the Vietnamese gloss” — with three distractors drawn from the same 913-word pool. A student meeting `Adversity` for the first time has no basis to choose `nghịch cảnh` over `nghịch đảo` or `nghịch lý`; a 25% lucky guess persists a full day of “learning”, raises `correctCount` and `streak`, and hides the word from the weak/error path. The scoring step with the most leverage in the whole scheduler was the one step with no guard.

A second, independent defect was reproduced in the same flow: `handleAnswer` accepted any answer while the card was unrevealed, and revealing the answer did **not** close the question. Pressing `Space` and then clicking the option that had just been displayed persisted `{"state":"learning","correctCount":1,"streak":1,"interval":1}` for a word the student had never studied — a copied answer recorded as a first-pass success, with no indication in the feedback that the card had been revealed first.

Both were reproduced on the unmodified checkout with the real interface, not inferred from source:

| Step | Observation on baseline |
| --- | --- |
| New-word session, first card | `Adversity` asked as 4-option recognition with no prior exposure, no example, no note for 912 of 913 words |
| Click the correct gloss immediately | `state: learning`, `correctCount: 1`, `nextReview: now + 1 day` |
| `Space` (reveal) then click the displayed gloss | same persisted success; feedback still says “✓ Chính xác!” |
| Wrong answer on a never-studied word | `state: weak`, the card is due immediately, and the next meeting is a typed recall with no prior exposure to the meaning |

Hypotheses (not measured, labelled as such): naive guessing inflates early schedules; a look-before-test step counters that for the first exposure; locked self-assessment after a reveal makes the score a self-report instead of a copy. No retention experiment was run.

## Why this improvement over the alternatives

- **Word families / real cloze exercise generation (deferred).** Data-driven and tempting — 300 records have `wordFamily` — but building exercises means generating sentences or distractors, which means authoring vocabulary facts. The task forbids inventing meanings, examples or word families, and the archive material is Vietnamese exam prose, not sentence banks keyed to these 913 headwords. High cost, unverifiable data risk.
- **Better distractors (deferred, partly mitigated).** Choosing same-POS/similar-meaning distractors would strengthen the quiz, but it is a heuristic on top of a data gap (no synonyms/antonyms) and does not by itself stop a guess from being scheduled as knowledge.
- **Richer analytics, streak goals, session length goals (rejected).** Adds state, validation and migration cost without changing retrieval quality.
- **Scheduler redesign (rejected).** The existing deterministic `new → learning → weak → review → mastered` machine is already tested, deterministic and honest; a redesigned scheduler would add risk for no demonstrated benefit in this environment.
- **Selected.** Introduce a never-studied word *before* grading it, and make a revealed answer un-scoreable by selection. Both act exactly on the scoring step that inflates progress, need no storage change, no migration and no new data, and can be verified deterministically in unit tests plus a real browser.

## Implemented behavior

- A card in state `new` opens with a **first-look introduction**: headword, part of speech, meaning, and whatever the dataset actually holds (`wordFamily`, `notes`, `register`, `connotation`, `synonyms`, `antonyms`, `collocations`, `examples`). A `Bắt đầu kiểm tra` button (`Enter`/`Space`) generates the quiz question for the same card, so the first graded retrieval is now informed rather than blind.
- The introduction is **not an answer and not a record**: it writes nothing to `localStorage`, does not touch `nextReview`, `correctCount`, `streak`, `ease`, `difficulty`, session history or the daily streak, and does not consume a practice retry. The progress-bar attempt counter is unchanged.
- A card is introduced **once per session** (session-local marker, like the existing practice queue), so skipping or returning to it does not re-show the meaning; nothing about the marker is persisted, so reloading mid-session re-introduces an ungraded new word, and a scheduled card that already has progress is never introduced.
- **Revealed answers are locked.** After `Space`, option buttons and the spelling input are disabled and visibly dimmed, the `1–4` shortcut no longer answers, and the only way to grade the card is `Nhớ được` / `Chưa nhớ`. The feedback states that the attempt was graded by self-assessment.
- Practice retries deliberately keep the typed recall exactly as before: an incorrect word gets one spelling attempt with its meaning shown, which is immediate corrective retrieval, not blind testing.
- Accessibility: the introduction button takes focus on render (the shell focuses the view container, so the button reclaims focus on the next tick), the introduction and locked options fit a 375 px viewport, and the existing `Space`/`Enter`/`R` shortcuts keep their meanings. Markup stays semantic; no new persisted preference was added.

## Files changed

- `index.html` — `needsFirstLook()` and `canGradeBySelection()` helpers with comments; first-look state and renderer; reveal lock; guarded `handleAnswer`; keyboard handling for the introduction and for the `1–4` shortcut; `.first-look*` and `.option.locked` styles; session-copy updates. No vocabulary record, storage key, storage shape, import/export field or deployment file was touched.
- `tests/static-app.test.js` — 2 new deterministic tests (14 → 16): which cards are introduced and that the decision mutates nothing, and which grading paths are allowed.
- `tests/browser-learning.cjs` — extended optional Chromium suite for the introduction, the reveal lock, keyboard/focus, 375 px layout, re-introduction after reload, and preservation of pre-existing progress.
- `README.md` — documents the first-look step and the reveal lock.
- `docs/learning-experience-audit-2026-10-13.md` — this appended section, first pass preserved.
- `docs/learning-first-look.png`, `docs/learning-reveal-locked.png` — new screenshots of the two states.

## Compromise recorded honestly

Locking the card after a reveal makes the attempt a **self-report** instead of a copy. A student can still claim “Nhớ được” after seeing the answer. That is the standard trade-off of self-graded flashcard review, it is now explicit in the copy and in the feedback text, and the alternative — scoring a copy as recall — is strictly worse: it was observably persisting a full review interval from a displayed answer. This is a behavioural hypothesis, not a measured retention result.

## Verification actually executed (this pass)

- `python scripts/build_vocabulary.py --check`, `python scripts/validate_vocab.py`, `python scripts/embed_vocabulary.py --check` — pass, 913 records unchanged.
- `python -m unittest discover -s tests -p 'test_*.py'` — 13 passed, unchanged.
- `node --test tests/static-app.test.js` — 16 passed (14 inherited + 2 new).
- `node tests/browser-learning.cjs` — Chromium 133.0.6943.0 passed with a controlled clock; the log line reports the new coverage list. Includes: introduction is shown and is not an answer (no progress/streak/history keys written), keyboard start, the graded attempt after the introduction, locked options and input after a reveal with `deepEqual` proof that progress did not move, self-assessment grading with its feedback note, no second introduction in one session, re-introduction after reload, no introduction for a card with existing progress whose counters keep growing, the inherited corrective-practice suite, valid/invalid import, dark mode and 375 px layout.
- `git diff --check` — clean (re-checked after the final edits).

Not run: retention measurement, screen reader, Safari/Firefox/iOS, storage-quota simulation, production GitHub Pages deployment, and the external automated reviewers that are rate-limited on this repository.

## Limitations

- Self-assessment after a reveal can be dishonest; the alternative was worse and this is documented.
- The introduction adds one extra screen per never-studied word. Skipping is one click (`Bỏ qua`).
- Distractor quality is unchanged; the SAME-POS/similar-meaning improvement above remains the best follow-up if the dataset ever gains synonyms.
- The one-word cloze situation is unchanged: 912 of 913 records have no example sentence, and no sentence was invented.
