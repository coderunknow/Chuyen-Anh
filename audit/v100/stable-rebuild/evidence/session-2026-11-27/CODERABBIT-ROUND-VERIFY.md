# Session 6b — CodeRabbit review round on `f58fd93` (2026-11-27)

The session-6 push requested a CodeRabbit review (`@coderabbitai review`,
comment 7216143010). CodeRabbit posted one review (id 6087003324) with
**18 actionable inline comments** — 3 Major (Security & Privacy, all in
`scripts/scan_workflow_injection.mjs`) and 15 Minor. Every finding was
verified against the current code before fixing (repro first where
applicable); **all 18 were valid and all 18 are fixed** in the follow-up
commit. Nothing was dismissed.

## Verification and fix register

| # | Comment | Severity | Verdict | Fix | Control |
| --- | --- | --- | --- | --- | --- |
| 1 | 4718454999 — matrix `include` entries can inject into a key the base matrix proved literal | Major | CONFIRMED (repro: fallback `{}` on poisoned workflow) | `includeEntriesAreLiteral`: any expression-bearing include/exclude entry drops the whole per-job allowlist (parsed + fallback) | new tests: poisoned include flagged both modes; literal-only include stays clean |
| 2 | 4718455017 — `[^}]+?` missed `${{ format('{0}', github.head_ref) }}` | Major | CONFIRMED (repro: no finding) | expression scan reads to the first real `}}`; unterminated `${{` flags the tail | new test: format-expression flagged both modes |
| 3 | 4718455024 — quoted `"run":` keys silently skipped by the fallback | Major | CONFIRMED (repro: no finding) | fallback `run:` regex accepts quoted keys (optional `"-`/`'-`, backreferenced close before the colon) | new test: quoted inline + quoted block flagged both modes |
| 4 | 4718454751 — URL user-info redaction consumed past `?`/`#` (false redaction of `https://api.example.test?contact=alice@localhost/path`) | Minor | CONFIRMED (live repro on both scrubbers) | `[^\s/@]+@` → `[^\s/?#@]+@` in BOTH `api/telemetry.js` and the client copy; comments updated | 2 new assertions per suite (query + fragment intact); 2 new mutants (boundary dropped) — **12/12 killed** |
| 5 | 4718454762 — baseline repro needs a locking Node | Minor | CONFIRMED (sandbox has no `navigator.locks`) | `REPRODUCTION_COMMANDS.md` gains the explicit precondition + check command | doc review |
| 6 | 4718454781 — method note names three untracked scripts | Minor | CONFIRMED (`git ls-files`: none tracked) | note now states the helpers were session-local one-offs and that steps 2–3 describe them fully; outputs ARE tracked | doc review |
| 7 | 4718454790 — `B_alignmentProbe` printed a fixed "0 failures" string never measured | Minor | CONFIRMED | `probe_exam_integrity.py` now RUNS `probe_question_alignment.mjs`, records its real totals/failureCount/exit, and adds any nonzero failure to `problems`; unused `b_bad` removed; `exam-integrity.json` regenerated from the probes (verified: 106/6708/6708, 0 failures) | regenerated artifact + exit status |
| 8 | 4718454802 — alignment probe never enforced the B4 totals it printed | Minor | CONFIRMED (one removed paper would still exit 0) | probe fails on papers ≠ 106, questions ≠ 6708, or unique ≠ parsed | live run: 106/6708/6708 enforced, exit 0 |
| 9 | 4718454814 — `fallback exit=0` trailer made the JSON unparseable | Minor | CONFIRMED | both scan reports regenerated as pure JSON with `exit` as a property | `json.load` on both |
| 10 | 4718454825 — same for the parsed report | Minor | CONFIRMED | same fix | same |
| 11 | 4718454833 — checklist referenced untracked `work/evidence/` paths | Minor | CONFIRMED (2 refs) | both rows now point at the tracked `audit/v100/stable-rebuild/evidence/` copies | grep: 0 refs left |
| 12 | 4718454945 — CHANGELOG said "published AND authorized" but force+authorized can deploy an unpublished stable release | Minor | CONFIRMED (gate path `force and stable and not stable_auth` → deny; `force` alone → allow for prerelease; `force+auth` → allow even unpublished stable) | behaviour RETAINED (designed D15 escape hatch) and now documented truthfully in CHANGELOG, `deploy.yml` input descriptions, and the gate docstring | `test_app_release_gate` + `test_deploy_gate` 32/32 unchanged |
| 13 | 4718454955 — curated entries naming an unknown examId escape every hash check | Minor | CONFIRMED (loop only walks embedded papers) | orphan examIds tracked, reported (`curatedOrphanExamIds`/sample), verdict fails on any | live run: 0 orphans, verdict still OK |
| 14 | 4718454968 — distractor pool check counted distinct words, not distinct meanings | Minor | CONFIRMED (60 words/1 gloss would pass) | per-level distinct-meaning floor (≥4: a 4-option board needs 3 others) added | live run: 0 defects |
| 15 | 4718454978 — `mutation_ds1.mjs` cannot catch mutants on lockless hosts | Minor | CONFIRMED (this sandbox reproduces the failure) | deterministic `navigator.locks` stub for the locking context; both environments host-independent | harness exit 0 HERE (previously failed) |
| 16 | 4718454989 — pglite evidence crashes (`old.res` of null) when the window changes on every retry | Minor | CONFIRMED (`withStableWindow` returns `{value: null}`) | all three output blocks (A, B1, B2) guard the inconclusive case and print it explicitly | `node --check` + short-circuit review |
| 17 | 4718455035 — requirements-file existence didn't check the PyYAML pin | Minor | CONFIRMED | test now asserts `^PyYAML == \d` inside `tests/requirements.txt` | control: emptied file → test FAILS |
| 18 | 4718455041 — a comment mentioning the path satisfied the install check | Minor | CONFIRMED | test requires an actual `python -m pip install … -r tests/requirements.txt` command BEFORE `unittest discover` in BOTH workflows | control: command removed → test FAILS |

Plus one summary-body refinement folded into #16: the B2 verdict predicate now
also requires `b2.firstGlobal === 120` (the committed evidence run satisfies
it: `pglite-rate-limit-evidence.txt` shows `firstGlobalRefusal=120`).

## Gates at the CodeRabbit-fix head

- Canonical CI Node set: **289/289**; scanner suite now **13 pass + 1
  documented skip** (4 new tests); telemetry suite 19/19; Python **303/303**;
  archive **5/5**; shard partition OK.
- `mutation_cr_scrub.mjs`: **12/12 mutants killed** (2 new boundary mutants).
- `mutation_ds1.mjs`: **OK on a lockless host** (deterministic stub).
- Clean-tree workflow scan: **0 findings in both parser modes** (8 workflows).
- All four session-6 probe batteries re-run at this head: **0 flags**; exam
  core unchanged (106 papers / 6,708 questions / 3,292 scorable items /
  0 crashes / 0 invariant violations).
- Release/deploy gates: held as designed; `DEPLOY_HOLD` untouched.
