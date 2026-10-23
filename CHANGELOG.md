# Changelog

## v1.0.0-beta6 — 2026-10-23

Release state — whether a `v1.0.0-beta6` tag, prerelease and assets exist, and which build Pages serves — must be verified live on GitHub; this file records contents, not publication status.

### Fixes: the priority session that started invisibly, and seven defects found auditing around it

- **“Bắt đầu phiên ưu tiên” did nothing when pressed in Settings.** The session was created, its timer started and its queue filled, but the app never left the Settings screen, so the learner saw only the button's press animation. Every session starter now lands on the study view. The same omission existed in the dashboard's “Từ yếu” card.
- **A session reported the whole lifetime XP total as its own gain.** `sessionXpStart` was only captured for priority sessions, so a classic or sprint session measured itself against `0` — measured on the shipped beta5 build, a 10-word session that earned 61 XP displayed **“+10861”** on a 10,800-XP profile. All three starters capture their own baseline; the summary now always equals `total − before`.
- **A new session inherited the previous session's skipped questions.** `skippedIds` and `matchState` are now reset by every starter, so the pending list, the unanswered count and the accuracy figures describe only the session on screen.
- **A start that cannot run was a dead click.** When no word matches the enabled groups the button used to be `disabled`: nothing happened and nothing explained why. It now stays operable, points at the empty-state explanation through `aria-describedby`, is dimmed via `data-blocked="true"`, and answers with the actual reason (“Không có từ nào thuộc nhóm đang bật…” / “No words belong to the enabled groups…”).
- **A sprint ignored the timed-practice toggle.** Sprint sessions now carry the same limit, countdown and expiry path as every other session.
- **Marking a hard word or a favourite discarded a typed answer.** Both toggles re-rendered the whole shell mid-card; they now refresh only their own button (state, `aria-pressed`, translated accessible name) while a card is on screen, and still re-render surrounding lists from other views.
- **“Học tiếp” left the shell stale.** The continue button now re-renders the shell, so the due count, streak and XP reflect the session that just ended.

### Verification

- `node --test tests/static-app.test.js` **81 pass / 0 fail** (beta5: 77). The four new guards fail on the beta5 build (`# pass 77 / # fail 4`) and pass on this one.
- `python3 -m unittest discover -s tests -p 'test_*.py'` **72 OK**; `node tests/browser-learning.cjs` **PASS** (218 s) — including six new interface scenarios: a session started from Settings opens in the study view, a sprint honours its timer, a blocked start explains itself, the reported XP gain equals the session's own gain, a typed answer survives the star/flag toggles, and a new session inherits no pending questions (“Học tiếp” also returns to the picker).
- `node tests/browser-exams.cjs` **PASS** (106 s); `build_vocabulary.py --check`, `embed_vocabulary.py --check`, `exams/embed_archive.py --check` (913 / 913 / 106) and `validate_vocab.py` are current. No vocabulary, exam or ledger content changed.
- Also verified while auditing: a timed session that expires while the learner is on another screen still lands on its results with unanswered questions reported blank.
- `APP_VERSION` = `v1.0.0-beta6`, `DEPLOY_HOLD` = `v1.0.0-beta6`. No learner study was run, and no screen-reader or full WCAG audit was performed.

## v1.0.0-beta5 — 2026-10-23

Release state — whether a `v1.0.0-beta5` tag, prerelease and assets exist, and which build Pages serves — must be verified live on GitHub; this file records contents, not publication status. `v1.0.0-beta5` was merged to `main` as PR #47 (merge commit `5cb35eb2fab04f0a1acd3c636011f25306c7f878`) and `DEPLOY_HOLD` names `v1.0.0-beta5`; the release itself is built from the tag and must be verified on GitHub before any retention or deployment claim is repeated.

### Priority/focus sessions, seven exercise types, timed practice, hard-word list, XP & badges, and the "Premium Academic" interface

