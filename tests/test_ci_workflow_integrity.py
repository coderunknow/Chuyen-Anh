"""Integrity rules for the workflow files themselves.

Round 9 found three defects that no existing test could see, because they were
properties of the workflow YAML rather than of the application:

  1. `ci.yml` declared the YAML anchor `&ci-paths` and then re-typed the same
     77-entry list under `push:` instead of aliasing it. The anchor did nothing,
     so adding a path to one trigger silently left the other stale - the exact
     drift the anchor was written to prevent. Four workflow files
     (`exam-sources`, `exam-validation`, `pages-smoke`, `telemetry-smoke`) were
     covered by no CI trigger at all.
  2. The original browser graph ran both suites in one job per engine. Round 9
     measured that splitting by suite did not help; this closeout now partitions
     the learning assertions into five exact-once regions per engine.
  3. The failure artifact step globbed `**/*.png` while nothing in the job set
     `BROWSER_SCREENSHOT`, so it could only ever report "no files found": the
     diagnostics looked present and collected nothing.

None of these are visible to a Python or Node unit test of the application, so
they are pinned here against the workflow text. The parsing is deliberately
line-based (like `test_ci_gate_coverage.py`) rather than requiring PyYAML: the
CI job that runs this file installs no Python dependencies.
"""

from __future__ import annotations

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKFLOWS = ROOT / ".github" / "workflows"
CI = WORKFLOWS / "ci.yml"


def ci_text() -> str:
    return CI.read_text(encoding="utf-8")


def uncommented(text: str) -> list[str]:
    """Workflow lines with YAML comments dropped: a path named in a comment runs nothing."""
    return [line.split(" #", 1)[0].rstrip() for line in text.splitlines()]


def block(lines: list[str], header: str) -> list[str]:
    """The body under a trigger key such as `  push:`.

    The body ends at the next *sibling* key - a non-blank line indented no deeper
    than the header - not merely at the next unindented one. Trigger keys are
    indented two spaces, so stopping only at column 0 ran one trigger's body into
    the next one: a path list present under `push` alone then appeared in both
    extracted sets and the parity test passed over unequal filters
    (CodeRabbit, PR #86).
    """
    start = next(index for index, line in enumerate(lines) if line == header)
    indent = len(header) - len(header.lstrip(" "))
    body = []
    for line in lines[start + 1:]:
        if not line.strip():
            body.append(line)
            continue
        if (len(line) - len(line.lstrip(" "))) <= indent:
            break
        body.append(line)
    return body


class AnchorAliasTests(unittest.TestCase):
    def test_a_declared_paths_anchor_is_actually_aliased(self) -> None:
        """`paths: &name` must be consumed somewhere as `paths: *name`.

        A declared-and-ignored anchor is worse than no anchor: it advertises a
        single source of truth that does not exist. If a workflow genuinely needs
        two different path lists, it must not anchor one of them.
        """
        for path in sorted(WORKFLOWS.glob("*.yml")):
            lines = uncommented(path.read_text(encoding="utf-8"))
            declared = set(re.findall(r"paths:\s*&([\w-]+)", "\n".join(lines)))
            used = set(re.findall(r"paths:\s*\*([\w-]+)", "\n".join(lines)))
            unused = declared - used
            self.assertEqual(set(), unused,
                             f"{path.name} declares anchor(s) {sorted(unused)} but never aliases them; "
                             "the list it was meant to share is duplicated instead")

    def test_the_pull_request_and_push_triggers_cover_the_same_paths(self) -> None:
        """A file that triggers one trigger and not the other is a two-speed gate.

        After the anchor fix the two lists are the same object in YAML; this test
        states the requirement without depending on how the aliasing is spelled,
        so flattening it back to two lists is still allowed - as long as they match.
        """
        lines = uncommented(ci_text())
        pr = block(lines, "  pull_request:")
        push = block(lines, "  push:")

        def paths(body: list[str]) -> set[str]:
            joined = "\n".join(body)
            alias = re.search(r"paths:\s*\*([\w-]+)", joined)
            if alias:
                name = alias.group(1)
                return set(re.findall(r'^\s*-\s*"?([^"\n]+?)"?\s*$', "\n".join(block(lines, f"    paths: &{name}")), re.MULTILINE))
            return set(re.findall(r'^\s*-\s*"?([^"\n]+?)"?\s*$', "\n".join(body), re.MULTILINE))

        pr_paths, push_paths = paths(pr), paths(push)
        self.assertGreater(len(pr_paths), 50, "the pull-request trigger must list its paths")
        # Both directions: a one-way difference check accepts extra paths in the
        # other trigger, which is the same drift in the other direction.
        self.assertEqual(sorted(pr_paths - push_paths), [],
                         "these paths trigger CI on a pull request but not on main")
        self.assertEqual(sorted(push_paths - pr_paths), [],
                         "these paths trigger CI on main but not on a pull request")


