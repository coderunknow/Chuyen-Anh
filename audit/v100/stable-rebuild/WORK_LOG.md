# WORK LOG — stable-rebuild session (2026-11-17) — append-only

### Session start

- Cloned `coderunknow/Chuyen-Anh`; verified live baseline via REST API and local
  git (`948f6f9` on `main`, no `v1.0.0` tag, no open PRs/issues, latest main CI
  green). Token used only at runtime via a credential helper reading the upload
  file; never stored or printed.
- Branch `build/v100-stable-rebuild` cut from verified `main`.
- Read `AGENT.md`, `README.md`, `SECURITY.md`, `PRIVACY.md`,
  `HANDOFF_NEXT_AGENT.md`, the tails of `DESIGN_LOG.md`/`AGENTS_LOG.md`
  (append-only), `audit/v100/*`, `api/telemetry.js`, both Supabase migrations.

### Suites run on the untouched baseline

- Python 294/294 OK; Node 304/305 (one failure → D-SR1); archive 5/5; 21
  validators pass; browser-exams PASS; browser-learning PASS (Chromium 133,
  in-sandbox); speed benchmark OK (68 ms median card latency).
- Installed test tooling in `/tmp` only (playwright-core 1.55.1, axe-core,
  @sparticuz/chromium 133, @electric-sql/pglite); repo dependency-free.

### Defect work

- D-SR1 (`NODE-LOCKS-ENV`): baseline repro → test fix → mutation controls →
  suite green. Evidence: `audit/v100/stable-rebuild/DEFECTS.md` D-SR1.
- D-SR2 (`TELEMETRY-NOTE-SECRETS`): baseline repro (client+server) → scrubber
  hardening in both files → tests in both suites → meta-test count reconciliation
  (telemetry-api 17→18, Node total 305→306) → mutation controls → suites green.

### Data audits (independent, fresh code)

- Exam: re-parsed all 106 papers with the production parser; recomputed
  coverage (106/6,708/5,155/1,553; 100% non-exempt) and re-derived all 2,146
  curated SHA-256 bindings (0 mismatches). Independently solved a deterministic
  10-question curated sample: 8/8 verifiable agree, 2 listening/context items
  unverifiable in-harness and left unclaimed.
- Vocabulary: deterministic sample of source-backed senses verified against the
  five pinned reference snapshots (198 automatic + 3 manual = 201/201 agree).

### Infrastructure evidence

- PGlite (in-memory Postgres): executed the real SQL of both migrations;
  demonstrated the old global-quota-exhaustion path and the hardened behaviour
  (5 stored rows, client:missing bucket, injection-shaped client_key rejected;
  refused attempts still count toward the global attempt budget — disclosed).
- Read-only live probes: telemetry preflight `204` (published origin), GET
  `405` + `Allow: POST, OPTIONS`; Pages deployment `7798610277` (rc11) success.
  No production-writing request was sent.

### Stable identity reconciliation

- `APP_VERSION = 'v1.0.0'`; `DEPLOY_HOLD` unchanged (`v1.0.0-rc11`); dual-gate
  tests reconciled (`test_deploy_gate.py`, `test_sprint_exam_features.py`,
  `static-app.test.js`, browser suites, checklist totals, PRIVACY/SECURITY/
  README/CHANGELOG). Gates verified: `app_release_gate` holds the stable
  candidate (`deploy=false (application release v1.0.0 not verified; held)`).
- Post-bump verification: Python 294/294, Node 306/306, validators 21/21,
  browser suites re-run (see below).

### Candidate browser suites (re-run after the version bump)

- `run-browser-suites.sh` (both suites, sequential, Chromium 133): executed at
  the candidate head; log `work/evidence/browser-suites-candidate.log`
  (session workspace). Speed benchmark re-run at the head for the comparison
  table in `FINAL_READINESS.md`.

### Documentation and evidence

- `CHANGELOG.md` stable-candidate section; `PRIVACY.md`, `SECURITY.md`,
  `README.md` version paragraphs; `DESIGN_LOG.md` + `AGENTS_LOG.md` appended
  (append-only); this evidence directory created.
- `git diff --check` clean; no secrets, artifacts or unrelated files committed
  (checked before push).

### Push and PR (2026-11-17, post-commit)

