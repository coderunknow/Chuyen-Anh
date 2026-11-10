"""Every test suite the readiness report counts must actually run in CI.

The v1.0.0 checklist reported `243/243` Python tests as PASS, counting
`scripts/exams/test_archive.py` — but that suite was never wired into a workflow
and needs `scripts/exams/requirements.txt` (PyMuPDF, BeautifulSoup, markdownify),
so a fresh checkout errors in two of its five tests. The claim was true only on a
machine where someone had already installed those packages by hand.

These tests make the claim auditable: the archive suite must be installed and run
by CI, and every `tests/*.test.js` file must be named by a workflow, so a new test
cannot be added without a workflow that runs it.
"""

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CI = (ROOT / ".github" / "workflows" / "ci.yml").read_text(encoding="utf-8")
ARCHIVE_SUITE = "scripts/exams/test_archive.py"
REQUIREMENTS = "scripts/exams/requirements.txt"
CHECKLIST = ROOT / "audit" / "v100" / "FINAL_READINESS_CHECKLIST.md"


def discovered_cases() -> int:
    """How many tests `unittest discover -s tests` collects — the number the report claims."""
    loader = unittest.TestLoader()
    return loader.discover(str(ROOT / "tests"), pattern="test_*.py").countTestCases()


def node_test_commands() -> str:
    """Only the `node --test …` run blocks: a suite named in a comment or a path filter runs nothing."""
    lines = [line.split(" #", 1)[0] for line in CI.splitlines()]  # drop YAML comments first
    blocks = []
    for index, line in enumerate(lines):
        if "--test" not in line:
            continue
        block = [line]
        for follower in lines[index + 1:]:
            if follower.strip() and not follower.startswith((" ", "\t")):
                break
            block.append(follower)
        blocks.append("\n".join(block))
    return "\n".join(blocks)


class CiGateCoverageTests(unittest.TestCase):
    def test_the_archive_conversion_suite_runs_in_ci_with_its_dependencies(self) -> None:
        self.assertIn(REQUIREMENTS, CI,
                      "CI must install scripts/exams/requirements.txt; without it two archive tests error out")
        self.assertIn(ARCHIVE_SUITE, CI,
                      "CI must run scripts/exams/test_archive.py, or the readiness count claims untested work")

    def test_every_node_test_file_is_run_by_the_ci_workflow(self) -> None:
        files = sorted(path.name for path in (ROOT / "tests").glob("*.test.js"))
        self.assertGreater(len(files), 5)
        commands = node_test_commands()
        missing = [name for name in files if f"tests/{name}" not in commands]
        self.assertEqual([], missing,
                         "these Node suites exist but no `node --test` command runs them: "
                         + ", ".join(missing))

    def test_the_release_source_check_runs_every_node_suite(self) -> None:
        """`DEFECTS.md` says packaging runs all suites; the list in code must match the files."""
        source = (ROOT / "scripts" / "release_artifacts.py").read_text(encoding="utf-8")
        listed = set(re.findall(r'"(tests/[\w.-]+\.test\.js)"', source))
        files = {f"tests/{path.name}" for path in (ROOT / "tests").glob("*.test.js")}
        self.assertEqual(sorted(files - listed), [],
                         "these Node suites exist but the release source check never runs them")

    def test_the_readiness_checklist_and_the_workflows_describe_the_same_suites(self) -> None:
        text = CHECKLIST.read_text(encoding="utf-8")
        self.assertIn(ARCHIVE_SUITE, text, "the checklist claims the archive suite; CI must run it")
        # A hand-installed `.venv` is not a reproducible instruction.
        self.assertNotIn(".venv/bin/python scripts/exams/test_archive.py", text,
                         "the checklist must not require a local virtualenv the repository does not create")

    def test_the_python_total_in_the_report_matches_the_discovered_suite(self) -> None:
        """The stated total must be the number `discover` actually runs — exactly, not approximately."""
        cases = discovered_cases()
        text = CHECKLIST.read_text(encoding="utf-8")
        row = next((line for line in text.splitlines()
                    if "test_archive.py" in line and "unit tests" in line), None)
        self.assertIsNotNone(row, "the checklist must keep a Python test-suite row")
        match = re.search(r"`(\d+)` unit tests", row)
        self.assertIsNotNone(match, "the checklist row must state `N` unit tests")
        stated = int(match.group(1))
        self.assertEqual(cases, stated,
                         f"checklist states {stated} unit tests; discover collects {cases}")

    def test_every_test_definition_is_collectable(self) -> None:
        """A test the runner cannot see is not a test.

        Round 4 found `test_check_mode_rejects_a_reshaped_artifact` defined *inside*
        the `if __name__ == "__main__":` guard of its own module: it parsed, it read
        correctly in a diff, and `unittest` never collected it, so the mutant proof it
        claimed had never run. Two shapes are rejected here — a definition nested in a
        `__main__` guard anywhere in the tree, and a `test_*` function that is not a
        method of a `unittest.TestCase` subclass in a test module.
        """
        import ast
        import pathlib

        root = pathlib.Path(__file__).resolve().parents[1]
        problems = []
        for path in sorted(root.rglob('*.py')):
            if any(part in {'.venv', 'node_modules', '__pycache__', 'release'} for part in path.parts):
                continue
            try:
                tree = ast.parse(path.read_text(encoding='utf-8'))
            except SyntaxError:
                continue
            for node in ast.walk(tree):
                if not isinstance(node, ast.If):
                    continue
                test_node = node.test
                compares_name = (
                    isinstance(test_node, ast.Compare)
                    and isinstance(test_node.left, ast.Name)
                    and test_node.left.id == '__name__'
                )
                if not compares_name:
                    continue
                nested = [child.name for child in node.body if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef))]
                if nested:
                    problems.append(f'{path.relative_to(root)}: {nested} nested inside the __main__ guard')

        for path in sorted((root / 'tests').glob('test_*.py')):
            tree = ast.parse(path.read_text(encoding='utf-8'))
            for node in tree.body:
                if isinstance(node, ast.FunctionDef) and node.name.startswith('test_'):
                    problems.append(f'{path.relative_to(root)}: module-level {node.name}() is never collected by unittest')
                if isinstance(node, ast.ClassDef):
                    for item in node.body:
                        if isinstance(item, ast.FunctionDef) and item.name.startswith('test_'):
                            bases = ' '.join(ast.unparse(base) for base in node.bases)
                            if 'TestCase' not in bases:
                                problems.append(f'{path.relative_to(root)}: {node.name}.{item.name}() is not in a TestCase subclass')

        self.assertEqual([], problems, 'unreachable test definitions: ' + '; '.join(problems))


if __name__ == "__main__":
    unittest.main()
