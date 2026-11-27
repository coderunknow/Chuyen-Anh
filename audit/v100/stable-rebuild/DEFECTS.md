# DEFECTS — stable-rebuild session (2026-11-17)

## D-SR1 — `NODE-LOCKS-ENV`: exam-persistence test pins a false environment assumption

- **Severity:** test-suite defect (CI-breaking on Node ≥24.22); no application defect.
- **Location:** `tests/exam-persistence.test.js:55-66` ("a locked write reports the mode it obtained").
- **Root cause:** the test asserted `result.mode === 'unserialized'` and
  `examHistoryLockSupport().available === false` with the comment "Node has no
  `navigator.locks`". Node v24.22.3 ships a working Web Locks implementation;
  `withExamHistoryLock` in `index.html` (554456-554486) obtains a real exclusive
  lock and reports `locked`. The shipped code was honest; the test's environment
  assumption was stale.
- **Baseline reproduction (raw):** on untouched `948f6f9`,
  `node --test tests/*.test.js` → `ℹ pass 304 / fail 1`;
  `AssertionError: + actual 'locked' - expected 'unserialized'` at
  `tests/exam-persistence.test.js:63`.
- **Fix:** the test derives the expectation from `examHistoryLockSupport()` —
  `assert.equal(result.mode, lockAvailable ? 'locked' : 'unserialized')` — so the
  honesty invariant ("never claim a stronger mode than obtained") is pinned on
  both kinds of environments.
- **Regression test:** the rewritten test itself (suite now 36/36 on this Node).
- **Mutation controls (both fail-first, restored afterwards):**
  - mutant always-`locked` (unserialized branch removed): caught on a lockless
    context (`mode='locked'` vs expected `unserialized`).
  - mutant always-`unserialized` (locked return replaced): caught on a locking
    context (`mode='unserialized'` vs expected `locked`).
  - Harness: `scripts/mutation_ds1.mjs` (session workspace), output
    `MUTATION-CONTROLS: OK (both mutants caught, both honest contexts pass)`.
- **Post-fix verification:** full Node suite 306/306 (after D-SR2 added one test).
- **Remaining limitations:** none for the invariant; note that CI's Node patch
  version determines which branch of the assertion runs there.

## D-SR2 — `TELEMETRY-NOTE-SECRETS`: diagnostics notes could carry verbatim credentials

- **Severity:** privacy hardening (privacy-policy violation risk, not XSS); both
  client and server.
- **Location:** `scrubTelemetryText` (`index.html`, telemetry module) and
  `scrub` (`api/telemetry.js`).
- **Root cause:** the only redactions were quoted fragments (note cut at the
  first quote character) and e-mail addresses. Notes legitimately carry
  `error.message` (`window.onerror`, `unhandledrejection`, `import-error`), and
  a failed fetch or a validation error can print its own `Authorization` header
  or a token-carrying URL — none of those shapes were scrubbed.
- **Baseline reproduction (raw):** on untouched `948f6f9`, both shipped scrubbers
  returned unchanged: `ghp_0123456789abcdefghijklmnopqrstuvwxyz`,
  `sk-proj-9f8e7d6c5b4a3210feedcba9876543210`,
  `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.disallowed` — while the controls
  behaved as documented (e-mail → `…`, quoted text cut at quote, plain text
  untouched). Harness: `scripts/rt_scrub_baseline.mjs` (session workspace).
- **Fix:** both scrubbers gained `SECRET_SHAPES` / `TELEMETRY_SECRET_SHAPES`
  (GitHub token prefixes, OpenAI-style keys, `Bearer` headers, URL credentials
  with the host kept readable), applied after the quote cut, before the e-mail
  pass; the two lists are documented as kept-in-sync.
- **Regression tests:** `tests/static-app.test.js` (5 new assertions inside the
  diagnostics contract test) and `tests/telemetry-api.test.js` (new end-to-end
  test "secret-shaped strings in a note are redacted before storage" asserting
  the stored payload never contains any sample secret). telemetry-api: 17 → 18
  tests; Node total 305 → 306; `audit/v100/FINAL_READINESS_CHECKLIST.md` row
  updated (the count meta-test `test_ci_gate_coverage.py` enforces this).
