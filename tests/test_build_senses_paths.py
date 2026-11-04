"""Exercise build_senses output paths without touching the committed data."""
import pathlib
import subprocess
import sys
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
SCRIPT = ROOT / 'scripts/build_senses.py'


class BuildSensesPathTests(unittest.TestCase):
    def test_custom_outputs_inside_and_outside_repo(self):
        for parent in (None, ROOT):
            with self.subTest(parent=parent), tempfile.TemporaryDirectory(dir=parent) as directory:
                path = pathlib.Path(directory) / 'vocab.json'
                path.write_text('[]\n', encoding='utf-8')
                for arg in (str(path), str(path.relative_to(ROOT)) if parent else str(path)):
                    run = subprocess.run([sys.executable, str(SCRIPT), '--json', arg], cwd=ROOT,
                                         text=True, capture_output=True)
                    self.assertEqual(run.returncode, 0, run.stderr)
                    self.assertIn('wrote senses for 0 entries', run.stdout)
                    self.assertEqual(path.read_text(encoding='utf-8'), '[]\n')

    def test_nonexistent_parent_or_unreadable_file_fails(self):
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory) / 'missing' / 'vocab.json'
            run = subprocess.run([sys.executable, str(SCRIPT), '--json', str(path)], cwd=ROOT,
                                 text=True, capture_output=True)
            self.assertNotEqual(run.returncode, 0)
            self.assertFalse(path.exists())
            self.assertNotIn('wrote senses', run.stdout)


if __name__ == '__main__':
    unittest.main()
