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

## Round 3 (2026-11-27, review 6088447084 on head `f077679`)

Re-review requested by comment 7218675373 after the session-7 infra commit.
4 actionable comments + 1 stale round-1 thread re-surfaced unmarked. Every
finding verified against the current head before acting:

| # | Finding | Verdict | Disposition |
| --- | --- | --- | --- |
| R3-1 | `scripts/app_release_gate.py:65` — force override deploys an unclassifiable (None) `APP_VERSION` without `stable_deploy_authorized`, violating the documented "force alone never deploys a stable release" contract | VALID (reproduced: duplicated declaration + `FORCE_DEPLOY=true` alone → `deploy=true`) | FIXED — force on an unclassifiable version now requires `stable_deploy_authorized` (or holds); docstring + deploy.yml input descriptions amended; 3 new control cases in `test_app_release_gate.py`, fail-verified (controls fail with the fix stashed, pass with it) |
| R3-2 | `FINAL_READINESS_CHECKLIST.md:23` — session-6 sweep row split across the table (category cell alone on line 23, evidence/status cells on line 26) | VALID (markdownlint MD055/MD056; row was split by an earlier edit) | FIXED — joined into one four-column row between CR-SR6-1 and the session-6b rows |
| R3-3 | `FINAL_READINESS_CHECKLIST.md:35` — the four session-7 infra rows had 5 cells (result text and evidence path split), so the status cell did not render | VALID (header defines 4 columns) | FIXED — evidence path merged into the Evidence cell; all rows re-verified 4 cells programmatically (0 bad rows) |
| R3-4 | `api/app.js:23` — header claimed a `src/` deployment mapping "reproducible from the repository", but no repo config creates that layout (`vercel.json` references `api/telemetry.js`; the mapping is a deployment-call choice) | VALID (overstated wording; the live deployment does carry the two files under `src/`, but via the files-based deploy call) | FIXED — header now describes the module layout (entrypoint + sibling handler), states vercel.json's actual role, and points at the evidence file for the deployment mapping |
| R3-5 (stale round-1 thread 4718454999, Major) | `scan_workflow_injection.mjs:87` — `include` entries can add combinations (PR-title example), so the literal-matrix allowlist must account for include values | ALREADY FIXED — does not reproduce on this head: CodeRabbit's exact example (expression-bearing `include` entry) is flagged in BOTH parser modes (parsed walk: `includeEntriesAreLiteral` false → whole allowlist dropped → `matrix.browser` flagged; fallback: same), 1 finding each, evidence reproduced 2026-11-27 | NO ACTION — reply posted with the repro; the rule added in `b9dd1b2` covers the case conservatively (any expression-bearing include/exclude entry disables the entire per-job allowlist) |

Fresh gates after the round-3 fixes: CI Node static 289/289; shard partition
OK + shard/scanner suite (1 documented skip); telemetry 19/19; Python 303/303
(PyYAML venv, 0 skips); archive 5/5; release + deploy gates exit 0; clean-tree
scanner 0 findings both modes; `mutation_cr_scrub` 12/12; exam + vocab
independent audits verdict OK.

## Round 4 (2026-11-27, review 6089248860 on head `c3ca701`)

| # | Finding | Verdict | Disposition |
| --- | --- | --- | --- |
| R4-1 | `scan_workflow_injection.mjs` fallback (Major, outside-diff): an expression on the `include:`/`exclude:` **key line** (inline flow map, e.g. `include: [{ browser: "${{ … }}" }]`) was never checked (scan starts on the following line), and `keys.clear()` ran before keys declared **after** the include block were collected — so a base key written after a poisoned include stayed allowlisted. CI runs the scanner without `yaml`, i.e. in exactly this fallback mode | VALID — reproduced on a scratch tree before fixing: both shapes produced **0 findings** in fallback mode | FIXED — the key-line value is checked (`keyMatch[3]`), the poison is recorded in a flag and the allowlist is cleared once after the matrix scan, so keys collected before or after the include block cannot survive; 2 new fixtures/tests (inline flow on the key line; base key after a poisoned include), **fail-verified** (suite: 13 pass/2 fail with the fix stashed → 15 pass/0 fail with it); parsed walk already rejected both shapes (verified) |

