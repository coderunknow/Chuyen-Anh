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
