# rc10 — resumable state (source of truth, not the chat)

Last updated: 2026-11-02 (third work round). Branch `arena/0eb61237-chuyen-anh`,
base `c427be25c9be`, PR **#81 (Draft, open — never merged, never tagged, never
released, never deployed)**.

## Where the work stands

| Phase | Status | Evidence |
| --- | --- | --- |
| P1 baseline + backup | **done** | `baseline.json`, `backup.md` |
| P2 CEFR leakage fixed at the root | **done** | `cefr-fix.md`, `tests/rc10-cefr.test.js`, `scripts/verify-rc10.mjs` |
| P7a Words Only / Words + Phrases scope | **done** | `cefr-fix.md` §scope, tests 7–9 |
| Test-matrix arithmetic corrected | **done** | 128 selections (2⁶ level sets × 2 Unclassified); 11 vocabulary entry points × 128 × 2 scopes = **2,816**; phrases 128 × 2 = **256**; total **3,072**. The old "7 × 2 × 128 = 256" claim is refuted in test 2 and in `qa.md`. |
| Exam-evidence layer for every entry | **done (archive class)** | `evidence/exam-occurrences-{vocabulary,phrases}.jsonl` + summary |
| **Reference lanes for every entry** | **done** | `evidence/cefrj-crosscheck.jsonl`, `evidence/reference-join.jsonl` + summaries. **5,706 of 5,852 rows** now carry at least one independent reference lane; 146 carry none and are named. |
| **First primary attestations applied** | **done (8 rows written)** | `evidence/reference-attestations.jsonl`, `evidence/corrections-applied.jsonl` |
| **Curation/CEFR decoupled** | **done** | `docs/vocabulary-curation-decisions.json` (1,271 frozen per-row decisions); `tests/test_curation_cefr_independence.py`; `academic` is B1 and still taught |
| P3 audit layer | **complete as a layer, FAIL as a gate** | 5,852 rows dispositioned: **32** individually inspected (incl. `academic`), 5,820 `machine_assessed` |
| P4 audit layer | **complete as a layer, FAIL as a gate** | 780 rows dispositioned: 0 individually verified |
| P5 new headwords | **not started as content** | candidate pipeline built: 1,447 corpus-backed candidates, 0 accepted |
| P6 new phrases | **not started as content** | 0 accepted (target 300 incl. 200 phrasal verbs) |
| P8 full QA | **partial** | Python 168 OK, Node 144 + 9 pass locally; CI green on `89d4021` (previous head) |
| P9 PR | **open, Draft, deliberately not merged** | `GATES.md` |

## Exact outstanding counts (computed from the records, not estimated)

```
vocabulary rows                 5852
  inspected_accepted              13   primary lane agrees with the stored label
  inspected_corrected             10   8 written to the dataset + 2 awaiting the dev4 ledger revision
  inspected_pending_ledger         3   ids 197, 814, 815 — frozen by the dev4 ledger
  inspected_below_scope            4   reference says A2; the seed set is deliberately B1–C2
  inspected_correction_blocked     1   id 4632 `academic` — see "blocked" below
  machine_assessed              5821   <- outstanding for G1
phrase rows                      780
  machine_assessed               780   <- outstanding for G2
new headwords accepted             0   <- outstanding for G3 (target 2000)
new phrases accepted               0   <- outstanding for G4 (target 300 / 200 phrasal verbs)
```

Reference-lane coverage of the 5,852 vocabulary rows:

| Lane | Rows covered | How |
| --- | --- | --- |
| `cefrj` (cefrpy 1.0.3 / CEFR-J index, pinned by sha256) | 5,704 (97.5%) | offline index, joined in one pass |
| `mirror` (third-party transcription of the official Oxford 3000/5000) | 2,835 (48.5%) | offline TSV, fidelity measured at 42/44 = 95.5% against primary entries |
| `primary` (publisher page read per entry) | 25 | the only lane that may change a label |
| any lane | 5,706 | |
| no lane at all | 146 | named in `reference-join.jsonl`, disposition `absent_everywhere` |

Join dispositions: `confirmed_by_lanes` 1,458 · `conflict_primary_needed` 4,223
(3,381 rows are editable, 842 are frozen by the dev4 ledger) · `attested` 25 ·
`absent_everywhere` 146. 149 rows have two or more lanes in unanimous agreement.

## Data changed this round (the only dataset change in rc10 so far)

Nine seed rows were re-levelled from a primary attestation; **eight were written**
and one is blocked. Nothing was deleted, no ID moved, no gloss changed.

| id | word | from | to | why it was written / not written |
| --- | --- | --- | --- | --- |
| 1494 | accessible | B2 | C1 | Oxford list: `accessible adj c1` |
| 2177 | absent | B1 | C1 | Oxford list: `absent adj c1` |
| 2266 | accommodation | C1 | B1 | Oxford list: `accommodation n b1` |
| 2522 | access | B2 | B1 | Oxford list: `access n b1` |
| 4861 | absolute | C1 | B2 | Oxford list: `absolute adj b2` |
| 4884 | abstract | C1 | B2 | Oxford list: `abstract adj b2` |
| 5450 | accomplish | C1 | B2 | Oxford list: `accomplish v b2` |
| 5502 | accompany | C1 | B2 | Oxford list: `accompany v b2` |
| 4632 | academic | B2 | **B1 not written** | attested B1, but that makes the row match `curation-category:basic-b1` and archives it out of the study deck. Blocked in `evidence/correction-blocks.jsonl`; needs a curation keep-decision first. |
| 914, 915, 916, 4686 | ability, accept, accident, abroad | B1 | **A2 not written** | attested A2; the seed set and study surface are deliberately B1–C2, so widening them was not a level audit's decision to make. |
| 197, 814, 815 | Accommodate, Abandon, Absorb | UNCLASSIFIED | **B2 not written** | attested B2, but ids 1–913 are pinned by `tests/test_vocabulary_audit_dev4.py`. |

