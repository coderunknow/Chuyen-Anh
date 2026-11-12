# Round 8 — continuation report

Status of this round: **implementation complete, all local automated checks green;
exact-SHA CI and the independent review are still outstanding.** Nothing here is
presented as a finished acceptance; the per-item state is in `CHECKLIST.md`.

## 1. Lineage

| | |
|---|---|
| Source branch | `arena/dedd1942-chuyen-anh` |
| **Starting SHA** | **`e663295ea8236fd29be6b30e0d04c78e911d7429`** |
| New working branch | `arena/chuyen-anh-r8-ready-review` (created from the exact SHA after a collision check) |
| New PR base | `arena/dedd1942-chuyen-anh` |
| PR #84 | **untouched**: still `OPEN`, `isDraft: true`, head `e663295…`, base `arena/2a533bbc-chuyen-anh` |

## 2. The persistence design, and the guarantees it actually gets

The round-7 design merged with whatever the key held and then read the key back to
repair a lost write. That cannot work, and it is worth stating why plainly rather than
describing it as "improved": **a read-back can prove that my write landed. It cannot
prove that nobody wrote after me and before my read.** Two tabs that both read `S0`
both write `S0 + x`, and each one's read-back confirms its own value; the second write
erases the first, and only the first writer would have had to notice.

Round 8 replaces the mechanism with three things that are each checkable:

**1. An explicit operation model.** Deletions are facts; additions are claims.

* `deleteExamResult` and the new `clearExamResultHistory` **tombstone** the ids they
  remove (id + time, bounded at 500 with compaction in `examPruneRetention`). A stale
  tab that still lists a deleted attempt therefore presents a *claim*, while the store
  holds a *fact*, and the fact wins in every merge direction
  (`examApplyTombstones` runs on both sides of `examUnionHistories`).
* A `Clear` also bumps `generation`, so "deliberately emptied" is distinguishable from
  "never written".
* A record created **after** the Clear has an id no tombstone names, so it survives.
  This is the case a blanket "throw away everything a stale tab wrote" gets wrong, and
  it is covered by a test that would pass under the wrong design only by accident.
* The tombstone/`generation` fields are additive to schema v1, defaulted when absent,
  and type-checked when present. A file written by an earlier build still loads.

**2. Real serialisation where the platform offers it, and an honest weaker mode where
it does not.** `persistExamResultHistory` is `async` and runs the whole
read → merge → write → verify inside `navigator.locks.request(…, { mode: 'exclusive' })`
when Web Locks exist. `examHistoryLockSupport()` reports availability, and **every**
result carries the mode it obtained (`locked` / `unserialized` / `verified` /
`unconfirmed` / `none`). A context that advertises Web Locks and then refuses
(`SecurityError`, `NotSupportedError`, `InvalidStateError` — the `file://` and opaque
origin cases) falls back rather than failing the save.

*Stated limit, not a hidden one:* without a lock, the guarantee is
**"merge + verify + bounded repair"**, not linearizability. Two writes in the same
instant can still interleave; what the contract refuses to do is *report success for a
write it could not confirm*. In Node there is no `navigator.locks`, and the test suite
asserts the reported mode is `unserialized` — the weaker mode, reported honestly.

**3. Nothing is written over a store this tab cannot read.** `inspectExamResultStore()`
separates `empty`, `present` and `unreadable` (with a reason). Previously all three
became an empty history, which the next writer then saved back — silently replacing
unreadable data with nothing. Both writers now refuse with `store-<reason>`, and the UI
shows a *specific* message ("stored history cannot be read, left untouched") instead of
"cannot save on this device".

### What is demonstrated, with which test

| Guarantee | Test (`tests/exam-persistence.test.js`) |
|---|---|
| Concurrent attempts from two tabs both survive | "two tabs creating different attempts concurrently keep both" |
| A stale tab merges rather than overwrites | "a write that lands between read and write is repaired, not adopted silently" |
| Deletion is not resurrected | "a stale tab cannot resurrect an attempt another tab deleted" |
| Clear is not resurrected | "a stale tab cannot resurrect history cleared by another tab" |
| Post-Clear legitimate work survives | "a legitimate attempt created while another tab clears survives" |
| Clear + in-flight write is well defined | same test (both resolve; the store matches the rule) |
| A submission concurrent with a correction keeps both | "an attempt created while another tab saves a correction keeps both facts" |
| Multiple corrections, different questions | "multiple corrections to different questions of one exam all survive" |
| Same record, two writers: one deterministic outcome | "two tabs correcting the same question keep one record, deterministically" |
| Reload consistency | "reloading either tab after concurrent writes shows the same history" |
| Write failure keeps the old data | "a store that rejects writes reports failure and keeps the old history intact" |
| Unreadable store is never overwritten | "an unreadable store is never overwritten with an empty history" |
| Read failure is a failure | "a storage that throws on read is a failure, not an empty history" |
| Retries converge | "repeated retries converge instead of oscillating" |
| Tombstones stay bounded | "they are bounded so history cannot grow without limit" |

An additional probe (`adversarial-verification.mjs`, logged to
`logs/adversarial-verification.log`) drives two interleavings the test file cannot
express well — a peer that reverts every write, and a three-way burst — and prints
`PASS` for all eight scenarios, including "a peer that always wins yields failure, not
a false success".

## 3. The unseen-attempt score mismatch (CodeRabbit `4537334892`)