- **Priority/focus system (`Phiên ưu tiên`).** Four fixed groups — due, weak, new and review — can each be switched off on the study screen or in Settings. The focus group takes `ceil(size × 0.6)` of the session and the remaining groups are interleaved round-robin, de-duplicated by vocabulary id. Disabled groups are excluded from both the queue **and** the counts shown to the learner (a defect the new tests caught: the panel used to promise words the session would never use), and an empty selection says so instead of silently falling back to another mode. Selection never touches `ease`, `interval`, `lastReviewed`, `nextReview`, mastery or first-pass statistics — asserted in `tests/static-app.test.js`.
- **Seven exercise types, selectable per mode and interleaved (`MC_EN_VI`, `MC_VI_EN`, `FILL_VI`, `FILL_EN`, `CLOZE`, `MATCH`, `FLASHCARD`).** Each renders its own question and grading path, not one shared button set. Single-card types are balanced without consecutive repeats, matching boards are spaced at least one single card apart and limited to at most half of the session's words (`MATCH_PAIRS_PER_BOARD = 4`; the back-to-back-board defect found by the new plan test is fixed). `CLOZE` requires a vetted example sentence (id `448`) and `MATCH` a full board of distinct pairs, so both ship off by default and both report their real availability before a session starts. A mode with no usable data is refused with its counts, never silently swapped.
- **Typed grading with declared aliases only.** NFC + case + whitespace + edge punctuation are normalised; Vietnamese diacritics are never folded (`nghich canh` is wrong for `nghịch cảnh`). The canonical answer is accepted first, then only aliases the dataset declares, then the recorded senses of a multi-sense gloss; `SYNONYMS` and `NOTES` are never used as answers. An answer equal to another entry's gloss is reported as **ambiguous** and routed to self-assessment instead of being marked wrong; a wrong answer shows the correct one plus the existing example.
- **Skip / pending / one grade per turn.** `pending`, `answered`, `skipped` and `flagged` live in one state machine: a skip stays unanswered, never writes progress, and cannot fire twice (double click or key repeat); a session-level `Đã bỏ qua (N)` list reopens skipped questions; every turn can be graded once.
- **Corrective practice queue.** A miss is recorded once, retries are bounded to one practice turn per word, and practice turns never move first-pass accuracy, the streak, mastery, `ease`, `interval` or the review schedule. Results separate first-pass from practice and never announce a retry that was not queued.
- **Hard-word list.** Toggle during a session (flag button, `F` shortcut) and manage in Settings; idempotent, validated against real ids, stored separately in `chuyen-anh.flagged.v1` (the vocabulary JSON is never rewritten), usable as its own session pool, and compatible with v1 backups.
- **Timed practice.** Enabled before the session starts: `Tự động` (20 s per word, 2-minute floor), or 10/15/20/30 minutes (clamped 1–60). One interval drives a real elapsed countdown that shows the remaining time and the answered count; expiry stops the session and moves straight to the results. Unanswered questions are reported blank — no scheduler update, no accuracy change, no XP — and re-rendering a card never creates a second timer or blocks the controls.
- **XP, levels and badges from real events only.** XP is re-derived from graded counts and the session history instead of being incremented by button presses, so retries, consolidations, auto-advance, reloads, double clicks and skips cannot earn it; the 25 XP session bonus is claimable once and only for a session with at least one graded answer (a bug found by the timed-session scenario: an empty timed session used to add XP). Eight deterministic badges are awarded once and never regranted after a restore or reload; the streak keeps its first-pass-only semantics; the dashboard shows the five metrics (due, accuracy, mastery, weak, streak) with the existing statistical definitions.
- **"Premium Academic" redesign, themes and bounded motion.** A design-system layer defines colour, type (display serif + system UI text), spacing, radius, shadow, hit-size, breakpoint and motion tokens for light and dark, and restyles the topbar, navigation, hero, priority panel, chips, cards, options, timer, pending list, matching board, summary, dashboard, settings, search and the exam reader. Themes are `system | light | dark`, default to `prefers-color-scheme`, and a manual choice persists in `chuyen-anh.theme.v1`. Feedback is immediate, progress and card/match/summary transitions animate, and confetti is reserved for real milestones (a new badge, a perfect session of at least five graded words), drawn on one internal canvas with a launch token that cancels stale frames. Nothing blocks input, shifts layout or steals focus; no sound autoplays; `prefers-reduced-motion` disables the animation; no external animation library is loaded. A 320 px English header overflow (caught by `tests/browser-exams.cjs`) is fixed in the narrow breakpoint with an icon-only backup button.
- **Study configuration and v1-compatible backup.** Groups, focus, exercise types, session size and the time limit persist in `chuyen-anh.study.v1`; badges in `chuyen-anh.badges.v1`. A corrupt or impossible configuration is repaired instead of blocking startup, and a beta4 profile without the block adopts its existing `prefs.sessionSize`. The export bundle stays `version: 1` with optional `study`, `flagged` and `achievements.seenBadges` blocks: importing an older file keeps the device's own new blocks and says so, a malformed optional block is rejected before anything is written, and importing or resetting always ends the running session.
- **Localization of every new string.** 554 exact dictionary entries and 92 anchored patterns; new markup keeps one translatable phrase per text node because the localiser translates text nodes and will not guess inside sentences. `tests/browser-learning.cjs` walks the rendered English study home, Settings, dashboard and a live session and fails on any surviving Vietnamese UI text outside the protected content classes.
- **Performance fix.** Opening the priority panel blocked the main thread for ≈3.6 s because availability built and shuffled the full distractor list for every word; the check now short-circuits on the first distinct candidate and indexes part-of-speech tokens once (≈4 ms for the same render).

