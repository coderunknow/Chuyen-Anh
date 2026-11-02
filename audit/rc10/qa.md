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