**Reproduced at the starting SHA** before changing anything
(`logs/repro-score-mismatch-at-start-sha.log`):

```
save base+c: true
tabB corrections: 1 attempts: [ 'a1' ]
tabA save: ok
tabB save: THREW: Conflicting stored exam history: score-mismatch
stored ids after: [ 'a1', 'a2' ]
```

The store was healthy; tab B's save was refused because the payload built for the merge
(`unseen`) validated *standalone* — it held an attempt without the correction that
attempt had been scored with. After the fix the same script prints
`tabB save: ok` and the store holds `['a1','a2','b1']`
(`logs/repro-score-mismatch-after-fix.log`).

The fix is structural rather than local: the **union** is recomputed once and validated
as a whole, and a correction backing an unseen attempt is carried from the snapshot that
actually holds the question and its base key. A first attempt at this was *stricter*
than the finding and broke a legitimate save; that is recorded as `FAILURE_LEDGER.md` F3,
along with the mirror test that pins the correct invariant (an attempt scored before a
correction *may* re-score when the union carries it).

## 4. The 1,000-character limit and historical data

One constant, one length definition (**Unicode code points**, not UTF-16 units — so
1,000 emoji are 1,000 characters, which is why `maxlength="1000"` is a convenience guard
and the code-point check is the rule). Enforced at four boundaries:

| Boundary | Behaviour |
|---|---|
| Input | `maxlength="1000"` plus a visible, associated hint (`aria-describedby`) |
| Parser (`examCorrectionCandidates`) | returns `null` above the limit |
| Validation (`examCorrectionValidation`, new) | `{ ok: false, reason: 'too-long', length, limit }` — the measured length is reported |
| Model (`applyExamKeyCorrection`) | `reason: 'correction-too-long'` |
| Storage validator | rejects an untagged over-limit candidate |

**Historical data is preserved, not truncated.** A schema-v1 correction longer than the
limit is indistinguishable by shape from an edited file, so the policy is explicit:

* on **load** and **import**, an `invalid-correction` result triggers one narrow
  compatibility retry (`allowLegacyOverLongCorrections`) that rescues the record and
  tags it `legacyOverLimit: true`;
* the text is preserved byte for byte — nothing is truncated, nothing is dropped;
* new input of the same length is still refused, so the compatibility path cannot be
  used to weaken the rule;
* the store is never declared unreadable for this reason, which is what would have let
  the next save replace it with an empty one.

Test: "an over-long historical correction is preserved, not truncated or dropped".

## 5. Everything else that was verified and changed

* **Paper snapshot selection** (`4539365158`) — `examCorrectionPaperKeys()` requires
  `examId` **and** the `questionId` **and** a `baseKeys` entry, and returns every
  backing key instead of the first plausible one. Tested with two content versions of
  one exam.
* **D75, `--help` side effects** — both build scripts now parse arguments; `--help`
  exits 0 having touched nothing, unknown flags are refused, `main()` is unchanged for
  the workflow. `tests/test_script_help.py` runs them with a fake failing `gh` first on
  `PATH`, the release environment variables set, and a hash of the tracked tree before
  and after.
* **Vocabulary multiword** (`4514659122`) — the upstream fix was already in place
  (`re.split(r"[,/]+", head)`), but the guard only asserted the shape of the index. A
  **negative control** now asserts the resolution the guard actually performs: `to` /
  prep must attest A1 and must **not** attest A2, while `according to` / prep attests
  A2. Mutating the split back to whitespace fails 2 tests; restored, the suite is green.
* **D64 documentation coverage** — measured at **78/218 = 35.8 %** (non-test
  functions/classes under `scripts/`) at the starting SHA, and improved to **84/218 =
  38.5 %** by documenting the release pipeline, which is the highest-risk and least
  documented code path. No boilerplate was added to move a number; the remainder is
  recorded as an advisory gap.

## 6. Results on this branch (not yet the final SHA)

| Check | Result | Log |
|---|---|---|
| Node, 9 suites | **288 pass / 0 fail** | `logs/node-after.log` |
| Python `discover` | **263 OK** | `logs/python-final.log` |
| `scripts/exams/test_archive.py` (venv + pinned requirements) | **5 OK** | `logs/archive-suite.log` |
| 21 `ci.yml` validator gates, extracted and run verbatim | **21 pass / 0 fail** | `logs/gates-final.log` |
| Adversarial persistence probe | **8/8 scenarios** | `logs/adversarial-verification.log` |
| Browser suites | **not run — `BLOCKED_EXTERNAL`** | `FAILURE_LEDGER.md` F1 |

## 7. Outstanding, and deliberately not claimed

| Item | Status |
|---|---|
| CI on the exact final head SHA | **pending** — the only valid source for the browser matrix |
| CodeRabbit on the exact final head SHA | **pending** — the earlier clean review does not cover this head |
| Kilo / Copilot | not a completion; exact status recorded below once probed |
| Screen-reader validation | **INCOMPLETE** — `accessibility/EXAM_HISTORY_MANUAL_CHECKLIST.md`, awaiting a human |
| `audit/v100/GATES.md` S40 mutation harness (`4523825956`) | `DEFERRED_WITH_JUSTIFICATION` — the harness is not in this repository and rewriting it would be presenting a new artefact as the original |

The user has accepted a ready-for-review PR with the screen-reader checklist and the
unavailable external reviews still incomplete, provided they are disclosed — which is
what the table above does.
