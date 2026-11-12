# Round 7 — evidence manifest

> **Reconstructed document**, rewritten after the untracked working tree was
> lost. Unlike the original, this one is committed to Git — see `H16` in
> `FAILURE_LEDGER.md` for why that distinction is the point.

## What is in this directory

| Path | Kind | Notes |
|---|---|---|
| `CONTINUATION_REPORT.md` | Reconstructed (A–G), live (§H) | The report; §H written during this session |
| `CHECKLIST.md` | Reconstructed | 15-criterion rubric with binary statuses |
| `FINDINGS.md` | Reconstructed | D65–D74 plus carried-forward items |
| `FAILURE_LEDGER.md` | Reconstructed | H9–H16, including this audit's own mistakes |
| `COVERAGE_MATRIX.md` | Reconstructed | 18 cases for the settings import |
| `accessibility/MANUAL_SCREEN_READER_CHECKLIST.md` | Original method, criterion open | Human checklist; criterion 8 stays INCOMPLETE |
| `logs/final-sha-verification.log` | **Live** | Commands and output, re-executed at the final SHA |
| `logs/RECONSTRUCTION_NOTICE.md` | Live | States exactly what was lost and what was rebuilt |
| `scripts/` | **Lost, not restored** | Interactive probes; see below |

## The probe scripts

`r7-device-settings-ui.mjs` (14 checks), `r7-import-keyboard.mjs` (19),
`r7-toast-args.mjs` (66 literals / 0 untranslated), `r7-chip-state.mjs`,
`r7-contrast.mjs` (6.84 / 8.32), `r7-toast-coverage-all.mjs` were hand-written
harnesses living only in the working tree. **They are gone and have not been
rewritten.** Rewriting them from memory would produce a script that agrees with
the conclusions it is supposed to test — the failure mode described in `H9`.

What that means for each claim:

- Claims that a **committed test** covers are unaffected — those tests re-run and
  are the authority: `static-app` (146), `exam-scoring` (60), and the five other
  Node files; the Python suite's 257.
- Claims resting **only** on a probe are recorded in `COVERAGE_MATRIX.md` with
  their method, so a later agent can rebuild them deliberately, and are marked
  reconstructed. They should be re-derived before anyone relies on them again.

## How to re-derive each measurement

Everything below was executed at the SHA in the log header. Nothing needs a
network connection except the optional browser install.

**Node suites** (one process per file; totals are per-file `# pass`):
```bash
for t in tests/*.test.js; do node "$t"; done
```

**Python suite:**
```bash
python3 -m unittest discover -s tests -p "test_*.py"
```

**Archive suite** (needs its own pinned dependencies):
```bash
python3 -m pip install --break-system-packages -r scripts/exams/requirements.txt
python3 scripts/exams/test_archive.py
```

**Validator gates.** The authoritative list is **not** derived by probing scripts
— it is the list `ci.yml` invokes explicitly, in its "Check vocabulary sources and
embedded HTML" step. Earlier revisions of this file invented a `--help` sweep to
discover gates, and that was wrong in three compounding ways:

1. It **executed** scripts to classify them. Six scripts in `scripts/` have no
   argument parser and act on import: `exams/discover.py` makes network requests,
   `exams/packages.py` extracts files, `exams/coverage.py` and
   `exams/review_sources.py` write reports, and `exams/build_archive.py` rebuilds
   archive sources. `release_artifacts.py` shells out to `gh release create
   --draft` — under `DEPLOY_HOLD` that is unacceptable. Probing then allowlisting
   is a side effect, not a check (CodeRabbit `4548054140`).
2. It **under-counted**. A skip list built from the first two failures missed the
   other four, so the "17 gates" total was a coincidence of which scripts happened
   to crash in this environment, not a property of the repository.
3. It was **environment-dependent**. Three scripts failed only because `requests`
   and `PyMuPDF` were absent after a sandbox reset, which silently changed the
   gate set.

The recipe now reads the commands out of `ci.yml` and runs exactly those. Nothing
is probed, so nothing can act on the repository or the network:

```bash
set -u
# Extract the commands the workflow itself runs and execute those, verbatim.
mapfile -t gates < <(sed -n '/Check vocabulary sources and embedded HTML/,/Run Python unit tests/p' \
  .github/workflows/ci.yml | grep -E '^\s+(python|node) scripts/' | sed 's/^ *//')
fail=0; pass=0
for g in "${gates[@]}"; do
  if bash -c "$g" >/dev/null 2>&1; then pass=$((pass+1)); echo "PASS  $g"
  else fail=$((fail+1)); echo "FAIL  $g"; fi
done
echo "gates: $pass passed, $fail failed (of ${#gates[@]})"
[ "$fail" -eq 0 ] && [ "${#gates[@]}" -eq 21 ]
```
Expected: `gates: 21 passed, 0 failed (of 21)`, exit 0. The count assertion is
what stops a silent shrink: "0 failed" is true and useless if only three gates
ran.

Note this runs the two `node` gates too, and it runs `validate_vocab.py` and
`validate_phrases.py` (plain validators, no `--check` flag) because CI runs them.
A `--check`-only sweep silently omitted all four.

**Browser suites.** Playwright's own browser download was unavailable for part of
this session (a CDN outage), so the `@sparticuz/chromium` fallback was used:
```bash
npm install --no-save --package-lock=false \
  playwright-core@1.55.1 @sparticuz/chromium@133.0.0 axe-core@4.14.0
node -e "require('@sparticuz/chromium/build/lambdafs').default
  .inflate(require('path').join(require('path').dirname(
    require.resolve('@sparticuz/chromium')),'../bin/chromium.br'))"
node -e "require('@sparticuz/chromium/build/lambdafs').default
  .inflate(require('path').join(require('path').dirname(
    require.resolve('@sparticuz/chromium')),'../bin/al2023.tar.br'))"
BROWSER_ENGINE=chromium BROWSER_EXECUTABLE=/tmp/chromium \
  LD_LIBRARY_PATH=/tmp/al2023/lib node tests/browser-learning.cjs
BROWSER_ENGINE=chromium BROWSER_EXECUTABLE=/tmp/chromium \
  LD_LIBRARY_PATH=/tmp/al2023/lib node tests/browser-exams.cjs
```
Two traps: `npm install` with `--no-save` **prunes** packages not named in the
same command, so all three must be installed together; and the inflated chromium
is a single executable at `/tmp/chromium`, not a directory.

**A control must fail.** For any repair-path test, delete the fix and confirm the
test fails, then restore. `logs/final-sha-verification.log` records the two
control runs for `9edc2a0`.

## Environment limits (not defects in the repository)

- No screen reader: no AT-SPI, no `pyatspi`, no display, Debian mirror
  unreachable. Blocks criterion 8.
- No Kilo credits on the app account. Blocks criterion 10.
- The sandbox resets discard uncommitted work and `/tmp`; pip packages and the
  extracted browser must be reinstalled. This is what destroyed the original
  evidence directory — commit evidence in the same chunk as the measurement.
