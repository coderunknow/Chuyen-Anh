# RC11 version synchronization — PR #85

Task: make the current candidate identify as **`v1.0.0-rc11`**, without rewriting
the history of the published `v1.0.0-rc10`. Companion records:
`COPILOT_85_DISPOSITION.md`, `CODERABBIT_85_DISPOSITION.md`, `CONTINUATION_REPORT.md`.

## 1. Version inventory

| Occurrence | Class | Before | After |
|---|---|---|---|
| `index.html` `export const APP_VERSION` | **active declaration** | `'v1.0.0'` | `'v1.0.0-rc11'` |
| `DEPLOY_HOLD` | **active deploy marker** | `v1.0.0-rc10` | `v1.0.0-rc11` |
| `tests/telemetry-api.test.js` `VALID_VERSION` | runtime/test expectation | `v1.0.0-rc10` | `v1.0.0-rc11` |
| `tests/telemetry_endpoint_smoke.py` `VERSION` default | runtime/test expectation | `v1.0.0-rc10` | `v1.0.0-rc11` |
| `tests/browser-learning.cjs` `#app-version` + `report.appVersion` | runtime/test expectation | `v1.0.0` | `v1.0.0-rc11` |
| `tests/browser-exams.cjs` `#app-version` | runtime/test expectation | `v1.0.0` | `v1.0.0-rc11` |
| `tests/static-app.test.js` `result.version` | runtime/test expectation | `v1.0.0` | `v1.0.0-rc11` |
| `tests/test_sprint_exam_features.py` | runtime/test expectation | `APP_VERSION = 'v1.0.0'` | `…-rc11` |
| `tests/test_deploy_gate.py` hold policy | runtime/test expectation | hold must be `rc10` | hold must equal the shipped prerelease |
| `tests/static-app.test.js` hold policy | runtime/test expectation | hold must be `rc10` | hold must equal the shipped version |
| `tests/pages_smoke.py` | runtime/test expectation | no `rc11` branch (would check **nothing**) | `rc11` branch with 10 markers |
| `tests/test_pages_smoke.py` fixture | runtime/test expectation | fixture lacked rc11 markers | fixture is a real rc11 page |
| `README.md`, `SECURITY.md`, `PRIVACY.md`, `THIRD_PARTY_NOTICES.md`, `CHANGELOG.md`, `audit/v100/FINAL_READINESS_CHECKLIST.md` | current-candidate documentation | candidate described as `v1.0.0` / `rc10` | candidate described as `v1.0.0-rc11` |
| `.github/workflows/*.yml`, `tests/rc10-cefr.test.js` | **historical / unrelated** | `rc10-*` | **unchanged** |
| `CHANGELOG.md` `## v1.0.0-rc10 …` section, `audit/rc10/**`, `DESIGN_LOG.md`/`AGENTS_LOG.md` rc10 entries, `test_app_release_gate.py`/`test_stable_release_path.py` tag fixtures | **historical release record** | `rc10` | **unchanged** |

No blind replacement was performed. `audit/rc10/` is intact; the rc10 changelog
section still says "Status: published prerelease".

## 2. The regression this found

`main` (published rc10) declares `APP_VERSION = 'v1.0.0-rc10'`; PR #85's base
declared `APP_VERSION = 'v1.0.0'` — the suffix was **dropped**. That is not cosmetic:
`scripts/app_release_gate.py` classifies a version with no dash as **stable**
(`is_stable = '-' not in version`), so the candidate was asking the gate for the
stable-deploy authorization path and describing itself as stable. RC11 restores a
prerelease identity and goes one release forward.

## 3. Fail-closed behaviour, verified against the live repository

```
$ python3 scripts/deploy_gate.py --repo coderunknow/Chuyen-Anh
deploy-hold gate: deploy=false (release v1.0.0-rc11 is missing; deployment held)

$ GITHUB_REPOSITORY=coderunknow/Chuyen-Anh python3 scripts/app_release_gate.py
app-release gate: deploy=false (application release v1.0.0-rc11 not verified; held)
```

Both gates read the live GitHub release state. The published `v1.0.0-rc10` cannot
satisfy either: they ask for the exact tag `v1.0.0-rc11`. The extra stable-release
authorization gate is untouched and still applies to a version without a suffix.

## 4. Acceptance criteria

