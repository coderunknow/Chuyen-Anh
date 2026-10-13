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

---

# Third pass — 2026-10-13, branch `arena/25926059-chuyen-anh`

User decision after the first two passes: implement the smarter-distractor follow-up, close PRs #14 and #15 as superseded, and keep PR #16 open and unmerged. This section records that work; the sections above are preserved verbatim.

## Hypothesis tested first, and one of them was wrong

The suspicion going in was twofold: (a) the shuffle might systematically place the correct answer away from option 1, and (b) distractor quality might be weak. Hypothesis (a) was **measured and rejected**: over 48 real questions the correct answer landed in each of the four slots `[9, 12, 11, 16]` (baseline run) — `shuffle` really is a uniform Fisher–Yates shuffle and there is no position bias. Nothing was “fixed” on the basis of that guess.

Hypothesis (b) held. Measured on the real app before any change: **38.2% of distractors shared a part of speech with the headword** (55/144; exact-string comparison gives 25.7%). For a word → Vietnamese-gloss question, a distractor from a different word class is usually eliminable at a glance, so roughly three quarters of the options were not plausible competition and the question was closer to a free pick than a test.

A third, smaller defect was confirmed from the data, not from the app: 5 glosses are shared by exactly 2 entries each (10 records, e.g. identical normalized meanings). Because the old candidate filter only excluded the *answer* text, two distractors could still carry the same gloss, silently turning a four-option question into a three-option one. And the cloze builder drew its options from the whole vocabulary with no check against the sentence being displayed, so an option could be a word already printed in that sentence.

## Change

`distractors(vocabulary, current, field, { usable })` now builds two pools, shuffles each, and takes same-part-of-speech candidates first, then falls back to the rest:

- **Part of speech matching.** `pos` is free text in the source table (`n`, `v/n`, `phrasal v`, `idiom`, `prep phrase`, …), so matching is done on token overlap, which correctly treats `v/n` as sharing a class with both `v` and `n`. Measured availability in `data/vocabulary.json`: 910 of 913 entries have at least three same-POS peers; only `grammar` (2 records) and `conj` (1 record) do not, and those fall back to other word classes so the question still offers four options.
- **No repeated text anywhere in the options.** Candidates whose normalized text equals the answer's or another chosen option's are skipped, which removes the duplicate-gloss problem described above.
- **Cloze options are not words already printed in the sentence.** `wordsIn()` builds the sentence's word set (including a regular plural, so `tasks` also blocks `task`) and such candidates are filtered out for that mode only.

No vocabulary record, scheduler rule, storage key, import/export field or dependency changed; the change is confined to how a question is composed.

## Measured effect (same probe, before and after)

| Metric (48 real questions, Chromium) | Before | After |
| --- | --- | --- |
| Distractors sharing the headword's part of speech (token-overlap definition) | 38.2% (55/144) | **100%** (144/144) |
| Correct-answer slot distribution | `[15, 14, 9, 10]` | `[10, 10, 14, 14]` — still effectively uniform, no new bias |
| Duplicate option texts | none observed in this sample | none |

## Verification executed

- `node --test tests/static-app.test.js` — **18 passed** (16 inherited + 2 new). The new property test walks all 913 real records in recognition, recall and cloze modes (1,827 generated questions) and asserts, for every one: four options, exactly one correct, the correct text present once, four distinct normalized option texts, and *exactly* `min(3, distinct same-POS peers)` same-part-of-speech distractors — so the fallback for `conj`/`grammar` is asserted rather than assumed. The second test drives the cloze mode 40 times over a fixture whose sentence contains candidate words and asserts they are never offered.
- `node tests/browser-learning.cjs` — Chromium 133.0.6943.0, no page errors, now also asserting in the real app that a recognition question offers four distinct texts, that the answer appears once, that all three distractors share the headword's part of speech, and that the sole cloze record (ID 448, forced into cloze through seeded progress `correctCount: 3`) shows no option already printed in its sentence.
- `python scripts/build_vocabulary.py --check`, `python scripts/validate_vocab.py`, `python scripts/embed_vocabulary.py --check` — pass, 913 records unchanged.
- `python -m unittest discover -s tests -p 'test_*.py'` — 13 passed, unchanged.
- `git diff --check` — clean.

Not run: everything already listed as not run in the second pass (retention measurement, screen reader, other browsers, real deployment), plus a human judgement of whether same-POS distractors *feel* harder — the difficulty increase is a hypothesis supported by the measured before/after composition, not by a retention study.

---

# Release audit — 2026-10-13, v1.0.0-dev1 candidate

