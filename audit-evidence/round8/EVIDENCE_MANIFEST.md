# Round 8 — evidence manifest

Everything a claim in this directory points at, and how to re-derive it. Where a
result cannot be reproduced from the repository alone, that is stated rather than
implied.

## Code and tests changed in this round

| File | Change |
|---|---|
| `index.html` | Asynchronous, lock-guarded, tombstone-based exam-history persistence; `inspectExamResultStore`; `clearExamResultHistory`; `examCorrectionPaperKeys`; one shared correction-length rule enforced at four boundaries; schema-compatible `generation`/`tombstones`/`legacyOverLimit`; async UI callers |
| `tests/exam-persistence.test.js` | **New** — 22 adversarial tests (concurrency interleavings, Delete/Clear semantics, storage failures, retries, correction limits, historical migration, snapshot selection, scoring) |
| `tests/test_script_help.py` | **New** — 5 tests: `--help` has no side effects (D75) |
| `tests/exam-scoring.test.js` | Every caller awaits the new async API; the `conflicting-paper` assertion became an explicit `ok/reason` assertion; one added tombstone case |
| `tests/core-invariants.test.js` | The oversized-import test awaits |
| `tests/test_seed_level_provenance.py` | Negative control for the multiword headword fix |
| `.github/workflows/ci.yml`, `.github/workflows/deploy.yml` | Run the new Node suite |
| `scripts/release_artifacts.py` | `argparse` + `cli()`; docstrings on the release path (D64) |
| `scripts/exams/build_archive.py` | `argparse` + `cli()` |
| `audit/v100/FINAL_READINESS_CHECKLIST.md`, `CHANGELOG.md` | Current totals; the gate tests recompute both and fail if either drifts |

## Raw logs in this directory

| File | What it is |
|---|---|
| `logs/node-baseline.log` | `node --test` over the 8 suites at the starting SHA — 266 pass |
| `logs/python-baseline.log` | `unittest discover` at the starting SHA — 257 OK |
| `logs/node-after.log` | The run at `bbe957d`, 9 suites — **288 pass / 0 fail** (kept as history) |
| `logs/node-after-review-fixes.log` | The run after the review fixes, 9 suites — **296 pass / 0 fail** (kept as history) |
| `logs/node-rc11.log` | The current run on this branch (RC11), 9 suites — **301 pass / 0 fail** |
| `logs/python-final.log` | `unittest discover` on this branch — **263 OK** |
| `logs/gates-final.log` | The 21 `ci.yml` `--check` commands, run verbatim — **21 pass / 0 fail** |
| `logs/archive-suite.log` | `scripts/exams/test_archive.py` in a venv with `scripts/exams/requirements.txt` — **5 OK** |
| `logs/pr84-review-threads.json` | The live GraphQL response for PR #84's review threads (38 total, 11 unresolved) |
| `logs/repro-score-mismatch-at-start-sha.mjs` | The reproduction, parameterised to run against `e663295`'s `index.html` |
| `logs/repro-score-mismatch-at-start-sha.log` | The reproduction at the starting SHA: **`THREW: Conflicting stored exam history: score-mismatch`**, final store `['a1','a2']` — tab B's `b1` never saved |
| `logs/repro-score-mismatch-after-fix.log` | The same script on this branch: saves, final store `['a1','a2','b1']` |

## How to re-derive each headline number

```bash
# Node (301) — the list is the one ci.yml runs, plus the new suite.
node --trace-deprecation --test tests/static-app.test.js tests/exam-scoring.test.js \
  tests/exam-anomalies.test.js tests/rc10-cefr.test.js tests/v100-senses.test.js \
  tests/exam-exempt-rubric.test.js tests/core-invariants.test.js \
  tests/telemetry-api.test.js tests/exam-persistence.test.js

# Python (263)
python -m unittest discover -s tests -p 'test_*.py'

# Archive suite (5) — needs the pinned dependencies, exactly as ci.yml installs them.
python -m venv /tmp/exam-archive-venv
/tmp/exam-archive-venv/bin/pip install -r scripts/exams/requirements.txt
/tmp/exam-archive-venv/bin/python scripts/exams/test_archive.py

# Validator gates (21) — extracted from ci.yml, never discovered by probing.
python - <<'PY'
import re, pathlib
text = pathlib.Path('.github/workflows/ci.yml').read_text()
step = text.split('Check vocabulary sources and embedded HTML', 1)[1].split('- name:', 1)[0]
for line in step.splitlines():
    line = line.strip()
    if line.startswith(('python ', 'node ')):
        print(line)
PY
```

The gate list is **read from the workflow**, not probed with `--help`. That is
deliberate: `FAILURE_LEDGER.md` F4 records why probing executes the build tools.

## Mutation checks performed (a guard is only worth its control)

| Guard | Mutation applied | Result |
|---|---|---|
| `tests/test_seed_level_provenance.py::test_a_word_is_not_attested_by_a_multiword_headword_that_contains_it` | restore `re.split(r"[,/\s]+", head)` in `oxford_index` | **2 tests fail** (the new control *and* the older shape test) — restored, suite green |
| `tests/test_ci_gate_coverage.py` (Node row) | add `tests/exam-persistence.test.js` without updating the checklist row | gate fails naming the missing suite; passes once the row states `exam-persistence` (`35`) and `PASS (296/296)` |
| `tests/test_audit_document_counts.py` (changelog totals) | change the checklist's Python total to `263` while the changelog still says `257` | fails with `263 != 257`; passes when both agree |
| `tests/test_script_help.py` | the round-7 shape (no parser) | would execute: the fake `gh` on `PATH` records the call and the tree digest changes. The shipped parser makes both assertions pass |

## What is **not** covered by evidence in this directory

* **Browser suites** — not run here (`BLOCKED_EXTERNAL`, `FAILURE_LEDGER.md` F1); the
  only valid result is CI's `browser (chromium|firefox|webkit)` on the exact final SHA.
* **CI on the exact final head SHA** — recorded in `CONTINUATION_REPORT.md` once available.
* **CodeRabbit on the exact final head SHA** — same.
* **Screen-reader validation** — `accessibility/EXAM_HISTORY_MANUAL_CHECKLIST.md`, `INCOMPLETE`.