- Commits landed locally on `build/v100-stable-rebuild`:
  `f84d85f` (D-SR1 test fix) and `8ee185f` (stable candidate: identity, D-SR2,
  evidence). Pre-push checks: `git diff --check` clean; diff secret-scan clean
  (the only hits are the synthetic test fixtures quoted inside DEFECTS.md).
- `git push -u origin build/v100-stable-rebuild` → **HTTP 403 "Permission to
  coderunknow/Chuyen-Anh.git denied to coderunknow"**. Probed the fine-grained
  PAT directly: `GET /user` → `coderunknow`; `POST /git/refs` (temporary probe
  ref at the main SHA) → `403 Resource not accessible by personal access token`;
  probe ref confirmed absent afterwards. Diagnosis: the supplied token has
  repository **read** access but **no Contents:write**, so pushing the branch
  and opening the PR are externally blocked pending a token with
  `contents: write` (or a classic PAT with `repo` scope). Branch delivered as a
  git bundle instead; PR body pre-drafted for the owner to push and open.

## Round 2 — review response, production-write prevention, deep audit (2026-11-17)

### CodeRabbit review round 2 (7 findings, all verified valid, all fixed)

- Fetched the genuine COMMENTED review at `248b75a` (submitted 12:45:11Z):
  7 inline findings, 5 Major (security) + 2 Minor (reproducibility). Each was
  reproduced against the current source first; failing tests were committed
  as the reproduction evidence (`evidence/review-round/repro-*-fail.log`)
  BEFORE the fix, then the fix landed and both suites went green.
- Fixes: fine-grained GitHub-token pattern; full RFC 6750 Bearer alphabet with
  trailing `=` and no minimum length; empty-username URL user-info redaction;
  secret patterns moved before the quote split (both scrubbers); baseline
  reproduction rewritten around a pinned `948f6f9` worktree; the five cited
  audit scripts tracked at their cited paths with repo-relative resolution.
- Suite totals after the round: Python 302/302 (+8 structural gate tests),
  Node 308/308 (+1 telemetry-api, +1 static-app). Checklist and changelog
  follow-up totals refreshed to match (enforced by `test_ci_gate_coverage.py`
  and `test_audit_document_counts.py`).
- Mutation controls: `scripts/mutation_cr_scrub.mjs` — 8/8 mutants killed,
  log `evidence/review-round/mutation_controls.log`.

### Production-write prevention (repository behaviour change)

- `telemetry-smoke.yml` no longer auto-triggers on `push` or `pull_request`
  (opening PR #88 had stored one synthetic production row before the cancel
  could land — recorded in FAILURE_LEDGER F-SR11). It is now dispatch-only:
  required `confirm_production_write` boolean, required `deployment_identity`,
  concurrency group, least privilege, pinned SHA, conditional checkout/probe.
- The authorized single production POST stays PENDING: the candidate revision
  of the endpoint has not been deployed by an authorized actor, so no POST was
  sent this session and none will be until the deployment identity can be
  verified.

### Independent deep audits (fresh code, fresh assumptions)

- Vocabulary deep audit (`scripts/independent_vocab_deep_audit.mjs`): unique
  row/sense IDs, structural integrity, locator-level CEFR conflicts inside
  multi-sense headwords, distractor-pool sufficiency per level, phrase-bank
  uniqueness → **0 defects** across 8,852 rows / 8,928 senses / 1,094 phrases
  (`evidence/review-round/vocab-deep-audit.json`).
- Reference-sample re-verification (fresh parsers): 198/198 = 100% agreement,
  3 unverifiable-first-ref senses documented (same result as round 1).
- Exam totals re-derived independently: 106 papers, 6,708 questions, 5,155
  scorable (76.85%), 1,553 exempt, 0 non-exempt missing keys, 2,146/2,146
  curated SHA-256 bindings re-derived with 0 mismatches.
- Transcript-fallback policy re-derived: 325 fallback-flagged items, **307
  scorable — every one LOW confidence**, 18 exempt (13 VERY_LOW + 5 LOW), 0
  official-verification claims, 0 violations
  (`evidence/review-round/transcript-fallback-audit.json`).
- Workflow security scan (`scripts/scan_workflow_injection.mjs`): 8 workflows,
  0 injection-shaped interpolations after the parse-verified literal-matrix
  allowlist; negative controls detect injected branch-name/PR-title
  interpolation in both `run:` forms
  (`evidence/review-round/workflow-injection-scan.json`).