This section records the current release pass on `arena/9c93afb0-chuyen-anh`. It supplements, and does not rewrite, the earlier audit passes above. The current user authorization explicitly permits one focused PR, merge after repository checks, deployment verification, and a prerelease; this supersedes the older “leave it unmerged” boundary quoted in the historical passes.

## Reproduced findings and scope choice

The supplied 913-word app and its due/new/mixed session rules already work as intended. The baseline browser run also confirmed the earlier first-look introduction, locked answer reveal/self-assessment, corrective retrieval, first-pass statistics, same-part-of-speech distractors, search/favorite stability, and data backup protections. Those behaviors were verified and preserved rather than redesigned.

The current unmodified UI had two directly reproduced accessibility defects: focusing `#content` after navigation drew a 3px outline around the whole page, and the two settings switches had no accessible names or visible keyboard focus on their actual switch. At 375×812, navigation plus duplicate progress/help panels left the page heading around y=667 and the first study choice around y=812, below the initial viewport. The dashboard and session surfaces also exposed internal English state/session names. These are interface/accessibility findings; they do not establish a learning-outcome problem.

The selected scope improves the study entry point, mobile hierarchy, visual consistency, learner-facing language, focus and settings accessibility, and backup feedback. A small, transparent recommendation is due review when `stats.due > 0`, otherwise a fixed 10-card mixed session. All prior session choices remain available. This is a convenience rule, not a claim that one session size improves retention.

## Changes and invariants

- Reworked the home view into a clear next action, focused study modes, and secondary quick-session choices. Reordered the responsive shell so the study content precedes supporting progress/shortcut panels; the navigation remains compact and sticky on narrow screens.
- Replaced text/emoji navigation and session glyphs with inline SVGs embedded in the same `index.html`; updated color tokens, cards, spacing, focus treatment, success/error toasts, and the browser theme-color metadata for dark mode. Reduced-motion mode now sets both transitions and animations to zero.
- Added Vietnamese display labels for learner-facing scheduler states and session/history modes. Storage keys, internal scheduler values, existing user records, scheduling decisions, and the version-1 import/export contract are unchanged. Backup validation failures and the reset confirmation now use learner-facing Vietnamese terms instead of raw internal field names.
- Gave settings controls explicit names/descriptions and a visible focus ring on the drawn switch; made live feedback toasts announce through status/alert semantics. Added `formatDuration` for accurate summary time labels.
- The display-only `recommendedSession` helper selects due review when due cards exist, otherwise `quick10`; it changes neither the queue contents nor scheduler/persisted state.
- No vocabulary source row, JSON record, embedded vocabulary content, build pipeline, production dependency, network request, backend, or workflow changed. The one-file HTML remains the only production artifact and all learner data remains local.

## Verification and visual review

- Before editing, the required vocabulary checks, 17 Python tests, 28 Node tests, existing Chromium suite, and whitespace check all passed at the baseline recorded in entry #33.
- After changes: `python scripts/build_vocabulary.py --check` reports that JSON matches all 913 Markdown records; `python scripts/validate_vocab.py` passes with 913 entries and zero duplicate IDs/words; `python scripts/embed_vocabulary.py --check` confirms the HTML embeds all 913 records; `python -m unittest discover -s tests -p 'test_*.py'` passes 17 tests; `node --test tests/static-app.test.js` passes 30/30; and `git diff --check` is clean.
- `node tests/browser-learning.cjs` passes on Chromium 133.0.6943.0 with no page errors. In addition to the established study, search, import/export and persistence cases, the run checks the recommendation in empty and due states, named settings switches and their keyboard focus ring, light/dark theme metadata, reduced motion, and horizontal overflow/content priority at 320×720, 375×812, and 768×900.
- Rendered and visually reviewed the actual HTML at 1440×1000 and mobile 375×812 across home, first look, question, feedback, summary, dashboard, search and settings. Home’s main content now begins before y=220 and the recommended action fits in both the 375×812 and 320×720 first viewport assertions; secondary progress/help follows it on mobile. The screenshots used for this temporary comparison were scratch files and are not production assets.
- The first rerun exposed stale browser assertions (a `.session-card` queried after navigation to a flashcard, ambiguous due-card selectors after the new recommendation, and old toast/chooser copy assumptions). Those assertions were scoped to the correct view and localized messages; the full suite subsequently passed. No production defect was hidden by loosening the behavioral checks.

## Limits and release status at this checkpoint

No screen-reader usability session, physical device, Safari/Firefox run, controlled learning-retention study, or live Pages visit was performed. Chromium automation is the browser evidence; it is not a substitute for those checks. No learning effectiveness is claimed. Local checks are complete, but PR review/CI, merge, Pages deployment, post-merge SHA verification, tag collision recheck, and GitHub prerelease are still pending at the time this section is written; none is claimed here.
