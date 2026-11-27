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
