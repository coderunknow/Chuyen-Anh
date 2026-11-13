"""Integrity rules for the workflow files themselves.

Round 9 found three defects that no existing test could see, because they were
properties of the workflow YAML rather than of the application:

  1. `ci.yml` declared the YAML anchor `&ci-paths` and then re-typed the same
     77-entry list under `push:` instead of aliasing it. The anchor did nothing,
     so adding a path to one trigger silently left the other stale - the exact
     drift the anchor was written to prevent. Four workflow files
     (`exam-sources`, `exam-validation`, `pages-smoke`, `telemetry-smoke`) were
     covered by no CI trigger at all.
  2. The browser job ran *both* suites in *one* job per engine, sequentially,
     which made the slowest engine the whole workflow's critical path.
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
    """The indented body under a top-level key such as `  push:`."""
    start = next(index for index, line in enumerate(lines) if line == header)
    body = []
    for line in lines[start + 1:]:
        if line and not line.startswith(" "):
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
        self.assertEqual(sorted(pr_paths - push_paths), [],
                         "these paths trigger CI on a pull request but not on main")


class WorkflowFileCoverageTests(unittest.TestCase):
    # Every workflow that can change what CI verifies. A workflow edit that no
    # trigger watches ships unchecked; these must be named by ci.yml's path filter.
    def test_every_workflow_file_is_watched_by_ci(self) -> None:
        covered = set(re.findall(r'"\.github/workflows/([\w.-]+)"', ci_text()))
        present = {path.name for path in WORKFLOWS.glob("*.yml")}
        missing = sorted(present - covered)
        self.assertEqual([], missing,
                         "these workflow files are covered by no ci.yml trigger path: " + ", ".join(missing))

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

    def test_both_suites_are_named_as_matrix_values(self) -> None:
        """One suite per job is the whole optimization: both files must stay in the matrix."""
        job = self.browser_job()
        for suite in ("tests/browser-learning.cjs", "tests/browser-exams.cjs"):
            self.assertIn(suite, job, f"the browser matrix must run {suite}")

    def test_a_job_runs_one_suite_not_both(self) -> None:
        """`run-browser-suites.sh` with no argument runs both, sequentially.

        That is the pre-Round-9 shape and it doubles the critical path. The job must
        pass an explicit suite file, taken from the matrix.
        """
        job = self.browser_job()
        invocations = [line for line in job.splitlines()
                       if "run-browser-suites.sh" in line and not line.lstrip().startswith("#")]
        self.assertTrue(invocations, "the browser job must run tests/run-browser-suites.sh")
        for line in invocations:
            self.assertRegex(line, r"run-browser-suites\.sh\s+\"?\$\{\{\s*matrix\.suite\.file\s*\}\}",
                             "the browser job must pass one suite from the matrix, not run both")
        self.assertIn("fail-fast: false", job,
                      "one engine failing must not cancel the others' verdicts")

    def test_the_runner_script_accepts_a_single_suite(self) -> None:
        script = (ROOT / "tests" / "run-browser-suites.sh").read_text(encoding="utf-8")
        self.assertIn('if [ "$#" -gt 0 ]', script,
                      "run-browser-suites.sh must accept explicit suite paths")
        self.assertIn("no such browser suite", script,
                      "a typo in a matrix value must fail the job instead of running nothing")


class FailureArtifactTests(unittest.TestCase):
    def test_the_screenshot_upload_points_at_a_directory_the_suites_write(self) -> None:
        """The glob `**/*.png` was satisfied by nothing, so the artifact was always empty."""
        job = BrowserMatrixTests().browser_job()
        self.assertNotRegex(job, r"path:\s*\|\s*\n\s*\*\*/\*\.png",
                            "the browser job must not glob **/*.png; nothing produces one")
        self.assertIn("browser-shots", job,
                      "the upload must name the scratch directory the suite writes into")
        self.assertIn("BROWSER_SCREENSHOT_DIR", job,
                      "the job must export BROWSER_SCREENSHOT_DIR for the suites")

    def test_both_suites_honour_the_screenshot_directory_on_failure(self) -> None:
        for suite in ("browser-learning.cjs", "browser-exams.cjs"):
            source = (ROOT / "tests" / suite).read_text(encoding="utf-8")
            self.assertIn("BROWSER_SCREENSHOT_DIR", source,
                          f"{suite} must honour BROWSER_SCREENSHOT_DIR")
            catch = source[source.rindex("main().catch"):]
            self.assertIn("screenshot", catch,
                          f"{suite} must capture a screenshot in its failure handler, not only on the happy path")

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


if __name__ == "__main__":
    unittest.main()
