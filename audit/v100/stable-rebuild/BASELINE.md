# BASELINE — stable-rebuild session (2026-11-17)

## Starting repository state (verified live, not assumed)

| Item | Value | Method |
| --- | --- | --- |
| Repository | `coderunknow/Chuyen-Anh` | GitHub REST API |
| Default branch | `main` | `GET /repos` |
| Starting SHA | `948f6f9ca1e7508014a6deb56e2ec67cfa7bf159` | `git log -1 main` + API |
| Latest main push | 2026-11-15T08:33:42Z (`pages-smoke: drop the push trigger that raced the Pages deploy`) | API |
| Application identity | `APP_VERSION = 'v1.0.0-rc11'` (28,273,009 bytes; gzip 3,093,228) | source + `gzip -c` |
| `DEPLOY_HOLD` | `v1.0.0-rc11` | file |
| Open PRs / issues | 0 / 0 | API |
| Tags | 24, all `v1.0.0-beta*`/`dev*`/`rc*`; **no `v1.0.0` tag** | API (`per_page=100`) |
| Releases | 24 prereleases published; **no stable release** | API |
| Latest main CI | run `43678703190` Static checks `completed/success` at `948f6f9` | API |
| Live Pages | deployment `7798610277` of `cc59c218` (rc11), state `success` | API |

## Mission-premise contradictions found at baseline

1. **`v1.0.0` tag does not exist.** The mission brief states a `v1.0.0` tag
   targets `13f13f9e2db04ba04721892c2bd019b781dd8dc3`. Live state: no such ref;
   `13f13f9e` is the merge commit of PR #87 that carried `APP_VERSION=v1.0.0`
   on `main` for two days. Consequence: `RELEASE_BLOCKED_TAG_COLLISION` is
   **not applicable**; a future stable publication has no tag collision.
2. **Listening grading policy.** The mission's policy says listening questions
   are never auto-graded even with a transcript; the shipped application and
   README grade 307 transcript-fallback listening items with `LOW` confidence
   and explicit warnings (part of the 5,155 scorable). Not silently changed —
   recorded as an owner decision (see `FINAL_READINESS.md`).
3. `deploy_gate.py --repo` in this sandbox reports "release v1.0.0-rc11 is
   missing" because the gate shells out to `gh api` and `gh` is not installed
   here — the documented fail-closed behaviour for a missing client. The real
   release state (rc11 published prerelease) was verified directly via the REST
   API.

## Baseline test results (untouched `948f6f9` tree)

| Suite | Result |
| --- | --- |
| Python `unittest discover` | 294/294 OK |
| Node `node --test tests/*.test.js` | 304/305 — **1 failure** (`NODE-LOCKS-ENV`, see `DEFECTS.md`) |
| Archive conversion (`scripts/exams/test_archive.py`) | 5/5 OK |
| 21-command validator block (ci.yml) | all pass |
| Browser `browser-exams.cjs` (Chromium 133.0.6943.0, in-sandbox) | PASS |
| Browser `browser-learning.cjs` (Chromium 133.0.6943.0, in-sandbox) | PASS |
| `tests/speed-benchmark.cjs` | OK (see below) |

## Baseline performance measurements (Chromium 133.0.6943.0, software-only, this sandbox)

- Raw HTML: 28,273,009 bytes; gzip: 3,093,228 bytes (brotli not installed here).
- `tests/speed-benchmark.cjs`: sprint median card latency 68 ms / mean 98.11 ms,
  consolidation median 3 ms, retry 3 ms; zero page errors
  (`work/evidence/speed-benchmark-baseline.log` in the session workspace).
  Same-hardware candidate comparison recorded at the final head.

## Limitations of this environment

- No `gh` CLI (gates exercised via REST API + fail-closed local runs).
- No Firefox/WebKit locally; no screen reader; no physical low-memory device.
- No Vercel/Supabase credentials; live infra inspected only through
  unauthenticated read-only probes and the GitHub API.
- Chromium ran via `@sparticuz/chromium@133.0.0` + `playwright-core@1.55.1`
  per `HANDOFF_NEXT_AGENT.md` §6.3.
