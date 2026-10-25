# RC1 Audit Report — v1.0.0-rc1 (unreleased candidate)

- **Repository:** `coderunknow/Chuyen-Anh`
- **Base commit:** `38f92a3c2129a08349dc99deac6e675a722c099f` (`origin/main`, *Merge pull request #60*)
- **Candidate branch:** `arena/1ace764a-chuyen-anh`
- **Candidate version:** `v1.0.0-rc1` (`APP_VERSION`, `DEPLOY_HOLD`)
- **Audit date:** 2026-10-25
- **Publication state at audit time:** nothing in this report was tagged, released, published or deployed. `v1.0.0-rc1` does not exist as a tag, GitHub Release or prerelease; the newest published prerelease remains `v1.0.0-beta8`; the deploy gate reports `deploy=false (release v1.0.0-rc1 is missing; deployment held)`.

---

## A. Summary

### Scope actually exercised

| Area | What was done |
| --- | --- |
| Repository state | `git fetch --all --prune`, `git fetch --tags`; `origin/main` = `38f92a3`; working tree clean at start; **no local tags existed** before the fetch; 13 prereleases exist on GitHub (`dev1`–`dev5`, `beta1`–`beta8`); PRs #59 and #60 both **MERGED**; 6 workflows present. |
| Governance docs | `AGENT.md`, the whole of `DESIGN_LOG.md` (1,141 lines, read to the end in slices), `AGENTS_LOG.md` (673 lines), `README.md`, `CHANGELOG.md`, `docs/EXAM_AUDIT_LEDGER.md`, `docs/vocabulary-*`, `SECURITY.md`, all 6 workflows, and the scripts/tests listed below. |
| Vocabulary data | Independent recount from `data/vocabulary.json` + `docs/vocabulary-families.json` (not from the documents): IDs, schema, glosses, parts of speech, tag namespaces, `familyHead` integrity in both directions, family coverage, `reviewed.rejectedMerges`, source registry. |
| Phrase bank | ID sequence, type distribution, duplicate detection, schema, and the documented split from the word count. |
| Exam archive | All 106 rows of `docs/EXAM_AUDIT_LEDGER.md` re-derived from `scripts/exams/selection.json`, the 106 Markdown bodies and the embedded `#exam-data`; tier distribution, Private-Use-Area inventory, listening/transcript columns and the parsed-question claims recomputed with the shipped parser. |
| Application code | The whole 5,915-line module was read; the flows were then driven in real Chromium (session start, graded turns, search, phrase practice, exam reader, settings, language switch, keyboard shortcuts). |
| UI / accessibility | Programmatic sweep in Chromium at 375 / 768 / 1440 px in both languages across all six screens, plus screenshots inspected by eye; console-error and overflow instrumentation. |
| Security | `innerHTML` sites, the exam Markdown renderer, escaping/highlight ordering, the twelve `localStorage` loaders, and the workflow permission/trigger surface. |
| Performance | Startup, search-index build, search, progress seeding, session selection and stats measured in Chromium against the real 5,852-row payload (figures in §E). |

### Result in one paragraph

Five product defects were confirmed by reproduction and fixed (one behavioural security/UX defect in keyboard handling, one self-contradicting audit document, one stale README count, and two classes of English-language defects). Two further findings are defects in the optional browser suite's own fixtures rather than in the application — a stale favourites-ordering assumption (**D-11**) and three stale queue/data expectations (**D-12**) — and had been failing, unnoticed because those suites are not part of CI, since before the base commit; both were corrected without changing application behaviour. Every claimed number in the documentation was recomputed from the data before it was repeated. The data itself — 5,852 rows, 5,112 headwords, 740 same-root forms, 581 hand-reviewed families, 780 phrases, 106 exam transcriptions, 3,472 parsed questions — was found **consistent**; no vocabulary meaning, exam sentence or answer key was rewritten, and no row was added to make a number match a document. Nothing was published, tagged or deployed.

### Verification limits stated up front

- **Exam content is not verified against primary sources.** All 106 transcriptions derive from one secondary aggregator (`tailieudieuky.com`). `official-verified` = 0 and `non-official-source-compared` = 0 in the ledger, and this audit did not and could not change that: no primary `Sở GD&ĐT` scan is available offline, and the sandbox allowlist does not include the aggregator's hosts. Checksums prove the Markdown matches the embedded copy; they prove nothing about fidelity to the original paper.
- **Answer keys remain unverified.** `gradeExamQuestion` returns `ungraded` unless a question carries `verificationStatus: 'verified'`; no shipped question does, so exam practice stays ungraded by design. That is a property of the data, not a bug, and was left alone.
- **Vietnamese gloss *quality* was spot-checked, not exhaustively re-edited.** Structural integrity is machine-verified for all 5,852 rows; semantic accuracy of ~5,000 editor-written glosses cannot be established without a dictionary source per row and was not claimed.
- **No screen-reader session was performed.** Accessibility findings are automated (DOM/ARIA instrumentation) plus keyboard-only driving in Chromium; see §E for what that does and does not prove.

---

## B. Vocabulary and content integrity

### B.1 The authoritative counts (recomputed, not copied)

| Measure | Value | How it is defined and computed |
| --- | ---: | --- |
| Rows in `Learned_Vocabulary_List.md` / `data/vocabulary.json` / embedded HTML | **5,852** | `len(json)` — IDs are 1…5852 with **no gaps and no duplicates**. |
| Active headwords (what the learner sees) | **5,112** | rows without `familyHead` |
| Same-root forms (audit rows, not separate items) | **740** | rows with `familyHead`, each pointing at an existing non-merged row |
| Root families | **581** | `docs/vocabulary-families.json → counts.families` |
| Rejected merges (recorded, with reasons) | **69** | `reviewed.rejectedMerges` |
| Phrase bank (separate store, never added to the word count) | **780** | `data/phrases.json` |
| Exam transcriptions | **106** | `scripts/exams/selection.json` and `#exam-data` |
| Auto-parsed exam questions | **3,472** (2,402 multiple-choice + 1,070 short-answer) across **91** papers | recomputed with the shipped `parseExamQuestions` |

Before the fix, `README.md`'s opening paragraph said **5,205 headwords / 647 forms** (the beta7 state) while the data and the same file's later sections said 5,112 / 740. That is finding **B-1** below.

### B.2 Structural audit of every row — no new defects

| Check | Result |
| --- | --- |
| Missing `id`, duplicate `id`, reused `id` | 0 / 0 / 0 (IDs 1–5852, dense) |
| Duplicate headword strings | 0 (`validate_vocab.py`), plus manual confirmation that spellings differing only by `-ise/-ize` are merged, not duplicated |
| Missing `meaning` | 0 |
| Missing `pos` | 0 (20 distinct values, all sensible: `n`, `adj`, `v`, `adv`, `v/n`, `idiom`, `phrasal v`, `collocation`, `prep`, `conj`, `pron`, `grammar`, `phrase`, `prep phrase`) |
| JSON/CSV hostility (`|`, quotes, newlines) in cells | escaped in Markdown; `splitExamTableRow`-style parsing is not used for vocabulary; the embedded JSON parses cleanly (4,836,432 bytes) |
| `familyHead` points at a non-merged row | 740/740 correct; 0 dangling, 0 self-references, 0 merged heads |
| Family coverage | the 740 merged IDs and the family members are the **same set** (no uncovered merged row, no orphan family entry) |
| Head note mentions each member | every family head's `WORD_FAMILY` note names every member; checked for all 740 |
| `SOURCES` list-valued cells use `[]`, text cells blank | validator enforces it and passed |
| Rebuild idempotence | `expand_vocabulary.py --check`, `build_vocabulary.py --check`, `embed_vocabulary.py --check` all report "matches" with no files written |

**No vocabulary row was edited in this audit.** The only data-adjacent change is the corrected README sentence; `Learned_Vocabulary_List.md`, `data/vocabulary.json` and the embedded block are byte-identical to `38f92a3`.

### B.3 Root-map (family) audit

- The map is applied by `scripts/vocabulary_families.py` inside `expand_vocabulary.py`, so the table, the JSON and the HTML cannot disagree; `--check` is clean.
- `kind ∈ {derived, same root, inflection}` is recorded per family. 69 rejected pairs are kept with reasons, including the grouped "other look-alikes" list; every pair whose two words exist in the table is present as two separate headwords, and no rejected form carries `familyHead` — i.e. the rejections are actually enforced, not just documented.
- Spot checks confirmed the two categories stay apart as documented: derivations (`weaken ← weak`, `colourful ← colour`) are merged; look-alikes (`bare/barely`, `form/formal`, `real/realize`, `principle/principal`, `person/people`) are not.
- Progress folding was reviewed (see D-6): a merged form's stored record is folded into its headword with counts summed, the furthest streak/interval kept and the earlier `nextReview` kept, so the merge cannot silently lose or delay a review.

### B.4 Source registry

`docs/vocabulary-sources.json` declares 4 top-level keys (`version`, `description`, `accessed`, `sources`); `validate_vocab.py` verifies that every `SOURCES.ref` resolves into the registry and that `supports` is present. Nothing was added to the registry in this audit, and **no new source, locator or URL was invented**. Whether a Cambridge locator supports a *gloss* is an editorial claim the registry itself documents as "headword spelling and part of speech"; the report does not upgrade that claim.

---

## C. Exam archive (106 transcriptions)

### C.1 Synchronisation and integrity (mechanical)

- `python scripts/exams/embed_archive.py --check` → `Standalone HTML embeds 106 exam transcriptions (4,169,772 text bytes)`.
- All 106 Markdown bodies match the embedded `contentSha256` digests; `tests/test_exam_audit_ledger.py` re-hashes each body from disk and checks the prefix cited in the ledger row.
- Row-by-row reconciliation of the ledger's own per-paper claims against the parser: **106/106 rows match** their `parsed:N Qs (M MC, K text)` claim, and the aggregate claim (91 papers, 3,472 questions) is exactly reproduced.
- Tier distribution recomputed from the rows: **61 `partially-supported` + 21 `structure-metadata-only` + 24 `insufficient-source` = 106**, matching the summary table.
- Private-Use-Area inventory recomputed by scanning all 106 bodies: **11 papers, 248 codepoints**, per-paper counts identical to the ledger's list.

### C.2 Content verification status (what is *not* proven)

The four-tier distinction the mission asks for, as it applies to this archive:

1. **Verified against an authoritative source:** **0 papers.** No primary `Sở GD&ĐT` scan, audio bundle or signed scoring sheet is in the repository.
2. **Compared with an independent secondary source:** **0 papers.** Every record comes from the same aggregator; raw upstream binaries are not stored in Git.
3. **Technical integrity checked, original not verified:** **82 papers** (the 61 + 21 mechanical tiers, plus the two digital extractions whose defect is documented rather than repaired). Text↔MD↔HTML parity, table structure, digest equality, row counts and parser agreement are verified.
4. **Not enough evidence to conclude:** **24 papers** (`22` `HTML/OCR-cần-soát` + `2022/ha-noi/so` + `2025/thai-nguyen/so`), where the source itself is OCR-derived or materially incomplete.

**A checksum is not a proof of accuracy.** Nothing in this audit moves a paper up a tier, and no exam sentence, option or answer was edited.

### C.3 Defects found in this area

- **C-1 (Medium, fixed):** `docs/EXAM_AUDIT_LEDGER.md` shipped three unrendered template placeholders and a wrong `insufficient-source` description. Details and evidence in §D.
- Remaining, documented-but-unresolved limits (not defects to fix by guessing): 55 papers have a listening section with **no audio and no transcript**, 4 have truncated transcripts, 2 no longer exist as full text… see the ledger's own listening column; 8 papers reference a figure/chart that is not in the text; 2 papers contain embedded tutor annotations; 3 papers contain OCR token collisions. All of these are recorded in the ledger and none can be repaired without the primary source.

---

## D. Code, UI and security findings

| ID | Severity | Area | Status |
| --- | --- | --- | --- |
| D-1 | **High** (data mutation + blocked browser UI) | `index.html` — `document.addEventListener('keydown')` shortcut handler | **fixed** |
| D-2 | Medium | `docs/EXAM_AUDIT_LEDGER.md` — unrendered placeholders + false technical claim | **fixed** |
| D-3 | Medium | `README.md` — stale headword/form counts in the opening sentence | **fixed** |
| D-4 | Low | `index.html` — English counted labels always plural | **fixed** |
| D-5 | Low | `index.html` — two learner-visible strings never translated | **fixed** |
| D-6 | — | Progress folding for merged family forms | **verified-not-a-bug** |
| D-7 | — | Exam Markdown → HTML rendering (XSS surface) | **verified-not-a-bug** |
| D-8 | — | `localStorage` loaders with corrupt/hostile values | **verified-not-a-bug** |
| D-9 | Low | `CHANGELOG.md` keeps an "Unreleased" heading for work that shipped in beta8 | **unresolved (documentation nit, deliberately not rewritten)** |
| D-10 | Note | Deploy gate is *open* for `beta8` at base commit; see §G | **addressed by repointing the hold to the unreleased rc1 (gate now closed)** |
| D-11 | Medium (test, pre-existing) | `tests/browser-learning.cjs` — stale favourites fixture graded the wrong word | **fixed (test only; the app was correct)** |
| D-12 | Medium/Low (test, pre-existing) | `tests/browser-learning.cjs` — three fixtures encoded queue rotation / pre-beta7 data as fixed expectations | **fixed (test only; the app was correct)** |

### D-1 — A modified key pressed a flashcard shortcut (High, fixed)

- **Reproduction (real Chromium, before the fix):** open the app, start a priority session, press **Ctrl+F**. Observed: `chuyen-anh.flagged.v1` went from `[]` to `["2"]` (the current word was silently added to the hard-word list) and the keydown was `defaultPrevented: true`, so Find-in-page never opened. The same handler accepts `Ctrl+R` (`repeatCurrent`), `Ctrl+1…4` (answers a card) and `Alt+<key>`.
- **Cause:** the handler's only guards were the view, the session, the focused element and an `event.defaultPrevented` check. It never looked at `ctrlKey`/`metaKey`/`altKey`.
- **Why it matters:** it mutates learner data (`flagged`), blocks ordinary browser affordances, and on `Ctrl+R` queues a practice turn inside a live session instead of reloading.
- **Fix:** an exported predicate `acceptsShortcutKey(event)` returns `false` for any chord or IME composition; the handler returns early. Single unmodified keys (`1`–`4`, `Space`, `Enter`, `R`, `F`) behave exactly as before.
- **Regression test:** `tests/static-app.test.js` → *a modified key is never a flashcard shortcut* (8 assertions). It fails on the old code (the predicate does not exist and the behaviour is wrong), and the browser reproduction re-run after the fix shows no flag written and `defaultPrevented: false` while plain `f` still flags the word.

### D-2 — The audit ledger contradicted itself (Medium, fixed)

- **Evidence:** `grep -n "len(listen_missing)" docs/EXAM_AUDIT_LEDGER.md` returned the literal text `` `{len(listen_missing)}` ``, `` `{len(no_listen)}` ``, `` `{len(speaking_papers)}` `` in a committed document — an unfilled generator template, so three numbers were replaced by source code. The same paragraph's sibling claim named `2023/binh-thuan/so` as carrying "`18` Private-Use-Area glyph substitutions and incomplete listening material"; scanning that file finds **0** Private-Use-Area codepoints, its row says "No listening section in paper" and its tier is `partially-supported`. The second non-OCR paper that actually carries `insufficient-source` is `2025/thai-nguyen/so` (partial multiple-choice key only).
- **Cause:** the summary prose was written by a generator that was never re-run, and the per-paper table is pinned by tests while the prose was not.
- **Fix:** placeholders replaced with values derived from the 106 per-paper rows (`56` omit audio+transcript, `23` have no listening section, `2` include speaking material; 23 + 4 + 56 = 83 papers with listening, 83 + 23 = 106), and the tier definition now names `2022/ha-noi/so` and `2025/thai-nguyen/so` with their actual defects.
- **Regression test:** three tests in `tests/test_exam_audit_ledger.py` — no unrendered placeholders; the `insufficient-source` definition names exactly the non-OCR rows that carry the tier and does not repeat the false glyph claim; the listening summary equals the per-paper column counts. **All three fail against the `38f92a3` ledger and pass on the fixed one** (verified by pointing the test class at `git show HEAD:docs/EXAM_AUDIT_LEDGER.md`).

### D-3 — README stated a stale vocabulary size (Medium, fixed)

- **Evidence:** opening sentence said "**5.205 từ gốc** (… 647 dạng cùng gốc …)" while the data says 5,112 / 740 and the same file's §37/§83 says 5,112 / 740.
- **Fix:** the sentence now states 5,112 headwords and 740 same-root forms.
- **Regression test:** `tests/test_readme_counts.py` recomputes headwords/forms/rows/families from the data and the family map, asserts the opening sentence matches, and scans the **whole** README for any stale `N từ gốc` / `N dạng cùng gốc` (a stated target such as `≥5.000 từ gốc` is a goal and is exempt). Fails on the pre-fix file (2 failures), passes now.

### D-4 — English counted labels never used a singular form (Low, fixed)

| Source (vi) | Old output | New output |
| --- | --- | --- |
| `1 lượt` | `1 turns` | `1 turn` |
| `1 lượt còn lại` | `1 turns left` | `1 turn left` |
| `Dài nhất 1 ngày` | `Longest 1 days` | `Longest 1 day` |
| `1 cặp · 1 bàn` | `1 pairs · 1 board` | `1 pair · 1 board` |
| `1 từ · 1 bàn` | `1 words · 1 board` | `1 word · 1 board` |
| `1 từ / phiên` | `1 words / session` | `1 word / session` |
| `1 kết quả` | `1 results` | `1 result` |
| `1 thẻ` / `1 phiên` | `1 cards` / `1 sessions` | `1 card` / `1 session` |

- **Fix:** one exported `pluralCount(count, singular, plural)` helper now backs every counted English pattern; plural cases keep their previous wording.
- **Regression test:** *English counted labels use singular and plural forms* (10 singular + 5 plural cases).

### D-5 — Two strings stayed Vietnamese in the English interface (Low, fixed)

- `N từ mới` (the new-word counter in the priority panel) had no English pattern at all; `20 từ mới` stayed Vietnamese in the English UI.
- The exam sidebar sentence `Nguồn đăng lại; 22 bản HTML/OCR cần soát và chỉ đọc. Các mục trích xuất khác chưa được xác minh từng câu.` had no dictionary entry.
- Both are translated now; the Vietnamese UI is untouched (`translateUiText(x,'vi')` returns `x`).
- **Evidence:** a Chromium sweep of all six screens in English mode found these two strings (plus province names and the `Sở GD&ĐT …` unit labels, which are source data and correctly left as-is).
- **Regression test:** *the exam archive scope panel is localised in English*.

### D-6 — Progress folding for merged forms (verified, not a bug)

Boot path: `foldFamilyProgress(loadProgress())` → `ensureProgress(..., vocabulary)` where `vocabulary` excludes merged rows. Consequences, all confirmed by reading and by the existing suite: merged-row records are folded into their headword (counts summed, furthest streak/interval, earliest `nextReview`, re-derived state), stray IDs are dropped, and `calculateStats().total` therefore always equals the active headword count. Favourites and flags are folded the same way. No change made.

### D-7 — Exam Markdown rendering (verified, not a bug)

`renderExamMarkdown` escapes **before** inline formatting, then whitelists exactly two inline HTML forms (`<br>`, `<u>`) plus links whose `href` must match `https?://` and is already entity-escaped. `highlightMatch` marks the raw string and escapes each piece afterwards, so entity names (`amp`, `lt`, `#39`) cannot be split. Queries containing regex metacharacters are escaped; an invalid pattern falls back to plain escaped text. No XSS path found through vocabulary, phrases, exam text, search results, or the `data-*` attributes that are populated from data.

### D-8 — Storage hardening (verified, not a bug)

All twelve loaders (`progress`, `prefs`, `favorites`, `history`, `streak`, `study`, `flagged`, `theme`, `badges`, `phrases`, `exam-history`, `language`) wrap access in `try/catch`, validate types, and return documented defaults. Writes return a boolean and callers surface a failure instead of claiming success. `quoteExceeded`/blocked-storage behaviour is exercised by the existing `failingStore` tests. No import/export migration regression found: the v1 bundle keeps `version: 1` and treats `study`/`flagged`/`seenBadges`/`phrases` as optional blocks that are refused when malformed.

### D-11 — A browser scenario had been failing since before this PR (Medium, fixed as a test defect)

- **Symptom:** `node tests/browser-learning.cjs` aborts at `assert.equal(failedProgress.state, 'weak')` (line 480) with `'new' !== 'weak'`.
- **Attribution first:** the *same* suite, run against `git show 38f92a3:index.html` **and** `git show 38f92a3:tests/browser-learning.cjs` in an isolated directory, fails at the same line with the same message. `AGENTS_LOG.md` records that the beta7 and beta8 tasks did **not** run the browser suites ("no Playwright in this sandbox"), so the regression was never observed on `main`. **This is pre-existing and not caused by this candidate.**
- **Cause is in the test, not the app.** The scenario seeded favourites `['298', '2']` and then answered "298" wrong, assuming that card came first. A favourites session is built by filtering `Object.values(progress)` — numeric string keys in ascending order — so the first card is **id 2 (`Meticulous`)** and the second is **298 (`Adverse`)**. Probed in Chromium: the first card's prompt is `Meticulous`, its options are `['5373','4725','2','5751']`, and 298 is not among them; the click therefore graded id 2 while the assertion read id 298, which stayed `new`. The same ordering code (`all.filter(p => favoriteIds.has(p.id))`) is present unchanged in `v1.0.0-beta6` and `v1.0.0-beta7`, so the fixture's assumption never held.
- **Fix (test only):** the scenario now reads the word on screen, resolves its entry, asserts it is one of the two seeded favourites, grades *that* card, and asserts the corrective retry belongs to the same word. Every behavioural assertion is kept (state → `weak`, the retry is queued, the progress bar reads 67 %, a practice turn writes no scheduling state, the summary reads 50 %). No assertion was removed or relaxed, and the app was not changed.
- **Verified:** see §F row 15 — the whole suite passes on this candidate after the fixture correction.

### D-12 — Three browser fixtures encoded behaviour that no longer exists (Medium/Low, fixed as test defects)

- **How it surfaced:** with D-11 corrected, the suite ran past line 480 and aborted twice more — `tests/browser-learning.cjs:606` (`'bất lợi, có hại; chống lại'` where `/tỉ mỉ/` was expected) and, after that was rewritten, `:827` (`'1 kết quả · trang 1/1'` where `/2 kết quả/` was expected). Each abort hid everything after it, so the remaining scenarios had not been observed since the fixtures were written.
- **(a) A skip rotates the queue — it does not leave the same card in front.** With two missed favourites the practice queue is `[id 2, id 298]`; `#skip-card` calls `skipSessionCard`, which moves the current card to the back (`session.push(session.shift())`). A probe of the shipped app recorded the same header before and after the skip (`3 / 4 lượt · 2 còn lại`) but the other pending word's meaning on screen (`tỉ mỉ, kỹ lưỡng` → `bất lợi, có hại; chống lại`). The fixture had assumed the skipped card stayed in front, typed `Meticulous` into the other card, and asserted a turn order that never existed. The property the scenario exists to prove — *a skip consumes no graded turn and adds no practice work* — holds: the header does not move and the summary still reports `Luyện lại: 2 đúng · 0 chưa đúng / 2 lượt`.
- **(b) The same rotation applies to an ungraded introduction.** `seed(['298', '2', '3'])` shows the introduction of id 2, then of id 3; skipping the second introduction shows id 298's introduction, and skipping again returns the first-skipped word **as a quiz, not reintroduced** (`#start-quiz` count 0, 4 options, `.first-look` count 0). The fixture instead asserted the literal sequence `'Ambiguity'` → `'Meticulous'`, i.e. the queue behaviour of an earlier build.
- **(c) The search count was written before the beta7 family merge.** `advers` matches **one** headword, not two: `Adversity` (id 1) carries `familyHead: "298"`, and the app builds its vocabulary, search index and sessions from `loaded.data.filter(entry => !entry.familyHead)`, so `Adverse` (id 298) is the only separate record. **Attribution:** the base commit's own file (`git show 38f92a3:index.html`, `v1.0.0-beta8`) was served in Chromium and produced `1 kết quả · trang 1/1` with the single row `Adverse` and 740 merged rows — so the expectation was already wrong on `main` and is not caused by this branch. `git diff 38f92a3 -- index.html` touches no ordering, `skipSessionCard` or search code; the only app changes are D-1/D-4/D-5 plus the version string.
- **Fix (test only):** the two queue scenarios now resolve the card on screen from its own prompt (`currentEntry`, added for this) and assert the *properties* — the first practice turn belongs to the first missed word, a skip shows the other pending word without changing the turn count, the skipped word still gets exactly one practice turn, and an introduced word returns without a second introduction. The search scenario derives the expected number of headword records from the shipped data and keeps the meta/rows consistency assertions (query and sort survive a favourite toggle, one row star toggles, favourite persisted). No assertion was deleted or weakened and the application was not changed.
- **Verified:** §F row 15 — `node tests/browser-learning.cjs` **PASS, exit 0, 208 s** on the final tree.

### D-9 — Historical changelog heading (unresolved, intentional)

`CHANGELOG.md` still contains a section titled "Unreleased — one headword per word root" describing data that shipped in beta8. It carries an explicit note that its numbers are the beta7 state, and rewriting a historical changelog entry would destroy evidence, so it was left as-is and recorded here instead.

---

## E. Performance and accessibility

### E.1 Measured figures

Environment: this sandbox, headless Chromium `133.0.6943.0` (via `playwright-core` + `@sparticuz/chromium@133.0.0`), single page load over a local HTTP server, `--server` from the same file, `prefers-reduced-motion: reduce`. Figures are single-run observations, **not** a benchmark and not extrapolated.

| Measurement | Value |
| --- | --- |
| `index.html` total size | **10,377,922 bytes** (served size 10,378,222 B including response headers) vs 10,376,145 B at the `v1.0.0-beta8` tag: RC1 adds 1,777 bytes of code and no data |
| Embedded `vocabulary-data` JSON | 4,890,492 bytes, parses cleanly |
| Embedded `exam-data` JSON | 4,471,838 bytes, parses cleanly |
| Embedded `phrase-data` JSON | 575,209 bytes, parses cleanly |
| Application module | 366,312 bytes of JavaScript in one `<script type="module">` |
| DOM content loaded / load event | 400 / 405 ms · 407 / 413 ms · 383 / 390 ms (three runs) |
| First paint / first contentful paint | 104 / 104 ms · 108 / 108 ms · 132 / 132 ms |
| Search index build over 5,852 records (5,112 headwords) | 76.3 ms · 116.9 ms · 123.7 ms |
| Single-character query over the whole index | 10.8 ms (5,846 matches) · 13.1 ms · 9.9 ms |
| Exact-word query | 10.6 ms · 1.2 ms · 0.9 ms |
| Progress seeding for 5,852 records | 0.9 ms · 4.2 ms · 1.4 ms |
| Session selection (size 20, due mode) | 1.3 ms · 6.1 ms · 1.4 ms |
| `calculateStats` over 5,852 records | 0.2 ms (all runs) |
| `generateQuestion` (multiple-choice distractors drawn from the full list) | 23.3 ms · 27.1 ms · 20.8 ms |

Interpretation, limited to what was measured: startup is dominated by parsing the 10 MB document (~0.4 s on this machine), not by application work. Every list operation is linear and cheap at this size; the single slowest per-card call is question generation (~21–27 ms), because distractors are drawn by scanning the vocabulary for a matching part of speech and then filtered for uniqueness. That is acceptable for a card the learner reads for seconds, and it is the place to look first if a slower device ever feels laggy. No optimisation was made: nothing measured crossed a threshold that justified changing working code, and the mandate forbids trading correctness for speed.

### E.2 What the sweep showed

- **Console errors: 0** and **page errors: 0** in both languages across all six screens at 375 / 768 / 1440 px.
- **Horizontal overflow: 0** cases (`documentElement.scrollWidth - clientWidth <= 1`) across the same matrix; no element's right edge exceeded the viewport.
- Screenshots were inspected at 375 and 1440 px per screen and language (`/tmp/rc1/shots`, not committed): hierarchy, spacing, contrast of the muted/faint text against the panel background, long Vietnamese glosses and long English headwords all render without clipping; the flashcard, options, matching board, summary, lookup, phrase and exam-reader layouts keep their alignment.
- The existing browser suites additionally assert the 320 px archive/detail layouts and reduced-motion behaviour.

### E.3 Accessibility — what was and was not checked

Checked: semantic landmarks (`header`/`aside`/`main`/`nav`/`footer`), one `h1` per view, `aria-label` on every icon-only control, `aria-current` on the active nav item, `aria-live`/`role="status"` on the result counters and hand-off strip, `role="alert"` on feedback and error toasts, `aria-describedby` for blocked session buttons, visible focus ring on all interactive elements, and keyboard-only operation of the session, search, phrase and exam flows. Focus is moved to `main` on view change and restored to the "next card" button after feedback. `prefers-reduced-motion` disables the confetti and transitions.

Not checked: no screen-reader (NVDA/VoiceOver/JAWS) session was run, so no WCAG conformance claim is made; 200 % browser zoom was exercised only through the narrow viewport sweep, not through a real zoom setting; colour-contrast was assessed visually on screenshots, not with a contrast analyser over every token.

---

## F. Test matrix

All commands were run on the candidate tree (branch `arena/1ace764a-chuyen-anh`). Exit codes are the real ones.

| # | Command | Status | Notes |
| --- | --- | --- | --- |
| 1 | `python scripts/expand_vocabulary.py --check` | PASS (0) | `5852 rows (913 legacy + 4939 seed); 5112 active headwords, 740 merged family forms` |
| 2 | `python scripts/build_vocabulary.py --check` | PASS (0) | `matches 5852 Markdown records` |
| 3 | `python scripts/validate_vocab.py` | PASS (0) | 5,852 entries, 0 duplicate IDs, 0 duplicate words |
| 4 | `python scripts/vocabulary_families.py` | PASS (0) | `581 families; 740 merged rows; 5112 active headwords` |
| 5 | `python scripts/embed_vocabulary.py --check` | PASS (0) | `embeds all 5852 vocabulary records` |
| 6 | `python scripts/build_phrases.py --check` | PASS (0) | `matches 780 phrases` |
| 7 | `python scripts/validate_phrases.py` | PASS (0) | 780 phrases, 0 duplicate IDs/phrases |
| 8 | `python scripts/embed_phrases.py --check` | PASS (0) | `embeds all 780 phrase records` |
| 9 | `python scripts/exams/embed_archive.py --check` | PASS (0) | `106 exam transcriptions (4,169,772 text bytes)` |
| 10 | `python scripts/generate_vocab_audit_dev5.py --check` | PASS (0) | report current, no files written |
| 11 | `python -m unittest discover -s tests -p 'test_*.py'` | PASS (0) | **98 tests OK** (91 before this audit; +7 new) |
| 12 | `node --test tests/static-app.test.js` | PASS (0) | **96 pass / 0 fail** in 261 s on the final tree (230 s on the earlier identical run; 93 tests before this audit, +3 new) |
| 13 | `git diff --check` | PASS (0) | no whitespace errors |
| 14 | `node tests/browser-exams.cjs` (real Chromium) | PASS (0) | 106-record catalogue, filters, digests, safe markup, 320/375/768/1440 px layouts, no network requests, no page errors |
| 15 | `node tests/browser-learning.cjs` (real Chromium) | PASS (0) | **208 s** wall time, driven with `NODE_PATH` to a `--no-save` install outside the repo. Three fixture defects had to be corrected first (D-11, D-12); on the base commit the same suite aborts at line 480 |
| 16 | `python scripts/deploy_gate.py` | `deploy=false` | gate closed: `release v1.0.0-rc1 is missing; deployment held` |

**Not run, with reasons:**

- `pytest`-style tooling: not used by this repository (it is `unittest` + `node --test`).
- A GitHub Actions run: this branch is a candidate branch; CI will run when the PR is opened. No workflow was dispatched by this audit, and no release/deploy workflow was triggered.
- Screen-reader testing: no screen reader is available in the sandbox.

---

## G. Residual risk

1. **Exam fidelity.** The strongest remaining risk is content accuracy of the 106 transcriptions and their reference keys: 0 papers are verified against a primary source, 24 are officially "not enough evidence", and 55 lack any listening material. Checksums and parser agreement cannot raise this. Fixing it needs the original PDFs/audio, which are not in the repository and are not reachable from this sandbox.
2. **Release-gate coupling (operational, not changed by code).** `DEPLOY_HOLD` must name the version the shipped file declares (`tests/test_deploy_gate.py` encodes that invariant). At the base commit the hold named the *published* `v1.0.0-beta8`, so the gate was **open** and a merge would have published the new build to Pages without any release of its own. RC1 repoints the hold to the unpublished `v1.0.0-rc1`, which closes the gate (`deploy=false`). This cannot publish anything; it is the same pre-release pattern used for every beta. **The maintainer must still decide** whether to tag `v1.0.0-rc1` and publish it, or to point the hold elsewhere, before merging if a deploy must be prevented or required.
3. **Gloss semantics.** ~5,000 editor-written Vietnamese glosses were not re-verified row by row; a systematic semantic error would not be caught by any validator here.
4. **English coverage.** Translation is a lookup/pattern system, so any new UI string silently falls back to Vietnamese. This audit added the two missing strings it could observe; it cannot prove total coverage, and a future string can reintroduce the gap. (The sweep covers the six screens reachable without a session; session-internal strings were exercised only through the existing pinned tests.)
5. **Accessibility.** No screen-reader pass and no full contrast measurement; automated checks cannot establish WCAG conformance.
6. **Performance at other devices.** All figures come from headless Chromium in this sandbox with a local server; a mid-range phone parsing a 10 MB HTML file will behave differently, and no such device was available.
7. **Browser suites are optional.** `tests/browser-*.cjs` are not part of CI, so the browser evidence in this report is reproducible locally but not enforced on every push.
