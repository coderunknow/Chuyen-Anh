# Round 7 continuation — report

> **Partly reconstructed.** §A–§G existed only in the untracked working tree and
> were lost (see `logs/RECONSTRUCTION_NOTICE.md`). They are rewritten from the
> committed code, the re-executed measurements and the PR history. §H was written
> live in this session and is not reconstructed.

Branch `arena/dedd1942-chuyen-anh` · PR #84 (Draft) · release identity
`v1.0.0-rc10` · `DEPLOY_HOLD` intact · no tag, no release, no deploy, not merged.

---

## A. What this continuation set out to do

A fresh, broad audit of PR #84 and its neighbouring paths: find real defects, fix
them with a repro that fails on the pre-fix commit plus a regression test,
implement the user's chosen **Option 3** device-settings export, re-run every
suite at one exact SHA, and get two independent reviews at that same SHA — while
keeping the PR in Draft.

## B. Repo and PR state

- `gh pr view 84` → `OPEN`, `isDraft: true`, base commit of the session branch
  `0026267`, remote head `9edc2a0`.
- Remote ref and local `rev-parse` compared after every push; they matched every
  time (`git ls-remote origin refs/heads/arena/dedd1942-chuyen-anh`).
- The PR was re-converted to Draft via GraphQL `convertPullRequestToDraft` after
  empty CI-retry commits silently cleared the flag. Verified `isDraft: true`
  afterwards. It is still Draft at the end of this session and has not been
  converted back.

## C. The Option 3 settings export

Implemented in `faa5728`, hardened in `99859e3` (byte cap before parse) and
`32ad30e` (no `ok` after a partial write).

Format is deliberately **not** the v1 backup:

```
{ app: 'chuyen-anh-device-settings', version: 1, exportedAt, settings: { cefr, theme, language, presentation } }
```

Decisions, in the order they matter:

1. **Separate file.** Merging settings into the v1 backup would have changed a
   schema other devices already read. The user asked for a separate export, and
   separation is also what keeps the v1 schema untouched (criterion 7).
2. **Versioned.** `version: 1` is checked exactly; an unknown version is refused
   rather than migrated. A migration strategy needs a second version to exist
   before it can be tested, and inventing one now would be untestable code.
3. **Replace-all-or-nothing.** The whole file is validated, then applied. A
   partially applied import is indistinguishable, from the learner's side, from a
   successful one that lost a setting.
4. **Device-local fields only.** CEFR preference, theme, language, presentation.
   Phrase progress is *learner progress*, belongs to the v1 backup, and is
   deliberately **not** duplicated — duplicating it would create two
   authorities for the same data and a merge problem on first conflict.
5. **`presentation` belongs here** and not in the backup: it is a rendering
   preference of this device (reduced motion, density), not a record of learning.

Failure semantics: any malformed value refuses the whole file, nothing is
written, and the previous settings remain readable. The refusal paths are
enumerated row by row in `COVERAGE_MATRIX.md`.

## D. What the audit actually found

Ten defects with controls (D65–D74 in `FINDINGS.md`) plus the process failures in
`FAILURE_LEDGER.md`. The ones worth a reader's attention:

- **D69** — a concurrent tab could silently drop an exam-history write, and the
  *common* (fast) path performed no verification at all. The shipped guarantee is
  detect-and-repair bounded to two retries; it is **not** mutual exclusion and is
  not described as such.
- **D71** — an operable control carried `aria-disabled="true"`. The probe that was
  supposed to catch this had encoded the bug as the requirement (H9).
- **D73** — the read-back compared attempt **summaries**, so an attempt replaced
  under the same id with the same score was adopted as the learner's own save.
- **D74** (this session) — the read-back never compared `papers`, so a snapshot
  replaced under the same key was adopted while every attempt still matched.

## E. What was tested, and the numbers

At `9edc2a0`: Node **266/266** (`exam-scoring` 60), Python **257 OK**, archive
**5 OK**, 16 validator gates pass (17 scripts accept `--check`; 1 is retired by design), both browser
suites PASS locally on chromium 133. The full transcription, with commands, is
`logs/final-sha-verification.log`.

The counts are recomputed by `tests/test_ci_gate_coverage.py` from the files that
declare them, which is how the stale `exam-scoring 59` was caught the moment the
60th test was added (H11).

## F. What is *not* done, and why

| Criterion | State | Reason |
|---|---|---|
| 8 — screen-reader validation | **INCOMPLETE** | No screen reader can exist in this environment. The checklist is real; the validation is missing. Not simulated. |
| 10 — Kilo review at the final SHA | **INCOMPLETE** | Insufficient credits on the app's account. Kilo fails to run at every SHA; an ACTION_REQUIRED is not a completion. |
| 13 — all CI green at the final SHA | **see §H** | Depends on the Playwright CDN and on WebKit runner health, neither of which is in the repository. |

Carried forward and **not** claimed fixed: Major `4537334892` (score mismatch on
`unseen` attempts) and Minor `4514659122` (multiword seed headwords, out of
scope).

## G. Release discipline

No merge. No tag, no release, no prerelease, no deploy. `DEPLOY_HOLD` is
unchanged and release identity remains `v1.0.0-rc10`. Merging PR #84 requires
separate authorisation and has not been requested by this report.

## H. CI at the final SHA — timeline

| SHA | `checks` | chromium | firefox | webkit | Note |
|---|---|---|---|---|---|
| `74a5e45` | pass | pass | pass | pass | last fully green run |
| `b19462c` | pass | pass | pass | pass | last fully green before the outage |
| `50fd918` | pass | **fail** | **fail** | cancelled | install step fails in ~2 s |
| `277b3c2` | pass | **fail** | **fail** | **fail** | empty retry commit, same step |
| `3c2d7ff` | pass | **fail** | **fail** | **fail** | empty retry commit, same step |
| `9edc2a0` | pass | **pass** | **pass** | **pass** | **CDN recovered — all four green** |
| `e538bb6` | pass | pending | pending | pending | docs/evidence only; in progress at time of writing |

The failure was always the same single step, `Install <browser> for Playwright`,
failing after ~2 s. The diagnosis rests on three facts, not on the error text:
the identical step passed at `b19462c` minutes earlier; `git diff b19462c..3c2d7ff`
contains **no** `.github` or package change; and the same commit set passes
locally. Job logs were unreachable (`EOF` from blob storage), so the step's own
output could not be quoted — that limitation is recorded rather than papered over.

At `9edc2a0` **all four jobs pass** — chromium, firefox, webkit and checks — with
no change to the workflow, which confirms the outage rather than a repository
defect. WebKit completed in ~14 minutes on that run, against the 35-minute job
timeout it had previously hit twice; the earlier cancellations were runner
health, not test failures.

**WebKit is tracked separately.** It has twice been cancelled after ~35 minutes
with no failing step (a runner timeout, not a test failure), and at the time of
writing it is still in progress. A job that never completes is not a pass, and
this report does not count it as one.
