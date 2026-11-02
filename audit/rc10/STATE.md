# rc10 — resumable state (source of truth, not the chat)

Last updated: 2026-11-02. Branch `arena/0eb61237-chuyen-anh`, base `c427be25c9be`,
PR **#81 (Draft, open — never merged)**.

## Where the work stands

| Phase | Status | Evidence |
| --- | --- | --- |
| P1 baseline + backup | **done** | `baseline.json`, `backup.md` |
| P2 CEFR leakage fixed at the root | **done** | `cefr-fix.md`, `tests/rc10-cefr.test.js`, `scripts/verify-rc10.mjs` |
| P7a Words Only / Words + Phrases scope | **done** | `cefr-fix.md` §scope, tests 7–9 |
| Test-matrix arithmetic corrected | **done** | 64 level sets × 2 Unclassified = 128 selections; 11 vocabulary entry points × 128 × 2 scopes = **2,816**; phrases 128 × 2 = **256**; total **3,072** configurations. The old "7 × 2 × 128 = 256" claim is refuted in test 2 and in `qa.md`. |
| Exam-evidence layer for every entry | **done (archive class)** | `evidence/exam-occurrences-{vocabulary,phrases}.jsonl` + summary |
| P3 audit layer | **complete as a layer, FAIL as a gate** | 5,852 rows dispositioned: 6 individually verified, 5,846 `machine_assessed` |
| P4 audit layer | **complete as a layer, FAIL as a gate** | 780 rows dispositioned: 0 individually verified |
| P5 new headwords | **not started as content** | candidate pipeline built: 1,447 corpus-backed candidates, 0 accepted |
| P6 new phrases | **not started as content** | 0 accepted (target 300 incl. 200 phrasal verbs) |
| P8 full QA | **partial** | Python/Node/Chromium green locally; CI green on `f31cb08` |
| P9 PR | **open, Draft, deliberately not merged** | `GATES.md` |

## Exact outstanding counts (computed, not estimated)

```
vocabulary rows                 5852
  inspected_accepted               4
  inspected_corrected (pending)    2
  machine_assessed              5846   <- outstanding for G1
phrase rows                      780
  machine_assessed               780   <- outstanding for G2
new headwords accepted             0   <- outstanding for G3 (target 2000)
new phrases accepted               0   <- outstanding for G4 (target 300 / 200 phrasal verbs)
```

## What the next session should do, in order

1. **Apply the two verified corrections** (ids 2 `Meticulous`, 3 `Ambiguity` → C2,
   Cambridge-attested). They are blocked by the frozen dev4 ledger window
   (ids 1–913): write the ledger revision with a dated note, update
   `tests/test_vocabulary_audit_dev4.py` only if the revision is genuinely
   recorded, then rebuild
   `build_vocabulary.py → embed_vocabulary.py` and every `--check` report.
2. **Continue the per-entry review in batches of 25–50**, appending to
   `evidence/manual-verifications.jsonl` (schema in `METHODOLOGY.md` §2) and
   re-running `node audit/rc10/tools/build-audit.mjs` after each batch. Batch
   commits, one per batch.
3. **P5/P6**: take candidates from `evidence/new-word-candidates.json`, look each
   one up, and only then add a row. Nothing enters the dataset without a lookup.
4. Re-run `GATES.md` and only then consider promoting PR #81 out of Draft.

## Reproduce everything in this branch

```
node --test tests/rc10-cefr.test.js                  # 9 tests, 3,072 configurations
node audit/rc10/tools/exam-evidence.mjs              # per-entry exam evidence (needs /tmp/english-words.txt only for the candidate tool)
node audit/rc10/tools/audit-worklist.mjs             # risk-ordered worklist
node audit/rc10/tools/build-audit.mjs                # P3/P4 dispositions + summary
node audit/rc10/tools/new-word-candidates.mjs        # P5 candidate pool
node audit/rc10/scripts/verify-rc10.mjs              # real browser probe
```

## Environment notes

- `@sparticuz/chromium@131.0.1` + `playwright-core@1.55.1` installed `--no-save`;
  `LD_LIBRARY_PATH=/tmp/al2023/lib`; Chromium runs locally, Firefox/WebKit only in CI.
- `/tmp` is not persisted: `english-words.txt` (264k lemmas, shape filter only) must
  be rebuilt from the `english-words` wheel before running the candidate tool.
- The pre-change dataset backup is committed nowhere; it lives at
  `audit/rc10/backup/data-pre-rc10.tgz` (sha256 `579f74fb…`) and is reproducible
  from `git archive c427be2`.
