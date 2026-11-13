# Round 9 — continuation report

Everything a follow-up session needs, in the order it would need it.

## State

- Branch `arena/34e7e96d-chuyen-anh`, PR **#86**, open, non-draft,
  `MERGEABLE`, base `arena/chuyen-anh-r8-ready-review` (not retargeted).
- PR #85 open and non-draft at `2f686f7` (Round 8's head); PR #84 untouched.
- `DEPLOY_HOLD` = `v1.0.0-rc11`; both gates return `deploy=false … held`.
- Nothing merged, tagged, released or deployed, and none of that is authorised
  here.

## What is verified, and how

| Check | Result | How to reproduce |
|---|---|---|
| Python unit tests | **285 OK** | `python3 -m unittest discover -s tests -p "test_*.py"` |
| Node tests | **208 pass / 0 fail** (`static-app` + `exam-scoring`) | `node --test tests/static-app.test.js tests/exam-scoring.test.js` |
| Browser suites, Chromium | both green, end to end | see "Running the browser suites locally" in `TEST_INTEGRITY.md` |
| Browser suites, Firefox/WebKit | CI only, green at `3ba0da6` | run `43415336939` |

## The last sha before this pass

`3ba0da6` — green: `43415336939`, 4/4, wall 15 m 05 s, runner-seconds 2 062 s
(chromium 421 s, firefox 603 s, webkit 905 s, checks 133 s).

## Open items, in priority order

1. **R9-B7b** — the 186 external asset digests are unchecked against their bytes.
   Needs network access to the 186 assets; not reachable from this sandbox.
2. **R9-C8** — CI failure capture + artifact upload never observed on a failing
   run. A deliberately failing run on a scratch branch would settle it. Not done:
   it needs a red CI run, which this round's instructions did not authorise.
3. **Screen-reader pass** (`MANUAL_REQUIRED`) — never performed, never claimed.
4. **R9-20** — webkit drift, unexplained. The follow-up recorded in the ledger is
   per-scenario timings inside `browser-learning.cjs`; that suite is 3,200 lines
   and could not be run here at the time, so it was not attempted. It **can** be
   run here now (see below), so this is a realistic next task.
5. **Firefox/WebKit locally** — only Chromium could be made to run in this
   sandbox. A browser binary for the other two was not obtainable from the
   reachable hosts.

## Traps this round paid for

- **A green test is not evidence until a mutation makes it red.** Four tests in
  this project could not fail for the reason they claimed (R9-15 twice, R9-19,
  R9-24). All four looked green.
- **Do not trust your own CSS compositor.** Three hand-rolled attempts produced
  impossible ratios (1.00, 1.06) before pixel sampling with transparent text gave
  numbers that matched exact gradient maths. Verify a measurement with a second,
  independent method before reporting a defect from it.
- **axe `incomplete` is not a pass.** 126 nodes in this app are undecidable by
  axe; that is where the real contrast failures were.
- **`runOnly: [list]` is not a WCAG audit.** Count the rules before writing the
  claim.
- **A rounded-corner element leaks background into a pixel sample.** Use the
  exact computed gradient stops for the confirmation, and treat any ratio within
  ~0.1 of the threshold as unproven until a second method agrees.
- **`aria-label` does not satisfy axe's `empty-table-header`** — the rule wants
  text content. If the source document has no header text, the honest fix is to
  stop claiming it is a header.
- **`playwright install` cannot reach `cdn.playwright.dev` here.** Use
  `@sparticuz/chromium` plus `LD_LIBRARY_PATH` from its `bin/al2023.tar.br`.
- **The theme key is `chuyen-anh.theme.v1`**, not `prefs.darkMode`; setting the
  latter still works via the legacy path, which is exactly how R9-24 hid.
- **A commit touching only `audit-evidence/**` triggers no CI** — touch
  `AGENTS_LOG.md` when the gate must run on the final SHA.
- **`/tmp` does not survive a sandbox reset.** The venv (`/tmp/br`), the Chromium
  and its libraries were rebuilt twice this round.

## If the sandbox was reset

```bash
mkdir -p /tmp/br && cd /tmp/br
npm install --no-save --package-lock=false playwright-core@1.55.1 axe-core@4.14.0 @sparticuz/chromium@133.0.0
/tmp/chromium            # decompressed on first executablePath() call
# extract libnss3/libnspr4/... from node_modules/@sparticuz/chromium/bin/al2023.tar.br
# (brotli) into /tmp/al2023/lib, then:
ln -sfn /tmp/br/node_modules /home/user/Chuyen-Anh/node_modules
LD_LIBRARY_PATH=/tmp/al2023/lib \
BROWSER_ENGINE=chromium BROWSER_EXECUTABLE=/tmp/chromium \
  bash tests/run-browser-suites.sh
```
