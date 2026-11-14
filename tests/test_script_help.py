"""`--help` must be a query: no rebuild, no release, no remote call (D75).

Round 7's evidence bundle recorded the defect precisely: `scripts/exams/build_archive.py`
and `scripts/release_artifacts.py` had no argument parser, so `--help` was ignored and
the module executed on import of `__main__`. The first rebuilt every archived paper from
`.source-review/`, writing into `De-chuyen-Anh-vao-10/`; the second read the release tag
from the environment and could call `gh release create --draft`. Any sweep that probes
scripts for flags therefore *acted on the repository*, and this repository is under a
deploy hold (`DEPLOY_HOLD`).

These tests reproduce that risk safely:

* the scripts are run with a fake `gh` first on `PATH` that fails loudly, so a remote
  call is an error rather than an event;
* `PUSH_TAG`/`INPUT_TAG` are set to a supported tag, which is exactly the environment
  the release workflow provides - if the parser were bypassed, `main()` would run;
* the tracked tree is hashed before and after, so "it printed help" is not enough:
  the files must be byte-identical.

Nothing here creates a release, uploads an asset or publishes anything.
"""

import hashlib
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / "De-chuyen-Anh-vao-10"
SCRIPTS = {
    "build_archive": ROOT / "scripts" / "exams" / "build_archive.py",
    "release_artifacts": ROOT / "scripts" / "release_artifacts.py",
}


def tree_digest(paths):
    """SHA-256 of every tracked file under the given paths, plus its relative name."""
    digest = hashlib.sha256()
    for base in paths:
        for file in sorted(base.rglob("*")) if base.is_dir() else [base]:
            if file.is_file():
                digest.update(str(file.relative_to(ROOT)).encode())
                digest.update(file.read_bytes())
    return digest.hexdigest()


class ScriptHelpTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        fake_bin = Path(self.temp.name) / "bin"
        fake_bin.mkdir()
        # A `gh` that records its invocation and fails. If the script reaches a
        # release operation under --help, the marker file appears and the test says so.
        self.marker = Path(self.temp.name) / "gh-called"
        gh = fake_bin / "gh"
        gh.write_text(
            "#!/bin/sh\n"
            f"echo \"$*\" >> {self.marker}\n"
            "echo 'gh must not run under --help' >&2\n"
            "exit 97\n",
            encoding="utf-8",
        )
        gh.chmod(0o755)
        self.env = dict(os.environ)
        self.env["PATH"] = f"{fake_bin}{os.pathsep}{self.env.get('PATH', '')}"
        # The release workflow's own environment: a supported tag plus an input tag.
        self.env["PUSH_TAG"] = "v1.0.0"
        self.env["INPUT_TAG"] = "v1.0.0"

    def run_script(self, name):
        return subprocess.run(
            [sys.executable, str(SCRIPTS[name]), "--help"],
            cwd=ROOT, env=self.env, text=True,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=120,
        )

    def test_help_prints_usage_and_exits_zero(self):
        for name in SCRIPTS:
            with self.subTest(script=name):
                result = self.run_script(name)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn("usage:", result.stdout.lower())
                self.assertIn("--help", result.stdout)

    def test_help_does_not_rebuild_the_archive_or_touch_tracked_files(self):
        before = tree_digest([ARCHIVE, SCRIPTS["build_archive"], SCRIPTS["release_artifacts"]])
        result = self.run_script("build_archive")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(before, tree_digest([ARCHIVE, SCRIPTS["build_archive"], SCRIPTS["release_artifacts"]]),
                         "--help must not rewrite the archived papers")

    def test_help_never_invokes_gh(self):
        for name in SCRIPTS:
            with self.subTest(script=name):
                result = self.run_script(name)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertFalse(self.marker.exists(),
                                 f"--help of {name} reached a gh call: {self.marker.read_text() if self.marker.exists() else ''}")

    def test_an_unknown_argument_is_refused_instead_of_run(self):
        # The dangerous shape is not "--help works"; it is "an unrecognised flag is
        # ignored and the script executes anyway", which is what the round-7 sweep hit.
        for name in SCRIPTS:
            with self.subTest(script=name):
                result = subprocess.run(
                    [sys.executable, str(SCRIPTS[name]), "--not-a-real-flag"],
                    cwd=ROOT, env=self.env, text=True,
                    stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=120,
                )
                self.assertNotEqual(result.returncode, 0, "an unknown flag must not be ignored")
                self.assertFalse(self.marker.exists(), f"{name} reached gh with an unknown flag")
                self.assertIn("unrecognized arguments", result.stderr)

    def test_both_scripts_still_expose_their_programmatic_entry_point(self):
        # The workflows and the existing test suites call `main()`, not the CLI, so
        # adding a parser must not have removed it.
        for name, path in SCRIPTS.items():
            with self.subTest(script=name):
                source = path.read_text(encoding="utf-8")
                self.assertIn("\ndef main(", source)
                self.assertIn("def cli(argv=None):", source)


if __name__ == "__main__":
    unittest.main()
