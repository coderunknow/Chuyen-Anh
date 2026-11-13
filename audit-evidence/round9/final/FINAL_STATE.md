# Round 9 — final state

## What is where

| Artefact | Path |
|---|---|
| Checklist (every requirement, status, evidence, SHA) | `audit-evidence/round9/CHECKLIST.md` |
| Defect ledger (24 entries, classified) | `audit-evidence/round9/DEFECTS.md` |
| Test integrity (21 mutations, changed expectations) | `audit-evidence/round9/TEST_INTEGRITY.md` |
| Actions baseline (measured) | `audit-evidence/round9/actions/BASELINE.md` |
| Actions optimization (measured, partly reverted) | `audit-evidence/round9/actions/OPTIMIZATION_REPORT.md` |
| Application probes | `audit-evidence/round9/application/audit-probes.md` |
| Local verification transcript | `audit-evidence/round9/application/local-verification.log` |
| Review dispositions (12 CodeRabbit findings) | `audit-evidence/round9/reviews/CODE_REVIEW_DISPOSITION.md` |
| Final audit report | `audit-evidence/round9/FINAL_AUDIT_REPORT.md` |
| Continuation report | `audit-evidence/round9/CONTINUATION_REPORT.md` |
| This file | `audit-evidence/round9/final/FINAL_STATE.md` |

## Commits

| SHA | Contents |
|---|---|
| `2f686f7` | base the audit started from (PR #85 head) |
| `b8f2c11` | Round 9 first pass: filter drift, trigger coverage, credential, diagnostics, evidence counts |
| `80e6248` | first review round: capture ordering, wrong-page selection, summary-script guard, parity helper, claim narrowing |
| `c8b22d8` | second review round: `freshWorld` capture path, vacuous assertion, citations |
| `074c48c` | final state + post-revert runner-seconds |
| `3e3bd67` | states precisely what CodeRabbit reviewed |
| `a82c3f7` | review dispositions appended to `AGENTS_LOG.md` — the final head, and the one CI and CodeRabbit evidence is cited at |

## Verified at the final head

| Check | Result |
|---|---|
| Python unit tests | **285 OK** |
| Node tests | **304 pass / 0 fail** |
| Archive conversion | **5 OK** |
| Vocabulary/exam validators | **21/21 commands, exit 0** |
| Deploy gates | both `deploy=false … held` (`DEPLOY_HOLD` = `v1.0.0-rc11`) |
| Workflow YAML | **8/8 parse** |
| Browser suites in CI | three engines × both suites, all passing at the final head `a82c3f7` — run `43402014715` (chromium 6 m 55 s, firefox 9 m 15 s, webkit 15 m 07 s, checks 1 m 26 s) |
| CodeRabbit | reviewed the code twice (12 comments, all disposed of). At `3ba0da6` its check is `skipped` with the reason *"manual review required for this OSS repository"* (a <10-star policy threshold, not quota) — see `CHECKLIST.md` R9-E1 |

## Not claimed

- Not "fully audited", not "all bugs fixed", not "production-ready". The ledger keeps
  an external failure (telemetry), an unreproduced flake, two design limitations and
  two accepted trade-offs open on purpose.
- The 186 external asset digests were **not** verified against the assets' bytes
  (`R9-B7b`).
- CI failure capture and artifact upload were **not** observed on a failing run: a
  passing run never enters that path, and the `skipped` step is not evidence.
- Screen-reader validation was **not** performed (`MANUAL_REQUIRED`).
- The telemetry endpoint smoke test fails for an **external** reason: `api/` and
  `supabase/` are unchanged across the green→red boundary, and a 503 is not a
  version error.
- No merge, tag, release, prerelease, publication or deploy was performed.

## The two findings that mattered most

1. **The planned optimization was wrong, and measuring it said so.** Splitting the
   browser job into six parallel jobs saved 1 second of wall-clock and cost 201
   runner-seconds, because the exam suite is 11–61 s and the learning suite is
   387–740 s. It was reverted, and the measurement is pinned next to the job. The
   same run pair also shows the noise this round declined to chase: the unchanged
   4-job shape produced 13 m 19 s, 13 m 18 s and 17 m 55 s on different runs.
2. **Three assertions that could not fail.** A screenshot captured after
   `browser.close()`, a scenario that closed its own browser first, and a count that
   included a declaration. All three looked green; all three were caught by review,
   and each is now covered by a mutation that provably fails.