- Threat-oriented security review written up with per-threat controls and
  tracked evidence (`evidence/SECURITY_AUDIT_ROUND2.md`).

### Session boundary notes

- The five original round-1 scripts were recovered from the session workspace
  and committed unchanged except for repo-relative path resolution; no
  evidence was rewritten or fabricated.
- `git worktree add /tmp/baseline-948f6f9 948f6f9` verified the documented
  baseline procedure: exactly 1 failure at base ("a locked write reports the
  mode it obtained"), 0 failures at the candidate head.

## Round 3 — review response on `2f13f33` (2026-11-17)

- The owner-authorized `@coderabbitai review` (comment 6949685023, posted
  13:39:26Z) produced a fresh COMMENTED review against `2f13f33`
  (submitted 13:51:34Z): 13 actionable findings (2 Major, 11 Minor/nitpick).
  All 13 were verified against the source and fixed; dispositions in
  `DEFECTS.md` (R3-1..R3-15).
- Headline fix (Major × 2): the round-2 Bearer class had omitted `-`, which
  RFC 6750 allows — leading-hyphen and embedded-hyphen credentials leaked.
  Fixed in both scrubbers with regression cases; mutation fixtures refreshed;
  8/8 mutants killed.
- The five audit scripts hardened per review (hash counting + exit codes,
  CRLF/quote-aware CSV, malformed-row guards, PGlite portability +
  window-boundary retry, `__proto__` own-property fixtures); the workflow
  injection scanner was rewritten to walk the parsed YAML with per-job,
  per-expression allowlists (poisoned-matrix, block and inline negative
  controls all detected).
- Suite counts unchanged (assertions added inside existing tests):
  Python 302/302, Node 308/308, archive 5/5, validators exit 0.
- New evidence: `evidence/review-round/{exam-audit-round3.json,
  vocab-ref-audit-round3.json, scrub-baseline-round3.log, pglite-round3.log,
  mutation_controls.log, workflow-injection-scan.json}`.
- Session error recorded honestly: a careless `mv` during this append
  briefly overwrote this file with the round-3 text alone; it was restored
  from git and the entry re-appended. No committed history was lost.

## Session 5 — owner-review round on `2fd29c2` (2026-11-27)

Operating base: this session's branch was created from `main` `948f6f9` and
fast-forwarded to the PR head `2fd29c2ab20c43ba8a3091b9dc3b46a24fb10fa6`
(all session-4 evidence intact), then worked on top of it. The owner's
independent "Review By ChatGPT" comment (PR #88, 2026-11-26) named two
confirmed defects at that exact head; both were reproduced before fixing.

### Fixes (details and dispositions in `DEFECTS.md` CR-SR5-1..4)

1. **CR-SR5-1** — both telemetry scrubbers now redact the WHOLE RFC 3986
   user-info component (`/([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+@/gi`), closing the
   username-only and empty-password bypass. Regression cases on both sides;
   10/10 mutation controls killed.
2. **CR-SR5-2** — the workflow-injection scanner's no-parser fallback now
   scans the full run body (block scalars, continuations) with a strictly
   narrower literal-matrix allowlist; new `tests/workflow-injection-scan.test.mjs`
   suite wired into `ci.yml`; clean tree passes in BOTH parser modes.
3. **CR-SR5-3** — `mutation_cr_scrub.mjs` no longer counts a load-breaking
   mutant as a kill (LOAD-FAILURE → inconclusive, exit 2).
4. **CR-SR5-4** — the telemetry-smoke gate's PyYAML dependency is declared
   (`tests/requirements.txt`, PyYAML==6.0.4), installed by `ci.yml`/`deploy.yml`,
   and skipped-with-reason on a fresh checkout; the checklist/changelog totals
   were refreshed to the measured values (Python 303 discover + 5 archive;
   Node 308 static/telemetry + 19 shard/failure/scanner).

### Fresh verification at the session head (local sandbox: Node v22.22.3, Python 3.11.2)

- 21/21 validator commands exit 0.
- Python `unittest discover`: **303 collected, 0 failures** (8 telemetry-smoke
  gate tests skip without PyYAML — CI installs `tests/requirements.txt` and
  runs them; with PyYAML: 303/303 pass).
- Node static + telemetry suites: **308 pass / 0 fail**.
- Shard partition + failure-capture + workflow-injection scan: **19 tests,
  18 pass + 1 documented skip** (parsed-walk test without a `yaml` module).
- Exam archive conversion (venv, pinned deps): **5/5 OK**.
- Integrity probes re-run at the head: exam integrity 106/6,708, 0 problems;
  question alignment 6,708 unique IDs, 0 failures; independent exam audit
  `verdictOk: true` (2,146/2,146 bindings); transcript-fallback audit 0
  violations.
- Workflow-injection scan: 0 findings in fallback AND parsed modes (evidence
  JSONs + negative controls in `evidence/session-2026-11-27/`).
- Mutation controls: 10/10 killed (`url-userinfo-scrub-evidence.txt`).

### Honest environment notes (this sandbox)

- No browser binaries and no Playwright CDN egress: the browser suites did NOT
  run locally this session; cross-engine coverage is delegated to CI on the
  pushed head (15 shards). The `index.html` delta is confined to the telemetry
  scrubber (2 comment lines + 1 regex literal), which no browser journey
  exercises.
- No screen reader, no physical low-memory device: unchanged residual.
- No Vercel/Supabase credentials: live-function redeploy and live-DB hardening
  verification remain owner actions (unchanged residual).
- PyYAML was installed into a disposable venv for the parsed-mode scan
  verification; no repository dependency was added beyond the pinned
  `tests/requirements.txt` consumed by CI.

## Session 6 — final merge-readiness audit round on `b8c3dbf` (2026-11-27)

Same branch, same operating base as session 5 (head `b8c3dbf`, all session-4/5
evidence intact). Directive: find all bugs in index.html with fresh adversarial
probes, no false positives, clean comprehensive fixes, then push, request
CodeRabbit and verify every finding.

### Probes (all written this round; every non-bug flag adjudicated before dismissal)

- Probe corpus rebuilt from the fixed head: module extracted from
  `index.html` (702,165 bytes, 11,400+ lines, 295 exports).
- Exam core re-sweep: 106 papers / 6,708 questions / 3,292 scorable choice
  items, 18 weird inputs each, 0 crashes, 0 invariant violations.
- Battery #2 (12 areas) re-run to 0 flags; the pending consolidation-placement
  flag closed as a probe arithmetic error (insert at `nonPracticeEnd`,
  `scheduledAfter = 2`, documented contract).
- Battery #3 (new, 12 areas): device settings round-trip + adversarial
  payloads, backup import validation incl. prototype pollution, essay rubric,
  stimulus state, CEFR sense model, match state machine, XP/badges/timers,
  telemetry report, exam practice lifecycle, family fold — 0 bugs.
- Battery #4 (new): 2,000 seeded distractor boards over the real deck with
  full invariants, phrase grader, phrase progress, exam corrections through
  the scorer, exam clock, hand-off guard — 0 bugs.
- Static sweeps: storage keys, global listeners, all 31 innerHTML sites,
  `new RegExp` sites, Math.random inventory — clean.

### Fixes (details and dispositions in `DEFECTS.md` CR-SR6-1)

1. **CR-SR6-1** — `highlightMatch`: the RegExp's first use (`.replace`) moved
   inside the same try/catch as its construction; V8 lazy compilation could
   otherwise throw an uncaught SyntaxError on queries of >= ~40k escaped atoms
   (search field has no length cap) and crash the search draw path. Fallback =
   the function's existing constructor-failure contract. Regression assertions
   in `tests/static-app.test.js`; before/after evidence in
   `evidence/session-2026-11-27/highlight-lazy-regex-crash-evidence.txt`.

### Fresh verification at the session head (Node v22.22.3, Python 3.11.2)

- Canonical CI Node set: **289/289** (incl. the new regression assertions).
- Shard/fresh-world/scanner trio: **18 pass / 1 skip (parsed-walk needs yaml)**;
  shard partition check OK; telemetry contract suite **19/19**.
- Python `unittest discover` (with PyYAML venv): **303/303**; archive suite
  5/5; release/deploy gates held as designed (`DEPLOY_HOLD` untouched).
- All four probe batteries re-run against the fixed module: 0 flags, exam-core
  numbers unchanged (106/6,708/3,292/0/0).

## Session 6b — CodeRabbit round on `f58fd93` (2026-11-27)

Requested the review per the directive (`@coderabbitai review`), then
verified all **18 findings** (3 Major + 15 Minor) against the code with
repros before fixing — all valid, all fixed, none dismissed. Register with
per-finding fixes and controls:
`evidence/session-2026-11-27/CODERABBIT-ROUND-VERIFY.md`.

### Fixes (details in `DEFECTS.md` CR-SR6-2..4)

1. **CR-SR6-2 (Major ×3)** — workflow-injection scanner: expression-bearing
   matrix `include`/`exclude` entries now drop the per-job literal allowlist
   (parsed + fallback); the expression scan reads to the first real `}}`
   (format-string braces no longer hide an injection); quoted `"run":` keys
   are scanned by the fallback.
2. **CR-SR6-3 (Minor)** — both telemetry scrubbers stop URL user-info
   matching at `?`/`#`/`/` so a query or fragment `@` can no longer create a
   false redaction; credential coverage byte-identical; 12/12 mutants killed.
3. **CR-SR6-4 (Minor batch)** — evidence/tooling honesty: enforced probe
   totals, measured (not asserted) alignment results, pure-JSON scan reports,
   tracked evidence paths, documented repro preconditions and escape hatches,
   guarded inconclusive rate-limit scenarios, host-independent ds1 mutation
   harness, content-checking CI coverage gate.

### Fresh gates at the session-6b head

Canonical CI Node **289/289**; scanner suite 13 pass + 1 documented skip;
telemetry 19/19; Python **303/303**; archive 5/5; shard partition OK;
`mutation_cr_scrub` **12/12**; `mutation_ds1` OK (lockless host); clean-tree
scan **0 findings both modes**; all four probe batteries **0 flags**; exam
core 106/6,708/3,292 with 0 crashes/0 violations; release/deploy gates held.

## Session 7 (2026-11-27) — live infrastructure blockers closed

Owner addendum 2 authorized direct execution of the external blockers through
the connected Supabase/Vercel apps under the standing
impact/data-safety/rollback procedure. Full register with live reads, fixes,
verifications and rollbacks: `evidence/session-2026-11-27/live-infra-hardening.md`.

1. Sandbox reconciliation: the workspace was re-cloned at the branch base
   `948f6f9` with the session-5/6 work present as uncommitted files; every
   on-disk file was byte-verified against its `b9dd1b2` blob before
   `git reset --hard b9dd1b2` re-anchored the branch (only `api/app.js`, new
   this session, was not in `b9dd1b2`).
2. Supabase `chuyen-anh-telemetry` (`zomeiulaqahyjwhgdemf`): restored from
   PAUSED; migration history was EMPTY. Live reads found **INFRA-2** (ingest
   function pre-hardening) and **INFRA-1** (`public.compute_jobs`: RLS off,
   anon/authenticated held ALL privileges incl. TRUNCATE). Fixes applied as
   tracked migrations (`apply_repo_20261031_telemetry_hardening` — repo SQL
   verbatim; `lock_compute_jobs_from_public_api`) and verified live
   (hardened=true; service_role-only grants). Rollbacks documented.
3. Vercel `chuyen-anh-telemetry` (`prj_YmtevOrE913KuRhJSX9FlQyKi3dO`): prod
   was the 2026-10-29 build, predating every scrubber fix (**INFRA-3**).
   First files-deploy (handler only) ERROR'd — "No entrypoint found" —
   exposing **INFRA-4**: the working deployment's `src/app.js` entrypoint
   existed nowhere in the repo. Second deploy replicated the working shape
   (repo-head handler byte-identical + documented wrapper) →
   `dpl_9S9n7dkfm8ysEii4nMf1n2ZEWhYW` READY/PROMOTED/aliasAssigned;
   `api/app.js` committed to close the reproducibility gap; local live-server
   smoke 204/405/403 matches the pinned contract.
4. Constraint compliance: zero telemetry POSTs (read-only OPTIONS/GET probes
   only); no merge/tag/release/force-push; DEPLOY_HOLD untouched. The two DB
   migrations are the only live mutations — both disclosed in the checklist
   Compliance row (amended) with rollback statements.
5. Gates re-run at the session-7 content state: CI Node 179 pass + 1
   documented skip; Python 303/303 (8 skipped-with-reason); release + deploy
   gates exit 0; scanner 0 findings both modes; exam + vocab independent
   audits verdict OK.

### Session 7 addendum — CodeRabbit round 3 (review 6088447084 on `f077679`)

Re-review of the session-7 head returned 4 actionable findings + 1 stale
round-1 thread. All verified against source before acting (no false
positives fixed as real): INFRA-gate bypass in `app_release_gate.py`
(force on an unclassifiable version) — reproduced live, fixed, fail-verified
controls added; two checklist table malformations — fixed; `api/app.js`
header wording — fixed; the stale scanner Major — does not reproduce (CR's
exact example flagged in both parser modes; repro recorded). Full register:
`evidence/session-2026-11-27/CODERABBIT-ROUND-VERIFY.md` (Round 3). Fresh
gates re-run at the resulting head: all green (Node 289 + 19 + 19; Python
303 with PyYAML, 0 skips; archive 5/5; gates exit 0; scanner 0/0;
`mutation_cr_scrub` 12/12; exam/vocab audits OK).

### Session 7 addendum — CodeRabbit round 4 (review 6089248860 on `c3ca701`)

One outside-diff Major: the fallback scanner missed expressions ON the
`include:`/`exclude:` key line (inline flow) and cleared the poisoned
allowlist before keys declared after the include block were collected — CI
runs the scanner in exactly that fallback mode. Reproduced (0 findings on
both poison shapes), fixed (key-line check + deferred allowlist clear),
fail-verified with two new fixtures; parsed walk confirmed already strict;
literal-only include merge preserved as safe. Register: Round 4 table in
`CODERABBIT-ROUND-VERIFY.md`.

## Session 8 (2026-11-27) — owner skip bug + ChatGPT round-2 closure

1. Owner report "continuous skipping breaks the session": root cause found by
   deterministic replay (SKIP-1 in DEFECTS.md) — the consolidation clamp in
   `skipSessionCard()` jumped unsatisfied consolidations to the front of a
   skip/practice-dominated queue (graded gap 0). Fixed by counting REAL
   first-pass turns during repositioning; fail-verified `Scope B.1b` added;
   `Scope B.1` untouched and green.
2. ChatGPT round-2 review (PR #89 comment 7220291631): 3 P1 + 3 P2 all verified
   then fixed — entrypoint packaging + packaging smoke suite, fallback scanner
   `run :`/`"run" :` whitespace class (6 matchers, 2 negative controls), CI
   path filters (+`.github/workflows/**`, scanner source), smoke-workflow
   declared-identity honesty + format check, quota-probe key restore, progress
   backup size cap (pre-read refusal + validator bound). Register:
   `evidence/session-2026-11-27/CHATGPT-ROUND2-VERIFY.md`.
3. CI truthfulness: the Node `yaml` parser is now pinned and installed in
   `ci.yml` (`yaml@2.9.1` via NODE_PATH) so the scanner's parsed-mode tests are
   REQUIRED on the runner instead of silently skipped (GPT2-2 addendum); the
   coverage gate pins the install, the NODE_PATH export and the path filters.
4. Count consistency gates kept honest: checklist Node row 314 (10 suites incl.
   `telemetry-entrypoint`), Python row 305, CHANGELOG PR-#86 totals synced —
   `test_audit_document_counts` green.
5. Fresh gates at the session-8 head: Node static 292/292; shard/scanner 26+1
   documented skip; telemetry 19/19 + entrypoint 3/3; Python 305/305; archive
   5/5; release/deploy gates exit 0; clean-tree scan 0/0; mutation_cr_scrub
   12/12; exam/vocab audits verdict OK.

### Session 9 addendum (2026-11-28) — CodeRabbit round-6 follow-ups + independent audit finding

1. CR6-a: the browser method note's "outputs ARE tracked" claim was false
   (neither recon JSON is in git) — rewritten to describe the self-contained
   procedure and point at the authoritative tracked digest record.
2. CR6-b: scanner CLI now exits 2 (loud, non-authoritative) without a parser;
   the suite fails in CI when the pinned parser is missing; escape-decoded run
   keys documented as parsed-mode-only, with tests for both modes' behaviour.
3. CR6-c: deploy.yml's hold comment now states the manual force exception.
4. AUDIT-1 (independent): quota-preflight exceptional paths hardened (unreadable
   pre-read → refuse untouched; failed restore → no probe residue),
   fail-verified regressions added (static-app 151).
5. Full matrix re-run at the round-6 head — all green (see Round 6 register).