- **Mutation controls (fail-first, restored afterwards):** with the scrub step
  removed from `api/telemetry.js` and `index.html`, the new server test and the
  new client assertions both fail (observed: `exit=1` on both suites; failures
  "secret-shaped strings in a note are redacted before storage" and "a GitHub
  token inside a note is redacted").
- **Post-fix verification:** repro shows `…` redactions on both sides; full
  suites green (Python 294/294, Node 306/306, 21 validators, both browser suites).
- **Residual (documented, by design):** notes are still free text; shapes beyond
  the four families (e.g. custom vendor tokens) are not detected. The payload is
  size-bounded (16 KB), events allow-listed, and the server re-scrubs everything.

## Not-a-defect controls verified during the red-team pass

- Prototype-pollution counter keys (`__proto__`, `constructor`) are dropped by
  the `TOKEN` regex (`__proto__`) or stored as plain own properties that never
  escape as pollution (`constructor`); verified on both client and server paths.
- The stored payload is rebuilt from allow-listed fields only; unknown fields,
  unknown kinds, unparsable timestamps, non-token names and over-range counters
  are dropped (existing test coverage re-confirmed).
- Injection-shaped `client_key` ("x'); insert into…") is accepted as an opaque
  string by the OLD SQL function (parameter-bound, no injection) and rejected by
  the hardened one (`invalid-client-key`); no SQL injection path exists through
  the parameterized RPC.
- Exam renderer: `audit_rendering.mjs` re-confirmed 0 renderer errors, 0 script
  tags, 0 inline handlers across all 106 transcriptions; the browser suite
  additionally asserts `2022/hai-phong/so` angle-bracket text renders inert in
  the live DOM.

## Review round 2 (CodeRabbit, 2026-11-17, against head `248b75a`) — dispositions

CodeRabbit's genuine COMMENTED review produced seven findings (five Major /
security, two Minor / reproducibility). All seven were verified against the
current source before touching code; all seven were valid and are fixed with
regression tests and mutation controls. No finding was dismissed.

### CR1 — fine-grained GitHub tokens not redacted (Major) — FIXED

