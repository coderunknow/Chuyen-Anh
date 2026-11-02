# rc10 — CEFR study-pool integrity and the study-scope setting

Scope of this document: the **reported defect** (a session or a promised number
disagreeing with the selected CEFR levels) and the **study-scope** setting
(Words Only / Words + Phrases). Data revalidation and new-entry phases are
tracked separately in `audit/rc10/STATE.md`; they are **not** claimed here.

Baseline for every "before" claim: `audit/rc10/baseline.json`, captured from
`main` @ `c427be25c9beb61d43a11a299097c1071cae7537`, `index.html` sha256
`f49f8b6e8916b924d398f143581d9073f8516a47f93193e9e77ba42ae7cf7a8d`.

## What was actually wrong (four defects, one root cause)

1. **Study counters read the whole deck.** `renderLearn`, `renderShell` and
   `renderDashboard` all bound `const currentStats = stats()`, and `stats()` is
   `poolStats(deckIds)` — the *unfiltered* deck. With C1 selected, the study card
   said **3.841 từ** for "Từ mới" while the C1 pool was **1.279** active rows
   (1.833 rows before archived rows are excluded). Dashboard due/weak/mastery had
   the same flaw.
2. **Favourites bypassed the filter.** `startSession` used
   `mode === 'favorites' ? deck : cefrDeck()`. `probe-leak.mjs` proved it: with
   C1 / A1 / B2+C1 / all-off / Unclassified-only selections, the favourites queue
   served B1 words (`ability`, `accept`, `accident`, `active`, `activity`) — 5
   failing cases out of 5 selections.
3. **The favourites and random cards promised populations they would not serve.**
   The favourites card counted every starred word; the random card printed
   `deck.length`.
4. **A queue built under one selection outlived the selection.** Changing chips
   mid-session left already-queued cards servable.

Root cause in one line: the *filtered* pool was authoritative for two of the
seven mode builders but not for the numbers, the favourites builder, or an
in-flight queue.

## The fix

- **One pool, one stats call.** `studyPoolIds()`, `studyStats()` and
  `wordsOnlyStudy()` (new helpers) make `cefrDeck()` the single source for every
  study promise: learn cards, top bar due counter, dashboard due/weak/mastery,
  brand detail, the favourites card, the random card.
- **Lifetime figures stay unfiltered, on purpose.** Accuracy, streak, XP, badges
  and history still read `stats()` — a level filter must never rewrite what
  already happened. `renderDashboard` now keeps `const lifetime = stats()`
  beside `const currentStats = studyStats()`.
- **Favourites obey the filter.** `const pool = cefrDeck();` for every mode. A
  starred word outside the selection stays starred, is counted separately, and
  the empty case explains itself: “Các từ yêu thích của bạn đều nằm ngoài mức
  CEFR đang chọn…”.
- **A running queue is re-checked.** `enforceStudyPool()` prunes a live session
  when the selection changes (chip click, import, reset, another tab via the
  `storage` event), adjusts the session total, drops the pending turn, and ends
  the session with an explanation if nothing is left.
- **Lookup stays complete, and says so.** Tra cứu keeps every word findable (a
  learner may look up a word outside their levels) and now prints both
  populations: “Tra cứu giữ toàn bộ 5.852 từ… phiên học chỉ dùng 1.279 từ…”.

## Study scope (Words Only / Words + Phrases) — P7a

- Persisted setting `scope` in `chuyen-anh.study.v1`, values `words-phrases`
  (default, unchanged behaviour) and `words`; export `STUDY_SCOPES`;
  `sanitizeStudyConfig` rejects anything else, so an old profile and a corrupt
  value both keep the default.
- Discoverable on the study home in a visible `#learn-scope` row with a text
  explanation (`#learn-scope-help`), in the advanced panel, and in Settings. One
  setter (`setStudyScope`) serves all three surfaces, so they cannot drift.
- Words-only removes the phrase source from the session pathways: phrase practice
  refuses with an explanation, and an open phrase session is closed when the
  switch happens. **No phrase row is deleted or filtered** — the bank, its IDs and
  its progress survive both directions (asserted in the test and probed in the
  browser).
- The scope never touches CEFR: phrase eligibility is still the phrase's own
  `level:*` tag.

## Evidence

| Claim | Where it is proved |
| --- | --- |
| 128 CEFR combinations narrow the deck to exactly their levels | `tests/rc10-cefr.test.js` test 1 (real 5.852-row dataset) |
| All 7 queue builders × 2 scopes × 128 selections stay inside the pool | test 2 (256 configurations) |
| Counters come from the filtered pool, lifetime figures do not | test 3 (source assertions) |
| No mode bypasses the filter; queues are pruned on change | test 4 |
| Scope is persisted, sanitised, defaults to words+phrases | test 5 |
| Scope is visible on the study home | test 6 |
| Words-only refuses phrase practice without deleting data | test 7 |
| Real browser: 6 selections × 9 entries + the scope journey | `audit/rc10/scripts/verify-rc10.mjs` |
| Module-level queues leak nothing | `audit/rc10/scripts/probe-leak.mjs` |

**Failing-before.** `git archive c427be2` into a clean directory plus the new test
file only: tests 3–7 fail (tests 1–2 pass, because the pure queue builders were
already correct in rc9). Numbers: `# pass 2 / # fail 4` before, `# pass 7 / # fail
0` after.

**Measured before/after (C1-only, real browser).**

| Surface | Before | After |
| --- | --- | --- |
| Brand detail | 3.841 từ trọng tâm | 1.279 từ (the pool) |
| Learn card “Từ mới” | 3.841 từ | 491 → 229 with a seeded profile (pool-exact) |
| Learn card “Ngẫu nhiên” | 3.841/1.833 đủ điều kiện mismatch | 1.279 từ đủ điều kiện |
| Favourites card | 30 from every level | eligible favourites only, with the held-back count named |
| Favourites session | served B1 under C1 | refuses with the level explanation |
| Queue surviving a chip change | served old cards | pruned with a toast, or ended if empty |
