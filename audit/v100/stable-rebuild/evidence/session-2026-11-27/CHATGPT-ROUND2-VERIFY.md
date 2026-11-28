# ChatGPT round-2 review verification (2026-11-27, head `66045db`)

Review source: PR #89 comment `7220291631` ("Review By ChatGPT", 2026-11-27T14:04Z).
Every finding was reproduced or refuted against the actual code before acting.
Verdicts and dispositions:

| # | Finding | Verdict | Disposition |
| --- | --- | --- | --- |
| GPT2-1 (P1) | `api/app.js` imports `./telemetry.js`, which resolves only in the sibling layout; the documented deployment layout is `src/app.js` + `src/api/telemetry.js`, where `./telemetry.js` would resolve to the wrong path — INFRA-4 not actually closed | VALID — the committed wrapper could not run under the documented layout unchanged | FIXED — the entrypoint now resolves the handler at runtime from whichever real layout it runs in (sibling preferred, nested `api/telemetry.js` otherwise) and fails loudly at boot when neither exists; NEW `tests/telemetry-entrypoint.test.js` (3 tests) performs the exact documented packaging step (copy to `src/app.js` + `src/api/telemetry.js`, byte-compare the handler), boots the PACKAGED entrypoint and asserts the pinned contract (204/405+Allow/403), boots the repository layout, and proves a handler-less deployment exits non-zero. Wired into ci.yml + deploy.yml + `release_artifacts.py` |
| GPT2-2 (P1) | The fallback scanner requires the colon immediately after `run`/quote; YAML allows whitespace before the mapping colon (`run :`, `"run" :`), so those scripts were never scanned | VALID — reproduced with PyYAML-equivalent forms before fixing | FIXED — all six fallback key matchers (`jobs:`, job keys, `strategy:`, `matrix:`, generic mapping keys incl. include/exclude, `run:`) now allow whitespace before the colon; 2 negative-control tests added (`run :` inline + quoted `"run" : \|` block); both poison forms flagged in BOTH parser modes, safe literal still clean |
| GPT2-3 (P1) | `ci-paths` omits `.github/workflows/**` and `scripts/scan_workflow_injection.mjs` — a new workflow file or scanner-only change runs no CI | VALID | FIXED — both entries added to the shared `ci-paths` anchor (push trigger aliases the same anchor, verified by a new coverage test) |
| GPT2-4 (P2) | telemetry-smoke.yml records an arbitrary non-empty string as a "verified" deployment identity | VALID (audit-trail honesty) | FIXED — input/step renamed to declared identity; description states it is NOT independently resolved against Vercel; the step format-checks the string (`dpl_…` or commit SHA) and the summary line says "caller-declared, format-checked"; gate test extended (declares/not-independently-verified/regex/pinned summary wording) |
| GPT2-5 (P2) | `commitStagedWrites()` quota preflight silently deletes a pre-existing value under `__chuyen-anh.import.probe` | VALID — reproduced reasoning matches the code path (unconditional probe write + remove) | FIXED — the preflight snapshots the probe key's previous value and restores it in a `finally` on the success path, on a refused probe, and on a failed real commit; regression test seeds the exact probe key and asserts survival in all three paths |
| GPT2-6 (P2) | The progress-backup importer reads an unbounded file before validation | VALID — `importFile` had no `file.size` check while device settings (64 KiB) and exam history (4 MiB) did | FIXED — `PROGRESS_BACKUP_MAX_BYTES = 4 MiB` exported; `importFile` refuses by `file.size` before `file.text()`; `validateImportPayload` enforces the same bound at entry for non-UI callers; regression test proves the size check precedes the read, oversized payloads throw, normal payloads still import. The new toast carries its English translation-map entry (localization contract green) |
| GPT2-7 (process) | PR #89 description stale (2 commits vs 7); CodeRabbit thread `#4718454999` unresolved; CI on the exact head queued; keep ONE canonical PR | VALID | PR #89 body refreshed with the full commit plan and fold-in command; thread #4718454999 replied to and resolved (the scanner include rule covers its example — verified in round 3); CI observed on each pushed head (queued runs are GitHub-side; exact-head evidence is recorded per head) |

Additionally verified in the review's runtime audit: the three previously
changed `index.html` hunks (APP_VERSION, highlightMatch, telemetry scrubbers)
re-confirmed clean; XSS/persistence paths re-inspected clean by the reviewer.

## Owner-reported runtime bug (session 8): continuous skipping breaks spacing

**Report:** "When I skip continuously in a session, it will be wrong."

**Root cause (reproduced before fixing):** `skipSessionCard()` repositioned
queued consolidation turns with `target = min(needed, nonPracticeBeforeSkipped)`
— an ABSOLUTE queue position, walking down past practice cards only. Once
skips and corrective retries dominated the queue, the clamp reached 0 and the
consolidation was placed at the FRONT of the queue and answered immediately
after its own first pass (graded gap 0) while a real first-pass card was still
queued behind it. A second variant: `target = needed` counts positions, not
real cards, so a mid-queue practice card silently reduced the real intervening
evidence below the required gap. Trace of the deterministic replay (N=7,
every 3rd turn graded wrong, others skipped): word 2 first pass graded at
turn 14, its consolidation graded at turn 15 — gap 0, with word 6's first pass
still queued behind it.

**Invariant violated:** an unsatisfied consolidation must never be graded while
a real first-pass card is still queued behind it (skips and practice retries of
other words provide no spaced evidence; only real first passes do).

**Fix:** the repositioning now walks the queue counting REAL first-pass turns
and inserts the consolidation after exactly `needed` of them; when fewer real
turns remain than the gap requires, it is placed after ALL of them (end of
session — the honest short-gap case the rendered note already covers), never
ahead of a queued real card.

**Controls:** new `Scope B.1b` test in `tests/static-app.test.js` —
deterministic replays of the reported pattern (3 phases × N=7), skip-heavy
wrong-heavy runs at N=10/15 asserting the grade-time invariant, and a
queue-level unit case (practice + unsatisfied consolidation + two real cards →
the consolidation lands behind both reals, never at the front). Fail-verified:
147 pass/1 fail with the fix stashed, 148 pass/0 fail with it (suite now 150).
The canonical `Scope B.1` no-skip gap contract is unchanged and green.

**Gates at the session-8 head:** CI Node static 292/292 (canonical 8-suite
command); shard partition OK + shard/scanner suites 26 pass + 1 documented skip
(20 scanner tests); telemetry 19/19; entrypoint packaging 3/3; Python 305/305;
archive 5/5; release + deploy gates exit 0; clean-tree scan 0 findings both
modes; `mutation_cr_scrub` 12/12; exam + vocab independent audits verdict OK.