- Root cause: `SECRET_SHAPES[0]` matched only the classic `gh?_` prefixes.
- Fix: the GitHub pattern now also matches `github_pat_` + 22 + `_` + 59
  characters (GitHub's documented fine-grained format), in both scrubbers.
- Regression: new test in both suites; mutant "github_pat pattern removed"
  killed on both implementations.

### CR2 — Bearer pattern missed `+` (and `/`, `~`) (Major) — FIXED

- Root cause: `[A-Za-z0-9._-]{12,}` excludes `+ / ~` (RFC 6750 b64token) and a
  token starting with `+` cannot match at all.
- Fix: `[A-Za-z0-9._~+/]+=*` with no minimum length (a short credential is
  still a credential), both scrubbers.
- Regression: `+ab~/cdEF9=` and `abc123` cases; mutants killed.

### CR3 — URL user-info with an empty username survived (Major) — FIXED

- Root cause: the username class `[^\s/@:]+` required ≥1 character, so
  `https://:password@host` never matched.
- Fix: username class `[^\s/@]*` (empty allowed); port-bearing URLs still do
  not false-positive (the password class cannot cross `/`, verified by case
  analysis and the untouched `https://learner:pass@host` expectations).
- Regression: new test; mutant killed.

### CR4 — baseline reproduction instructions wrong (Minor) — FIXED

- Root cause: `git stash` cannot recover the baseline on a checkout of the
  candidate branch — the fixes are committed, so the "baseline" run executed
  fixed code.
- Fix: `REPRODUCTION_COMMANDS.md` now pins the baseline in a separate worktree
  (`git worktree add /tmp/baseline-948f6f9 948f6f9`); verified end-to-end: the
  baseline worktree reproduces exactly the D-SR1 failure and the candidate
  worktree passes the same suite.

### CR5 — five cited audit scripts untracked (Minor) — FIXED

- Root cause: the scripts lived in the session workspace and were never
  committed, so the evidence was not reproducible from a clean checkout.
- Fix: all five scripts tracked at the cited paths (`scripts/mutation_ds1.mjs`,
  `scripts/rt_scrub_baseline.mjs`, `scripts/independent_exam_audit.mjs`,
  `scripts/independent_vocab_audit.mjs`,
  `scripts/pglite_rate_limit_evidence.mjs`) with repo-relative path resolution
  replacing the absolute sandbox paths; every documented command executed from
  the checkout. The pglite dependency is declared in the doc with its install
  command instead of being silently required.

### CR6 — incomplete Bearer credential alphabet client-side (Major) — FIXED

- Same root cause and fix as CR2, client side (`TELEMETRY_SECRET_SHAPES[2]`);
  the reviewer's example (`Bearer abcd+…`) is covered by the same new cases
  and the same mutant.

### CR7 — quote split ran before the secret patterns (Major) — FIXED

- Root cause: `split(QUOTE)[0]` executed first, so an apostrophe inside URL
  user-info truncated the text before the `@`, leaving the password prefix in
  the note (RFC 3986 permits apostrophes in userinfo).
- Fix: the secret-pattern loop runs before the quote split in BOTH scrubbers;
  the reviewer's exact example now yields `fetch failed https://…@example.test/`.
- Regression: new test in both suites; mutant "order swapped back" killed.

### Round-2 guard rails added beyond the findings

- `tests/test_telemetry_smoke_gate.py` (8 tests): the production-writing smoke
  workflow must stay dispatch-only with an explicit confirmation input and a
  deployment identity, concurrency-protected, least-privileged and SHA-pinned.
  Negative control: re-adding a `pull_request` trigger fails the suite.
- `scripts/mutation_cr_scrub.mjs`: 8 mutants (one per fix per implementation),
  all killed; log `evidence/review-round/mutation_controls.log`.
- `scripts/scan_workflow_injection.mjs`: script-injection scan of all
  workflows with a parse-verified literal-matrix allowlist; negative control
  detects injected `github.head_ref` / PR-title interpolation in both block
  and inline `run:` forms.

## Review round 3 (CodeRabbit, 2026-11-17, against head `2f13f33`) — dispositions

The owner-authorized `@coderabbitai review` on the round-2 head produced 13
actionable findings (2 Major, 11 Minor incl. nitpicks). All were verified
against the current source; all were valid and are fixed. No finding dismissed.

### R3-1/R3-2 (Major, server + client) — Bearer class missing `-` — FIXED

- Root cause: the round-2 pattern `[A-Za-z0-9._~+/]` omitted `-`, which RFC
  6750 b64token allows; `Bearer abc-def` matched only `Bearer abc` and a
  leading-hyphen token did not match at all.
- Fix: `[A-Za-z0-9._~+/-]` in both scrubbers (hyphen last in the class).
- Regression: leading-hyphen and embedded-hyphen cases added to both suites
  (assertions inside the round-2 tests; suite counts unchanged).
- Mutation fixtures updated to mirror the new pattern; 8/8 mutants still
  killed after the fixture refresh.

### R3-3 (Minor) — exam audit counted checked, not passing, hashes; always exited 0 — FIXED

`independent_exam_audit.mjs` now counts an entry as passing only when it
carries at least one hash and every supplied hash matches, and exits non-zero
on any mismatch or missing key (`verdictOk` in the JSON output). Re-run:
2,146/2,146, `verdictOk: true`.

### R3-4 (Minor) — naive CSV/TSV splitting — FIXED

`independent_vocab_audit.mjs` splits rows on `/\r?\n/` and parses CSV fields
with a quote-aware parser (RFC 4180 subset); re-run reproduces 198/198.

### R3-5 (Minor) — unguarded `row.word` in the deep audit — FIXED

Both uses guarded (`String(row.word || '')`), so a malformed row is reported
as a defect instead of crashing the audit.

### R3-6 (Minor) — mutation harness counted infra failures as kills — FIXED

`mutation_cr_scrub.mjs` classifies a completed non-zero exit (`error.status`
number, no signal) as a kill and everything else (timeout, signal, spawn
error) as an inconclusive infrastructure failure (exit 2). The first attempt
of this fix itself misclassified — see FAILURE_LEDGER F-SR13.

### R3-7/R3-8 (Minor) — PGlite portability and window boundaries — FIXED

The script documents `PGLITE_NODE_PATH`, fails with the exact install command
(exit 2) instead of a MODULE_NOT_FOUND stack, and every scenario reads the
DB's own 600-second window floor before and after; a boundary crossing
retries from a fresh database (up to 3 attempts) and an unresolvable crossing
marks the scenario inconclusive. Re-run: both behaviours demonstrated.

### R3-9..R3-14 (Minor) — workflow-injection scanner hardening — FIXED

The scanner now walks the PARSED YAML: per-job literal-matrix allowlists
(local to the consuming job), matrix values that contain expressions are
rejected from the allowlist, `run` bodies are taken from the parsed document
(block-scalar headers, indicators and comments are the parser's problem, not
a regex's), every expression in a body is checked individually, and the old
`SAFE_CONTEXT` shell-text filter is gone. Negative controls: a poisoned
matrix value, a block-form `github.head_ref` and an inline PR-title
interpolation are all detected; the clean tree passes with 0 findings.

### R3-15 (nitpick) — `__proto__` fixture created no own property — FIXED

Both counter fixtures in `rt_scrub_baseline.mjs` use `['__proto__']: 1`, so
the probe exercises the actual rejection of an own `__proto__` key.

## Session 5 — owner ChatGPT-review round on `2fd29c2` (2026-11-27)

The repository owner posted an independent review ("Review By ChatGPT", PR
comment 2026-11-26, target `2fd29c2ab20c43ba8a3091b9dc3b46a24fb10fa6`) with two
confirmed code findings. Both were reproduced on this session's head before
fixing, fixed with regression tests, and mutation-guarded. No finding dismissed.

### CR-SR5-1 / "P1" (Privacy, high) — URL user-info with a username-only or empty-password credential bypassed both scrubbers — FIXED

- Root cause: the RFC 3986 user-info rule
  `/([a-z][a-z0-9+.-]*:\/\/)[^\s/@]*:[^\s/@]+@/gi` required a colon AND a
  non-empty password, so `https://alice-secret@localhost/api` (username-only,
  single-label host so the e-mail rule cannot catch it) and
  `https://alice-secret:@localhost/api` (empty password) passed through both
  `TELEMETRY_SECRET_SHAPES` (index.html) and `SECRET_SHAPES` (api/telemetry.js)
  unchanged. Baseline repro captured from `git 2fd29c2`
  (`evidence/session-2026-11-27/url-userinfo-scrub-evidence.txt`).
- Fix: the whole user-info component is redacted —
  `/([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+@/gi` → `$1…@` — in BOTH files, comment
  updated in sync. A path `@` (`https://example.com/@user`) is untouched
  (negative control), and a username before an IPv6 authority is covered too.
- Regression: client assertions in `tests/static-app.test.js` ("rc5 round 2")
  and server events + never-stored fragments in `tests/telemetry-api.test.js`;
  both suites green.
- Mutation controls: `scripts/mutation_cr_scrub.mjs` fixtures refreshed to the
  new rule and two new mutants per side (revert to colon+password; drop the
  colon from the class) — **10/10 killed** with the hardened harness.

### CR-SR5-2 / "P2" (Security tooling, high) — the no-parser fallback of the workflow-injection scanner missed multiline run bodies AND flagged the clean tree — FIXED

- Root cause: without the optional `yaml` module the fallback only inspected
  the `run:` header line. A poisoned `run: |` body
  (`echo "${{ github.event.pull_request.title }}"`) produced **no** finding
  (false negative) while ci.yml's safe inline `${{ matrix.browser }}` WAS
  flagged (false positive) — so in a parser-less environment the scanner both
  missed real injections and failed the clean tree. Reproduced from
  `git 2fd29c2` in
  `evidence/session-2026-11-27/workflow-injection-negative-controls.txt`.
- Fix: `scripts/scan_workflow_injection.mjs` rewritten around an exported
  `scanWorkflows()` (importable, no side effects; CLI behaviour unchanged).
  The fallback now inspects the FULL run text — block-scalar bodies (`|`, `>`,
  chomping and explicit indent indicators, blank lines, comments), quoted and
  plain inline continuations — and applies the same literal-matrix allowlist
  through a strict line scan that can never allowlist more than the parsed
  walk (flow maps, multi-line flow collections, include/exclude and
  expression-bearing values all stay rejected); alias-valued `run:` steps are
  flagged because they cannot be resolved safely.
- Regression: `tests/workflow-injection-scan.test.mjs` (10 tests) — poisoned
  block/inline/folded/explicit-indent/preamble fixtures, allowlisted matrix
  cases, non-run contexts, alias case, and the repository's real workflows
  passing in fallback mode; the parsed-walk test runs whenever `yaml` resolves.
  Wired into `ci.yml` next to the shard-partition suite.
- Fresh scan: 8 workflows, **0 findings** in BOTH modes
  (`workflow-injection-scan-fallback.json`, `workflow-injection-scan-parsed.json`).

### CR-SR5-3 (Audit-tooling honesty, medium) — a load-breaking mutant counted as a "kill" — FIXED

While adding the CR-SR5-1 mutants the harness's `to:` strings dropped the
leading `[` of the regex literal, so the mutant failed with a SyntaxError and
the suite "failed" without running any assertion — a false kill (the harness's
first attempt at this session's own fix repeated the failure-ledger pattern of
F-SR13). `runTest` now classifies a completed non-zero exit whose output looks
like a load failure (`SyntaxError`, `ERR_*`, `ReferenceError`, …) as
**LOAD-FAILURE — inconclusive (exit 2)**, not a kill; only an assertion
failure counts. Verified: reverting one mutant manually produces the expected
`expected: 'request failed https://…@localhost/api'` assertion failure, and the
full 10/10 run still kills every mutant.

### CR-SR5-4 (Reproducibility, medium) — the telemetry-smoke gate depended on an undeclared preinstalled PyYAML — FIXED

`tests/test_telemetry_smoke_gate.py` imports `yaml` at module top. GitHub
runners ship PyYAML, so CI was green, but a fresh checkout (and this sandbox)
errored at import: `discover` collected 295 tests + 1 loader error while the
checklist claimed 302 — exactly the "claims no workflow could reproduce" class
the coverage contract exists for. Fix: the dependency is declared and pinned in
`tests/requirements.txt` (PyYAML==6.0.4), `ci.yml` and `deploy.yml` install it
right before `unittest discover`, and the module skips with that reason when
PyYAML is missing. Fresh counts: **302 collected with or without PyYAML** (8
gate tests skip without it) and the new contract test
(`test_the_python_suite_dependencies_are_declared_and_installed_in_every_workflow`)
keeps both workflows honest. With the new scanner suite the totals are Python
**303** (`discover`) + 5 archive, Node **308** static/telemetry + **19**
shard/failure/scanner; checklist and changelog refreshed to match.

## Session 6 — final merge-readiness audit round on `b8c3dbf` (2026-11-27)

Directive: "find all bugs in index.html — don't just repeat the green tests;
confirm no false positives; fix comprehensively and cleanly; then push, request
CodeRabbit and verify every finding." The whole single-file runtime (the
~11,400-line ES module inside `index.html`) was re-probed adversarially at head
`b8c3dbf` through four fresh probe batteries (all written for this round, all
iterating until their own probe-contract errors were eliminated — every
non-bug flag was adjudicated against the real contract before being dismissed):

1. Exam grading core re-sweep: all 106 papers / 6,708 parsed questions /
   3,292 scorable choice items with 18 weird inputs each, determinism pairs,
   per-option credit invariants, multi-select subset credit — 0 crashes,
   0 invariant violations (unchanged from session 4, re-confirmed at this head).
2. Behavioral battery #2 (12 areas): storage/store guards, staging rollback
   incl. `__proto__` keys, `updateProgress` walks, telemetry sanitize, exam
   result store, typed grading incl. ambiguity paths, queue/consolidation
   placement — 0 flags. The previously pending consolidation-placement flag was
   closed as a probe arithmetic error (with 2 unseen cards and gap 3 an
   achievable gap does not exist; the documented contract inserts at
   `nonPracticeEnd` with `scheduledAfter = index-1 = 2`).
3. Behavioral battery #3 (new): device-settings export/validate/apply
   round-trip incl. 10 adversarial payloads, v1 backup import validation incl.
   prototype-pollution and junk-field cases, essay rubric grader, exam
   stimulus state, the full CEFR sense model, match-board state machine, XP/
   badge/timer math, telemetry report build, exam practice lifecycle, family
   fold — 0 bugs.
4. Behavioral battery #4 (new): 2,000 seeded distractor boards over the real
   8,112-headword deck (4 options, exactly one correct, unique normalized
   texts, no answer leak, EN→VI masking, gradeAnswer agreement, seeded
   determinism), phrase grader adversarial cases, phrase progress counters,
   exam corrections through `scoreExamSession` (0→1 credit, foreign examId
   ignored), exam clock, hand-off leak guard — 0 bugs.
5. Static sweeps: 17 storage keys (no collisions), global listener
   registration (4 document/window listeners, each registered once inside
   `createApp`; no `beforeunload` exists at all), every `innerHTML` template
   site (31) checked for unescaped data-derived interpolation (all escaped;
   exam markdown renderer escapes raw HTML and only whitelisted inline tags
   pass), `new RegExp` sites, Math.random inventory (shuffle/distractors/
   attempt id/confetti only — nothing security-relevant).

Exactly one real defect was found and fixed this round; every other flag was
adjudicated as a probe-contract error with the reason recorded.

### CR-SR6-1 (Robustness, high) — `highlightMatch` threw an uncaught SyntaxError on huge search queries (V8 lazy RegExp compilation) — FIXED

- Root cause: the try/catch in `highlightMatch` wrapped only the
  `new RegExp(...)` constructor. V8 compiles a RegExp body lazily, so the
  constructor can succeed and the first `.replace()` still throws
  (`regular expression is too large`). `#search-field` has no maxlength and no
  JS cap, so a query of >= ~40,000 escaped regex atoms (measured: 30,000 ok,
  40,000 throws, Node v22.22.3) crashed the whole search `draw()` path with an
  uncaught exception. Not ReDoS — a plain crash.
- Fix: construction and first use now sit inside ONE try/catch whose catch
  returns `escapeHtml(source)` — exactly the function's existing
  constructor-failure contract (plain escaped text, no `<mark>`). One comment
  documents the lazy-compile mechanism. Nothing else changed.
- Evidence: before/after probe transcripts in
  `evidence/session-2026-11-27/highlight-lazy-regex-crash-evidence.txt`.
- Regression: `tests/static-app.test.js` ("search highlighting never breaks
  the text it escapes") now pins the 40k/60k-atom fallback, a 40k-atom `+`
  query, and that a 20,000-match source still marks every match. Full suites
  green at the fix head (289 canonical Node + 19 shard/failure/scanner +
  303 Python + 5 archive).
- Adjudicated non-bugs recorded for completeness (probe errors, verified
  against source): `pluralCount` includes the count; `highlightMatch` marks
  only matched characters; `loadExamResultHistory` is best-effort by design
  with the writer holding the refusal guard; `createExamAttempt` throws on
  invalid input (fail-closed, bounds 1–360 min); `examStimulusState` returns a
  status string; essay `under_length` fires before the template gate by
  design; CEFR levels live on senses (`sense.cefr`, verified against
  data/vocabulary.json) with `level:` tags as the legacy headword path;
  match items use `item.vocab`; `sessionTimeLimit` untimed returns 0;
  `examClockState` is not called by runtime UI paths and its attempts are
  sanitized (Number.isFinite enforced) so NaN inputs are out of contract;
  `phraseKey` folds punctuation including dashes (intended);
  `handOffForDisplay` passes the answer through when no leak exists;
  `generateQuestion`'s cloze fall-through is unreachable (the only runtime
  call site is fed sanitized numeric progress counters and hints that are
  either MODE values or `EXERCISE_TO_MODE` keys; match turns carry
  `match: true` and never reach it).

## Session 6b — CodeRabbit review round on `f58fd93` (2026-11-27)

The session-6 push requested the CodeRabbit review per the audit directive.
The review (id 6087003324) posted **18 actionable comments — 3 Major
(Security & Privacy), 15 Minor — every one of them verified against the code
with a repro before fixing, every one confirmed valid, every one fixed.**
Full register with per-finding fixes and controls:
`evidence/session-2026-11-27/CODERABBIT-ROUND-VERIFY.md`.

### CR-SR6-2 (Major, Security tooling) — three scanner allowlist/coverage gaps — FIXED

1. **Matrix include bypass:** GitHub adds a combination for an `include`
   entry that cannot fully merge with the base values, so a single
   expression-bearing include field put attacker text into a matrix key the
   base matrix had proved literal, and `${{ matrix.<key> }}` was allowlisted.
   Fix: any expression-bearing include/exclude entry drops the whole per-job
   allowlist (parsed and fallback modes). Controls: poisoned include flagged
   in BOTH modes; literal-only include still clean.
2. **Expression under-scan:** `[^}]+?` stopped at the lone `}` inside
   `format('{0}', …)`, so `${{ format('{0}', github.head_ref) }}` produced NO
   finding at all. Fix: the expression scan reads to the first real `}}`
   (an unterminated `${{` flags the tail conservatively). Control:
   format-expression flagged in both modes.
3. **Quoted run keys:** the fallback's `run:` regex missed valid quoted
   mapping keys (`"run":`, `'run':`), silently skipping the whole script —
   the opposite of conservative. Fix: optional quote pair (backreferenced)
   around the key, close before the colon. Control: quoted inline + quoted
   block flagged in both modes.

### CR-SR6-3 (Minor, Privacy tooling) — URL user-info redaction consumed past `?`/`#` — FIXED

`[^\s/@]+@` could match across a query or fragment, so
`https://api.example.test?contact=alice@localhost/path` was rewritten to
`https://…@localhost/path` — mangling the real host and misreporting the
endpoint in diagnostics. Fix in BOTH scrubbers (`api/telemetry.js`,
index.html client copy): `[^\s/?#@]+@` — user-info sits between the scheme
and the authority, so a query/fragment `@` is not a credential. All
CR-SR5-1 redaction cases unchanged. Controls: 2 new assertions per suite; 2
new boundary mutants; **12/12 killed**.

### CR-SR6-4 (Minor, Evidence honesty) — audit tooling/evidence integrity batch — FIXED

All confirmed and fixed with controls (details in the register file):
probe totals now enforced (alignment B4; orphan curated examIds fail the
verdict; distinct distractor meanings checked), `B_alignmentProbe` is now
MEASURED by running the alignment probe (fixed string removed), scan
evidence files are pure JSON with `exit` as a property, checklist evidence
paths point at tracked files, the baseline repro documents its Web Locks
precondition, the browser method note states its one-off helpers were not
committed, the pglite evidence guards inconclusive window changes and pins
the B2 global refusal, `mutation_ds1.mjs` runs both environments
deterministically on any host (verified on a lockless sandbox), and the
CI-coverage gate checks the actual PyYAML pin and the actual install command
(controls: each broken state fails the new test). The CHANGELOG/deploy.yml
force-override wording now documents the real dispatch-only escape hatches
(behaviour unchanged, pinned by 32/32 gate tests).

### Gates at the session-6b head

Canonical CI Node 289/289; scanner trio 22 pass + 1 documented skip;
telemetry 19/19; Python 303/303; archive 5/5; shard partition OK;
`mutation_cr_scrub` 12/12 killed; `mutation_ds1` OK on a lockless host;
clean-tree scan 0 findings both modes; all four session-6 probe batteries
0 flags; exam core unchanged (106/6,708/3,292/0/0); gates held as designed.

## Session 7 (2026-11-27) — live-infrastructure defects (INFRA-1..4)

Found by direct live inspection (Supabase/Vercel connectors) after owner
addendum 2 authorized it. Full evidence:
`evidence/session-2026-11-27/live-infra-hardening.md`.

### INFRA-1 (critical) — `public.compute_jobs` writable by the public API — CLOSED

Live state: RLS disabled, zero policies, and `anon` **and** `authenticated`
holding SELECT/INSERT/UPDATE/DELETE/**TRUNCATE**/REFERENCES/TRIGGER — anyone
with the project's public anon key could dump and wipe the table via
PostgREST. Zero references anywhere in the repo (grep of `supabase/`, `api/`,
`scripts/` and git history) — it belongs to a separate compute pipeline.
Fix (tracked migration `lock_compute_jobs_from_public_api`): RLS enabled,
all anon/authenticated privileges revoked. Live re-read: grants = service_role
only, RLS on. The owning pipeline (service_role, BYPASSRLS) is unaffected.
Rollback: disable RLS + re-grant (single pair, documented).

### INFRA-2 (critical) — live ingest function was pre-hardening — CLOSED

Live state: `public.telemetry_ingest` matched `20261029_telemetry_ingest.sql`
(no `client:missing` bucket, no `missing_key_limit`) while the rc10/rc11
client ships the hardened contract — keyless callers could consume the whole
global 120/10-min budget. Fix: repo migration
`20261031_telemetry_hardening.sql` applied verbatim via
`create_migration apply_repo_20261031_telemetry_hardening`. Live re-read:
`ingest_is_hardened=true`, execute granted to postgres + service_role only,
`search_path` pinned. Rollback: re-apply `20261029_telemetry_ingest.sql`.

### INFRA-3 (high) — production endpoint stale (2026-10-29 build) — CLOSED

The live function predated every rc8–rc11 scrubber fix (URL user-info
boundary, Bearer alphabet, fine-grained PAT rule). Fix: files-based
production deploy of the byte-identical repo-head handler in the working
deployment's shape → `dpl_9S9n7dkfm8ysEii4nMf1n2ZEWhYW` READY/PROMOTED,
alias `chuyen-anh-telemetry.vercel.app` assigned 2026-11-27. Rollback: the
retained 2026-10-29 deployment `dpl_FbxQncjJru7dSKMWnPnTs1GozMWV` can be
redeployed.

### INFRA-4 (medium) — deployment not reproducible from git — CLOSED

The working deployment contained `src/app.js` (service entrypoint) that
existed nowhere in the repository; the first redeploy attempt
(`dpl_2xJrWZ6eKhpmykYfKuGmezrvDBts`) failed with "No entrypoint found" —
proof the gap was real. Fix: `api/app.js` committed (minimal pass-through
wrapper, documented mapping, never touches request data); local live-server
smoke against the real handler: OPTIONS→204 (+CORS/methods), GET→405
(+Allow), POST from disallowed origin→403. Rollback: none needed (additive
file; the wrapper is only exercised in the Node-service deployment).

### INFRA-5 (medium, gate integrity) — force override deployed unclassifiable builds — CLOSED (round 3)

Found by CodeRabbit round 3 on head `f077679`. `app_release_gate.py` treated
an unclassifiable `APP_VERSION` (missing, malformed, or duplicated
declaration → `app_version()` returns None) as "not stable", so the
`elif force:` branch granted a deploy WITHOUT `stable_deploy_authorized` —
while the gate's own contract (docstring + deploy.yml input text) promises
"FORCE_DEPLOY alone never deploys a stable release". Reproduced live: a
duplicated declaration + `FORCE_DEPLOY=true` alone printed
`deploy=true (manual force override)`.
Fix: force on an unclassifiable version now requires
`stable_deploy_authorized=true` (or the deploy holds); behaviour for a single
valid declaration is unchanged (prerelease+force allowed, stable+force
denied without authorization, stable+force+authorization allowed).
Controls: three new cases in `tests/test_app_release_gate.py`
(unclassified+force → denied; unclassified+no force → held;
unclassified+force+authorization → allowed), fail-verified against the
unfixed gate. Docstring and both deploy.yml input descriptions amended to
state the unclassified corner.