### Measured interaction throughput and startup (`ROUNDS=3`, Chromium `133.0.6943.0`, 600/450 ms, `outliersDropped: 0`, `pageErrors: []`)

| flow | beta4 baseline | beta5 candidate | delta (median) | turns |
|---|---|---|---|---|
| `standard` | `14,046 ms` (`14,398 / 14,046 / 13,925`) | `14,412 ms` (`15,306 / 14,412 / 14,070`) | `+366 ms` (`+2.6 %`) | `11` |
| `sprint` | `21,275 ms` (`21,395 / 21,275 / 21,107`) | `21,344 ms` (`22,567 / 21,344 / 21,326`) | `+69 ms` (`+0.3 %`) | `21` |

Turn-class medians (sprint): `firstPass` `8 → 9 ms`, `handOff` `8 → 10 ms`, `consolidation` `2 → 3 ms`, `retry` `2 → 3 ms`; `minConsolidationGap` = `3` on both builds. The ranges overlap on both flows, so the honest reading is *no measurable change beyond run-to-run noise* — not a speed-up. Startup (local probe: navigation start → first study view, 5 cold loads × 3 interleaved repetitions): baseline median `218 ms` (`178–325`, n=15) vs candidate `237 ms` (`208–303`, n=15). File size `5,194,482 B → 5,330,154 B` (`+135,672 B`, `+2.6 %`). Synthetic browser timings never prove human learning speed or retention.

### Tests, release gate, and candidate status

- `node --test tests/static-app.test.js` **77 pass / 0 fail** (beta4 baseline: `67`; the `68` quoted in `DESIGN_LOG.md` for beta4 is the same run with `tests/benchmark-contract.cjs` appended).
- `python3 -m unittest discover -s tests -p 'test_*.py'` **72 OK**; `python3 -m unittest discover -s scripts/exams -p 'test_*.py'` **5 OK** once `pymupdf`, `requests`, `beautifulsoup4` and `markdownify` are available (a throwaway venv outside the repository; nothing was added to the repo).
- `node tests/browser-learning.cjs` **PASS** (193 s) and `node tests/browser-exams.cjs` **PASS** (98 s), both in Chromium `133.0.6943.0` with no page errors; the same two suites also **PASS** against the unmodified beta4 tree.
- `build_vocabulary.py --check` (913), `embed_vocabulary.py --check` (913), `exams/embed_archive.py --check` (106), `validate_vocab.py` and `generate_vocab_audit_dev5.py --check` are all current; no vocabulary, exam or ledger file was edited.
- `APP_VERSION` = `v1.0.0-beta5`, `DEPLOY_HOLD` = `v1.0.0-beta5` after the merge of PR #47; `python3 scripts/deploy_gate.py --repo coderunknow/Chuyen-Anh` reports whether the `v1.0.0-beta5` release is published and therefore whether Pages may deploy it. No learner study was run: the 30 %/50 % and ≤5 pp targets remain unverified, and no screen-reader or full WCAG audit was performed.


## v1.0.0-beta4 — 2026-10-22

Release state — whether a `v1.0.0-beta4` tag, prerelease and assets exist, and which build Pages serves — must be verified live on GitHub; this file records contents, not publication status.

### Localization safety, consolidation spacing & streak isolation, benchmark hardening, 106-exam audit ledger, and state normalization

