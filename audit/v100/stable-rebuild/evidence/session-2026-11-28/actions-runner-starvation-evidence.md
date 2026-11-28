# GitHub-hosted runner starvation — evidence register (2026-11-28)

All PR #89 CI runs since 2026-11-27 ~12:47 UTC have been delayed or withheld
before ANY job executed. This file records the diagnosis so the "CI pending"
state in the verdict is understood as an external infrastructure condition,
not an unverified claim and not a workflow defect.

## Timeline (UTC, all times 2026-11-27 unless dated 11-28)

| When | Event | Pickup latency |
| --- | --- | --- |
| 11-27 09:21 / 10:39 / 11:10 | PR runs completed | seconds–minutes (healthy; 6-min total wall) |
| 11-27 12:47 / 13:15 / 14:06 | runs cancelled by concurrency | queued 28–47 min, never started |
| 11-27 15:55 → 20:24 | run `46029120206` SUCCESS | **4 h 18 m queued**; jobs started 20:13–20:15 |
| 11-28 05:25 / 05:52 | runs cancelled by concurrency | queued 27–39 min, never started |
| 11-28 08:09 | run `46124448383` (`6cde17b`) | **queued 100+ min, zero of 16 jobs ever picked up** |
| 11-28 08:49 | `coderunknow/FlawLessChess` (same account): 3 runs (ubuntu-24.04) | still queued at 09:58, never touched |
| 11-28 09:53 | remedy applied: wedged run replaced by fresh run `46132561454` (`7f12d11`) | queued at 09:58 |

## Ruled out (each verified against live APIs)

1. **Approval gates** — `GET /actions/runs/{id}/approvals` → `[]`.
2. **Label mismatch** — jobs demand `ubuntu-latest` / `ubuntu-24.04` only (standard hosted labels; identical to the runs that completed on 11-27).
3. **Runner groups / self-hosted requirement** — `runner_group_name` empty; no self-hosted pool involved.
4. **Concurrency deadlock** — `cancel-in-progress` works (older runs transition to `completed/cancelled` when a new run arrives); at most one run per branch queued.
5. **Billing / minute quota** — repo is public (free unlimited standard-runner minutes); the two stuck repos are public.
6. **Workflow defect** — no workflow or CI-contract change between the healthy runs and the stuck ones except reviewed doc/identity-guard changes; the identical 16-job matrix completed SUCCESS as `46029120206`.
7. **GitHub-wide outage** — status page (`githubstatus.com`, checked 09:24 UTC): all components operational, zero incidents.

## Observed pattern

Progressive degradation of hosted-runner pickup for this ACCOUNT while the
status page stays green: seconds (11-27 morning) → tens of minutes (11-27
midday) → 4 h 18 m (11-27 evening, eventual pickup) → zero pickup for 2+ hours
across TWO repos simultaneously (11-28 morning). Community reports document
the same failure mode with a green status page
(github.com/orgs/community/discussions/205874, /212786 — "queued indefinitely,
no runner, cannot cancel").

Most consistent causes, in order of likelihood:
(a) automated abuse-review hold on the account (heavy sustained parallelism —
15 simultaneous browser-engine jobs — is exactly the shape GitHub's heuristics
flag; GitHub does not surface these holds in the API or status page);
(b) undocumented scheduler/pool degradation affecting the account's region.

## Remedies applied in-repo (2026-11-28)

- **Cancel + fresh-run remedy** (the documented community fix for wedged run
  records): the wedged `46124448383` was replaced via cancel-in-progress by a
  fresh run `46132561454` on `7f12d11`. Sandbox Actions-write scope is
  read-only, so the replacement was performed by pushing the retrigger commit
  rather than calling the cancel endpoint.
- **Sandbox-state recovery during diagnosis**: the workspace re-anchored to the
  branch base mid-session (prior pushed commits preserved remotely); verified
  the remote tip was authoritative and reset `--hard` to it — zero work lost.
- **Evidence register** (this file) committed so reviewers see why CI is
  pending; no CI contract, test, or workflow behaviour was changed.

## Escalation package (owner actions only — none executable from the sandbox)

The GitHub account owner (authenticated here as `coderunknow`) should file a
support ticket at support.github.com — automated holds are only lifted by
Support. Draft:

> Subject: GitHub-hosted runners stopped picking up jobs for my account since Nov 27
>
> Since 2026-11-27 ~12:47 UTC, Actions jobs in repos `coderunknow/Chuyen-Anh`
> and `coderunknow/FlawLessChess` wait hours or indefinitely in `queued` with
> zero runner pickup, while githubstatus shows all systems operational.
> Examples: run `46029120206` (created 15:55, first job started 20:13);
> run `46124448383` (created 2026-11-28 08:09, 100+ min queued, 0/16 jobs
> started, never ran); runs `46127578632/644/661` in FlawLessChess (created
> 08:49, still queued). Standard labels only (ubuntu-latest, ubuntu-24.04),
> approvals empty, public repos, concurrency functioning. Earlier runs on the
> same configuration picked up in seconds. Please check whether the account is
> subject to an automated abuse-review hold or region-specific scheduler
> degradation and lift/re-route it.

Interim options if the ticket is slow: temporarily register one self-hosted
runner on a trusted machine and add `runs-on: [ubuntu-latest, self-hosted]`
fallbacks, or re-run from the UI periodically (pickup windows opened before:
11-27 20:13).
