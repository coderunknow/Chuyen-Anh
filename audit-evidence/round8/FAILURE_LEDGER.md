# Round 8 — failure ledger

Append-only. Each entry: what was tried, why it failed or stayed inconclusive, what was
learned, and the next viable alternative.

---

## F1 — Browser suites cannot run in this sandbox

**Hypothesis.** The Playwright matrix (chromium/firefox/webkit) can be executed locally
so the exact-SHA claim does not depend on CI.

**Method.** `npm install --no-save playwright-core@1.55.1 axe-core@4.14.0` (succeeds),
then `npx playwright@1.55.1 install chromium`.

**Actual.** `Error: Failed to download Chromium 140.0.7339.186 (playwright build v1193),
caused by: Download failure, code=1`. The executable path
(`~/.cache/ms-playwright/chromium-1193/chrome-linux/chrome`) does not exist. The sandbox
has outbound access only to a small allowlist of hosts; the browser CDN is not on it.

**Conclusion.** `BLOCKED_EXTERNAL`. Not a repository defect and not a flake. The suites
are exercised in CI (`ci.yml` job `browser`, three engines) on the exact final SHA;
their result is reported from that job, never inferred from this sandbox. No local
"PASS" is claimed for a browser suite in this round.

**Next viable alternative used.** The DOM contract the browser suite asserts for the
correction UI (input `maxlength`, hint element, `aria-describedby`) is pinned statically
in `tests/exam-persistence.test.js::r8 correction UI: the 1,000-character limit is
visible and enforced at the input`, which runs in the dependency-free Node job.

---

## F2 — A first attempt at migrating the test suites corrupted the callbacks

**Hypothesis.** A regex can turn every `test(...)` callback that now awaits into an
`async` arrow.

**Method.** `re.sub` over `test\(..., () => {…}\)` blocks, then a hand-written brace
matcher.

**Actual.** The regex matched comment text inside a callback and produced
`async () =>  Attempt ids can all match …` — a syntax error in the file, not a test
failure. Nothing was lost: the file was restored with `git checkout --` and the
migration redone.

**Lesson.** Structural edits to a 1,700-line test file must be driven by a real
brace/tokenizer walk, not by a line-level regex. The second attempt (line-oriented
scan for `test(` … `\n});` boundaries, then targeted `await` insertion) worked on the
first try and is what shipped.

---

## F3 — Making persistence strict about "every stored summary must reproduce" broke a legitimate save

**Hypothesis.** After merging, the union is only trustworthy if every attempt's stored
`summary` equals a re-computation of it.

**Actual.** Two shipped tests failed: an attempt scored *before* a correction legitimately
re-scores higher once the union carries that correction, so "the stored summary is
immutable" is false by design. The correct invariant is "the union is self-consistent
after one re-score", which is what the validator already enforces.

**Fix.** `examMergeIntent` recomputes once and validates the result; it does not compare
the recomputation with the pre-merge summary.

**Lesson.** The review finding said *"validate unseen attempts with their stored
corrections"* — about a **partial payload**, not about frozen summaries. Reading the
finding as a stricter invariant than it states replaced one wrong refusal with another.
The evidence that this was understood: `FINDINGS.md` #6 pairs the fix with its mirror
test, which proves an attempt *may* re-score when a correction arrives.

---

## F4 — `--help` probing is still dangerous, so it was not used as a discovery mechanism

**Observation.** The round-7 evidence bundle records that a `--help` sweep over every
script *executed* `release_artifacts.py` (which can call `gh release create`). This
repository is under `DEPLOY_HOLD`.

**Method used instead.** The gate list was **extracted from `ci.yml`** and run verbatim
(`21` commands), never discovered by probing. The two build tools were only invoked
through `tests/test_script_help.py`, which puts a fake failing `gh` first on `PATH`, sets
the release environment variables, and hashes the tracked tree around the call.

**Result.** Both `--help` invocations exit 0 with byte-identical files and no `gh` call.
No tag, release, draft, asset or upload was created at any point in this round.

---

## F5 — `assert.throws` is the wrong assertion for an asynchronous refusal

**Hypothesis.** The round-7 conflict test (`conflicting-paper`) could keep `assert.throws`.

**Actual.** Persistence now resolves a result object; the refusal is
`{ ok: false, reason: 'conflicting-paper' }`, and `assert.throws` failed with
"Missing expected exception".

**Fix.** The test asserts `ok === false` and `reason`, which is also the contract the UI
depends on (it shows a specific message instead of catching). The intent of the original
assertion — *a different snapshot is never merged blindly* — is preserved and strengthened
by checking the reason.
