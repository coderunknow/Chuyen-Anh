# rc10 — resumable state (source of truth, not the chat)

Last updated: 2026-11-03 (fourth work round). Branch `arena/0eb61237-chuyen-anh`,
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
| Reference lanes for every entry | **done** | `evidence/reference-resolutions.jsonl` — a disposition per row, each naming the reference consulted |
| Curation/CEFR decoupled | **done** | `docs/vocabulary-curation-decisions.json` (1,271 frozen per-row decisions); `tests/test_curation_cefr_independence.py` |
| **P3 / G1 — every vocab row revalidated** | **PASS** | 7,852/7,852 rows (the 2,000 new rows carry `verified_new_reference`): `verified_agree` 576 · `verified_precedence` 1,006 · `verified_corrected` 915 · `verified_below_scope` 1,010 · `pending_ledger` 425 · `no_reference` 1,920. 1,921 corrections written with per-row source. `machine_assessed == 0`. |
| **P4 / G2 — every phrase row revalidated** | **PASS** | 1,094/1,094: `phrase_listed` 6 (agree 2 · corrected 2 · precedence 2) · `no_phrase_reference` 774 · `verified_constituent_bound` 314. `audit/rc10/GATES.md` § Phrase policy |
| **P5 / G3 — new headwords** | **PASS (exactly 2,000)** | `evidence/new-headword-evidence.jsonl` (2,251 authored rows), `evidence/gloss-batches/batch1…8.txt`, `evidence/new-word-pool.json` (3,068 candidates). Bank 5,852 → 7,852 rows; **2,000 new headwords**, 0 removed. |
| **P6 / G4 — new phrases** | **PASS** | **314 accepted** (phrasal-verb 228 · idiom 52 · collocation 18 · dependent-preposition 15 · fixed-expression 1); bank 780 → 1,094 rows, phrasal verbs 184 → 412. `evidence/new-phrase-pool.json` (343 of 1,192 candidates), `evidence/new-phrase-evidence.jsonl`, authored batches in `evidence/phrase-batches/`. |
| P8 full QA | **green** | Python **176 OK** · `static-app.test.js` **144 pass** · `rc10-cefr.test.js` **9 pass** · CI green on `3313b6e`: run `41622636566` (checks + all three browsers) and `41622636304` (exam archive); PR body rewritten to the measured state and pushed |
| P9 PR | **open, Draft, deliberately not merged** | `GATES.md`, `PR-BODY.md` |

## Exact counts (computed from the records, not estimated)

```
vocabulary rows                 7852   (913 legacy + 6939 seed)
  headwords                     7112   (rows minus 740 same-root forms)
  archived (out of study deck)  1271
  focus deck                    5841   = 3841 pre-rc10 + 2000 new headwords
  level-tagged deck   B1 757 · B2 1714 · C1 1638 · C2 889 · UNCLASSIFIED 843
  default B2+C1 selection       3352
phrase rows                     1094    phrasal-verb 412 · collocation 210 · idiom 185 ·
                                       dependent-preposition 120 · linker-phrase 90 ·
                                       pattern 76 · fixed-expression 1
  phrase levels                  B1 387 · B2 324 · C1 304 · C2 79
new headwords accepted          2000   <- G3 met
new phrases accepted             314   <- G4 met (228 phrasal verbs / 314 total)
seed candidates skipped        1536    duplicate 897 · word-family 562 · inflection 60 ·
                                       spelling 16 · comparative 1
```

G3 breakdown of the 2,000 landed headwords: level B1 261 · B2 739 · C1 642 · C2 358;
POS n 1,084 · adj 499 · v 341 · adv 76; level source Oxford 3000/5000 610 ·
CEFR-J 1.5 734 · Octanove C1/C2 656; **1,206 also exam-attested** (3,629 locators
across the transcribed papers), 794 list-only.

## Data changed in rc10 (cumulative)

* 1,921 vocabulary rows re-levelled from a published reference (per-row source in
  `evidence/corrections-applied.jsonl`); no row deleted, no ID moved, no gloss
  invented.
