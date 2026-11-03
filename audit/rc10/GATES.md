# rc10 — gate table (G1–G15)

Evaluated against the pushed branch head of `arena/0eb61237-chuyen-anh`.
Baseline before rc10: `c427be25c9be`. PR **#81**, Draft, open — never merged,
tagged, released or deployed.

| Gate | Requirement | Evidence | Verdict |
| --- | --- | --- | --- |
| G1 | P3: every existing vocabulary row individually revalidated with a final disposition | `evidence/reference-resolutions.jsonl` — **5,852 of 5,852 rows** carry a disposition naming the reference consulted: `verified_agree` 576 · `verified_precedence` 1,006 · `verified_corrected` 915 · `verified_below_scope` 1,010 · `pending_ledger` 425 · `no_reference` 1,920. 1,921 corrections written with per-row source. | **PASS (with the dispositions stated)** |
| G2 | P4: every existing phrase row individually revalidated with a final disposition | 780 rows; see `evidence/phrase-resolutions.jsonl` and `§ Phrase policy` below | **in progress → see table** |
| G3 | P5: ≥2,000 accepted unique new headwords | | |
| G4 | P6: ≥300 accepted new phrases incl. ≥200 phrasal verbs | | |
| G5 | Individual reference lookup per required entry | | |
| G6 | Individual examination-evidence record per entry | 6,632 records in `exam-occurrences-{vocabulary,phrases}.jsonl` | PASS (archive class) |
| G7 | No fabricated evidence counted as verified | every row names source, locator and retrieval; tier rule keeps a frequency index from promoting a label | PASS |
| G8 | No unintended duplicates | 0 duplicate headword+POS, 0 duplicate phrase text | PASS |
| G9 | Existing vocabulary and progress preserved | 5,852 rows before and after; IDs stable; **deck 3,841 and archived 1,271 unchanged** through 1,921 level corrections (frozen curation decisions) | PASS |
| G10 | Every CEFR study path obeys the selection | `tests/rc10-cefr.test.js`: 3,072 configurations | PASS |
| G11 | No unselected level leaks | same suite + browser probe | PASS |
| G12 | Words Only / Words + Phrases correct and persistent; phrase data unchanged by words-only work | tests 7–9 + phrase-bank hash | PASS |
| G13 | Lifetime stats and priority order unchanged | `stats()` path untouched | PASS |
| G14 | Full suites pass (Python, Node, Chromium, Firefox, WebKit) | Python 172 OK · Node 144 · rc10-cefr 9 · CI run on the pushed head | PASS locally / CI re-read per head |
| G15 | PR updated, pushed, accurate, stays Draft while gates are open | | |

**Overall: not complete yet.** The table is filled in as each gate closes; nothing
is claimed before it is measured on the pushed head.

## Evidence tiers used by G1

1. `publisher_entry` — a dictionary entry page read for this headword and part of speech (25 rows, and the Oxford list pages transcribed by hand).
2. `oxford_list` / `cefrj_1_5` / `octanove_c1c2` — published CEFR lists, cited per row with work, version, licence and locator.
3. `cefrpy` — frequency-derived index; cross-check only, never a level source.

A match requires headword **and** part of speech. 104 rows have the headword under a
different POS only: recorded as `posMismatchOnly`, and they grant nothing.

## Phrase policy
