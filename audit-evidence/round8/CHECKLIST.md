# Round 8 — acceptance checklist

Binary. `[x]` only where the item was verified in this session with evidence that can be
re-opened; `[ ]` where it is incomplete, blocked, inconclusive or awaiting a human.
No item is ticked because code changed or a command was merely run.

Starting SHA `e663295ea8236fd29be6b30e0d04c78e911d7429` · branch `arena/chuyen-anh-r8-ready-review`.

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | New working branch created directly from the verified starting SHA, after a collision check | `[x]` | `BASELINE.md`; `git ls-remote --heads origin 'refs/heads/arena/chuyen-anh-r8*'` returned nothing |
| 2 | PR #84 verified live and left untouched (open, Draft, base `arena/2a533bbc-chuyen-anh`) | `[x]` | `BASELINE.md`; re-verified at the end in `CONTINUATION_REPORT.md` |
| 3 | Baseline recorded before any change: SHA, branch, tree status, tests, gates, threads | `[x]` | `BASELINE.md`, `logs/node-baseline.log`, `logs/python-baseline.log`, `logs/pr84-review-threads.json` |
| 4 | All 11 live unresolved review threads retrieved and each given a disposition | `[x]` | `FINDINGS.md` §1 (thread ids + comment ids + verification per row) |
| 5 | Persistence: cross-tab read/merge/write serialised when the platform can (`navigator.locks`) | `[x]` | `index.html` `withExamHistoryLock`; `exam-persistence.test.js` "a locked write reports the mode it obtained" — Node has no Web Locks, so the reported mode is `unserialized`, and the code **never claims otherwise** |
| 6 | Persistence: unlocked contexts have a documented, weaker guarantee instead of a retry disguised as a fix | `[x]` | Comment block above `persistExamResultHistory`; `mode` in every result; `CONTINUATION_REPORT.md` §guarantees |
| 7 | Two tabs creating different attempts concurrently keep both | `[x]` | `exam-persistence.test.js` that test name |
| 8 | Two tabs updating the same logical record: one deterministic outcome, never a fabricated merge | `[x]` | "two tabs correcting the same question keep one record, deterministically" |
| 9 | An attempt created while another tab saves a correction keeps both facts | `[x]` | "an attempt created while another tab saves a correction keeps both facts" |
| 10 | A stale tab cannot resurrect an attempt deleted by another tab | `[x]` | "a stale tab cannot resurrect an attempt another tab deleted" |
| 11 | A stale tab cannot resurrect history cleared by another tab | `[x]` | "a stale tab cannot resurrect history cleared by another tab" |
| 12 | A legitimate attempt created during/after Clear survives | `[x]` | "a legitimate attempt created while another tab clears survives" |
| 13 | Clear overlapping an in-flight write is well defined | `[x]` | same test — both operations resolve and the store matches the documented rule |
| 14 | Multiple corrections to different questions of one exam all survive | `[x]` | "multiple corrections to different questions of one exam all survive" |
| 15 | Reloading either tab after concurrent writes shows one consistent history | `[x]` | "reloading either tab after concurrent writes shows the same history" |
| 16 | Storage errors, unavailable APIs, interrupted writes are explicit failures, not empty histories | `[x]` | "a store that rejects writes reports failure and keeps the old history intact"; "an unreadable store is never overwritten with an empty history"; "a storage that throws on read is a failure" |
| 17 | Repeated operations, retry and recovery converge | `[x]` | "repeated retries converge instead of oscillating" |
| 18 | `file://` and offline operation preserved | `[x]` | No new network dependency; Web Locks are optional and their absence is the supported fallback path. The app remains a single `index.html` that runs from `file://` (browser suites assert this in CI; **not run locally** — see #26) |
| 19 | 1,000-character limit enforced at input, parser, application and storage with one length definition | `[x]` | `examCorrectionLength` / `examCorrectionExceedsLimit` / `examCorrectionValidation`; `exam-persistence.test.js` "exactly 1000 characters is accepted, 1001 is refused everywhere" |
| 20 | The limit is visible at the UI and an over-limit answer explains itself | `[x]` | `#exam-key-correct-hint` + `aria-describedby` + a live measured-length hint; enforcement is an input handler using the same two model functions the save uses, **not** `maxlength` — `maxlength` counts UTF-16 units over the whole field, so it blocked a valid 600-emoji answer and accepted two 700-character answers (CodeRabbit, PR #85). Test: "the 1,000-character limit is visible and enforced at the input" |
| 21 | Historical schema-v1 records longer than the limit are preserved and migrated, never truncated or dropped | `[x]` | "an over-long historical correction is preserved, not truncated or dropped" |
| 22 | Correction targets the snapshot that back it; multiple versions handled; no arbitrary first match | `[x]` | `examCorrectionPaperKeys`; "the snapshot that backs the correction is the one carried" |
| 23 | Unseen-attempt score mismatch reproduced against the starting SHA, then fixed | `[x]` | `logs/repro-score-mismatch-at-start-sha.log` (throws `score-mismatch`) vs `logs/repro-score-mismatch-after-fix.log` (saves, all three attempts stored) |
| 24 | Vocabulary multiword finding verified and given a negative control | `[x]` | `test_a_word_is_not_attested_by_a_multiword_headword_that_contains_it`; mutation check in `EVIDENCE_MANIFEST.md` |
| 25 | `--help` has no side effects in `build_archive.py` and `release_artifacts.py` | `[x]` | `tests/test_script_help.py` (5 tests, fake `gh`, tree hash before/after, `PUSH_TAG`/`INPUT_TAG` set) |
| 26 | Full local regression at the working tree state | `[x]` | Node **301 pass / 0 fail** (9 suites), Python **263 OK**, **21/21** `ci.yml` gates, archive suite **5 OK** in a pinned venv; logs in `logs/` |
| 27 | Browser suites (Chromium/Firefox/WebKit) on the exact final SHA | `[x]` | On `98d36c7`: all three engines **pass** (`browser (chromium)`, `browser (firefox)`, `browser (webkit)` — workflow run `43239398860`). The earlier failure at `bbe957d` was a real regression, fixed and recorded as `FAILURE_LEDGER.md` F6. Not run locally: browser downloads are unreachable from this sandbox (F1) |
| 28 | Required CI jobs green on the exact final head SHA | `[x]` | On **`98d36c7`** (exact head): `checks` **pass**, `validate` **pass**, `browser (chromium)` **pass**, `browser (firefox)` **pass**, `browser (webkit)` **pass**. Earlier SHAs' results are not reused; `bbe957d` failed the three browser jobs (F6) and that failure stands in the record |
| 29 | CodeRabbit completed on the exact final head SHA | `[x]` | Requested on PR #85 and **completed** (check `pass`, not `SKIPPED`) with 16 threads; all dispositioned in `CODERABBIT_85_DISPOSITION.md` — 12 code fixes, 4 doc corrections, each code fix mutation-checked. A re-review on the commits that answer it is a *separate* review and is recorded in `CONTINUATION_REPORT.md` |
| 30 | Screen-reader manual validation with genuine evidence | `[ ]` | **INCOMPLETE — no real screen reader in this environment.** `accessibility/` records what a human must do |
| 31 | Kilo / Copilot external review | `[ ]` | Not a completion; see `CONTINUATION_REPORT.md` |
| 32 | Documentation and evidence match the final code and SHA | `[x]` | Re-checked against `98d36c7`: count-gate tests pass, raw logs in `logs/` are from this tree, and every SHA-dependent row names the SHA it belongs to |
| 33 | New PR body accurate (branches, SHAs, tests, limitations, no merge/tag/release/deploy) | `[x]` | PR #85 body refreshed for `98d36c7`: start SHA `e663295`, base `arena/dedd1942-chuyen-anh`, local + CI results with the failed `bbe957d` run disclosed, CodeRabbit rate-limit disclosed, screen reader `INCOMPLETE` |
| 34 | PR #84 still Open and Draft, unmodified | `[x]` | Verified at the end of the session; recorded in `CONTINUATION_REPORT.md` |
| 35 | No merge, tag, release, prerelease, publication or deployment performed | `[x]` | Only local `git`, `node`, `python` and `gh` PR read/update calls were used. Two PR comments were posted (the review requests); no merge, tag, release, artifact publication or deploy |
