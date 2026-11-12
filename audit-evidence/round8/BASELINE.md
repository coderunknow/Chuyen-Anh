# Round 8 — baseline

Measured **before** any change in this session, at the exact verified starting commit.

| Item | Value | How it was verified |
|---|---|---|
| Repository | `coderunknow/Chuyen-Anh` | `git remote -v` |
| Starting source branch | `arena/dedd1942-chuyen-anh` | `gh pr view 84`, `git ls-remote --heads origin` |
| **Starting SHA** | **`e663295ea8236fd29be6b30e0d04c78e911d7429`** | `git rev-parse HEAD`; `git ls-remote --heads origin refs/heads/arena/dedd1942-chuyen-anh` returned the same 40-char SHA |
| New working branch | `arena/chuyen-anh-r8-ready-review` | created from `e663295…` after a collision check (`git ls-remote --heads origin 'refs/heads/arena/chuyen-anh-r8*'` → no refs) |
| PR #84 live state | `OPEN`, `isDraft: true`, head `e663295…`, base `arena/2a533bbc-chuyen-anh`, `MERGEABLE`, `updatedAt 2026-11-12T10:33:13Z` | `gh pr view 84 --json …` |
| PR #84 base branch | `arena/2a533bbc-chuyen-anh` @ `2c2e50db8158c691a512a9a431ffbabf93a4f1d1` | `gh pr view 84`; `git ls-remote --heads origin refs/heads/arena/2a533bbc-chuyen-anh` |
| Working tree | clean | `git status --porcelain=v1 -b` |
| Remote `main` | `f12b4bc5241e330eb8c051ada749d4f514111b61` | `git ls-remote --heads origin` |

PR #84's body is **stale** and was not used as evidence: it claims head `9cd1a65` and base
`main @ f12b4bc5`, while the live PR has head `e663295…` and base `arena/2a533bbc-chuyen-anh`.
That discrepancy is why the new PR is based on the *live* branch, not on the body's text.

## Baseline test and gate results (before any change)

Raw logs: `logs/node-baseline.log`, `logs/python-baseline.log`.

| Check | Result |
|---|---|
| `node --test` (8 suites as `ci.yml` names them) | **266 pass / 0 fail** |
| `python -m unittest discover -s tests` | **257 tests, OK** |
| 21 `ci.yml` validator gates, extracted and run verbatim | **21 passed / 0 failed** |
| Browser suites (chromium/firefox/webkit) | **NOT RUN in this sandbox** — Playwright's browser download fails (no access to the CDN that serves the Chromium build); see `FAILURE_LEDGER.md` F1. Deferred to CI. |

## Baseline review-thread inventory (PR #84)

Retrieved live via GraphQL (`logs/pr84-review-threads.json`): **38 threads total, 11 unresolved**.
The full disposition of every unresolved thread is in `FINDINGS.md`; PR #84 itself was not
modified in any way.
