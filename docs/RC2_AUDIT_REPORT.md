# RC2 Audit Report — v1.0.0-rc2 (unreleased candidate)

- **Repository:** `coderunknow/Chuyen-Anh`
- **Base commit:** `b72a9c64a86682cb8431e99d5b060c3b4794f236` (`main`, *Merge pull request #61*, the `v1.0.0-rc1` candidate)
- **Base release state, verified 2026-10-26:** annotated tag `v1.0.0-rc1` exists on that merge commit and the GitHub prerelease **Chuyên Anh v1.0.0-rc1** is published (2026-10-25T13:36:38Z). No later tag or release exists, so `v1.0.0-rc2` is the correct next candidate.
- **Candidate branch:** `arena/526d4d8f-chuyen-anh`
- **Candidate version:** `v1.0.0-rc2` (`APP_VERSION`, `DEPLOY_HOLD`)
- **Audit date:** 2026-10-26
- **Publication state:** nothing in this report was tagged, released, published, merged or deployed. `python scripts/deploy_gate.py --repo coderunknow/Chuyen-Anh` reports `deploy=false (release v1.0.0-rc2 is missing; deployment held)`, so merging this candidate cannot publish it to GitHub Pages before its own prerelease exists.

---

## A. Summary

This candidate implements four requested learning-flow changes and fixes the defects a repository-wide audit confirmed around them. Every defect below was reproduced against the rc1 tree before it was fixed, and each fix carries a regression test that fails on rc1 and passes here (fail-first evidence in §E).

| ID | Severity | Finding | Status |
| --- | --- | --- | --- |
| R2-1 | **High** (scoring integrity) | Matching resolution was *render-driven*: a both-selected state observed during render was resolved on a timer, so a selection that merely changed while the opposite column held a value could be graded as an attempted pair. A wrong pair also marked **both** implicated words as missed, so a word whose meaning tile had been misused was recorded wrong without ever being attempted itself. | Fixed: pure `applyMatchSelection` state machine; only the click that fills the empty column produces an attempt; only the selected word is missed on a wrong pair. |
| R2-2 | **High** (scoring integrity) | Matching boards bypassed the first-look introduction entirely (`firstLook = false` for every match turn), so never-studied words were graded on a board without ever being shown their meaning. Unseen phrases were likewise graded directly. | Fixed: `turnNeedsFirstLook` covers boards pair-by-pair; `needsPhraseFirstLook` covers the phrase bank. |
| R2-3 | Feature | No explicitly selectable four-option exercise existed by that name, and multiple-choice availability accepted a pool with a **single** distractor, so a two- or three-option question could be presented as available. | Added `mc4` (**Trắc nghiệm 4 phương án**) on the shared recognition path with a strict exactly-four contract; availability now requires a full distractor pool everywhere. |
| R2-4 | **High** (grading fairness) | Việt → Anh (recall) questions could offer another headword recorded with the *same gloss* as a wrong option — an equally correct answer marked wrong. The shipped data has 150 shared-gloss groups covering 319 headwords; the phrase bank has 23 groups covering 48 phrases. | Fixed: same-gloss candidates are never distractors for gloss-prompted questions. |
| R2-5 | Medium | A matching board could contain two identical meaning tiles (same shared-gloss data), making the board ambiguous however it was played. | Fixed: boards are grouped only from distinct words **and** distinct meanings; `isUnambiguousMatchGroup` states the invariant. |
| R2-6 | Low | The wrong-pair flash marked the meaning that *belonged to* the picked word (leaking the correct pairing) and never flashed the word tile; the mark also persisted onto the learner's next, innocent selection. | Fixed: exactly the two clicked tiles flash, and a fresh selection clears the mark. |
| R2-7 | — (audit, no defect) | Vocabulary coverage ("many words outside their intended sections") reconciled in full in §B: no headword is orphaned; the only mode exclusions are three untypable notation entries (typed English) and the example-sentence requirement (cloze, 1 of 5,112). | Documented; encoded as a reconciliation test. |

No vocabulary row, phrase, exam transcription, meaning, ID or family relationship was changed: the three embedded JSON payloads are byte-identical to the base commit (§B.1), and `git diff` over `Learned_*`, `data/`, `De-chuyen-Anh-vao-10/`, `scripts/` and `.github/` is empty.

### Verification limits stated up front

- The exam archive remains unverified against primary sources and its answer keys remain unverified, exactly as in RC1 (§G). Nothing in this candidate touches exam content.
- Vietnamese gloss *quality* was not re-edited; structural integrity is machine-verified, semantics are not.
- No screen-reader session and no physical-device test were performed; browser evidence is headless Chromium (§E).
- The optional browser suites are still not part of CI.

---

## B. Vocabulary coverage reconciliation (Feature D)

### B.1 Inventory, recomputed from the shipped data

| Measure | Value | Definition |
| --- | ---: | --- |
| Rows in `Learned_Vocabulary_List.md` / `data/vocabulary.json` / embedded HTML | **5,852** | `len(json)`; IDs 1–5852 dense |
| Active headwords (lookup + every learning path) | **5,112** | rows without `familyHead` |
| Same-root forms (audit rows, never separate cards) | **740** | rows with `familyHead`, folded into their headword |
| Phrase bank (separate store) | **780** | `data/phrases.json` |
| Exam transcriptions (separate archive) | **106** | `#exam-data` |
| Embedded payload parity vs base commit | byte-identical | SHA-256 of `#vocabulary-data` (4,890,492 B), `#phrase-data` (575,209 B), `#exam-data` (4,471,838 B) all match `b72a9c6` |

The pipeline checks (`expand/build/embed --check` for vocabulary and phrases, exam embed check, both validators) all pass, so Markdown → JSON → embedded HTML cannot disagree.

### B.2 Per-exercise eligibility on the 5,112 headwords (measured with the shipped predicates)

| Exercise | Eligible | Excluded | Why the exclusion is legitimate |
| --- | ---: | ---: | --- |
| Trắc nghiệm Anh → Việt (`mc_en_vi`) | 5,112 | 0 | — |
| Trắc nghiệm Việt → Anh (`mc_vi_en`) | 5,112 | 0 | — |
| **Trắc nghiệm 4 phương án (`mc4`)** | 5,112 | 0 | every headword has ≥ 3 distinct meaning distractors |
| Gõ nghĩa tiếng Việt (`fill_vi`) | 5,112 | 0 | — |
| Gõ từ tiếng Anh (`fill_en`) | 5,109 | 3 | `522: Lest + S + (should) V-bare`, `526: Burn one's bridges/boats`, `547: Rear its (ugly) head` contain notation no keyboard answer can reproduce; they fall back to recall and stay available everywhere else |
| Điền từ vào câu (`cloze`) | 1 | 5,111 | only `448: Menial task` carries a recorded example sentence; the app never invents one |
| Nối cặp (`match`) | 5,112 | 0 | per-word eligibility; board-level distinctness is R2-5 |
| Flashcard tự đánh giá (`flashcard`) | 5,112 | 0 | — |

Every headword keeps at least one learning path **and** lookup: a test reconciles the whole inventory (`rc2: vocabulary coverage reconciles the full headword inventory`).

### B.3 Pipeline audit: where a word can be lost, and what was actually found

| Stage | Verdict |
| --- | --- |
| Source table → JSON → embedded | Synchronized; `--check` clean; no drift. |
| Runtime load (`loadVocabulary`) | Rejects duplicate IDs/normalized words; all 5,852 rows validate. |
| Headword filter | `vocabulary = data.filter(!familyHead)` = 5,112; merged forms' progress/favourites/flags fold into the headword (`foldFamilyProgress`), so no merged form is schedulable and no study is lost. |
| Progress seeding | `ensureProgress` creates a `new` record for every headword (also after import), so session selectors iterating the progress map can reach all 5,112. |
| Session selection | `new` mode can queue all 5,112 exactly once (tested). Classic due/weak/favourites/random/mixed and sprint iterate the same map. **By-design exclusion:** the four priority groups (due/weak/new/review) do not include `learning` or `mastered` words that are not yet due (measured: 0 of 100 learning-not-due fixtures); those words stay reachable through classic, sprint, random and favourites sessions and enter the priority pool when they become due. This is the documented group semantics, not data loss. |
| Exercise planning | Words no enabled exercise can serve are reported in `plan.dropped` (and in the UI summary), never silently substituted. R2-5's distinct grouping returns unusable words to single-card turns. |
| Question generation | Prompt/answer fields per mode re-verified over all rows by the existing inventory tests; R2-4 fixed the one wrong-answer-field class (same-gloss distractors). |
| Grading | Option-id grading is position-independent after shuffling (tested); typed grading's ambiguous-answer path already refused to auto-mark same-gloss evidence wrong — R2-4 brings the option modes to the same standard. |
| Skip / retry / expiry | Skipped cards stay pending and reopenable; boards cannot be skipped half-graded; expiry counts unresolved pairs as blank, never wrong. No queue entry is dropped silently (existing tests + the rc2 browser scenario). |
| Search / lookup | The index is built from the filtered headword list; an empty query returns all 5,112 (tested). POS filter options are the dataset's own values. |

### B.4 Shared glosses (the data fact behind R2-4/R2-5)

150 normalized meanings are each recorded for more than one headword (319 headwords involved, e.g. three headwords glossed `không thể tránh khỏi`). These rows are **correct data** — synonyms legitimately share a gloss — and were not edited. The defects were in question/board construction treating a same-gloss peer as a wrong answer or as a distinguishable tile.

---

## C. The four task features, as implemented

### C.1 Four-option multiple choice (`mc4`)

- New exercise type `mc4` in `EXERCISE_TYPES`/`EXERCISE_ORDER`, labelled **Trắc nghiệm 4 phương án** / **Four-option multiple choice**, shown as a toggle chip wherever exercise types are configured, counted in session summaries, and mixed by the existing planner like every other type.
- It generates through the **same** recognition path (`EXERCISE_TO_MODE.mc4 = recognition`, same `distractors()`, same `gradeAnswer`); there is no second scoring implementation. Planned turns now keep their exercise identity (`exerciseHint`) so an `mc4` turn is labelled and counted as one.
- Contract: `OPTION_COUNT = 4`; distractors are real vocabulary entries, same part of speech first, distinct after the app's `normalize()`, never the answer, never a same-gloss peer, never a word printed in a cloze sentence; options are Fisher–Yates shuffled with the correct key on the option object itself.
- Insufficiency is explicit: availability requires three distinct distractors (`countDistractorCandidates`, shared by availability and generation so they cannot disagree); if a generated `mc4` question still comes up short it is returned flagged `unavailable`, and the session counts it in `dropped`, skips it **ungraded**, and never renders a short option list. With the shipped data all 5,112 headwords qualify, so this path is defence-in-depth plus small-pool correctness.
- Default: **off**, like cloze and matching, because the two directional multiple-choice types are already on in a fresh profile; a stored rc1 configuration (no `mc4` key) keeps its exact meaning with `mc4` off. The v1 backup schema is unchanged; the optional `study` block simply carries the extra boolean, and older files import untouched.

### C.2 Matching-board grading (R2-1, R2-6)

Reproduction on rc1 (code-level, then pinned by tests): the board kept `selectedWord`/`selectedMeaning` as loose state, re-rendered the whole card on every click, and resolved a pair whenever a later render observed both halves set, via `setTimeout`. Grading was therefore a property of *rendered state*, not of a deliberate completing click: re-picking a tile while the opposite column still held a selection (including racing the pending timer) resolved a pair the learner had not just completed. On a wrong pair both implicated words were flagged `missed`, so the owner of the misused meaning tile was later graded wrong for an attempt it never made; and the wrong-flash marked the meaning belonging to the picked word (`wrong.word === meaning.id`), leaking the correct pairing while never marking the word tile.

Fix: selection is one pure, exported transition, `applyMatchSelection(state, side, id)`:

- picking a tile in a column that already has a selection only moves (same tile: clears) that selection — **no attempt, no grade, no persistence**;
- an attempt exists only in the transition that fills the one empty column; both selections clear in the same transition, so repeated/double/stale events cannot grade a pair twice;
- a both-selected state (unreachable in the new flow) restarts from the new pick instead of grading;
- resolved tiles cannot be selected; `gradeMatchPair` itself now refuses an already-resolved pair.

The click handlers apply this transition synchronously (the render+timer resolution is deleted), a wrong pair marks only the selected word's first pass, the flash marks exactly the two clicked tiles, a fresh selection clears the flash, and focus is restored to the activated tile after the re-render so keyboard play continues. **Documented behaviour change:** before rc2 a wrong pair tainted both words; from rc2 it taints only the word the learner made a claim about. First-pass statistics definitions otherwise unchanged.

### C.3 Introduce before testing (R2-2)

One contract, `turnNeedsFirstLook(item)`: single cards delegate to the existing `needsFirstLook`; matching boards ask `matchFirstLookPairs` (pairs whose sanitized state is `new` and not yet taught this session). Audit of every path that can present a `new` word:

| Path | Before rc2 | rc2 |
| --- | --- | --- |
| Priority planned turns (incl. `mc4`, all 8 types mixed) | single cards introduced; **boards bypassed** | boards show a board introduction listing each new pair's word, POS, meaning and recorded metadata/examples, then build the board |
| Classic due/weak/new/random/favourites/quick | introduced | unchanged (via the shared predicate) |
| Sprint (+ consolidation) | introduced at first pass; consolidation only follows a graded first pass | unchanged |
| Corrective practice (`practice`) | only queued after a graded answer, so the word is no longer `new` | unchanged; predicate still excludes practice |
| Phrase practice | **graded unseen phrases directly** | introduction stage (`needsPhraseFirstLook`); confirming it writes nothing |
| Exam archive practice | ungraded by design (no keys) — no grading side effect exists to protect | unchanged |

The introduction never calls `updateProgress`/XP/streak/scheduler code and persists nothing (asserted in Node and browser by storage snapshots). Skipping an introduction leaves the card untaught, so it is introduced again when it returns — never graded sight-unseen.

### C.4 Coverage fixes (R2-4, R2-5)

Covered in §B.3/§B.4. No data was edited; both fixes are construction rules in `distractors()`/`buildPhraseQuestion` and `buildExercisePlan`.

---

## D. Repository-wide audit beyond the four features

| Area | What was checked on this tree | Result |
| --- | --- | --- |
| Application correctness | RC1 findings revalidated (modifier/IME shortcut guard, counted-label plurals, sprint gap/hand-off, practice isolation, history window, search highlight); full diff reviewed for scheduler changes | No regression found; `updateProgress` and statistics definitions untouched |
| Data integrity | All `--check` pipelines + validators; embedded payload digests vs base | Clean; payloads byte-identical |
| Persistence/compat | Twelve storage loaders unchanged; new code adds no key and no schema change; rc1 study configs and v1 backups round-trip (new tests) | Compatible |
| Security/privacy | New markup (`matchFirstLookBody`, phrase intro) escapes every data field like its neighbours; selector built with `CSS.escape`; `grep -c "fetch(" index.html` = 0; no external resource | Self-contained offline file preserved |
| Accessibility/UX | Board tiles keep `aria-pressed`/disabled semantics; focus restored after board re-renders; new strings localized vi/en (incl. counted-pattern sweep); content text (phrase usage/pattern) correctly stays in source language under protected selectors | No screen-reader claim |
| Performance | Availability still short-circuits (count stops at 3 candidates); board grouping is one queue scan per board; benchmark-contract tests in the Node suite pass unchanged | No new full-data scans on the render path |
| Build/CI/release | No workflow file changed; `DEPLOY_HOLD` advanced to the version the file declares, keeping the gate **closed**; version pins updated in tests | Gate not weakened |

Deferred, with reasons (also §G): classic (non-planned) sessions keep their pre-existing rotation and do not consult the exercise toggles — `mc4` is therefore offered where exercise configuration lives, the priority planner, exactly like the other seven types; changing classic-session semantics is a product decision outside this fix. The priority-group exclusion of not-yet-due learning/mastered words is documented product semantics (§B.3), reachable by other session types.

---

## E. Verification actually run

Baseline on the unmodified base commit first: Python **104 OK**, Node **98 pass**, all pipeline `--check`/validators clean — so every failure below is attributable to rc2's own changes, and none was left.

Fail-first: the seven new `rc2:` Node tests plus the updated eight-types test were run against the **rc1** `index.html`: **8 fail / 0 pass**. The reproductions behind them on rc1: a recall question for `allow` offered `permit` (same gloss) as a wrong option; `exerciseAvailability('mc_en_vi')` was `true` for a two-word pool producing a two-option question; `buildExercisePlan` built a board with meanings `[cho phép, cho phép, …]`; `turnNeedsFirstLook`/`applyMatchSelection`/`mc4` did not exist and `nextQuestion` forced `firstLook = false` for boards.

| Command | Result on this candidate |
| --- | --- |
| `python scripts/expand_vocabulary.py --check` | OK — 5,852 rows; 5,112 headwords, 740 forms |
| `python scripts/build_vocabulary.py --check` | OK |
| `python scripts/embed_vocabulary.py --check` | OK |
| `python scripts/build_phrases.py --check` / `embed_phrases.py --check` / `validate_phrases.py` | OK — 780 phrases |
| `python scripts/exams/embed_archive.py --check` | OK — 106 transcriptions |
| `python scripts/validate_vocab.py` | OK — 5,852 entries |
| `python -m unittest discover -s tests -p 'test_*.py'` | **104 tests OK** |
| `node --test tests/static-app.test.js` | **105 pass / 0 fail** (98 inherited, 7 new `rc2:` tests) |
| `node tests/browser-learning.cjs` (real Chromium) | **PASS** — Chromium 133.0.6943.0; full PASS line quoted in `AGENTS_LOG.md` |
| `node tests/browser-exams.cjs` (real Chromium) | **PASS** — Chromium 133.0.6943.0, 65 s |
| `python scripts/deploy_gate.py --repo coderunknow/Chuyen-Anh` | `deploy=false (release v1.0.0-rc2 is missing; deployment held)` |
| `git diff --check` | clean |

New browser evidence (in `tests/browser-learning.cjs`): a board of never-studied words opens on the board introduction with storage untouched; changing the left selection writes no grade and shows no error; completing pairs grades each word once; a wrong pair defers grading, then marks only the selected word while the misused meaning's owner still scores correct; an `mc4`-only session shows four options and grades once; the English config chip reads *Four-option multiple choice*. Two driver fixtures were corrected without touching app behaviour: the mixed-session turn log now confirms an introduction before logging its turn (an introduction and its question are one turn), and the phrase loop confirms the new phrase introduction. One real app defect the suite caught during development — phrase usage text in the intro was not under a protected selector, so English mode treated source content as UI copy — was fixed in the app.

**Not run, with reasons:** `pytest` (repository uses `unittest` + `node --test`); a screen-reader pass (none in sandbox); the speed benchmark as a release gate (its contract tests are inside the Node suite and pass; no performance claim is made from them).

---

## F. Versioning and release-gate state

`APP_VERSION` and `DEPLOY_HOLD` both name `v1.0.0-rc2`; `tests/test_deploy_gate.py` keeps enforcing that they agree. No tag, release, artifact or deployment was created or dispatched by this work, and no workflow was modified. The required order remains merge → annotated tag on the merge commit → build/verify assets from the tag → publish prerelease → Pages deploy.

## G. Residual risk

1. **Exam fidelity (inherited, unchanged).** 0 of 106 transcriptions are verified against a primary source and answer keys are unverified; see `docs/RC1_AUDIT_REPORT.md` §G (56 of 83 papers with a listening section have neither audio nor transcript, 4 a truncated transcript, 23 have no listening section).
2. **Gloss semantics.** ~5,000 editor-written Vietnamese glosses were not re-verified row by row; no validator here can catch a systematic semantic error. Shared glosses are now *handled* correctly, not *reviewed*.
3. **Classic sessions and exercise toggles.** Classic/quick/sprint sessions use the documented rotation/retrieval ladder and never consulted the exercise-type toggles; `mc4` joins them only through planned priority sessions. Unifying that is a product decision deferred beyond this fix.
4. **Cloze data sparsity.** Cloze still applies to exactly one headword (ID 448) until more verified examples exist; nothing fabricates sentences.
5. **Greedy board grouping.** Board construction is first-fit over the queue; a pathological ordering could in theory under-fill a board that an exhaustive matching would complete. The fallback is single-card turns — no word is lost — and session sizes make this vanishingly unlikely.
6. **Accessibility limits.** Automated DOM/ARIA checks and keyboard driving only; no screen-reader or real-device session.
7. **Browser suites outside CI.** Their evidence is reproducible locally (optional `playwright-core` + `@sparticuz/chromium`, installed outside the repo) but not enforced per push.