Resulting bank: B1 1,105 · B2 1,229 · C1 1,830 · C2 775 · Unclassified 913
(total 5,852, unchanged). Shipped deck 3,841 headwords (B1 163 · B2 886 · C1 1,275
· C2 674 · Unclassified 843), 1,271 archived, default B2+C1 selection 2,161.
Two snapshot assertions in `tests/static-app.test.js` were updated to those
values — they are counts of real data, not weakened checks (see `qa.md` §rc10-3).

## Measured throughput of the primary lane (this is the honest constraint)

| Step | Cost | Yield |
| --- | --- | --- |
| 1 `fetch_page` chunk of the Oxford list HTML | ≈8k tokens | ≈44–70 entries |
| transcription → `evidence/oxford-wordlist.jsonl` | — | 44 entries → **25 rows matched** to the bank (57%) |
| of those 25 | — | **16 disagreed** with the stored label (64%), 13 eligible, **8 written**, 4 below scope, 1 blocked |
| whole `cefrj` lane | 1.2 s, no network | 5,852 rows cross-checked |

Extrapolation for G1, stated as arithmetic rather than hope: the Oxford list can
only ever reach the **2,835 rows it covers**; at 25 rows per chunk that is ≈113
chunk fetches (≈0.9M tokens). The remaining **3,017 rows** (mostly C2 and
non-list vocabulary) need one dictionary page each at ≈8–10k tokens per page
≈30M tokens. The offline index lane is what makes reconciliation cheap; it
cannot promote a label, so it does not shorten that path.

## What the next session should do, in order

1. **Continue the Oxford-list sweep.** Fetch the next chunk (the cache currently
   covers `a`–`according to`), transcribe entries into
   `evidence/oxford-wordlist.jsonl`, then re-run, in this order:
   `cefrj-crosscheck.py → oxford-attest.mjs → reference-join.py → build-audit.mjs`.
2. **Apply what the sweep attests**:
   `python3 audit/rc10/tools/apply-attested-corrections.py --dry-run` first, then
   without the flag; then `expand_vocabulary.py`, `build_vocabulary.py`,
   `embed_vocabulary.py`, and every derived report (`vocabulary_cefr_review.py`,
   `generate_vocab_audit_dev5.py`, `audit_vocabulary_quality.py`,
   `audit_learned_vocab.py`, `audit_exam_provenance.py`,
   `rc4_vocabulary_audit.py`), re-pinning each report's original timestamp.
3. **Unblock `academic`** by adding a documented keep-decision for
   academic-register rows to `docs/vocabulary-curation.json`, then re-running the
   applier — the attestation is already recorded.
4. **Decide the dev4 ledger revision** for `meticulous`, `ambiguity`,
   `Accommodate`, `Abandon`, `Absorb` (ids 2, 3, 197, 814, 815). Until then they
   stay `correct_pending_ledger`; do not edit ids 1–913 piecemeal.
5. **P5/P6** unchanged: nothing enters the dataset without a lookup.

## Reproduce everything in this branch

```
export PYTHONPATH=/tmp/cefrpy/src                     # cefrpy 1.0.3, see the tools' docstrings
node audit/rc10/tools/exam-evidence.mjs               # per-entry exam evidence
node audit/rc10/tools/audit-worklist.mjs              # risk-ordered worklist
python3 audit/rc10/tools/cefrj-crosscheck.py          # lane 1: offline index, all rows
node audit/rc10/tools/oxford-attest.mjs               # lane 3: primary attestations from the cache
python3 audit/rc10/tools/reference-join.py            # per-row lane coverage + disposition
python3 audit/rc10/tools/apply-attested-corrections.py --dry-run
node audit/rc10/tools/build-audit.mjs                 # P3/P4 dispositions + summary
node --test tests/rc10-cefr.test.js                   # 9 tests, 3,072 configurations
```

## Environment notes

- **No network from the shell.** `curl` to any host returns 000; only `git`,
  `gh`, `pip` and the `fetch_page`/`web_search` tools reach the internet. That is
  why the Oxford list has to be transcribed through page fetches and why the
  CEFR-J index arrives as a pip download.
- cefrpy is **not** vendored: rebuild with
  `pip download --no-deps --no-binary :all: -d /tmp/pdl cefrpy==1.0.3` and
  `tar xzf … -C /tmp/cefrpy --strip-components=1`. The tool refuses to run if
  `data.bin` does not hash to `21866e2f…`.
- The Oxford mirror lives at `/tmp/oxq` (clone of
  `voothi/20260715190122-oxford-3000-5000`); `reference-join.py` reads it and
  reports `mirror` coverage only.
- `@sparticuz/chromium@131.0.1` + `playwright-core@1.55.1` installed `--no-save`;
  `LD_LIBRARY_PATH=/tmp/al2023/lib`; Firefox/WebKit only in CI.
- The pre-change dataset backup lives at `audit/rc10/backup/data-pre-rc10.tgz`
  (sha256 `579f74fb…`, git-ignored, reproducible from `git archive c427be2`).
