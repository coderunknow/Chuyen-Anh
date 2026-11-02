# rc10 — QA log (this pass only)

What this file covers: the automated and browser evidence gathered for the CEFR
study-pool fix and the study-scope setting. It is **not** the full rc10 QA: the
dataset-revalidation, new-entry and migration suites have nothing to test yet,
because those phases are `not started` (see `audit/rc10/STATE.md`).

## Local suites

Run from the repository root on 2026-11-02.

| Suite | Command | Result |
| --- | --- | --- |
| Python | `python3 -m unittest discover -s tests -p 'test_*.py'` | **168 tests, OK** (35.2 s) |
| Node (all) | `node --trace-deprecation --test tests/static-app.test.js tests/exam-scoring.test.js tests/exam-anomalies.test.js tests/rc10-cefr.test.js` | **183 pass, 0 fail** (448.9 s) — 143 static + 25 scoring + 7 anomalies + 8 new |

`tests/rc10-cefr.test.js` is new; it runs against the real 5.852-row vocabulary
and 780-row phrase bank embedded in `index.html`, not fixtures.

## Module-level queue probe

`node audit/rc10/scripts/probe-leak.mjs` — imports the app module, builds a
five-state synthetic profile over every row, and checks `selectSession`
(due/weak/new/random/mixed/favorites), `selectSprintSession` and
`selectPrioritySession` (due/weak/new/review) against the pool for five
selections.

- **Before the fix:** 5 failures, all `selectSession:favorites`, leaking B1 rows
  (`ability`, `accept`, `accident`, `active`, `activity`) under C1-only,
  A1-only, B2+C1, all-off and Unclassified-only. All other queues: 0 leaks.
- **After the fix:** handled in-process by passing the filtered deck, which the
  node test suite pins at 256 configurations; the probe is kept as the manual
  reproduction of the original defect.

## Real-browser probe

`node audit/rc10/scripts/verify-rc10.mjs`

Environment: `@sparticuz/chromium@131.0.1` + `playwright-core@1.55.1`, installed
with `--no-save --package-lock=false`; the bundled binary is inflated into
`/tmp/al2023` and launched with `LD_LIBRARY_PATH=/tmp/al2023/lib`. Clock frozen
at `2026-11-02T12:00:00Z` so schedule math is deterministic.

It serves the real `index.html` (17 MB) from an ephemeral port and, for each
selection, seeds a deterministic five-state profile through the app's own
sanitiser and folder, then checks:

1. brand detail, top-bar due counter and the five counting cards all state the
   pool's own numbers (new/due/weak/eligible/random/favourites);
2. all nine session entries (`due`, `weak`, `new`, `favorites`, `random`,
   `quick10`, `quick20`, `quick30`, `sprint`) render headwords that belong to the
   pool — checked on word, gloss, option, match-tile, prompt, reveal and feedback
   nodes, so an option distractor counts as a served word;
3. the study-scope chip is **visible on the study home**, persists, restores
   after a reload, refuses phrase practice in words-only mode with an
   explanation, and leaves both the phrase bank and phrase progress intact.

Selections: C1 only · A1 only (empty) · B2+C1 (default) · everything off (empty) ·
Unclassified only · all levels + Unclassified.

### Known probe limitations (reported, not hidden)

- The probe cannot read a word from some cards whose layout it does not model
  (it prints `NOTE … session ran but this probe read no word from it`). Those
  turns are still validated by the node-level queue tests, which check the item
  list the session was built from.
- The probe reads only the first five turns of a session.
- Browser suites are Chromium-only; Firefox and WebKit were not run.

## CI evidence (PR #81, draft)