class WorkflowFileCoverageTests(unittest.TestCase):
    # Every workflow that can change what CI verifies. A workflow edit that no
    # trigger watches ships unchecked; these must be named by ci.yml's path filter.
    def test_every_workflow_file_is_watched_by_ci(self) -> None:
        covered = set(re.findall(r'"\.github/workflows/([\w.-]+)"', ci_text()))
        present = {path.name for path in WORKFLOWS.glob("*.yml")}
        missing = sorted(present - covered)
        self.assertEqual([], missing,
                         "these workflow files are covered by no ci.yml trigger path: " + ", ".join(missing))
        # The exact test totals are read from these readiness documents, so edits
        # to their contract inputs must rerun the gate that validates them.
        for report in ("audit/v100/DEFECTS.md", "audit/v100/GATES.md",
                       "audit/v100/FINAL_READINESS.md", "audit/v100/FINAL_READINESS_CHECKLIST.md"):
            self.assertIn(f'"{report}"', ci_text(),
                          f"changes to {report}, read by CI integrity tests, must trigger CI")

    def test_the_optimization_report_changes_trigger_the_measured_gate(self) -> None:
        self.assertIn('"audit-evidence/round9/actions/OPTIMIZATION_REPORT.md"', ci_text(),
                      "changes to the report of measured CI results must trigger the gate they describe")

    def test_the_anchor_covers_the_workflow_files_as_well(self) -> None:
        """Guard the specific regression: exam-* and *-smoke workflows were untracked."""
        text = ci_text()
        for name in ("exam-sources.yml", "exam-validation.yml", "pages-smoke.yml", "telemetry-smoke.yml"):
            self.assertIn(f'".github/workflows/{name}"', text,
                          f"ci.yml must re-run when .github/workflows/{name} changes")


class BrowserMatrixTests(unittest.TestCase):
    def browser_job(self) -> str:
        text = uncommented(ci_text())
        start = next(index for index, line in enumerate(text) if line == "  browser:")
        body = [text[start]]
        for line in text[start + 1:]:
            if line and not line.startswith(" "):
                break
            body.append(line)
        return "\n".join(body)

    def test_all_three_engines_run(self) -> None:
        job = self.browser_job()
        for engine in ("chromium", "firefox", "webkit"):
            self.assertIn(engine, job, f"the browser matrix must keep {engine}")

    def test_both_suites_remain_in_the_required_browser_run(self) -> None:
        """The wrapper keeps both full-suite fallback and the exam shard path."""
        job = self.browser_job()
        script = (ROOT / "tests" / "run-browser-suites.sh").read_text(encoding="utf-8")
        for suite in ("tests/browser-learning.cjs", "tests/browser-exams.cjs"):
            self.assertIn(suite, script,
                          f"the default suite list must include {suite}")
        self.assertIn("run-browser-suites.sh", job,
                      "the browser job must run the wrapper that names both suites")

    def test_the_job_does_not_hide_a_failure(self) -> None:
        job = self.browser_job()
        self.assertNotIn("continue-on-error", job,
                         "a browser failure must fail the job, not be swallowed")
        self.assertIn("fail-fast: false", job,
                      "one engine failing must not cancel the others' verdicts")

    def test_the_runner_script_accepts_a_single_suite(self) -> None:
        """Explicit suite paths remain available for focused local reproduction."""
        script = (ROOT / "tests" / "run-browser-suites.sh").read_text(encoding="utf-8")
        self.assertIn('if [ "$#" -gt 0 ]', script,
                      "run-browser-suites.sh must accept explicit suite paths")
        self.assertIn("no such browser suite", script,
                      "a suite path that does not exist must fail, not run nothing")


