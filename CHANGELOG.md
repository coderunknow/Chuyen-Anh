# Changelog

## v1.0.0-rc5 — meaning preview removed, real telemetry path, interface polish (2026-10-29, candidate)

**Status: release candidate in this pull request.** Tag and prerelease are created only after every gate on the branch is green;
the publication timestamp is recorded here and on the release page when that happens. Base: `77de95e` (the merged rc4 candidate,
PR #65). No vocabulary row, stored ID, gloss, family note, progress key or scheduling rule changes in this release.

### 1. “Only after answering” now removes the preview stage instead of masking it

rc4 kept the first-look stage and printed a fixed five-dot mask with one “show meaning” button per word. That left the stage in
the session as a panel whose only content was hidden, and a learner who chose to hide glosses still had to dismiss it. rc5 deletes
the surface. One predicate — `previewStageVisible(presentation, item)` = the preference **and** the item's own introduction rule —
decides whether the stage exists at all, for single cards, matching boards and the phrase-practice introduction alike. When it is
false the item is marked introduced for this visit and the exercise is built immediately.

Nothing else changes: `meaningConcealed()` still answers the separate question “may a *passive* surface print this gloss?”, and
required stimuli stay visible — the Vietnamese prompt of a recall or spelling card, a cloze's own sentence, the gloss options of a
recognition card, and a Vietnamese definition inside a Vietnamese→English completion. Graded feedback still reveals the answer.

Deleted: `MASKED_MEANING`, `revealedMeanings`, `meaningRevealed()`, `data-reveal-meaning`, `data-reveal-phrase`, the
`.meaning-masked` / `.meaning-dots` / `.meaning-reveal` rules and the `translatorExceptions` carve-out in the English translator.
A hidden gloss is now simply absent, and list layouts drop the column (`vocab-list--no-gloss`, `vocab-row--no-gloss`) instead of
holding an empty one.

### 2. Telemetry that actually arrives — and only when you press send

`index.html` can post the opt-in diagnostics log to the project's own serverless function
(`https://chuyen-anh-telemetry.vercel.app/api/telemetry`), which validates the request and stores it in Supabase Postgres. The
whole chain is in the repository: `api/telemetry.js` (Vercel, no dependencies), `app.js` (entrypoint), `vercel.json`,
`supabase/migrations/20261029_telemetry_ingest.sql` (the schema the project was migrated with) and
`tests/telemetry_endpoint_smoke.py` (live probes, run by `.github/workflows/telemetry-smoke.yml`).

* One `POST` per click, no retry, no background queue, `credentials: 'omit'`, 12 s timeout, at most 50 events (the client cap
  equals the endpoint cap) and only the coarse environment.
* Status codes are contractual: `202` stored, `400` rejected (bad contract, bad version, malformed body), `403` origin not
  allowed, `413` too large / too many events, `415` wrong content type, `429` rate limited with `Retry-After: 600`, `503`
  unconfigured or upstream unreachable. A failure never claims success and never removes the local log.
* The server rebuilds the stored payload from an allowlist; unknown fields, unknown event kinds, badly keyed counters and
  non-token names are dropped, notes are cut at the first quote and e-mail addresses are redacted.
* Database: schema `telemetry`, RLS on with **no policy**, no privilege for `anon`/`authenticated`, one `security definer`
  function executable by `service_role` only, 90-day retention enforced by writes, 10/10 min per client (salted HMAC of the IP,
  the IP itself is never stored) and 120/10 min globally.
* No credential is in the application, the repository or the docs; the endpoint reads `SUPABASE_URL`, `SUPABASE_SECRET_KEY` and
  `TELEMETRY_IP_SALT` from the Vercel environment.

### 3. Interface polish, both skins

A shared motion vocabulary (`--ease-spring`) with pressed states on buttons, options, switches and session cards; a tighter
chrome (64 px top bar, tighter panels and session cards) and a two-column Settings layout from 900 px, so the same content needs
less scrolling; hover lift suppressed on touch devices; and one `prefers-reduced-motion` block that removes the new transitions
and transforms for both Classic and Modern. No layout is rewritten and no control moves between screens.

### 4. Tests

`tests/telemetry-api.test.js` (13 tests) pins the endpoint contract; `tests/test_telemetry_api.py` (11 tests) pins the migration
and the wiring; `tests/static-app.test.js` gains the rc5 behaviour tests (stage skipping, absence of every mask token, passive
surfaces, the send path with an injected transport) and loses the rc4 assertions that pinned the mask. Each new assertion fails on
rc4 code: they assert the *absence* of masking and the *presence* of stage skipping.

## v1.0.0-rc4 — presentation and vocabulary-audit candidate (2026-10-29, prerelease)

**Status: published prerelease.** Tag `v1.0.0-rc4` (annotated) points at merge commit `88248ce`; the GitHub release was published
on 2026-10-29T05:50:13Z as a **prerelease**, and GitHub Pages deployed from that same commit (deployment `7405139291`, workflow run
`40825679415`). `DEPLOY_HOLD` still names `v1.0.0-rc4`: the gate held every merge-time push while the release was a draft, and
returned `deploy=true (release v1.0.0-rc4 is published)` only after publication — the documented ordering, not a bypass. Base:
`54ccaa0` (the merged rc3 candidate, PR #63), delivered by PR #64. This release adds no vocabulary row, changes no stored ID, gloss,
family note or progress key, and adds no new storage of learning data: the only new key is a presentation preference, and every
existing key keeps its shape.

### Added: show or hide Vietnamese meanings (Feature A)

- **One persisted preference, `chuyen-anh.presentation.v1`.** `{ meanings: 'show' | 'hide', interface: 'classic' | 'modern' }`,
  sanitised on read (unknown values fall back to `show` / `classic`), stored outside the v1 backup contract, and included in the
  cross-tab `storage` sync list. A damaged record cannot block boot, and a record that had to be repaired is written back at boot
  so the learner's next reload does not re-repair it.
- **The toggle stops being a decoration: it is the preference.** The flashcard header carries a `Nghĩa: hiện` / `Nghĩa: ẩn`
  button (`aria-pressed`, `aria-label`, `title`), and Settings carries the same control as a two-option group. Changing it
  re-renders the current screen without leaving the session: the queue, the current card, the typed spelling answer and the caret
  position survive the redraw.
- **Applied to every pre-answer surface**: the first-look introduction (single card and matching board), search rows, the
  dashboard weak-word list, the Settings flagged-word list and the phrase list. **Never applied** to a question stimulus or its
  options, to graded feedback, to the handoff strip or to the summary — the answer is already on screen there, and masking it would
  only make the correction unreadable.
- **No leakage path.** The mask is a fixed `•••••`, not the gloss length; while masked the row carries no `title`, no tooltip and
  no gloss-bearing `aria-label`, only a per-row “Hiện nghĩa” button whose label names the headword.
- **Explicit per-word reveal.** `revealedMeanings` is a `Set` scoped to the running view. Revealing one row shows that gloss and
  nothing else: the global preference stays `hide`, nothing is written to storage, and no progress, scheduler field, streak, XP,
  session count, accuracy or mastery number is touched. A preference change clears the set, so an old peek never reappears.
- The new Vietnamese strings are in the English dictionary as whole-string entries (`Show Vietnamese meanings`, `Meanings: hidden`,
  `Show meaning`, `Interface style`, …); the regex pattern table gained no substring rule, so no vocabulary or exam text can be
  rewritten by the translator.

### Added: Classic and Modern interface modes (Feature C)

- **A real second design system, not a palette swap.** `document.documentElement.dataset.ui` selects the skin; every selector,
  element, event handler, scheduler path and storage key is shared. Classic remains the existing “Premium Academic” design;
  Modern is **Studio**: warm paper and ink, a dark masthead with a horizontal segmented navigation band instead of the left rail,
  flat bordered panels with hard offset shadows, squared controls, monospaced counters and uppercase mono labels, an editorial
  page header, table-style search rows, a wide worksheet-style flashcard with a left accent spine, and its own type scale,
  spacing scale and breakpoints (940px / 680px / 380px).
- **Two discoverable switches**: a segmented control in the top bar (hidden below 680px, where vertical space is scarce) and a row
  in Settings. Both are real buttons with `aria-pressed`, both persist, and the choice survives reload.
- **Switching cannot lose work.** The switch redraws the shell only. A running session keeps its queue, card, answered state,
  revealed flags and typed answer; a second tab follows through the `storage` event.
- **Motion.** Modern adds a staggered rise-in for content blocks, a pop on feedback, a press-and-release on controls and a
  cross-fade for the interface change, all CSS-only, all short (120–240 ms), none of which moves layout or steals focus. The
  existing `prefers-reduced-motion` block now also disables every Studio animation, and the Classic motion set is unchanged.
  No achievement, XP or completion animation was invented for this release.

### Added: full vocabulary audit (Feature B)

- **`scripts/rc4_vocabulary_audit.py` → `docs/rc4-vocabulary-audit.{json,md}`** (`--check` fails when the report no longer
  matches the data). It classifies all **5.852 rows** exactly once: **5.112 headwords** = **3.841 KEEP** in the focus deck +
  **1.271 EXCLUDE_BASIC** archived + **740 family forms** documented on their headword; **3 REVIEW**; **0 corrected**; **0 added**.
- **The exclusion is replayed, not asserted.** The reviewed curation map is re-run through the shipping engine
  (`scripts/vocabulary_curation.matched_rows`) against the Markdown table: **1.271 decisions = 1.271 stored archived rows**,
  0 missing, 0 extra, 0 category mismatches, 0 engine problems. The audit also re-checks that no archived row can enter the study
  deck, that every family form points at a headword that agrees with it about curation, and that every archived row declares one
  declared category.
- **`docs/curriculum-grades-6-9.json`** records the curriculum words actually read for this audit — 201 words from the Global
  Success grade 8 and grade 9 unit tables plus the grade 6 and grade 7 topic lists — each with its source URL and retrieval date,
  and a stated limitation that grades 6 and 7 publish no per-unit word table in the retrieved documents. Cross-check:
  **82** of those words are in the bank, **14** excluded, **68** still taught, and **0** unexplained retentions — every
  curriculum-level (A1–B1) word still in the deck is a family root, which is the documented exemption.
- **The high-quality inclusion standard is measured instead of claimed.** Word families (**862** retained headwords), editorial
  notes (**294**), word-formation (**79**), academic register (**1.037**), confusable pairs (**34**), linkers (**59**), idioms
  (**24**), phrasal verbs (**13**) and collocations (**9**) are present; `synonyms`, `antonyms`, `collocations` and `examples`
  are empty on all but a handful of rows. The report states that gap as a gap. Filling those fields needs a source per row, so
  nothing was invented to make the numbers look complete.
- **The REVIEW queue is three rows** whose stored Vietnamese gloss repeats the English headword (`proton`, `gluten`,
  `cholesterol`). They stay exactly as they are until an editor supplies a gloss; no row was auto-archived, re-IDed or rewritten.

### Fixed

- **The English localiser skipped text inside a protected element.** The masked gloss is a protected presentation surface, so the
  early return meant its label and reveal button stayed Vietnamese in English mode. `localizeSubtree` now exempts the mask
  descendants (`translatorExceptions`) while still refusing to translate the gloss cell itself, and the gloss is never fed to the
  dictionary at all.
- **A damaged presentation record stayed damaged.** `loadPresentation` already fell back to defaults, but the broken value was
  left in storage; boot now writes the sanitised record back when it differs, so the fallback is not silently re-computed forever.
- **A duplicated `.ui-switch` wrapper in the top bar** (introduced while building this candidate) produced two nested switches;
  the markup now emits one.
- **The phrase-practice introduction ignored "hide meanings".** Found by the release-gate audit, not by CI: the word
  first look conceals the gloss, but the phrase bank's own "Cụm mới · học trước khi kiểm tra" introduction printed it in
  clear text, so a learner who had hidden meanings saw the answer before the phrase was quizzed. It now uses the same
  fixed mask with one per-phrase reveal control (`data-reveal-phrase`), which reveals that phrase for this visit only:
  the preference and the stored phrase progress are untouched, and focus moves to “Bắt đầu kiểm tra”. The pre-answer
  surface test now covers this screen explicitly, and was checked by reverting the guard (test red) and restoring it.
- **The new top-bar switch pushed the document sideways at 768 px.** CI's browser suite caught it
  (`browser-learning.cjs:66`, "the tablet breakpoint does not introduce horizontal overflow", run 40720178176). The compact copy is now
  hidden below 1025 px and Settings keeps the selector, which restores the pre-rc4 top-bar geometry; the phone layout is untouched because
  it never showed the compact copy.
- **Two accessible-name defects in the new controls.** The card toggle carried an `aria-label` that paraphrased its visible text and the
  mask's dots carried their own label, both of which fail axe's `label-content-name-mismatch` rule. The toggle is now named by its own text
  (`Nghĩa: hiện` / `Nghĩa: ẩn` + `aria-pressed`), the dots are `aria-hidden`, and the English reveal labels keep the visible words
  (“Show meaning of …”) so the name still contains the label.

- **The candidate still shipped an rc3 version pin.** CI's second browser run (40720987107) failed the first card assertion because
  `tests/browser-learning.cjs:517` still expected `#app-version` to read `'v1.0.0-rc3'`. A version bump is not done until every literal
  agrees, and the browser suite carries its own; it now expects `'v1.0.0-rc4'` like the other pins. No application code changed.
- **The new Settings rows displaced a keyboard stop.** CI's third browser run (40721747824) failed at `browser-learning.cjs:597`:
  the meanings and interface rows sat between the theme selector and the shortcuts switch, so the fourth Tab stop was
  `setting-meanings-show` instead of `keys-setting`. The two rows now follow the session-size selector, restoring the long-standing
  order (language → theme → shortcuts → session size → meanings → interface). The existing assertion was not relaxed — a tab-order
  test edited to match a new layout stops being a regression test.
- **Two more rc3 version literals sat in the browser suite.** CI's fourth run (40723536730) failed the About-panel assertion
  (`browser-learning.cjs:2833`, expected `/v1\.0\.0-rc3/`) and would have failed the next one
  (`report.appVersion`, line 2894) for the same reason. Both now read `v1.0.0-rc4`. To stop the class of bug rather than the instance,
  `tests/static-app.test.js` gained *every shipped version literal agrees with APP_VERSION*: it reads the version from the module,
  collects the version a pin names in `index.html`, `PRIVACY.md`, both browser suites and the two Python version tests, and fails on any
  value that is not the shipped one (the deploy-gate fixtures that name `dev5`/`rc2` on purpose and the changelog are exempt). It was
  checked by reverting one pin to `rc3`: the test failed, and passed again when the pin was restored.
- **Two phone-width overflow risks removed** (found while hardening, not by CI): a masked gloss inside `.vocab-row` no longer forces
  `grid-column: 3`, so the desktop grid auto-places it while the ≤680px rule keeps its own full-width placement instead of reusing a
  four-column span inside the three-column mobile grid; and `.flashcard-head` / `.flashcard-head-actions` wrap below 680px so the
  card's fourth header control cannot widen a 320–375px card.

### Tests and verification

- The stylesheet parses at **893** rules / **105.653** bytes after the phone-width rules (891 / 105.363 before them).
- `tests/static-app.test.js`: **120** node tests (115 before this candidate). The sync-key pin now expects
  `chuyen-anh.presentation.v1`, the localiser guard asserts the new conditional return, four rc4 tests cover the preference,
  the concealed surfaces, the separation between presentation and scheduling, and the second layout, and a fifth cross-checks
  every shipped version literal against `APP_VERSION`.
- `tests/test_rc4_vocabulary_audit.py`: **11** new Python tests for the reconciled counts, the policy replay, the deck boundary,
  the family-link agreement, the curriculum evidence file, the review queue and report staleness.
- Python suite: **141** tests (130 before this candidate). Static data chain unchanged and green.
- Browser suites (`tests/browser-learning.cjs`, `tests/browser-exams.cjs`) **cannot run in the build sandbox** (Chromium cannot be
  downloaded here: `npx playwright@1.55.1 install chromium` fails with `ECONNRESET`), so they were **run by CI instead**. After four
  failing runs — each one a real defect, listed under *Fixed* — the final run on this head (**40818141160**, commit `26fb144`) reports
  `checks` **pass** and `browser` **pass** (5m28s, both suites sequentially). They are the only visual review either interface received:
  no pixel inspection at 320/768/1280 px was possible locally, and no physical-device check was made.
- The jsdom DOM-level suite (**43/43**), the axe `label-content-name-mismatch` audit and the six-view/two-skin console sweep were run
  locally against the same `index.html`; the sandbox scratch harness that hosted them was lost when the session's `/tmp` was reset, and
  they were last executed on commit `584b5ed`, whose `index.html` is byte-identical to this head (`git diff 584b5ed 26fb144` touches only
  tests and logs).
## v1.0.0-rc3 — quality hardening candidate (2026-10-28, NOT released)

**Status: unreleased candidate.** `APP_VERSION` and `DEPLOY_HOLD` both name `v1.0.0-rc3`; no tag, release, prerelease or deploy
exists for it, and the Pages gate reports `deploy=false (release v1.0.0-rc3 is missing; deployment held)`. Base: `15a4615`
(the published rc2, PR #62). This release adds no headword and changes no stored ID, gloss, family note or progress key.

### Vocabulary: the 923-word review queue, classified instead of deleted

- **`scripts/vocabulary_evidence_review.py`** writes `docs/vocabulary-evidence-review.{json,md}`: all **923** focus headwords without
  an `exam-corpus` source are classified by cause, each with a locator when one exists — **14** whole phrases occur in a
  transcription, **188** have only a regular inflection/derivation in the corpus (`endorsed` for `endorse`), **5** are multi-word
  items whose parts occur in one paper but not together, **5** are word-formation/confusable items the exam tests directly,
  **698** rest on a dictionary locator only, and **13** have no basis found and are named for manual review.
- **No row was removed, archived or rewritten** by this review. The report separates "not in the corpus" from "not needed": the
  corpus covers 106 papers, and the absence of a word there is not evidence against it.
- Surfaced gap, kept visible rather than patched: the builders attach a dictionary locator only to single-word entries, so
  **0 of the 61 multi-word headwords** carry one. Every phrase/idiom row therefore rests on the learner list plus whatever corpus
  evidence it has, and the review records that per row (`dictionaryLocator`). Adding Cambridge slugs for multi-word entries without
  being able to open them would be an unverifiable claim, so it was not done.

### Exam provenance: measured, and two claims corrected

- **`scripts/audit_exam_provenance.py`** writes `docs/exam-provenance-audit.{json,md}` and recomputes every content hash:
  **106/106** transcriptions match the `sha256_noi_dung` in their own front matter, so a hand edit to a transcription now turns a
  test red. The reproduction that found this is `tests/test_evidence_reports.py`.
- **The archive depends on one source.** All 106 papers were captured from `tailieudieuky.com`, a republisher; **0** papers have an
  official Sở/trường source and **0/106** were compared with an official original.
- **Answer claims measured:** 74 papers claim answer content, 66 have an answer section or answer table in the stored body, and
  **8** have neither (named in the report; front-matter labels left untouched because the answers may have been lost during
  extraction). One of the eight was read line by line: `2026-quang-tri-so` carries only a speaking marking guide.
- **Manual cross-checks recorded in `docs/exam-crosschecks.json`:** Hải Phòng 2025 5/5 anchors, Đắk Lắk 2023 6/6 anchors
  (including four answer entries) with one page-count difference, Bình Dương 2025 4/4 anchors. These are independent
  *reproductions*, not originals, and the file says so.

### Added: an opt-in diagnostics log the learner sends themselves

- **Settings → Privacy & diagnostics log.** Off by default; consent is stored with the moment it was given
  (`chuyen-anh.telemetry-consent.v1`), and an `enabled` flag without a recorded decision is not treated as consent.
- **Local only.** The log is at most **200** events in `chuyen-anh.telemetry.v1`. The application contains no `fetch`,
  `XMLHttpRequest` or `sendBeacon` and no endpoint: the learner clicks **Tải nhật ký JSON** and forwards the file to
  [the project's issues](https://github.com/coderunknow/Chuyen-Anh/issues) if they choose to. A test asserts that the app script
  has no transmission path at all.
- **Narrow by construction.** An event is `{at, kind, name, counters, note}`: `kind` from a fixed list, `name` a short token, at most
  **six** finite counters, and a note that is cut at the first quote character and stripped of e-mail addresses and control
  characters — so a `JSON.parse` message cannot carry the snippet the learner typed. Answers, typed text, search queries, words
  studied, backup contents, user agent, device ids, timezone, IP address and the exact viewport are never recorded; the report
  states that list (`notCollected`) and buckets the viewport as mobile/tablet/desktop.
- **Real control.** Withdrawing consent deletes the log immediately (the key is removed, not emptied), and the log can be cleared
  without turning it off. Events are recorded for boot, session end (counters only), opening Tra cứu, backup export/import outcome
  and uncaught errors — never per card.
- `PRIVACY.md` documents the same contract in Vietnamese and English. New test:
  *the diagnostics log is opt-in, local, bounded and free of learner content* (static) plus a browser scenario covering default-off,
  consent, a downloaded report, erasure and the English interface.

### Performance: a card is generated from memoised row keys, not re-keyed per card

- **Measured first.** Building one question walks all 5.852 rows and keys each candidate's text twice (`normalize` for visual
  distinctness, `normalizeTyped` for the typed-answer contract) plus splits its part of speech. On this machine that cost
  **24 ms median / 25,1 ms mean** per card (200 cards, `p90` 30 ms) and **425 s** for the whole deck in three modes — the reason
  the static test suite took ~7,5 minutes.
- **Fixed at the source, semantics untouched.** `index.html` memoises the two option keys per row and field (and the part-of-speech
  split) in `WeakMap`s. Nothing in the application assigns to `word`, `meaning` or `pos`, so the memo cannot go stale. The
  candidate rules — same part of speech first, never the answer's own text, never a peer recorded with the same gloss — are the
  same code, now fed by cached keys.
- **After, same harness:** **3 ms median / 3,3 ms mean** per card (`p90` 4 ms), and **54 s** for the whole deck in three modes
  (425 s → 54 s). The first card of a session still pays the fill (~53 ms before, 54 ms after), so the win is per subsequent card,
  not a faster cold start.
- **Equivalence evidence.** With one seeded `Math.random` replayed for both builds, the old and new implementation returned the
  same option ids, order and correctness flag for **all 17.556** (record, mode) pairs — 0 mismatches. The static test that
  computes the expected same-part-of-speech distractor count independently still passes for every row.
- **Test-side work on the same cost.** The distractor-plausibility test now unions the distinct option texts per part-of-speech
  token (memoised) instead of walking every peer of every row — the same number, proven equal on all 17.556 pairs — and looks
  options up by id index instead of `Array.find`. `node --test tests/static-app.test.js` went from ~7,5 min to **1m54s** for the
  same 114 tests.

### Fixed: the flaky Space-shortcut step in the browser suite (test-only)

`tests/browser-learning.cjs` failed in CI (job `122763067884`, `browser-learning.cjs:761`, "a revealed spelling card cannot be
typed into") while passing locally. A card that owns an input moves focus into it from `setTimeout(…, 0)`; the suite blurred the
page and pressed Space immediately, so when the focus task landed **between** the blur and the keypress, Space was typed into the
input and the document handler never saw it. Reproduced by delaying that task: with the timer landing 2 ms after the blur the old
sequence failed with exactly that signature (`#spelling-input` focused at press time, no `.reveal`, input still enabled), while
the card itself behaved correctly in every other ordering. All five Space-shortcut steps now share `pressSpaceShortcut()`, which
lets the card's focus land, blurs, retries if it lands again, and asserts that the document — not an input — owns the key before
pressing. **Application code is unchanged by this fix**; it removes a race in the test, not a defect in the app.

### Process: browser suites in CI, and a truthful deploy gate

- **Both browser suites now run in CI** as a second job (`browser` in `.github/workflows/ci.yml`), after the static job, through
  `tests/run-browser-suites.sh`, which runs them **sequentially** and stops at the first failure. `playwright-core` is installed
  only in that job; the app remains one HTML file with no runtime dependency. Prior to this, both suites were outside CI.
  The first CI run of the job **failed after 1m14s** against the runner's preinstalled Chrome; the job now installs Playwright
  1.55.1's own Chromium (`--with-deps`) and points `BROWSER_EXECUTABLE` at `chromium.executablePath()`, and both suites pass
  (job 6m45s, alongside a 12m14s `checks` job). Failures are echoed as 40-line annotations because GitHub's job log lives behind a
  blob URL that is not always reachable.
- **`scripts/deploy_gate.py` no longer blames the release for a missing input.** A local run without `--repo`/`GITHUB_REPOSITORY`
  used to print "release v1.0.0-rc2 is missing" while the release was published; it now holds the deploy and names the missing
  repository. Covered by two new tests.
- The three evidence `--check` commands were added to the CI check step and to the deploy workflow, so a stale report blocks a
  deploy instead of shipping next to outdated evidence.
- `APP_VERSION` and `DEPLOY_HOLD` synchronised to `v1.0.0-rc3`; version pins updated in `tests/static-app.test.js`,
  `tests/browser-learning.cjs`, `tests/test_sprint_exam_features.py`, `tests/test_deploy_gate.py`.

### Still not done

No merge, tag, release, deploy or version publication; no new headword; no gloss re-editing; 0/106 papers verified against an
official original; browser timings are not re-claimed (see the rc2 performance section — only the search prewarm was outside the
noise), and the new per-card figure is a Node-side measurement of `generateQuestion` over the shipped deck, not a browser
transition measurement — the visible effect was not re-timed in Chromium.

## v1.0.0-rc2 — release candidate (2026-10-26; published as a prerelease 2026-10-27)

**Status corrected on 2026-10-28.** The text below was written while rc2 was still a candidate; GitHub now shows tag `v1.0.0-rc2` on commit `15a4615`, a published prerelease (2026-10-27T14:06Z) with HTML/ZIP/checksums assets, and a successful Pages deployment of `15a4615` at 14:21Z. The original wording is kept below for history. This section describes the state of the RC2 branch (`arena/526d4d8f-chuyen-anh`) on top of `b72a9c6`, the merged `v1.0.0-rc1` candidate, which was tagged `v1.0.0-rc1` on that merge commit and published as a prerelease on 2026-10-25 (verified on GitHub before this work started; the rc1 section below predates that publication and its "NOT released" status line is corrected by this note). No `v1.0.0-rc2` tag, GitHub Release or prerelease exists, no deployment was performed or dispatched, and Pages is unchanged. `DEPLOY_HOLD` names `v1.0.0-rc2`, which has no published release, so the deploy gate reports `deploy=false (release v1.0.0-rc2 is missing; deployment held)` and the gate is **closed**. The audit report is [`docs/RC2_AUDIT_REPORT.md`](docs/RC2_AUDIT_REPORT.md).

### Added: a selectable four-option multiple-choice exercise

- A new exercise type **Trắc nghiệm 4 phương án / Four-option multiple choice** (`mc4`) appears in the study configuration alongside the existing types and mixes into priority sessions like any of them. It generates through the same recognition path and grader as `MC_EN_VI` — one authoritative implementation — under an explicit contract: exactly four distinct options (same part of speech first), exactly one correct option whose key follows the option through the shuffle, and never a distractor recorded with the same gloss as the answer. If three distinct distractors genuinely do not exist, the question is flagged `unavailable`, counted as dropped and skipped ungraded instead of being shown short. Off by default (the directional multiple-choice types are already on); rc1 study configurations and v1 backups keep their exact meaning.

### Fixed: changing a matching selection could grade a pair the learner never completed

- Matching resolution used to be render-driven: a both-selected state was resolved on a timer after a re-render, so grading was a property of rendered state rather than of the completing click, and a wrong pair marked **both** implicated words as missed. Selection is now one pure transition (`applyMatchSelection`): picking another tile in the same column only moves (or clears) the selection and can never grade, persist or count; an attempt exists only in the transition that fills the empty column, clears both selections with it, and cannot repeat. A wrong pair now misses only the selected word's first pass; the word owning the misused meaning tile keeps its own. The wrong-pair flash marks exactly the two clicked tiles (it previously marked the meaning belonging to the picked word, leaking the pairing) and clears on the next selection.

### Fixed: matching boards and unseen phrases skipped the new-word introduction

- Every match turn forced `firstLook = false`, so never-studied words were graded on a board before their meaning had ever been shown. One predicate (`turnNeedsFirstLook`) now covers single cards and boards: a board with still-new pairs opens on a board introduction (word, part of speech, meaning, recorded metadata and examples) and is only built after it is confirmed; confirming an introduction writes nothing. Unseen phrases get the same introduction stage in the phrase bank (`needsPhraseFirstLook`).

### Fixed: questions could mark an equally correct answer wrong, and boards could be ambiguous

- The data records one gloss for several headwords (150 shared-gloss groups, 319 headwords). Recall questions could offer a same-gloss headword as a wrong option, phrase questions likewise (23 groups, 48 phrases), and a matching board could contain two identical meaning tiles. Distractor construction now excludes same-gloss candidates for gloss-prompted questions, and boards are grouped only from distinct words and distinct meanings (`isUnambiguousMatchGroup`); words that cannot join a board stay in single-card turns. Multiple-choice availability now requires a full three-distractor pool (`countDistractorCandidates`) instead of a single distractor, so a short option set is never presented as available. No vocabulary row was changed: the embedded data blocks are byte-identical to rc1.

### Audited: vocabulary coverage reconciles completely

- 5,852 rows, 5,112 headwords, 740 merged same-root forms, 780 phrases, 106 exam transcriptions — recomputed, with Markdown/JSON/embedded synchronization clean. Every headword is reachable through lookup and a new-word session (all 5,112 exactly once), and per-exercise eligibility is: `mc_en_vi`/`mc_vi_en`/`mc4`/`fill_vi`/`match`/`flashcard` 5,112; `fill_en` 5,109 (three notation entries — IDs 522, 526, 547 — fall back to recall); `cloze` 1 (only ID 448 has a recorded example; none is invented). The priority groups' exclusion of not-yet-due `learning`/`mastered` words is documented product semantics, with classic/sprint/random/favourites as the reaching paths. Encoded as a reconciliation test so drift fails loudly.

### Tests

- Seven new Node regression tests (`rc2: …`) plus the eight-exercise inventory test; all eight **fail on the rc1 tree** and pass here. A new Chromium scenario drives a board of new words (introduction first, storage untouched), left-selection changes (no grade, no error), wrong-pair semantics, and an `mc4`-only session; two browser driver fixtures were aligned with the introduction stages. Final matrix on this tree: Python 104 OK; Node 105 pass / 0 fail; both Chromium suites PASS; all pipeline `--check` commands clean; deploy gate closed.


### Added: a curated focus deck, and an About panel that states what ships

- **Vocabulary curation (priority 1 of this review).** 1.271 of the 5.112 headwords are now reviewed out of the learning deck (`curation:archived` + `curation-category:<id>`), leaving **3.841 focus headwords**. Four categories with a written rationale and evidence — `basic-b1` (516), `everyday-object` (403), `food-drink` (189), `nature-species` (163) — plus 15 hand-checked exceptions that stay in the deck (`ability`, `abroad`, `advice`, `choice`, `interest`, `lose`, `marriage`, `quite`, `lung`, `muscle`, `canvas`, `sole`, …) because each has a measured reason: word-formation or confusable value, a phrase already in the bank, or attested lines in the transcriptions. `artery`, `kidney` and `fuse` were proposed as keepers and then **reversed** — 0/106 transcriptions each — and the reversal is recorded in `docs/vocabulary-curation.json → reviewNotes`. **No row was deleted, no ID changed, no progress touched**: an archived row stays in the table, in `data/vocabulary.json`, in backups and in Search (marked “Lưu trữ”), but it never enters a session, a count or a distractor pool. The 913 legacy rows, every family head and every `word-formation`/`confusable`/`linker` row are exempt by rule.
- **A deterministic quality audit** ([`docs/vocabulary-quality-audit.md`](docs/vocabulary-quality-audit.md), `scripts/audit_vocabulary_quality.py`) that recomputes every count from the repository: provenance claims (5.105/5.112 match, 7 explained by the cited inflected form, 0 unexplained), corpus coverage, **1.489 automatically extracted multiple-choice items** across the 106 transcriptions (1.286 focus headwords appear in at least one item), and a **923-row review queue** of focus headwords with no transcription evidence — flagged for review, never asserted as wrong. `--check` passes, so the artifact provably matches the data.
- **Exam evidence now excludes the archive's own bookkeeping.** `vocab_sources.exam_text()` strips front matter, URLs, the “Nguồn và giới hạn” section and provenance blockquotes before counting; `document` fell from 106 to 4 papers, `file` 106→8, `download` 29→6, `export` 26→2, and `zip` lost its only exam claim. Seven citation rows now quote the surface form the cited line actually shows.
- **About panel** in Settings: real app name and mark, `APP_VERSION`, the MIT licence read from `LICENSE` (a test fails if the embedded copy drifts), and a two-sentence purpose. Per-word Info stays out of this release (v1.1.0 scope).
- **Perceived performance**: the search index is built while the browser is idle after the first screen, so opening Tra cứu no longer pays the index build — median in-page click cost **86 ms → 34 ms** (5 runs per build, same harness; figures recorded in `DESIGN_LOG.md`); `normalize()` takes an ASCII fast path and the search filter reuses precomputed part-of-speech keys; the data fingerprint is computed on first read instead of at boot. Boot (DCL 698 → 688 ms) and typing (~9 ms) are unchanged within noise, and the 10 MB single-file payload remains the dominant boot cost.
- **Fixed: every corpus locator now points at the line it describes.** Filtering the archive's own bookkeeping out of the evidence text moved the line numbers, so all 4.647 vocabulary and 492 phrase locators drifted and cited empty or unrelated lines — the evidence was unreadable even though the counts were right. `vocab_sources.exam_lines()` now returns `(file line, text)` pairs and every consumer (index, multiple-choice items, phrase index) uses it; a sampled check of 477 locators went from 477/477 wrong to 0/477 wrong, and the new `tests/test_evidence_locators.py` walks all 5.139 locators and requires the cited line to show the claimed form.
- **Phrase claims now count papers, not lines.** `build_phrases.py` reported `phrase occurs in N transcribed exam(s)` where N was the number of matching lines, so a phrase seen twice in one paper claimed two papers (67 of 160 sampled rows were overstated). N is now the number of distinct papers, verified for all 492 corpus-backed phrases by the same test file.
- **Multi-word headwords no longer claim the whole phrase.** Their count was always "papers where every word occurs", but the row said "form occurs in N papers" while the locator showed one component; the claim now reads "headword words occur in N transcribed exam(s); the locator shows ‘x’", and the audit parses that wording instead of drifting from it.
- **UI**: archived rows get a dashed edge and a muted “Lưu trữ” pill; a skip-to-content link is the first tab stop (translated in English); screens fade in over 180 ms and every new transition respects `prefers-reduced-motion`.

## v1.0.0-rc1 — release candidate, NOT released (2026-10-25)

**Status: unreleased candidate.** This section describes the state of the RC1 branch. No `v1.0.0-rc1` tag, GitHub Release or prerelease exists, no deployment was performed or dispatched, and Pages is unchanged. `DEPLOY_HOLD` names `v1.0.0-rc1`, which has no published release yet, so the deploy gate reports `deploy=false (release v1.0.0-rc1 is missing; deployment held)` and the gate is **closed**. The published prereleases are still `v1.0.0-dev1`…`dev5` and `v1.0.0-beta1`…`beta8`; `v1.0.0-beta8` remains the newest published build.

### What this candidate is

A full audit build on top of `v1.0.0-beta8` (`38f92a3c2129a08349dc99deac6e675a722c099f`): every claimed number was recomputed from the data, every defect below was reproduced before it was fixed, and each fix carries a regression test. The audit report with the full evidence, test matrix, performance figures and residual risks is [`docs/RC1_AUDIT_REPORT.md`](docs/RC1_AUDIT_REPORT.md).

### Fixed: a modified key pressed a flashcard shortcut (highest-impact defect)

While a session was open, `Ctrl`/`Cmd`/`Alt` combinations reached the flashcard shortcut handler. Reproduced in Chromium at RC1: pressing **Ctrl+F** added the current word to the hard-word list (`chuyen-anh.flagged.v1` went from `[]` to `["2"]`) and called `preventDefault()`, so the browser's Find-in-page never opened; `Ctrl+R` would have queued a practice retry instead of reloading, and `Ctrl+1…4` would have answered a card instead of switching tabs. The handler now ignores any chord (`acceptsShortcutKey`), while single unmodified keys keep working. Covered by *a modified key is never a flashcard shortcut* plus a real-browser reproduction.

### Fixed: the exam audit ledger contradicted itself

`docs/EXAM_AUDIT_LEDGER.md` shipped three unrendered template placeholders (`{len(listen_missing)}`, `{len(no_listen)}`, `{len(speaking_papers)}`) in its listening summary, and its `insufficient-source` definition named the wrong second digital paper: it claimed `2023/binh-thuan/so` carried "18 Private-Use-Area glyph substitutions and incomplete listening material", while the file contains no Private-Use-Area codepoints, the row is `partially-supported`, and the second digital paper that actually carries the tier is `2025/thai-nguyen/so` (partial multiple-choice key). The placeholders are now `56` / `23` / `2` and the definition names `2022/ha-noi/so` and `2025/thai-nguyen/so`. Every figure was derived from the ledger's own per-paper rows, and the 106 rows, the tier distribution (61/21/24), the 11-paper/248-codepoint Private-Use-Area inventory, the 91 graded papers and the 3,472 parsed questions (2,402 multiple-choice + 1,070 short-answer) were independently re-verified against the archive. Covered by three new tests in `tests/test_exam_audit_ledger.py`.

### Fixed: README stated a stale vocabulary size

The opening paragraph claimed **5,205 headwords** and **647 same-root forms** while the data holds **5,112** and **740**, and while the same file stated the correct numbers further down. Corrected, and pinned by `tests/test_readme_counts.py`, which recomputes every stated count from `data/vocabulary.json` and `docs/vocabulary-families.json`.

### Fixed: counted English labels used the plural for a count of one

Seven learner-facing labels always used the plural: `1 turns`, `1 turns left`, `Longest 1 days`, `1 pairs · 1 board`, `1 words · 1 board`, `1 words / session`, `1 results` (and `1 cards` in the session/mode lines). A single `pluralCount(count, singular, plural)` helper now backs every counted pattern. Two strings also stayed Vietnamese in English mode — the `N từ mới` counter in the priority panel and the archive-scope sentence in the exam sidebar ("Nguồn đăng lại; 22 bản HTML/OCR cần soát…") — and are now translated. Covered by *English counted labels use singular and plural forms* and *the exam archive scope panel is localised in English*.

### Fixed: four stale expectations in the optional browser suite (test-only)

`tests/browser-learning.cjs` had not been able to pass since before this branch, and because it is not part of CI nobody saw it fail. Four fixtures had drifted from the code: **card order** (a favourites session starts with the first seeded id `298`, but the app follows vocabulary order, so `2` comes first — D-11); **skip behaviour** (`#skip-card` rotates the skipped card behind the other pending one and adds no turn, it does not leave the same card in front); **introduction order** (a skipped introduction returns later in the same session rather than in a fixed order); and **the search total** (searching `advers` matches one record, because since the beta7 family merge `Adversity` id 1 is a form of `Adverse` id 298 — D-12, three fixtures). The fixtures now resolve the card on screen from its own prompt and derive the expected number of matching headwords from the shipped data; every behavioural assertion is kept, and the application was **not** changed for these findings. `node tests/browser-learning.cjs` now passes in 208 s.

### Fixed in review round 2: a Shift chord still pressed a shortcut, and twenty counted labels stayed plural

CodeRabbit's review of this candidate, plus an independent sweep written to check its claim, found two more real defects; both were reproduced on the reviewed head (`edd2ede`) before being fixed.

- **`Shift` was not treated as a modifier (D-13).** `acceptsShortcutKey` rejected `Ctrl`/`Cmd`/`Alt` but not `Shift`, so with a session open **Shift+F** wrote the current word into `chuyen-anh.flagged.v1` (`[]` → `["298"]`) and **Shift+Space** revealed the answer. Shift+Space scrolls a page up and Shift+letter is how a capital letter is typed, so both chords belong to the learner, not to the card. Fixed in the helper and covered by a new browser scenario that presses ten real chords (`Ctrl+F`, `Ctrl+R`, `Ctrl+1`, `Ctrl+Space`, `Alt+1`, `Shift+F`, `Shift+R`, `Shift+Space`, `Shift+Enter`, `Ctrl+Shift+F`) through the registered `document` handler and asserts that none of them reveals, grades or writes anything. Plain `f` and `Space` still work.
- **"Every counted pattern" was too strong (D-14).** Twenty distinct English labels, coming from 21 pattern entries plus one inline summary line, hard-coded the plural. This entry said **ten** when it was written; review round 3 recomputed the figure from the diff and from the pre-fix build and corrected it here, in the audit report and in the logs. Three labels were reproduced end-to-end in Chromium with ordinary data: `1 / 1 turns` (the header of a one-card session), `Practice retries: … / 1 turns` (one retry), and `You have missed this word 1 times` (the note on the *first* wrong answer). Two are provably latent because `formatNextReview` builds English directly, so a Vietnamese count of one never reaches the table (`in 1 days`, `in 1 hours`). The remaining fifteen — `1 phrases`, `1 phrases.`, `1 phrases · first 1 shown`, `Flashcards · 1 words`, `Flashcards · 1 headwords`, `Search … · 1 words.`, `Search … · 1 headwords.`, `/ 1 turns · 1 left`, `Graded 1 items`, `Match pairs · 1/1 pairs`, `Study sprint · 1 words / session`, `Queues 1 prioritised words`, `The sprint keeps … (1 words per session)`, `Consolidation: … / 1 turns`, `1 eligible words · 1 queued · 1 due · 1 weak` — need a one-item data set or a screen state this audit did not build, and are recorded as latent rather than claimed as reproductions. All now use `pluralCount`, and a new test derives a count-of-one sample from **every** pattern in the shipped table (104 samples from 108 patterns; four are non-counted selectors), so a future pattern that forgets the singular fails instead of reaching a learner.
- **Four inconsistencies in the audit report itself (D-15).** A table row broken by a literal pipe inside a cell, a byte count that was really a character count of an older build, an evidence-tier sentence that double-counted the two digital papers already inside `insufficient-source`, and a listening tally that said 55 where the ledger says 56. All corrected, and each is now derived from the data by a test rather than retyped.

No learner data, vocabulary row, phrase, exam transcription, answer key or ID was changed in this round, and nothing was released.

### Fixed in review round 3 (third CodeRabbit review, `5641732787` on `706c247`)

Five findings, all reproduced before being changed; nothing in the data, the vocabulary, the phrases, the exam transcriptions, the answer keys or the IDs was touched.

- **A counted label chose its noun from a Vietnamese-grouped number (D-17).** The search-count pattern passed the raw capture to `pluralCount`, which decides with `Number(count)`; `Number('1.000')` is the decimal `1`, so one thousand rendered as `Search … · 1.000 word.` — singular *and* still grouped the Vietnamese way inside the English interface (`5.112` kept the wrong separator too). It now normalises with the same `formatCount` helper its `từ gốc` sibling already used. Vietnamese rendering is unchanged.
- **The residual-risk section still quoted the pre-recount listening number (D-16).** §C.3 had been corrected to 56 in round 2 and §G was missed. §G now states 56 of the 83 papers with a listening section have neither audio nor transcript, 4 have a truncated transcript, and 23 papers have no listening section at all.
- **The "ten labels" count in this file and in the audit report was wrong (D-14).** 22 changed translation sites (21 pattern entries plus one inline summary line) rendered 20 distinct English labels, not ten. Corrected here, in `docs/RC1_AUDIT_REPORT.md` and in the logs, with the 3 reproduced labels kept separate from the 2 provably masked ones and the 15 that remain unproven.
- **Two tests could not fail (D-18).** The ledger test read "the first cell containing *listening*" (eight rows mention it in the completeness column) and the report test compared tier numbers by membership, so swapping `61` and `24` still passed. Both now select by header / compare label→count pairs, and both were shown to fail on a mutated ledger and on swapped numbers respectively.
- **Guard hardening.** The count-of-one sweep now splits on full stops as well, so a trailing `1 phrases.` cannot hide; its blind spot for a plural that follows an adjective is documented in the test and covered by an explicit case.
- **A broken code span in the audit report itself (D-19, fixed in review round 4).** The D-18 passage quoted the removed membership assertion inside single backticks while the quoted text contained two more, so it rendered as broken inline code (CodeRabbit, MD038). It is now a fenced `python` block with the explanation outside it.

### Repository review configuration (review round 4)

`.coderabbit.yaml` now configures CodeRabbit for this repository, so reviews no longer depend on account-level defaults: every push to every open pull request is reviewed (`auto_review.enabled` and `auto_incremental_review`), draft pull requests included (`drafts: true`), in any target branch (`base_branches: [".*"]`), with the five-commit auto-pause disabled (`auto_pause_after_reviewed_commits: 0`) and no title, author, label or description exclusions. `abort_on_close` stops a review of a closed or merged PR. `path_filters` excludes exactly two machine-generated audit files (`docs/vocabulary-audit-dev5.json`, `docs/vocabulary-300-counts.json`) that their generators already `--check`; the application, the shipped data, the scripts, tests, workflows, documentation and the exam sources all stay in scope. Configuration only: no dependency, workflow or application change, and excluding files does not reduce the review allowance that reviews themselves consume.

The first review that ran under this file caught a scope claim that was false (D-20): `**/*.tsv` is on CodeRabbit's default ignored list, so the seed tables would not have been reviewed even though nothing here excluded them. The documented override for a default exclusion — the same pattern without the leading `!` — now re-includes them without turning the list into an allowlist.

### Test coverage closed in review round 4 (D-21)

Two browser scenarios covered less than they claimed, and both gaps were in the behaviour this branch changes. `tests/browser-learning.cjs` proved that modified chords cannot grade, reveal or write, but never drove a composing `keydown` through the registered handler — a composing key carries no modifier, so only the handler's own guard can stop it. It now dispatches composing `f` and `Space` and asserts the card, the feedback area and learner storage are untouched. `tests/browser-exams.cjs` asserted the archive count only in Vietnamese (`106 bản chép`), so the English flow would have passed even if the count stayed untranslated; it now waits for `106 transcriptions`. Both assertions were shown to fail when the guarded behaviour was deliberately broken (`isComposing` removed; the pattern reverted to Vietnamese) and pass on the restored tree. Test-only: no application, data or gate change.

### Version

`APP_VERSION` is `v1.0.0-rc1`, `DEPLOY_HOLD` names the same candidate (gate closed until that release exists), and the version pins in `tests/static-app.test.js`, `tests/browser-learning.cjs`, `tests/test_sprint_exam_features.py` and `tests/test_deploy_gate.py` moved with it.

## v1.0.0-beta8 — audit release (2026-10-24)

Release state — whether a `v1.0.0-beta8` tag, prerelease and assets exist, and which build Pages serves — must be verified live on GitHub; this file records contents, not publication status. This build was prepared with the gate **held** (`DEPLOY_HOLD` = `v1.0.0-beta8`). Sequence actually executed: merge commit `fe45a96192339ca26e7e5c94bcdb8033c968280f`, annotated tag `v1.0.0-beta8` on it, assets built from the tag by `Release artifacts` run `40087575768` (HTML `10,376,145 B`, `sha256 d66491e4…b474b74c`, identical to the tag's `index.html`), prerelease published 10:59:46Z, then `Deploy Flashcard` run `40088098400` success and deployment `7297681926` (`success`). The push-triggered run `40087543579` ran every test and skipped the Pages steps while the gate was still closed.

### What this release is

An audit build, not a feature build. The target was fatal and high-risk behaviour, and every claim below is backed by a command or a test that would fail if the defect came back. Three code defects and one data defect were found and fixed; several suspicions were checked and documented as *not* defects, so later reviews do not re-litigate them.

### Data: the root-rule map was incomplete, and one headword was counted twice

- **A real duplicate:** `licence` (ID 5144) and `license` (ID 3026) were both active headwords with the same noun gloss. They are the British and American spellings of one word, so `licence` is now a merged form of `license` (`kind: inflection` in `docs/vocabulary-families.json`).
- **Derivations that were still counted as headwords** were merged after a hand review of every suffix candidate: 83 new families covering 93 forms, for example `actually ← actual`, `weakness ← weak`, `strengthen ← strength`, `harmful`/`harmless ← harm`, `emotional ← emotion`, `invitation ← invite`, `occurrence ← occur`, `uncertainty ← uncertain`, `calculator ← calculate`, `streaming ← stream`, `meeting ← meet`, `dressing ← dress`, `blender ← blend`, `washer ← wash`, `cyclist ← cycle`, `psychologist ← psychology`, `crimes ← crime` (plural) and `obesity ← obese`. Eight heads that already had families (`weak`, `examine`, `indicate`, `install`, `start`, `revolution`, `revere`, `exhaust`) had the new forms appended instead of being declared twice.
- **Look-alikes stayed separate, with a reason on the record.** The same review appended 54 rejections to `reviewed.rejectedMerges`: `author/authority`, `fact/factor`, `improve/improvise`, `media/mediation`, `pass/passive`, `decade/decadence`, `import/importance`, `allergy/allergen`, `custom/customer`, `element/elementary`, `limit/limited`, `concern/concerning`, `belong/belonging`, `teenage/teenager`, `disadvantage/disadvantaged`, `wire/wireless`, `handy/handful`, `fur/furious`, `poll/pollen`, `chick/chicken`, `moth/mother`, `pond/ponder`, `sand/sandal`, `sauce/saucer`, `latte/latter`, `badge/badger`, `gravy/gravity`, `loaf/loafer`, `probe/probation`, `probe/probable`, `discus/discuss`, `grate/grateful`, `relay/relation`, `treaty/treatment`, `inform/informal`, `apart/apartment`, `potent/potential`, `kettle/kettleful`, `bucket/bucketful`, `intern/internal`, `equate/equator`, `escalate/escalator`, `forge/forgive`, `spur/spurious`, `protract/protractor`, `coal/coalition`, `metre/metric`, `blaze/blazer`, `lone/lonely`, `globe/global` (global already heads its own family, so merging would nest families).
- **Counts after the change:** 5,852 rows, **5,112 headwords**, **740 same-root forms**, **581 families**. 5,852 − 740 = 5,112, and the app derives the figure it shows from the data, so the brand bar, session header, lookup header and Settings panel moved together. The ≥5,000 headword target still holds.

### Code: three defects, each with a regression test

- **Search highlighting could split an HTML entity.** The lookup view escaped a row and then ran the highlight regex over the *escaped* string, so a query that matched inside an entity corrupted the visible text: searching `&` rendered `A &amp; B` in a row that read `A & B`, and `amp`, `lt`, `#39` did the same. `highlightMatch(text, query)` now marks the raw text first and escapes each piece afterwards, and the view calls it. Covered by *search highlighting never breaks the text it escapes*.
- **English relative review times were ungrammatical.** `formatNextReview` produced `in 1 hours` and `in 1 day`-scale strings without singular forms. It now returns `in 1 hour` / `in 1 day` and keeps the Vietnamese strings unchanged; the helper is exported and covered by *relative review times are plural-correct in both languages*.
- **Notation headwords were asked as typed exercises.** Three legacy rows are dictionary patterns rather than words (`Lest + S + (should) V-bare`, `Burn one's bridges/boats`, `Rear its (ugly) head`). They were offered as `fill_en` and could be drawn as a spelling card whose hint was `L••••••…`, which no learner can answer. A single predicate, `isTypableHeadword` (letters, spaces, apostrophes, hyphens), now gates `fill_en` availability and makes the generator fall back to recall instead of spelling, so the planner and the generator cannot disagree. Covered by *a headword a learner cannot type is never asked as a typed exercise*.

### Checked and deliberately not changed

- **“73 glosses without Vietnamese diacritics” is not a defect.** A diacritic-only scan flags `nhanh`, `phim`, `tim`, `cao`, `phanh`, `bia`, `tem`, `cua`, `men`, `len`, `vai`, `chai`, `ao`, `cam` and similar words that are correctly written without diacritics in Vietnamese. The scan is recorded as a false positive; no gloss was rewritten to satisfy it.
- **Duplicate glosses are synonyms, not duplicates.** 124 gloss groups (256 rows) share a Vietnamese gloss; inspection shows unrelated words with the same translation (`high`/`tall` → `cao`), which is correct. Only the `licence`/`license` pair was the same headword twice.
- **Exam practice still writes no exam history.** `createExamAttempt`/`updateExamAttempt` exist and are tested, but ungraded transcript practice deliberately does not create an attempt record, so `chuyen-anh.exam-history.v1` stays absent. This matches the browser contract that asserts the key is `null` after a practice submission; the loaders remain for the timed-attempt contract.
- **Malformed-payload fuzzing found no crash.** Every loader (`loadProgress`, `loadPrefs`, `loadFavorites`, `loadHistory`, `loadStreak`, `loadStudyConfig`, `loadFlagged`, `loadTheme`, `loadSeenBadges`, `loadPhraseProgress`, `loadExamHistory`, `loadLanguage`) was fed 15 malformed values (truncated JSON, arrays, scalars, `__proto__` keys, negative counters); none throws, and each returns its documented sanitised default.

### Verification for this build

- Regenerated through the single writer chain: `expand_vocabulary.py` (5,852 rows; 5,112 headwords; 740 merged), `build_vocabulary.py` (5,852 records), `embed_vocabulary.py` (5,852 embedded). `--check` passes for all three, and `vocabulary_families.py` prints `581 families; 740 merged rows; 5112 active headwords` with no problems.
- `node --test tests/static-app.test.js` → **93 pass / 0 fail** (485 s), including the three new regression tests.
- `python3 -m unittest discover -s tests -q` → **91 tests OK**, including the version, hold-marker and count assertions updated for this build.
- `git diff --check` clean; no seed file, no ID and no legacy row was edited other than through the family map.

## Unreleased — one headword per word root (2026-10-24)

> Numbers in this section are the beta7 state (5,205 headwords / 647 forms / 498 families). The beta8 audit above raised the map to 5,112 / 740 / 581; the mechanism described here is unchanged.

The vocabulary stops counting forms. Two rows that share a root are now one vocabulary item: the root is the headword, and every other form is a note on that headword. Nothing is deleted and no ID moves, so existing progress still resolves.

- **Counts.** 5,852 rows stay in `Learned_Vocabulary_List.md` and `data/vocabulary.json`, but **5,205 are headwords** and **647 are same-root forms** grouped into **498 families**. 5,852 − 647 = 5,205. The app, the dashboard, the search screen and the data panel all report the headword count; the data panel also states the 509 family forms explicitly.
- **The vocabulary target is reached: 913 → 5,205 headwords (≥5,000).** Nine new seed files (`data/vocab-seed/12-academic-extension.tsv` … `20-corpus-mid.tsv`) add 3,364 candidates; `expand_vocabulary.py` accepts 2,639 of them (4,939 seed rows total). Two authoring routes are used, both auditable: thematic lists written from the C1–C2 word stock (academic, household/clothing, flora/fauna, cuisine, jobs/money) and a corpus-mining pass over the 106 transcribed exams. The mining pass only proposes *forms*: each accepted word is then given a Vietnamese gloss, part of speech, CEFR level and topic by hand, and its `SOURCES` cell is generated from the repository's own registry — a dictionary locator for every headword, plus an exam locator when the corpus index actually finds the form (3,823 rows), so "the word appears in an exam" is never presented as evidence for a meaning.
- **Derivatives found in the new stock were merged, not counted.** A review pass over the 2,639 accepted rows added **118 hand-checked families** plus `offensive ← offend` (for example `weaken ← weak`, `colourful ← colour`, `admiration ← admire`, `documentation ← document`, `symbolize ← symbol`). The two spelling variants the pass found were removed from the seeds instead of being merged twice (`colorful` → keep `colourful`, `offense` → keep `offence`). Look-alikes that are *not* derivations were kept separate and recorded in `reviewed.rejectedMerges`: `bare/barely`, `form/formal`, `real/realize`, `verb/verbal`, `rot/rotation`, `success/successive`, `complex/complicate`, `content/contentious`, `infer/inferior`, plus a list of suffix accidents (`badger/badge`, `chicken/chick`, `pollen/poll`, `saucer/sauce`, …).
- **Headword labels are localised and interpolation-driven.** `formatCount(value, language)` groups the number for the reader's locale (`5.205` in `vi-VN`, `5,205` in `en-US`) and `countNumber()` normalises a grouped string back to an integer. Every learner-facing count is now `${formatCount(vocabulary.length)}` (brand bar, random-session card, lookup header, Settings → data info) instead of a literal; the English patterns return **headwords** / **same-root forms**, accept both grouped and ungrouped input, and keep the phrase bank's `780 phrases` on its own line so it is never added to the word count.

- **The rule paragraph is translated too.** Settings → *Thông tin dữ liệu* explains the root rule in prose; its bold label (`Quy tắc gốc từ:` → **Root rule:**) and the sentence that same-root forms are notes rather than entries now have English strings, so the English UI does not fall back to Vietnamese for the one paragraph that explains the count. Asserted in `tests/static-app.test.js`.- **Why the version label did not change.** `APP_VERSION` stays `v1.0.0-beta7` and `DEPLOY_HOLD` stays `v1.0.0-beta7`, whose release is already published, so the Pages gate is open for the merge. This change is data plus two display helpers; inventing a `beta8` label without a matching release would make the Settings label claim a release that does not exist. The data version hash shown next to it does change, because `data/vocabulary.json` and the embedded copy were rebuilt.
- **The rule is data, not a heuristic.** `docs/vocabulary-families.json` is the hand-reviewed map (`{head, headId, kind, members:[{id, word, pos, meaning}]}`, `kind` ∈ `derived`/`same root`/`inflection`). `scripts/vocabulary_families.py` applies it inside `scripts/expand_vocabulary.py`, so the table, the JSON and the embedded HTML always agree. Generation heuristics were rejected: suffix stems merged `apparent/appear/apply/appliance/appeal`, union-find over roots produced 339 noisy components, and a 5-letter-prefix scan produced 350 mostly-false groups.
- **What a merged row looks like.** It keeps its ID, word, gloss and tags, gains `family:merged` and `family-head:<id>`, and is hidden from the app. Its headword gains a `WORD_FAMILY` note, appended after any existing prose: `Cùng gốc: abundance (n: sự phong phú)`. Merged rows keep their own historical `WORD_FAMILY` text as an audit record; the dev4/dev5 ledgers compare it with the generated note stripped (`audit_view`), so a bookkeeping change never rewrites a frozen evidence ledger.
- **Four dangling heads were re-pointed rather than left broken:** `produce`, `govern`, `infect` and `substantial` are not headwords in the data, so their families now hang off `government ← governance`, `infection ← infectious`, `substance ← substantial, substantially` and `temperature ← temperate`.
- **False friends were rejected before shipping.** A first pass of the map grouped 22 forms that are separate dictionary entries, or that only look alike: `virtue ← Virtually` (Virtually belongs to *virtual*), `Principle ← principal`, `person ← people`, `quality ← Qualification`, `define ← definitely`, `technology ← technically`, `organise ← organic`, and `prior`, `regular`, `Competent`, `population`, `Variation`, `literal/literary/literature`, `conceive`, `Distinguish`, `expedition`, `attendance/attendant`, `integrity`. They are now headwords again, which is why the map has 380 families / 509 forms rather than 392 / 531; `docs/vocabulary-families.json` records the rejected merges under `reviewed.rejectedMerges`. `note ← notification, notify` was re-headed as `notify ← notification` because `notify` is a row of its own.
- **Search still reaches every form.** `searchText` already indexes `wordFamily`, so searching `adversity` (a merged form) returns the headword `Adverse` with its family note.
- **Progress is preserved by folding, not by dropping.** `familyHeadMap`/`foldFamilyIds`/`foldFamilyProgress` move a stored record from a merged form to its headword: correct/wrong counts add, streak and interval keep the furthest value, `lastReviewed` keeps the most recent date, `nextReview` keeps the earlier date (so merging never delays a review) and `state` is re-derived. Favorites and flags fold the same way, and no stored ID disappears from the dataset, so IDs are never reused.
- **Honest count against the old target.** The ≥3,000 target was met by 3,215 *rows*; after the root rule there were 2,706 headwords. The ≥5,000 target is now met by **5,205 roots** (5,852 rows, 647 merged forms), and `README.md` states both numbers and where they come from. An earlier count of at least 294 new roots — derived forms of existing roots do not count, which is the point of the change.
- **Tooling.** `scripts/vocabulary_families.py` (`apply_families`, `validate`, `--json`), `scripts/expand_vocabulary.py` (`--check` reports `5205 active headwords, 647 merged family forms`), `scripts/build_vocabulary.py` (derives `familyHead` from the `family-head:` tag and drops it otherwise) and `scripts/validate_vocab.py` (new `family`/`family-head` tag namespaces; `familyHead` required on merged rows, forbidden elsewhere, no self-reference, and the headword's note must name the form).
- **Tests.** `node --test tests/static-app.test.js` **90 pass / 0 fail** (88 before) with two new tests — family folding/counts, and the learner-facing count plus its English labels — and a search assertion that a merged form resolves to its headword; `python3 -m unittest discover -s tests -p 'test_*.py'` **91 OK** (83 before) with the new `tests/test_vocabulary_families.py` (8 tests) and family-aware dev4/dev5 parity. `expand_vocabulary.py --check`, `build_vocabulary.py --check`, `embed_vocabulary.py --check` and `generate_vocab_audit_dev5.py --check` all pass without writing.
- **Not claimed.** `tests/browser-learning.cjs` was updated for the new count and to seed headwords (id `1`/`Adversity` is now a form of id `298`/`Adverse`), but it was **not run**: this sandbox has no Playwright/browser. No learner study was performed; the root rule is a data-integrity change, not a learning-outcome claim. `APP_VERSION` stays `v1.0.0-beta7` — this is a data/documentation change, not a release.

- **CI and Pages budget raised after a real timeout.** The first post-merge `main` runs (`Static checks` `40082462137`, `Deploy Flashcard` `40082462164`) were both cancelled at the 5-minute job limit while inside `Run static app logic and single-file tests`, so `Configure Pages`/`Upload Pages artifact`/`Deploy` were skipped and Pages kept the previous build. The suite is slower because it generates questions for every row (5,852 × 6 modes) and now measures `283,986 ms` locally and `5m49s` in CI. `.github/workflows/ci.yml` and `.github/workflows/deploy.yml` now allow **20 minutes**; no test, assertion or gate step was removed or weakened. The follow-up deploy (run `40083253186`) completed all steps and the `github-pages` deployment `7296958172` reports `state: success` for `63c37897b1d9d8575ed0246bd3bdbe60b44758ad`.

## v1.0.0-beta7 — 2026-10-24

Release state — whether a `v1.0.0-beta7` tag, prerelease and assets exist, and which build Pages serves — must be verified live on GitHub; this file records contents, not publication status. This build was prepared with the gate **held** (no tag, no prerelease) and was released afterwards on an explicit maintainer decision: annotated tag `v1.0.0-beta7` on `1181a654d9f2df23a0a55888a4990bc181b4eb81`, then a published prerelease whose HTML asset is byte-identical to that tag's `index.html` (`8,231,070 B`, `sha256 74fc0a8a…d69080`), which opened the deploy gate and published the same file to GitHub Pages.

### The vocabulary grows from 913 to 3,215 headwords, and the phrase bank ships as a second data set

- **Vocabulary: 913 → 3,215 headwords (target ≥3,000).** 2,302 new single-word headwords come from `data/vocab-seed/*.tsv` (11 bands, 2,866 candidates) through `scripts/expand_vocabulary.py`. Every ID from 1 to 913 keeps its word, gloss, tags and progress; new rows continue at 914. Distribution of the new block: B1 400 / B2 671 / C1 905 / C2 326; type academic 719, topic 855, core 360, word-formation 217, linker 103, confusable 48; evidence from the transcribed exam corpus 1,992, dictionary locator only 310.
- **564 candidates were rejected, with the reason recorded** by `expand_vocabulary.py --report`: 311 duplicates, 218 **word-family forms already taught under a legacy headword** (`adaptation` under `Adapt`, `assumption` under `Assume`, …), 34 inflections, 1 spelling variant. The word-family rule is the important one: counting a derived form that the app already teaches under its base word would inflate the total without teaching anything new. The rule is enforced in code, not by hand-editing the table.
- **Structured provenance.** Every row now carries `SOURCES` — a JSON array of `{ref, locator, supports, url}` objects resolved against the new registry [`docs/vocabulary-sources.json`](docs/vocabulary-sources.json). `NOTES` retains its prose citations; the two are separate. `scripts/validate_vocab.py` rejects a row whose source is missing, unknown to the registry, or silent about what it supports, and also rejects two headwords that only differ by hyphen/punctuation folding.
- **Phrase bank: 780 entries with their own `P001…P780` IDs.** Phrasal verbs (184), idioms (133), collocations (192), dependent prepositions (105), linker phrases (90) and exam-structure patterns (76), each with a Vietnamese gloss, a usage note, the grammatical frame, level/topic/skill tags and its own provenance. 492 entries are evidenced by an occurrence in a transcribed exam (`file:Lnnn`), 288 carry a dictionary locator only. The bank is built by `scripts/build_phrases.py` from `data/phrase-seed/*.tsv`, validated independently by `scripts/validate_phrases.py`, and embedded by `scripts/embed_phrases.py`; all four support `--check`. Phrases are **not** counted towards the vocabulary target, and a phrase that duplicates a single-word headword is rejected.
- **The bank is usable in the app.** A new **Cụm từ** screen searches phrase, meaning, usage and pattern text, filters by type and by CEFR level, and shows each entry's state. *Luyện cụm từ* queues ten phrases, never-practised first, then the least accurate, then the stalest, interleaved across types. An unseen phrase is asked as recognition (meaning → choose the phrase); a phrase already answered correctly is asked by typing it, with typographic apostrophes and dash/hyphen variants folded and diacritics never removed. Answers write to `chuyen-anh.phrases.v1` only — `ease`, `interval`, `state`, streak, XP and `chuyen-anh.progress.v1` are untouched (asserted in Node and again in Chromium, where the word store is compared byte for byte).
- **Backup compatibility, non-breaking.** The v1 export gains an optional `phrases` block only when the device actually has phrase progress; `validateImportPayload` accepts files with or without it, rejects a malformed block before writing anything, and an import without the block keeps the device's own phrase progress. Reset clears the phrase store alongside the word stores. The English interface covers the new screens (dictionary entries plus count patterns); phrase text itself stays untranslated because it is data.
- **Reproducibility and tests.** `scripts/expand_vocabulary.py`, `build_vocabulary.py`, `embed_vocabulary.py`, `build_phrases.py`, `embed_phrases.py` and `generate_vocab_audit_dev5.py` all pass `--check` and never rewrite their outputs. The dev4/dev5 audits were scoped to the 913-row legacy block they actually reviewed, and now also assert that no appended row claims a legacy ID.
- `node --test tests/static-app.test.js` **88 pass / 0 fail** (beta6: 81); `python3 -m unittest discover -s tests -p 'test_*.py'` **83 OK** (beta6: 72) including the new `tests/test_learned_phrases.py`; `node tests/browser-learning.cjs` **PASS** with a new phrase scenario (browse, search, type/level filters, ten practice turns, separate store, English interface, reset); `node tests/browser-exams.cjs` **PASS**.
- `APP_VERSION` = `v1.0.0-beta7`, `DEPLOY_HOLD` = `v1.0.0-beta7` (the marker stays: once the named release is published the gate opens for this and every later deploy). While the candidate was being prepared, `python3 scripts/deploy_gate.py --repo coderunknow/Chuyen-Anh` reported `deploy=false (release v1.0.0-beta7 is missing; deployment held)`; after the prerelease was published it reports `deploy=true (release v1.0.0-beta7 is published)`.
- `v1.0.0-beta4` was restored as an annotated tag and a prerelease on `9b9de43e4ee0f035e4a8360352057f06b277d918` (that commit's `APP_VERSION` is `v1.0.0-beta4`), under the closed `v1.0.0-beta7` gate, so publishing it cannot deploy `main`/beta7 to Pages.

### Measured interaction cost (`tests/speed-benchmark.cjs`, `ROUNDS=3`, `outliersDropped: 0`, `pageErrors: []`, Chromium 133.0.6943.0, 600/450 ms)

| flow | beta6 baseline | beta7 candidate | delta (median) | turns |
|---|---|---|---|---|
| `standard` | `15,818 ms` (`16,454 / 14,944 / 15,818`) | `14,432 ms` (`14,808 / 14,169 / 14,432`) | `−1,386 ms` (`−8.8 %`) | `11` |
| `sprint` | `21,668 ms` (`22,934 / 21,559 / 21,668`) | `21,303 ms` (`22,702 / 21,225 / 21,303`) | `−365 ms` (`−1.7 %`) | `21` |

Turn-class medians (sprint): `firstPass` `10 → 16 ms`, `handOff` `10 → 17 ms`, `consolidation` `3 → 2 ms`, `retry` `2 → 2 ms`; `minConsolidationGap` = `3` on both builds. The sprint ranges overlap, so the honest reading is no measurable change; the standard flow's ranges do not overlap in this run, but a single sandbox is not evidence of a general speed-up. File size `5,333,821 B → 8,231,070 B` — the cost of 2,302 more headwords and 780 phrases in the same single file. A fresh cold-start measurement was attempted and did not complete (the measuring browser crashed in this sandbox), so no startup number is claimed here.

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
