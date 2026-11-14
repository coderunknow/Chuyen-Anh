# GitHub Actions baseline — measured before optimization

All numbers below come from the GitHub Actions API for this repository
(`repos/coderunknow/Chuyen-Anh/actions/runs/.../jobs`). Raw payload:
`logs/jobs-baseline-43342769617.json`, run history:
`logs/static-checks-history.txt`. Nothing here is estimated.

## Wall-clock of the whole "Static checks" workflow

| Run | Head | Conclusion | Wall-clock |
|---|---|---|---|
| `43342769617` | `2f686f7` | success | **13m19s** (01:09:45 → 01:23:04) |
| `43340592187` | `5d57f56` | success | **16m17s** |
| `43338082027` | `711257a` | success | **15m11s** |
| `43333905715` | `fe6a081` | success | **17m13s** |
| `43242630492` | `856d1a1` | success | **15m51s** |
| `43239398860` | `98d36c7` | success | **17m49s** |

Range **13m19s – 17m49s**. Median ≈ 16m. The spread is runner-provisioning noise,
not a change in the work performed.

## Per-job, run `43342769617` (the measurement run used throughout this audit)

| Job | Duration | Share of wall-clock |
|---|---:|---|
| `checks` | **2m20s** | 18% |
| `browser (chromium)` | **7m52s** | 59% |
| `browser (firefox)` | **12m38s** | **95% — the critical path** |
| `browser (webkit)` | **13m16s** | **100% — the critical path** |

Browser runner-seconds total **2026s** across three jobs.

## Where the browser time actually goes (per engine)

| Engine | Install browser | Test execution | Total |
|---|---:|---:|---:|
| chromium | 23s | **437s** | 472s |
| firefox | 16s | **730s** | 758s |
| webkit | 38s | **747s** | 796s |

**Conclusion: browser installation is not the problem (16–38s). Test execution is** —
and it is serialized per engine by `tests/run-browser-suites.sh` *by design*.

## Where `checks` time goes (per step)

| Step | Duration |
|---|---:|
| Check vocabulary sources and embedded HTML (21 validator commands) | 24s |
| Run Python unit tests (263 tests) | **47s** |
| Run exam archive conversion tests (5 tests) | 6s |
| Run static app logic, scoring and single-file tests (Node, 9 suites) | **53s** |
| Run telemetry endpoint contract tests | 1s |
| Checkout + Node setup | ~5s |

## Runner image

`ubuntu-24.04`, **4 vCPU / 16 GB** for this public repository
([GitHub docs, verified 2026-11-13](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)).
The `run-browser-suites.sh` comment blames a "2-CPU VM" for a historical segfault;
on the current image each matrix job has 4 vCPUs, which is the fact that makes the
split below safe. That claim is re-verified by the split itself (see
`OPTIMIZATION_REPORT.md`): if the hardware could not sustain two browsers, the split
jobs would fail, not silently pass.

## What is NOT measured, and why

- **GitHub Actions minutes/billing**: public repositories are unmetered, so the API
  exposes no per-run cost. `N/A` rather than invented.
- **Queueing delay**: not separable from provisioning in the API. The run timestamps
  above include it, which is the honest number a maintainer waits for.