* 2,000 new headwords appended (IDs 5,853–7,852) from `data/vocab-seed/21-exam-corpus-expansion.tsv`,
  each with an authored Vietnamese gloss and an evidence record.
* 2 phrase rows re-levelled (`evidence/corrections-applied.jsonl`, kind `phrase`).
* 16 low-value single-list candidates dropped **on the record** to keep G3 at
  exactly 2,000 (named in `GATES.md`); 4 words with no lexicon entry
  (`planning`, `breathtaking`, `counterproductive`, `elitist`) and 13 lines that
  `add-headwords.py` refused never entered the seed file.

## What the next session should do, in order

1. Read the browser-engine CI on the final head (Chromium/Firefox/WebKit) and add
   the run id to `GATES.md` G14 — the only gate whose evidence is not local.
2. Keep the two rc10 pipelines reproducible in the order documented in `GATES.md`
   §G3 and §G4: both *require* restoring the pre-round bank/JSON first, because
   the pool refuses anything already present (that is by design, and it is why an
   un-restored rerun reports "already in bank" for everything).
3. Re-run the whole chain after any data change and re-pin counts **only** to
   measured values (`expand_vocabulary.py` → `build_vocabulary.py` →
   `embed_vocabulary.py`; `vocabulary_cefr_review.py`; `rc4_vocabulary_audit.py`;
   `audit_vocabulary_quality.py`; `vocabulary_evidence_review.py`;
   `docs/vocabulary-families.json` counts; `README.md` opening line).
3. Keep G15 honest: update the PR body with the real numbers, keep it Draft,
   never merge/tag/release/deploy.

## Reproduce everything in this branch

```sh
# G1 — vocabulary dispositions (5,852/5,852)
python3 audit/rc10/tools/reference-resolve.py && node audit/rc10/tools/build-audit.mjs

# G4 — 314 new phrases, in this exact order
git checkout -- Learned_Phrase_List.md data/phrases.json
rm -f data/phrase-seed/07-rc10-expansion.tsv audit/rc10/evidence/new-phrase-evidence.jsonl
python3 audit/rc10/tools/new-phrase-pool.py
python3 audit/rc10/tools/add-phrases.py audit/rc10/evidence/phrase-batches/batch1.txt audit/rc10/evidence/phrase-batches/batch2.txt
python3 scripts/build_phrases.py && python3 scripts/embed_phrases.py

# G2 — phrase dispositions (all phrase rows)
python3 audit/rc10/tools/phrase-resolve.py && python3 audit/rc10/tools/apply-phrase-corrections.py --dry-run

# G3 — 2,000 new headwords, in this exact order
git checkout -- Learned_Vocabulary_List.md data/vocabulary.json
rm -f data/vocab-seed/21-exam-corpus-expansion.tsv audit/rc10/evidence/new-headword-evidence.jsonl
python3 audit/rc10/tools/new-word-pool.py
python3 audit/rc10/tools/add-headwords.py audit/rc10/evidence/gloss-batches/batch*.txt
python3 scripts/expand_vocabulary.py && python3 scripts/build_vocabulary.py && python3 scripts/embed_vocabulary.py

# suites
python3 -m unittest discover -s tests -q          # 176 tests
node --test tests/static-app.test.js              # 144 tests
node --test tests/rc10-cefr.test.js               # 9 tests, 3,072 configurations
```

## Environment notes

- **No network from the shell to publisher sites.** `curl` returns 200 for
  `pypi.org`, `github.com`, `api.github.com`, `registry.npmjs.org` and `000` for
  dictionary/publisher sites; those need the `fetch_page` tool.
- Reference fixtures live in `/tmp` and do **not** persist: re-acquire with
  `audit/rc10/tools/acquire-references.sh` (Oxford mirror TSV, CEFR-J 1.5,
  Octanove C1/C2) plus
  `pip download english-words==2.0.2` and
  `get_english_words_set(['gcide','web2'])` → `/tmp/refs/english-words.txt`
  (264,494 words). `new-word-pool.py` refuses to invent a headword without it.
- The pre-change dataset backup lives at `audit/rc10/backup/data-pre-rc10.tgz`
  (sha256 `579f74fb…`, git-ignored, reproducible from `git archive c427be2`).