Negative control re-run: the all-literal include merge (safe case) still
produces 0 findings in both modes. Fresh gates at the round-4 head: shard +
scanner suite 24 pass + 1 documented skip (16 scanner tests); clean-tree scan
0 findings both modes; `mutation_cr_scrub` 12/12.

## Round 6 (2026-11-28, CodeRabbit re-analysis replies in the resolved round-1 threads + review 6090656978 on `750df86`)

CodeRabbit re-analysed after the thread resolutions and raised three concrete
follow-ups; a fourth finding (AUDIT-1) came out of this session's independent
exceptional-path audit. All four verified against source, fixed, and tested:

| # | Finding | Verdict | Disposition |
| --- | --- | --- | --- |
| CR6-a (browser-session-method.md) | The note claimed the recon helper OUTPUTS (`tailieudieuky-recon.json`, `asset-digest-classification.json`) "ARE tracked" — `git ls-tree` proves neither file is in the tree or its history | VALID (false documentation claim) | FIXED — the note no longer claims the outputs are tracked; it states they were session-workspace artefacts, that the URL list is derivable from the tracked exam records' `assets[].url` fields, and that the authoritative tracked verification record is the embedded per-record `assets[].sha256` / `contentSha256` set plus the session-4 reconciliation outcome in `WORK_LOG.md` (186 compared — 163 byte-verified, 1 explained drift, 22 dynamic) |
| CR6-b (scanner, Major) | (1) `"\x72un"` decodes to `run` — the fallback matcher cannot see escape-decoded keys (verified: fallback 0 findings, parsed 1); (2) the CLI still printed a clean-scan verdict with no parser; (3) parsed-mode tests could silently skip | VALID (reproduced) | FIXED — the scanner CLI now **exits 2** with an explicit "NOT an authoritative clean-scan check" message when no parser is available (the fallback engine remains available to the test suite via explicit `yamlParse: null` and is documented as non-authoritative); the suite **fails in CI when the parser is missing** (`CI === 'true' && !yamlParse` → throw), so the pinned install can never silently convert required parsed-mode coverage into skips; new tests: escape-sequence parsed-mode flagging (parser present) + documented fallback limitation (parser absent) + CLI exit-2 contract. CI sim verified locally: `CI=true` without parser → suite fails; with parser → 20/20, zero skips |
| CR6-c (deploy.yml gate comment) | The comment above "Evaluate deploy hold" said the DEPLOY_HOLD release must be published before Pages deploys, without the manual force exception that `deploy_gate.py` honours | VALID | FIXED — comment now qualifies the maintainer override (`force_deploy=true` via workflow_dispatch) and notes the application-release gate still refuses a stable version without `stable_deploy_authorized=true` |
| AUDIT-1 (quota preflight, independent audit) | Exceptional paths of the probe-key restore: a failing probe-key PRE-READ made the code treat the key as absent and later DELETE a pre-existing value; a failing RESTORE write left the probe string behind | VALID (edge-path reproduction) | FIXED — an unreadable pre-read now refuses the commit outright (nothing touched); a failed restore falls back to removing the key so no probe residue survives; 2 regression tests, fail-verified (150/1 with the fix stashed → 151/151 with it) |

Fresh gates at the round-6 head: Node static **293/293**; shard partition OK +
shard/scanner **28 pass + 1 documented skip** (22 scanner tests incl. the two
new ones); telemetry 19/19; entrypoint packaging 3/3; Python **305/305**;
archive 5/5; release + deploy gates exit 0; clean-tree scan **0 findings both
modes**; `mutation_cr_scrub` **12/12**; exam + vocab independent audits
verdict OK; checklist/changelog count gates green (static-app 151 → Node
315/315).