- **English UI & shortcut hint localization without substring corruption (`Scope A`).** Removed the unanchored substring replacement fallback inside `translateUiText()` — which previously mutated **26 / 913** vocabulary meanings (e.g. `Assimilate`: `'tiếp thu'` → `'next thu'`) and **106 / 106** embedded exam transcriptions — replacing it with exact dictionary entries, strictly anchored `^...$` patterns, and exact whole-sentence composition (`lookupSingleUiText`). Translated every leaked shortcut hint and split text node (`'Lượt củng cố · Space lật'`, `'lật'`, `'bắt đầu kiểm tra'`, `'/ N lượt · M còn lại'`, card headers, archive/practice statuses, metadata labels, and protected container `aria-label` attributes in `localizeSubtree()`). Tagging inline `.vocab-word`, `.vocab-meaning`, `.vocab-pos`, and `.vocabulary-metadata dd` protects 100% of vocabulary and exam source content in English mode while keeping Vietnamese UI and keyboard shortcuts (`1–4`, `Space`, `Enter`, `R`) unchanged.
- **Consolidation spacing at queue boundaries, skip safety, and truthful gap copy (`Scope B.1`).** `queueConsolidation()` now counts remaining unseen cards ahead of trailing corrective retries and inserts at `Math.min(gap + 1, nonPracticeEnd)` whenever `unseenRemaining > gap`, switching cleanly to `nonPracticeEnd` at the tail of a session so earlier consolidations act as real spacing for the final unseen cards (`minGap = min(3, N - 1)` for every `N >= 1`; `[3, 3, 3, 3, 3, 3, 5, 5, 3, 3]` for a 10-word sprint instead of dropping to `2` and `1` on words 9–10). Exported `skipSessionCard()` keeps consolidations behind enough non-skipped cards across repeated skips without starving top cards. When a very short session (`N <= 3`) makes a 3-card gap impossible (`0`, `1`, or `2` intervening cards), exported `consolidationTurnNote(actualGap)` and `consolidationResultNote(correct, actualGap)` report the exact realized card gap instead of claiming “after a few cards”.
- **Strict streak & progress isolation (`Scope B.2`).** Moved `updateStreak()` inside `if (firstPass)` alongside `updateProgress()` and `persist()` in `handleAnswer()`. Neither consolidation turns, corrective retries, nor `first-look` introductions can initialize or advance the daily streak or alter `state`, `ease`, `interval`, `lastReviewed`, `nextReview`, or first-pass accuracy.
- **Benchmark hardening & empirical learner-study protocol (`Scope C`).** Updated `tests/speed-benchmark.cjs` and `tests/benchmark-contract.cjs` to stamp per-card transitions in-page via monotonic `data-turn-seq`, report separate `turnTimingsByClass` (`firstPass`, `handOff`, `consolidation`, `retry`), enforce `minConsolidationGap >= 3`, validate `ROUNDS` / `THINK_MS` / `REACTION_MS` strictly (exiting non-zero on invalid settings or incomplete runs), retain all rounds without dropping outliers (`outliersDropped: 0`), and separate software throughput claims from unproven human retention claims via a 5-part empirical learner-study protocol in `DESIGN_LOG.md`.
- **Full 106-exam provenance & transcription audit (`Scope D`).** Added [`docs/EXAM_AUDIT_LEDGER.md`](docs/EXAM_AUDIT_LEDGER.md) auditing every single one of the `106` exam transcriptions in `scripts/exams/selection.json`, `De-chuyen-Anh-vao-10/*.md`, and `#exam-data` across explicit mutually exclusive evidence tiers: `official-verified`: `0`, `non-official-source-compared`: `0`, `partially-supported`: `61`, `structure-metadata-only`: `21`, `insufficient-source`: `24` (`22` `HTML/OCR-cần-soát` + `2022/ha-noi/so` + `2023/binh-thuan/so`). Documents `91` papers with unverified community reference keys (`3,472` extracted questions), `15` reader-only papers, `0` embedded audio files (`22` full transcripts, `4` truncated transcripts, `57` missing transcripts, `23` non-listening papers), `11` PUA glyph papers (`75` codepoints), `5` ligature-artifact papers, `7` missing-chart/figure papers, `2` tutor-gloss papers, and `3` OCR token collisions without fabricating edits.
- **Vocabulary `new`-state normalization across all modes (`Scope E`).** Hardened `sanitizeProgress()` with `deriveStudiedState()` so genuinely unstudied entries (and ungraded `new` entries carrying stale scheduling fields) always normalize cleanly to `new` across `new`, `random`, `favorites`, `sprint`, `mixed`, `due`, and `weak` sessions, trigger `first-look` once per session with zero persistence on view, preserve valid and legacy studied progress without resetting to `new`, and keep `Learned_Vocabulary_List.md` free of personal progress state.