Branch head `f31cb08` (PR #81). Run `41430469888`:

| Check | Result |
| --- | --- |
| `checks` (Node suites, Python suites, static gates) | **pass** (3 m 5 s) |
| `browser (chromium)` | **pass** (5 m 53 s) |
| `browser (firefox)` | **pass** (7 m 58 s) |
| `browser (webkit)` | **pass** (10 m 16 s) |
| `CodeRabbit` | **skipping** (not installed for this repository) |

The first push (`183f754`) failed the three browser jobs; the failures were real
and are recorded here because they are the reason the second commit exists:

1. `L is not defined` twice — the new Tra cứu and dashboard pool notes called a
   helper that only exists inside two other render functions.
2. The English interface showed Vietnamese on the study home and the dashboard:
   four new sentences and two counted strings had no dictionary entry, and the
   random-card description had been rewritten without one.
3. The multi-tab race fixture starred unclassified words and then opened a
   favourites session under the default B2+C1 selection — which now correctly
   refuses to start. Every fixture that opens a favourites session now seeds the
   levels its own starred words carry; no assertion was relaxed.

## Local reproduction of the browser suites

```
LD_LIBRARY_PATH=/tmp/al2023/lib BROWSER_ENGINE=chromium bash tests/run-browser-suites.sh
```

Both suites pass locally on chromium 131.0.6778.0 through the
`@sparticuz/chromium` fallback; firefox and webkit were verified in CI only.

## Correction of the earlier test-count statement

An earlier revision of this file and of `STATE.md` said the matrix was
"7 builders x 2 scopes x 128 selections = 256 pool configurations".

- `7 x 2 x 128 = 1,792`, not 256. The claim was arithmetically wrong.
- The number 128 was also unexplained. It is the **number of CEFR selections**:
  six levels give 2^6 = 64 level sets, crossed with the Unclassified switch
  (2) = 128. It is not a number of "combinations" in any other sense.
- The real matrix, counted by `tests/rc10-cefr.test.js` test 2 and enumerated in
  `BUILDERS` there, is 11 vocabulary entry points (6 `selectSession` modes +
  sprint + 4 priority focuses) × 128 selections × 2 study scopes = **2,816**,
  plus the phrase entry point 128 × 2 = **256**, for **3,072** pool
  configurations. Word builders are asserted to return identical queues under
  both scopes, which is what proves Words Only does not alter word study.

## CI evidence on the current head

Head `aec5b79` (PR #81, Draft). Run `41460767841`:

| Check | Result |
| --- | --- |
| `checks` (source/HTML consistency, Python suites, Node static + exam + rc10) | **pass** (3 m 26 s) |
| `browser (chromium)` | **pass** (6 m 37 s) |
| `browser (firefox)` | **pass** (9 m 0 s) |
| `browser (webkit)` | **pass** (10 m 44 s) |
| `CodeRabbit` | **skipping** (integration not enabled for this repository) |

Local runs on the same tree: Python `168 OK`; `node --test tests/static-app.test.js`
`144` pass; `node --test tests/rc10-cefr.test.js` `9` pass.

This CI status proves the **application and existing data** are intact. It does not
advance the data gates: G1–G5 fail on counts (`GATES.md`), and CI cannot make them
pass.

## rc10-3 — third round: reference lanes and the first applied corrections

**What changed in the dataset.** Nine seed rows were re-levelled from a primary
attestation; eight were written (id 1494 accessible B2→C1, 2177 absent B1→C1,
2266 accommodation C1→B1, 2522 access B2→B1, 4861 absolute C1→B2, 4884 abstract
C1→B2, 5450 accomplish C1→B2, 5502 accompany C1→B2). `academic` (4632) was blocked
because B1 triggers the `basic-b1` curation rule and would archive it out of the
study deck. Four A2 attestations were recorded without being written because the
seed set is deliberately B1–C2. No row was deleted, no ID moved, no gloss changed;
the bank is still 5,852 rows.

**Bank after:** B1 1,105 · B2 1,229 · C1 1,830 · C2 775 · Unclassified 913.
**Deck after:** 3,841 headwords (B1 163 · B2 886 · C1 1,275 · C2 674 ·
Unclassified 843), 1,271 archived, default B2+C1 selection 2,161.

**Two snapshot assertions updated, deliberately and narrowly.**
`tests/static-app.test.js` ("the shipped vocabulary keeps every row and every level
is selectable") listed the deck's per-level counts and the default-selection total.
Both are counts of real data, so they moved: `B1 162→163`, `B2 883→886`,
`C1 1279→1275`, default selection `2162→2161`. The assertions were not relaxed —
the totals still have to equal the deck, `A1`/`A2` still have to be zero, the
Unclassified count still has to be 843/913, and the archived/deck/headword counts
(1,271 / 3,841 / 5,112) are unchanged. The `test_evidence_reports` retained-headword
literal (3,841) still passes because the blocked correction kept the deck intact;
with `academic` unblocked it would read 3,840 and one row would silently leave the
deck — which is exactly why the block exists.

**Suites.** `python -m unittest discover -s tests -p 'test_*.py'` → **168 OK**;
`node --test tests/static-app.test.js` → **144 pass**; `node --test
tests/rc10-cefr.test.js` → **9 pass**. Derived reports were regenerated and each
one re-pinned to its original `generatedAt` timestamp so the staleness checks
still mean what they meant.

**Not done, and not claimed.** G1 (5,821 rows still `machine_assessed`), G2 (780
phrase rows), G3 (2,000 headwords), G4 (300 phrases / 200 phrasal verbs), G5.
PR #81 remains **Draft and unmerged**; nothing was tagged, released or deployed.