class BrowserShardMatrixTests(unittest.TestCase):
    def test_each_engine_runs_all_five_learning_regions(self) -> None:
        job = BrowserMatrixTests().browser_job()
        self.assertIn("part: [1, 2, 3, 4, 5]", job)
        self.assertIn("timeout-minutes: 9", job,
                      "each matrix cell is bounded below the 600-second runtime target")
        self.assertIn("PART: ${{ matrix.part }}", job)
        self.assertIn("bash tests/run-browser-suites.sh", job)
        self.assertNotIn("continue-on-error", job)

    def test_the_shard_generator_is_in_the_ci_path_filter(self) -> None:
        self.assertIn('"scripts/shard_browser_suite.mjs"', ci_text(),
                      "changes to the script that creates every browser shard must trigger CI")

    def test_the_exact_once_guard_and_behavioral_negative_controls_run_in_ci(self) -> None:
        workflow = ci_text()
        self.assertIn("node scripts/shard_browser_suite.mjs --check", workflow)
        self.assertIn("node --test tests/shard-browser-suite.test.mjs tests/fresh-world-failure.test.cjs", workflow)
        learning = (ROOT / "tests" / "browser-learning.cjs").read_text(encoding="utf-8")
        self.assertIn("const runFreshWorldScenario = scenario => withFreshWorldScenario(", learning)
        self.assertEqual(learning.count("await runFreshWorldScenario(async world => {"), 8,
                         "every fresh-world scenario must exercise the tested capture-before-close helper")
        self.assertIn("}, scenario, captureFailureScreenshot);", learning)

    def test_exam_suite_runs_once_per_engine_outside_the_learning_partition(self) -> None:
        script = (ROOT / "tests" / "run-browser-suites.sh").read_text(encoding="utf-8")
        self.assertIn('if [ "$PART" = "5" ]; then', script)
        self.assertIn('suites+=("tests/browser-exams.cjs")', script)
        self.assertIn('suites=("tests/browser-learning.cjs" "tests/browser-exams.cjs")', script,
                      "PART unset must preserve the full, unsharded local path")


class FailureArtifactTests(unittest.TestCase):
    def test_the_screenshot_upload_points_at_a_directory_the_suites_write(self) -> None:
        """The glob `**/*.png` was satisfied by nothing, so the artifact was always empty."""
        job = BrowserMatrixTests().browser_job()
        self.assertNotRegex(job, r"path:\s*\|\s*\n\s*\*\*/\*\.png",
                            "the browser job must not glob **/*.png; nothing produces one")
        self.assertIn("browser-shots", job,
                      "the upload must name the scratch directory the suite writes into")
        self.assertIn("mkdir -p", job,
                      "the scratch directory must exist before the suite runs")
        self.assertIn("BROWSER_SCREENSHOT_DIR", job,
                      "the job must export BROWSER_SCREENSHOT_DIR for the suites")

    def test_the_browser_log_is_uploaded_even_when_the_suite_fails(self) -> None:
        job = BrowserMatrixTests().browser_job()
        self.assertIn("browser-log", job,
                      "the job must upload the suite log; a red run otherwise loses its output")
        self.assertRegex(job, r"if:\s*always\(\)",
                         "the log upload must run on failure too")


class CheckoutCredentialTests(unittest.TestCase):
    """Every checkout must opt out of persisting the token.

    `actions/checkout` writes `${{ github.token }}` into `.git/config` unless
    `persist-credentials: false`. Most of this repository's checkouts opted out;
    `deploy.yml`, which runs with `pages: write` and publishes the site, did not
    (Round 9, R9-14). A credential left in the working tree is readable by every
    later step and by any tool that shells out to git, so the leak is silent.
    """

    @staticmethod
    def checkout_blocks(path: Path) -> list[tuple[int, list[str]]]:
        lines = path.read_text(encoding="utf-8").splitlines()
        blocks = []
        for index, line in enumerate(lines):
            if "uses: actions/checkout" not in line:
                continue
            # The block is the whole list item: `uses:` sits at the same
            # indentation as its sibling `with:` / `if:`, so the item ends where
            # the next `- ` marker starts, not at the first line that dedents.
            dash = len(line) - len(line.lstrip(" "))
            block = [line]
            for follower in lines[index + 1:]:
                if not follower.strip():
                    block.append(follower)
                    continue
                stripped_follower = follower.lstrip(" ")
                follower_indent = len(follower) - len(stripped_follower)
                if follower_indent < dash or (follower_indent == dash and stripped_follower.startswith("- ")):
                    break
                block.append(follower)
            blocks.append((index + 1, block))
        return blocks

    def test_every_checkout_disables_credential_persistence(self) -> None:
        for path in sorted(WORKFLOWS.glob("*.yml")):
            blocks = self.checkout_blocks(path)
            for line_number, block in blocks:
                self.assertIn("persist-credentials: false", "\n".join(block),
                              f"{path.name}:{line_number} checks out without "
                              "'persist-credentials: false', leaving the workflow token in .git/config")

    def test_the_publishing_job_is_checked_too(self) -> None:
        """Guard the specific regression: the one checkout with publish rights was the one missing it."""
        deploy = (WORKFLOWS / "deploy.yml").read_text(encoding="utf-8")
        self.assertIn("pages: write", deploy)
        blocks = self.checkout_blocks(WORKFLOWS / "deploy.yml")
        self.assertGreaterEqual(len(blocks), 1, "deploy.yml must still check out main")
        for line_number, block in blocks:
            self.assertIn("persist-credentials: false", "\n".join(block),
                          f"deploy.yml:{line_number} publishes Pages but persists the token")