## Round 7 (2026-11-28, review `6096051559` on `6409352` — 9 actionable inline findings)

Every finding was reproduced against the code/data before fixing (untrusted
review data rule). 8 VALID + 1 PARTIAL (behaviour intentional, comment/test
hardened). All fixed in one commit; gates re-run green.

| # | Finding (file:line) | Verdict | Evidence & disposition |
| --- | --- | --- | --- |
| 1 | telemetry-smoke.yml:64 — identity check greps per line; a dispatch input `"abcdef0\nnot-an-id"` passes the anchored first line and smuggles extra lines into the audit trail | VALID | FIXED — whole-string `case` guard rejects embedded `\n`/`\r` BEFORE the anchored grep; new python gate regression (`test_identity_input_rejects_multi_line_values_before_the_format_check`) pins guard-before-grep order + both break kinds; live shell probes: multi-line → rejected, `abcdef0` / `dpl_ABCDEFGHIJ` → accepted, `not-an-id` → grep-rejected |
| 2 | browser-session-method.md:18 — the 140-record count needs its filter named (URL extension vs `type`) | VALID | VERIFIED against `scripts/exams/selection.json` and FIXED — url-ext `.pdf`/`.zip` → 140 records / 60 unique URLs / 53 URLs with ≥2 records; `type` pdf/docx → 164 records / 84 unique URLs; 24 pdf-typed records have extension-less URLs; note now states the exact filter and the contrast (all numbers recomputed from the tracked data, not copied from the review) |
| 3 | browser-session-method.md:33 — "re-running steps 2-4 reproduces those digests" over-claims: the helper fetches only the 60 file URLs, not the 22 dynamic pages | VALID | FIXED — sentence scoped to FILE-ASSET digests and pointed at the `contentSha256` chain for the 22 dynamic-page records |
| 4 | CHATGPT-ROUND2-VERIFY.md:10 — unescaped `\|` inside `` `"run" : \|` `` splits the markdown table cell (markdownlint MD056) | VALID | FIXED — pipe escaped |
| 5 | static-app.test.js:2225-2231 + index.html skipSessionCard — comments claim "only real first passes provide spacing" while `elapsed` counts every graded turn (`completedTurns`); the oracle cannot detect the violation its comment describes | PARTIAL (doc/semantic mismatch; behaviour intentional) | Comment alignment chosen (CR's offered branch "update the stated rule"): the IMPLEMENTED two-part rule is (a) `needed` decays with every GRADED turn — practice turns are graded retrievals, skips never grade and never close the gap; (b) PLACEMENT counts only real first-pass retrievals so the consolidation sits behind at least `needed` real cards, and an unsatisfied consolidation (neededNow > 0) is never graded while a real first-pass card is queued. Both comments rewritten to state exactly this; NO app behaviour change (SKIP-1 fix is probe-verified on this measure: H/I/J/K + 600 randomized clean) |
| 6 | static-app.test.js:3916-3918 — restore-throw leg treats deletion of the original 9000-char value as success, in tension with the P2 preservation contract | PARTIAL (behaviour intentional; test hardened) | The endpoint is deliberate: the value was READ (known app-scratch residue, not opaque data), the store refuses to hold it back again ("store shrank"), so preservation is impossible and deleting the app-owned probe key is the fail-closed residue-removal — leaving the probe string would poison future preflights. Test now pins the WHOLE sequence: restore genuinely re-attempted first (`restoreAttempts === 1`), real write confirmed, only then fallback removal; comment reconciles explicitly with the P2 contract |
| 7 | telemetry-entrypoint.test.js:100,154 — cleanup registers a fresh `exit` listener after the child may already have exited → promise hangs forever, masking the startup diagnostic | VALID | FIXED — shared `exited` promise registered immediately after each `spawn`; cleanup kills only a live child (`exitCode`/`signalCode` both null) then awaits the shared promise |
| 8 | telemetry-entrypoint.test.js:69 — child inherits a caller-provided `TELEMETRY_ORIGINS`, which would change 405/403 semantics of the pinned contract | VALID | FIXED — `TELEMETRY_ORIGINS: 'https://coderunknow.github.io'` set explicitly on both service-booting spawns (`evil.example` stays disallowed) |
| 9 | workflow-injection-scan.test.mjs:297 — deleting `NODE_PATH` does not hide a repo-local `yaml` install (module walk from the script's dir); the CLI test would run the parsed scan instead of refusing | VALID | FIXED — the CLI test now runs a COPY of the self-contained scanner from a temp dir (module chain tmpdir → /tmp → /), so the parser is genuinely absent. Fail-verified with a planted repo-local `node_modules/yaml`: old spawn resolved it (exit 1 — ran the scan), new copy refuses (exit 2) |

Gates at the round-7 head: Node 293/293 + shard/scanner (22 scanner tests
incl. the hardened CLI test; 19+1 documented skip parser-less), telemetry
19/19, entrypoint 3/3, Python **306/306** (+1 smoke-gate regression), archive
5/5, release + deploy gates exit 0, doc-count gates green (checklist Python
row 306 / 311+311 total, changelog totals synced 306/151/315 + 9 gate tests).

## Round 8 (2026-11-28, manual `@coderabbitai review` on PR #88 after integration — 13 findings / 9 threads on the full 92-file diff)

Verified against source before fixing; 9/9 threads dispositioned with evidence.

| Finding | Verdict | Disposition |
| --- | --- | --- |
| Major — URL user-info scrubber stops at the FIRST `@` (`https://alice@team:secret@host` leaks the password; WHATWG URL treats earlier `@` as credential data) | VALID (reproduced) | FIXED in BOTH scrubbers (`index.html` client, `api/telemetry.js` server): the rule now redacts THROUGH THE LAST `@` of the authority while still stopping at `/ ? #` whitespace (query/fragment emails preserved — existing tests kept passing). 4 regressions (2 client, 2 server) + 2 NEW mutation mutants (first-@ revert, per-scrubber) → **14/14 mutants killed** (was 12) |
| REPRODUCTION_COMMANDS.md cites Node 24 for Web Locks (API landed in 24.5.0) | VALID | FIXED — Node ≥ 24.5 stated in both affected preconditions |
| browser-session-method.md helpers not committed → clean checkout cannot run them | VALID | FIXED — runnable re-creations committed under `evidence/session-2026-11-26/scripts/` (`extract_asset_list.py` — a new python regression pins that it reproduces 140/60/53/186 + the 164/84 type-filter contrast from tracked `selection.json`; `browser_digest_check.js` + `browser_recon2.js` — console helpers following steps 3–4 exactly, `node --check` clean, clearly marked as re-creations) |
| The `.md` → `contentSha256` chain over-claims for the 22 dynamic pages | VALID | FIXED — the note now states the chain proves INTERNAL integrity only and that the 22 dynamic snapshots are NOT verified against their live source |
| probe_question_alignment.mjs uses `.pathname` (breaks on paths with spaces) | VALID | FIXED — `fileURLToPath(new URL(...))` |
| CHATGPT-ROUND2-VERIFY.md invariant wording contradicts the round-7 two-part spacing rule | VALID | FIXED — the invariant now states the two-part rule verbatim |
| Runner doc's self-hosted option lacks the fork-PR warning | VALID | FIXED — explicit conditions (no fork workflows, approval requirement, removal after recovery) |
| branding/README says the app already loads the favicons | VALID (contradicted index.html) | FIXED — deferred-wiring status stated, with the two adoption paths |
| branding/README says social-preview.png is "referenced by og:image" | VALID (no og:image tracked) | FIXED — marked as candidate, wiring deferred |

Gates after the round-8 fixes: Node **316/316** (telemetry-api 20; the new test is count-gated), Python **307/307** (helper-count regression), shard/scanner 28 + 1 documented skip, archive OK, release+deploy gates exit 0, mutants **14/14**, doc-count gates green (316/312 rows, changelog 307/316).
