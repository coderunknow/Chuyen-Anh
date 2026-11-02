# rc10 — gate table (G1–G15), evaluated 2026-11-02 against branch head `f31cb08`

The task's own gate list is used verbatim where it exists. Where the repository
has no authoritative G1–G15 definition (only the older rc8 G1–G5 in
`docs/RC8_RELEASE_REPORT.md`), the gate text below is the **task's** checklist, not
an invented repository rule — and that is stated so nobody mistakes it for one.

| Gate | Requirement | Evidence | Verdict |
| --- | --- | --- | --- |
| G1 | P3: every existing vocabulary row individually reviewed with a final disposition | `audit/rc10/evidence/p3-p4-audit-summary.json` — 6 individually verified, **5,846 outstanding** | **FAIL** |
| G2 | P4: every existing phrase row individually reviewed | same file — 0 verified, **780 outstanding** | **FAIL** |
| G3 | P5: ≥2,000 accepted unique new headwords | **0 accepted**; candidate pool of 1,447 built but unverified | **FAIL** |
| G4 | P6: ≥300 accepted new phrases incl. ≥200 phrasal verbs | **0 accepted** | **FAIL** |
| G5 | Individual reference lookup per required entry | 6 lookups recorded in `manual-verifications.jsonl` | **FAIL** (6 of 6,632 existing) |
| G6 | Individual examination-evidence record per entry | **PASS for the archive class**: 6,632 records in `exam-occurrences-{vocabulary,phrases}.jsonl` (3,725 + 397 with a hit, the rest explicitly recorded as zero hits with the search method documented) | **PASS (archive_transcription_repost only)** |
| G7 | No fabricated evidence counted as verified | Audit layer separates `inspected_*` from `machine_assessed`; every record names its class and URL | **PASS** |
| G8 | No unintended duplicates | 0 duplicate headword+POS, 0 duplicate phrase text (`build-audit.mjs`) | **PASS** |
| G9 | Existing vocabulary and progress preserved | No row deleted or re-created; IDs stable; the two pending corrections are recorded, not applied; `audit/rc10/backup/data-pre-rc10.tgz` sha256 `579f74fb…` intact | **PASS** |
| G10 | Every CEFR study path obeys the selection | `tests/rc10-cefr.test.js`: 128 selections × 11 vocabulary entry points × 2 scopes = 2,816 configurations, plus 256 phrase configurations | **PASS** |
| G11 | No unselected level leaks | same test; plus real-browser probe over 6 selections × 9 entries | **PASS** |
| G12 | Words Only / Words + Phrases correct and persistent; phrase data unchanged | `tests/rc10-cefr.test.js` tests 7–9 + browser scope journey | **PASS** |
| G13 | Lifetime stats and learning priority unchanged; prior defects fixed | lifetime figures still read `stats()`; priority order untouched; favourites leak + stale-queue defects fixed and regression-tested | **PASS** |
| G14 | Full suites pass (Python, Node, Chromium, Firefox, WebKit) | local: Python 168 OK, Node 183/183, both Chromium suites PASS; CI run `41430469888` on `f31cb08`: checks + 3 browsers PASS | **PASS for `f31cb08`** (must be re-run on the final head) |
| G15 | Correct PR updated, pushed, Ready for Review, CI green on the exact head, description accurate | PR #81 is **Draft**; it stays Draft because G1–G5 fail | **FAIL (by design)** |

**Overall: NOT COMPLETE.** G1, G2, G3, G4, G5 fail, and G15 stays open as a
consequence. Nothing was merged, tagged, released or deployed.