class SummaryScriptTests(unittest.TestCase):
    """`scripts/ci_run_summary.py` is the measuring instrument for the Actions work.

    A measuring instrument that reports numbers for a run that has not finished is
    worse than none: it produced a "0m10s wall-clock" beside a 7-minute job from
    live data during this round (CodeRabbit, PR #86). Final metrics are only
    reported for a completed run.
    """

    @staticmethod
    def module():
        import importlib.util
        path = ROOT / "scripts" / "ci_run_summary.py"
        spec = importlib.util.spec_from_file_location("ci_run_summary_under_test", path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    RUN = {
        "id": 1, "head_sha": "a" * 40, "event": "pull_request",
        "run_started_at": "2026-11-13T06:00:00Z",
    }
    JOBS = [{"name": "browser (webkit)", "conclusion": None,
             "started_at": "2026-11-13T06:00:00Z", "completed_at": "2026-11-13T06:07:00Z"}]

    def test_an_unfinished_run_reports_no_final_metrics(self) -> None:
        summary = self.module().summarise_from(
            dict(self.RUN, status="in_progress", conclusion=None, updated_at="2026-11-13T06:00:10Z"),
            self.JOBS)
        self.assertFalse(summary["complete"])
        self.assertIsNone(summary["wall_clock_seconds"],
                          "an unfinished run has no wall-clock; updated_at is not a finish time")
        self.assertIsNone(summary["critical_path_seconds"])
        self.assertIsNone(summary["sum_job_seconds"],
                          "a partial sum over finished jobs is not a total")

    def test_a_completed_run_reports_the_measured_metrics(self) -> None:
        summary = self.module().summarise_from(
            dict(self.RUN, status="completed", conclusion="success", updated_at="2026-11-13T06:13:19Z"),
            self.JOBS)
        self.assertTrue(summary["complete"])
        self.assertEqual(summary["wall_clock_seconds"], 799)
        self.assertEqual(summary["critical_path_seconds"], 420)
        self.assertEqual(summary["sum_job_seconds"], 420)

    def test_latest_never_selects_an_unfinished_run(self) -> None:
        source = (ROOT / "scripts" / "ci_run_summary.py").read_text(encoding="utf-8")
        self.assertIn('run.get("status") == "completed"', source,
                      "--latest must filter for completed runs")


class BlockExtractionTests(unittest.TestCase):
    """`block()` must stop at the next sibling key, not at column 0.

    Trigger keys are indented two spaces, so a column-0 bound ran one trigger's
    body straight into the next. A path listed only under `push` then appeared in
    both extracted sets, and the parity test passed over filters that genuinely
    differed - the assertion was inverted into a no-op by its own helper
    (CodeRabbit, PR #86).
    """

    SAMPLE = [
        "on:",
        "  pull_request:",
        "    paths: &p",
        '      - "a"',
        "  push:",
        "    branches: [main]",
        "    paths: *p",
        "concurrency:",
        "  group: x",
    ]

    def test_the_body_stops_at_the_next_trigger(self) -> None:
        lines = list(self.SAMPLE)
        body = block(lines, "  pull_request:")
        joined = "\n".join(body)
        self.assertIn('- "a"', joined)
        self.assertNotIn("paths: *p", joined,
                         "the pull_request body must not swallow the push trigger")
        self.assertNotIn("concurrency", joined)

    def test_a_path_only_in_one_trigger_is_detected(self) -> None:
        """The regression the helper bug hid: an unequal pair must not look equal."""
        lines = [line.replace('    paths: *p', '    paths:\n      - "b"') for line in self.SAMPLE]
        flat = []
        for line in lines:
            flat.extend(line.split("\n"))
        pr = "\n".join(block(flat, "  pull_request:"))
        push = "\n".join(block(flat, "  push:"))
        self.assertIn('- "a"', pr)
        self.assertNotIn('- "b"', pr)
        self.assertIn('- "b"', push)
        self.assertNotIn('- "a"', push)


if __name__ == "__main__":
    unittest.main()