### Measured interaction throughput (`ROUNDS=3`, Chromium `133.0.6943.0`, software throughput only)

| scenario (`thinkMs` / `reactionMs`) | flow | turns | median elapsed (all 3 rounds) | per turn | median class DOM latency (`firstPass` / `handOff` / `consolidation` / `retry`) | consolidation gaps |
|---|---|---|---|---|---|---|
| `600 / 450 ms` | `standard` | `11` (`10 + 1`) | `14,015 ms` (`14,547 / 14,015 / 13,946`) | `1,274 ms` | `4 ms / — / — / 2 ms` | `—` |
| `600 / 450 ms` | `sprint` | `21` (`10 + 10 + 1`) | `20,984 ms` (`21,179 / 20,910 / 20,984`) | `999 ms` | `6 ms / 7 ms / 2 ms / 2 ms` | `[3,3,3,3,3,3,5,5,3,3]` (`min=3`) |
| `1200 / 450 ms` | `standard` | `11` (`10 + 1`) | `21,652 ms` (`21,652 / 21,654 / 21,614`) | `1,968 ms` | `4 ms / — / — / 9 ms` | `—` |
| `1200 / 450 ms` | `sprint` | `21` (`10 + 10 + 1`) | `34,700 ms` (`34,906 / 34,662 / 34,700`) | `1,652 ms` | `7 ms / 8 ms / 2 ms / 2 ms` | `[3,3,3,3,3,3,5,5,3,3]` (`min=3`) |
| `600 / 250 ms` | `standard` | `11` (`10 + 1`) | `11,776 ms` (`12,319 / 11,776 / 11,721`) | `1,071 ms` | `4 ms / — / — / 5 ms` | `—` |
| `600 / 250 ms` | `sprint` | `21` (`10 + 10 + 1`) | `18,466 ms` (`19,762 / 18,466 / 18,452`) | `879 ms` | `7 ms / 7 ms / 2 ms / 2 ms` | `[3,3,3,3,3,3,5,5,3,3]` (`min=3`) |

All 18 runs (`outliersDropped: 0`, `pageErrors: []`) complete all 10 distinct words in identical order with `wrongAt = 3`. Sprint lowers per-turn UI interaction time by **16.1 %–21.5 %** while deliberately taking **49.7 %–60.3 % longer per session** because it adds 10 delayed recall/spelling consolidations. Synthetic browser timings never prove human learning speed or memory retention.

### Tests, release gate, and candidate status

- `node --test tests/static-app.test.js tests/benchmark-contract.cjs` **68 pass / 0 fail**; `.venv/bin/python -m unittest discover -s tests -p 'test_*.py'` **72 OK** (including `tests/test_exam_audit_ledger.py`); `.venv/bin/python -m unittest discover -s scripts/exams -p 'test_*.py'` **5 OK**; `node tests/browser-learning.cjs` **PASS**; `node tests/browser-exams.cjs` **PASS**; `ROUNDS=3 node tests/speed-benchmark.cjs --matrix` **PASS**.
- Follow-up regression scenarios (PR #46, rebased onto this candidate): the rendered English card-footer is asserted on first-pass, hand-off, consolidation and first-look cards (`Space reveal · Enter next` / `Consolidation turn · Space reveal` / `Enter start quiz`), and a shifted-clock scenario proves the daily streak ignores a consolidation that opens a new day and that first-look introductions write nothing. Fail-first verified twice: moving `updateStreak()` out of `if (firstPass)` fails at the midnight consolidation (writes 2 !== 1), and removing the footer dictionary keys fails with the original `Space lật · Enter tiếp` rendering.
- `APP_VERSION` = `v1.0.0-beta4` and `DEPLOY_HOLD` = `v1.0.0-beta4`. At candidate time `python3 scripts/deploy_gate.py --repo coderunknow/Chuyen-Anh` prints `deploy=false (release v1.0.0-beta4 is missing; deployment held)`, keeping GitHub Pages on the previously published release until a maintainer explicitly tags and publishes `v1.0.0-beta4`.

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
