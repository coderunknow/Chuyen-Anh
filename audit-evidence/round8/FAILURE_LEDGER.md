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

---

## F6 — CI caught a real regression my local suites missed: importing a backup after Clear

**Hypothesis.** Tombstones should win in every direction, including an import.

**Actual.** All three browser jobs at `bbe957d` failed at the same step:
`waiting for locator('#exam-history-list .exam-history-row')` after
*Clear all* followed by *Import*. The suite's scenario is the ordinary learner one —
export a backup, clear, import it back — and the tombstones I had added refused it, so
the import silently restored nothing.

This is the valuable kind of failure: the *unit* tests all passed, because they asserted
the tombstone rule without asserting that the learner's own explicit restore still works.
The browser suite exercises the flow, not the rule.

**Fix.** An import un-tombstones exactly the ids the file carries, and nothing else: an
explicit restore by the owner is a different actor from a stale tab. The stale-tab
guarantee is unchanged (and still tested).

**Control.** The new test
`r8 persistence: importing a backup after Clear restores it, because the learner asked for it`
was run against the pre-fix code and **fails** (`22 pass / 1 fail`), then passes with the
fix (`23 / 0`). That is the first test in this round whose control was provided by CI
rather than by me choosing where to look.

**Lesson.** A rule that is right in isolation can still break a flow nobody asserted.
The tombstone tests were written from the finding; the import test was written from a
failing pipeline.

**Second lesson, recorded honestly.** The log download for the failed jobs was unavailable
from this sandbox (`gh run view --log` returns `EOF` from the results receiver), so the
diagnosis came from the check-run annotations, which named the exact locator. When the
raw log is unreachable, the annotation is the evidence — and it was enough.

---

## F7 — Browser binaries are still unavailable, so the jsdom probe is a substitute, not proof

**Method.** With the real engines unreachable (F1), the UI flow that the browser suite
asserts was driven through `jsdom` and the app's own exported API
(`audit-evidence/round8/ui-flow-probe.mjs`, 8 checks, all passing): submit → correct →
clear → malformed import → valid import, on the store the app actually uses.

**What it proves.** The application logic and the storage contract of that flow, in a
context with no Web Locks (the `file://`-shaped fallback).

**What it does not prove.** Rendering, focus, timing or anything a real engine does
differently. It is not a browser result and is not counted as one; the browser matrix is
still read only from CI.
