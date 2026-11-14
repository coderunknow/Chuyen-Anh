#!/usr/bin/env python3
"""Summarise a workflow run: wall-clock, per-job durations, and the critical path.

Round 9 changed the browser job from "one job per engine, both suites" to "one
job per (engine, suite)". The claim that this shortens the workflow is only worth
anything if it is measured on the same workflow, so this script turns the Actions
API into the three numbers the report needs, and refuses to invent the ones the
API does not expose.

    python scripts/ci_run_summary.py 43342769617
    python scripts/ci_run_summary.py --latest --workflow ci.yml
    python scripts/ci_run_summary.py 43342769617 --json > before.json

Design notes:
  * wall-clock is `run_started_at` -> last `completed_at`, because that is what a
    maintainer waits for (it includes provisioning and queueing);
  * "critical path" is the longest single job, which is what has to shrink for the
    wall-clock to shrink, given all jobs start together;
  * runner-seconds are summed separately: a change that trades wall-clock for
    total compute (the split does: six jobs instead of three) has to say so;
  * anything not derivable from the API is reported as null, never estimated.
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from datetime import datetime


def gh(args: list[str]) -> str:
    if shutil.which("gh") is None:
        raise SystemExit("this script needs the `gh` CLI on PATH")
    result = subprocess.run(["gh", *args], capture_output=True, text=True)
    if result.returncode != 0:
        raise SystemExit(f"gh {' '.join(args)} failed: {result.stderr.strip()}")
    return result.stdout


def parse(ts: str | None) -> datetime | None:
    if not ts:
        return None
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))


def resolve_run(explicit: str | None, latest: bool, workflow: str) -> str:
    if explicit:
        return explicit
    if not latest:
        raise SystemExit("pass a run id, or --latest")
    runs = json.loads(gh([
        "run", "list", "--workflow", workflow, "--limit", "20",
        "--json", "databaseId,status",
    ]))
    if not runs:
        raise SystemExit(f"no runs found for workflow {workflow!r}")
    # Prefer the newest *completed* run: measuring a run that is still in flight
    # yields partial numbers, which is the mistake this script used to invite.
    completed = [run for run in runs if run.get("status") == "completed"]
    if not completed:
        raise SystemExit(f"no completed run of {workflow!r} in the last 20; pass an explicit run id")
    return str(completed[0]["databaseId"])


def summarise_from(run: dict, jobs: list[dict]) -> dict:
    # An unfinished run has no wall-clock: `updated_at` is then just "last time
    # GitHub touched this record", and the jobs still running are excluded from
    # every total. Reporting those numbers produced a "0m10s wall-clock" with a
    # 7-minute critical path from live data (CodeRabbit, PR #86). Final metrics are
    # only computed for a completed run; otherwise they are null.
    finished = run.get("status") == "completed"
    started = parse(run.get("run_started_at") or run.get("created_at"))
    completed = parse(run.get("updated_at")) if finished else None
    wall = round((completed - started).total_seconds()) if started and completed else None

    rows = []
    for job in jobs:
        job_started = parse(job.get("started_at"))
        job_done = parse(job.get("completed_at"))
        seconds = round((job_done - job_started).total_seconds()) if job_started and job_done else None
        rows.append({
            "name": job["name"],
            "conclusion": job.get("conclusion"),
            "seconds": seconds,
        })

    measured = [row["seconds"] for row in rows if row["seconds"] is not None]
    slowest = max(rows, key=lambda r: r["seconds"] or 0) if rows and finished else None
    return {
        "run_id": run.get("id"),
        "head_sha": run.get("head_sha"),
        "event": run.get("event"),
        "status": run.get("status"),
        "conclusion": run.get("conclusion"),
        "complete": finished,
        "wall_clock_seconds": wall,
        "critical_path_job": (slowest or {}).get("name"),
        "critical_path_seconds": (slowest or {}).get("seconds"),
        # A partial sum over finished jobs while others still run is not a total.
        "sum_job_seconds": sum(measured) if finished and measured else None,
        "jobs": sorted(rows, key=lambda r: r["seconds"] or 0, reverse=True),
        # The API exposes no billing or cache-hit data for workflow runs, so these
        # stay null instead of being guessed.
        "billable_minutes": None,
        "note": "billable minutes are not exposed by the Actions API for this repository",
    }


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("run_id", nargs="?", help="workflow run id")
    parser.add_argument("--latest", action="store_true", help="use the most recent run of --workflow")
    parser.add_argument("--workflow", default="ci.yml", help="workflow file name for --latest")
    parser.add_argument("--json", action="store_true", help="emit JSON instead of a table")
    args = parser.parse_args(argv)

    run_id = resolve_run(args.run_id, args.latest, args.workflow)
    raw_run = json.loads(gh(["api", f"repos/{{owner}}/{{repo}}/actions/runs/{run_id}"]))
    raw_jobs = json.loads(gh(["api", f"repos/{{owner}}/{{repo}}/actions/runs/{run_id}/jobs?per_page=100"]))
    summary = summarise_from(raw_run, raw_jobs.get("jobs", []))

    if args.json:
        print(json.dumps(summary, indent=2))
        return 0

    def clock(seconds: int | None) -> str:
        return "n/a" if seconds is None else f"{seconds // 60}m{seconds % 60:02d}s"

    print(f"run {summary['run_id']}  head {summary['head_sha']}  event {summary['event']}  {summary['conclusion']}")
    if not summary["complete"]:
        print(f"status {summary['status']}: this run has not finished, so no wall-clock, "
              "critical path or runner-second total is reported")
    print(f"wall-clock          {clock(summary['wall_clock_seconds'])}")
    print(f"critical path       {clock(summary['critical_path_seconds'])}  ({summary['critical_path_job']})")
    print(f"runner-seconds sum  {clock(summary['sum_job_seconds'])}")
    print()
    print(f"{'job':<44}{'result':<12}{'duration':>10}")
    for row in summary["jobs"]:
        print(f"{row['name']:<44}{str(row['conclusion']):<12}{clock(row['seconds']):>10}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