- [x] `index.html` declares `v1.0.0-rc11`.
- [x] `DEPLOY_HOLD` names `v1.0.0-rc11`, and the published rc10 cannot satisfy it (verified above).
- [x] User-facing version surfaces show rc11: the About panel and the data panel both render `APP_VERSION`; the pages probe reads the served page and passes on the rc11 string.
- [x] Exported exam-result metadata carries `APP_VERSION` (`buildExamResultJson` → `appVersion`), pinned by test.
- [x] Every shipped version literal agrees with `APP_VERSION` (the repository's own version-consistency test passes; it had been failing on five pins I had not moved).
- [x] Telemetry validation still accepts only the release-shaped version (`/^v\d+\.\d+\.\d+(-[a-z]+\d+)?$/`) and rejects arbitrary strings; only the *default* moved to rc11.
- [x] Deploy and release gates remain fail-closed (commands and output above).
- [x] Historical rc10 records remain accurate and untouched.
- [x] No active documentation calls rc10 the current candidate.
- [x] No `v1.0.0-stable` declaration anywhere; `grep -r "v1.0.0-stable"` outside this report's own explanation returns nothing.
- [x] Copilot's 10 review comments dispositioned; 5 code fixes, each mutation-checked.
- [x] Local regression: Node **301/301**, Python **263 OK**, archive **5 OK**, `ci.yml` gates **21/21**, pages probe **PASS**.
- [ ] Exact-final-SHA CI (checks, validate, chromium, firefox, webkit) — recorded below once the head is known.
- [ ] Independent re-review of the RC11 commit — CodeRabbit was rate-limited on the previous request; a new request is made on the final SHA and the outcome recorded whatever it is.
- [ ] Screen-reader validation — **INCOMPLETE**, human work specified in `accessibility/EXAM_HISTORY_MANUAL_CHECKLIST.md`.

## 5. Commands executed (actual results)

| Command | Result |
|---|---|
| `node --test tests/*.test.js` | `# tests 301 / pass 301 / fail 0` (two consecutive full runs) |
| `python -m unittest discover -s tests -p 'test_*.py'` | `Ran 263 tests … OK` |
| `scripts/exams/test_archive.py` (venv + pinned requirements) | `Ran 5 tests … OK` |
| 21 validator commands extracted from `ci.yml` | `GATES pass=21 fail=0` |
| `python tests/pages_smoke.py` against a local server | `pages probe passed` (`v1.0.0-rc11`, all 10 rc11 markers) |
| `python scripts/deploy_gate.py --repo …` | held (rc11 missing) |
| `python scripts/app_release_gate.py` | held (rc11 not verified) |

## 6. Failures met while doing this, and what they were

1. **The version-consistency gate failed on five pins** I had not moved
   (`browser-learning`, `browser-exams`, `static-app`, `test_sprint_exam_features`,
   `PRIVACY.md`). The gate was right; the pins were moved. It also caught a pin
   `/^v1\.0\.0$/` that would have passed *by accident* on rc11, now anchored.
2. **`pages_smoke.py` had no `rc11` branch.** Left alone, publishing rc11 would have
   passed the version line and then checked **nothing else** — a smoke test that
   silently stops smoking. Added the branch and proved it is not vacuous: stripping
   one marker from the fixture makes the probe exit 1.
3. **`test_deploy_gate.py` and `static-app.test.js` encoded the old hold policy**
   ("a PR-only candidate keeps the hold at the last published release"). RC11
   reverses that policy, so both were rewritten to assert the new invariant and,
   more importantly, that the hold is *fail-closed* and not satisfiable by rc10.
4. **A full-suite run showed `rc7: no generated question … prints its answer early`
   failing once** (`6947 mc_en_vi option leaks: đường ray, lan can`) while the same
   test passed in isolation and in two subsequent full runs. I could not reproduce
   it in three further attempts, so it is recorded as an unreproduced flake, not as
   fixed. The test uses the real dataset and a randomized ordering, which is the
   likely cause; it is **not** attributed to the RC11 change and I am not claiming
   it is gone.
5. **`/tmp/r8/gates.sh` and the venv were gone** (ephemeral `/tmp`). Rather than
   reuse a remembered count, the runner was re-derived from `ci.yml` by parsing the
   validator step (15 `--check` + 4 plain + 2 node commands = 21), and the venv was
   rebuilt from `scripts/exams/requirements.txt`.

## 7. Historical references deliberately preserved

`audit/rc10/**` (41 files), the `## v1.0.0-rc10` changelog section, every rc10 entry
in `DESIGN_LOG.md`/`AGENTS_LOG.md`, `tests/rc10-cefr.test.js`, the `rc10` fixture
tags in `test_app_release_gate.py`/`test_stable_release_path.py`, and the published
release/tag on GitHub. None were modified. RC10 remains a real, published prerelease.
