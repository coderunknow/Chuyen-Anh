"""rc10 release: inference-pin fail-closed regression tests.

The inference boundary introduced in rc10 prevents the teaching bank from
silently altering answer-key inference for historical exam papers. This suite
proves the *fail-closed* half of that boundary: the builder must refuse to run
when the pin is missing, malformed, inconsistent, or stale — it must never fall
back to the live bank.

Each test runs the actual `build_answer_keys.mjs` in a temporary copy of the
repository, so the real `data/exam-answer-keys.json` and audit artifacts are
never touched by a failing case.

Required coverage (mission §4):
  1. the normal pinned build succeeds
  2. a missing inference lexicon causes a non-zero exit
  3. malformed or incomplete pin data is rejected
  4. the builder cannot silently use newly added teaching-bank entries
  5. failed execution does not corrupt or partially overwrite generated keys
  6. existing exam scoring and inference behaviour remains correct
"""

import json
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BUILDER = ROOT / 'scripts' / 'exams' / 'build_answer_keys.mjs'
PIN = ROOT / 'scripts' / 'exams' / 'inference-lexicon.json'
KEYS = ROOT / 'data' / 'exam-answer-keys.json'
VOCAB = ROOT / 'data' / 'vocabulary.json'
PHRASES = ROOT / 'data' / 'phrases.json'

# Files the builder reads but does not write; tests only need to copy these.
BUILDER_INPUTS = [
    ROOT / 'index.html',
    ROOT / 'scripts' / 'exams' / 'selection.json',
    ROOT / 'scripts' / 'exams' / 'inference-lexicon.json',
    VOCAB,
    PHRASES,
]
BUILDER_OUTPUTS = [
    ROOT / 'data' / 'exam-answer-keys.json',
    ROOT / 'docs' / 'exam-scoring-audit.json',
    ROOT / 'docs' / 'exam-scoring-audit.md',
]


class InferencePinFailClosedTest(unittest.TestCase):
    """Each test operates in an isolated temp copy so a failure cannot corrupt the repo."""

    def setUp(self) -> None:
        self.tmp = Path(tempfile.mkdtemp(prefix='rc10-pin-'))
        self.addCleanup(shutil.rmtree, self.tmp, ignore_errors=True)
        # Mirror the layout the builder expects.
        (self.tmp / 'scripts' / 'exams').mkdir(parents=True)
        (self.tmp / 'data').mkdir(parents=True)
        (self.tmp / 'docs').mkdir(parents=True)
        for f in BUILDER_INPUTS:
            dest = self.tmp / f.relative_to(ROOT)
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(f, dest)
        # Copy the generated outputs too, so --check can compare.
        for f in BUILDER_OUTPUTS:
            if f.exists():
                dest = self.tmp / f.relative_to(ROOT)
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(f, dest)
        # Copy the builder script itself so `root` resolves to the temp tree.
        shutil.copy2(BUILDER, self.tmp / 'scripts' / 'exams' / 'build_answer_keys.mjs')
        # The builder reads exam transcriptions from De-chuyen-Anh-vao-10/.
        shutil.copytree(ROOT / 'De-chuyen-Anh-vao-10', self.tmp / 'De-chuyen-Anh-vao-10')

    def _run(self, cwd: Path) -> subprocess.CompletedProcess:
        builder = cwd / 'scripts' / 'exams' / 'build_answer_keys.mjs'
        return subprocess.run(
            ['node', str(builder)],
            cwd=str(cwd), capture_output=True, text=True, timeout=300)

    def _pin_path(self, cwd: Path) -> Path:
        return cwd / 'scripts' / 'exams' / 'inference-lexicon.json'

    def _read_pin(self, cwd: Path) -> dict:
        return json.loads(self._pin_path(cwd).read_text(encoding='utf-8'))

    def _write_pin(self, cwd: Path, pin: dict) -> None:
        self._pin_path(cwd).write_text(json.dumps(pin, indent=1) + '\n', encoding='utf-8')

    def _sha256(self, path: Path) -> str:
        import hashlib
        return hashlib.sha256(path.read_bytes()).hexdigest()

    # 1. Normal pinned build succeeds.
    def test_normal_pinned_build_succeeds(self) -> None:
        proc = self._run(self.tmp)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertIn('scorable', proc.stdout)

    # 2. Missing inference lexicon causes a non-zero exit.
    def test_missing_inference_lexicon_fails_closed(self) -> None:
        self._pin_path(self.tmp).unlink()
        proc = self._run(self.tmp)
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn('missing', proc.stderr.lower())
        self.assertIn('fall back', proc.stderr.lower())

    # 3a. Malformed JSON is rejected.
    def test_malformed_pin_json_rejected(self) -> None:
        self._pin_path(self.tmp).write_text('{not valid json', encoding='utf-8')
        proc = self._run(self.tmp)
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn('not valid JSON', proc.stderr)

    # 3b. Missing mandatory field is rejected.
    def test_pin_missing_mandatory_field_rejected(self) -> None:
        pin = self._read_pin(self.tmp)
        del pin['frozenAt']
        self._write_pin(self.tmp, pin)
        proc = self._run(self.tmp)
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn('missing mandatory field', proc.stderr)
        self.assertIn('frozenAt', proc.stderr)

    # 3c. Empty vocabulary array is rejected.
    def test_pin_empty_vocabulary_rejected(self) -> None:
        pin = self._read_pin(self.tmp)
        pin['vocabulary'] = []
        pin['counts']['vocabulary'] = 0
        self._write_pin(self.tmp, pin)
        proc = self._run(self.tmp)
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn('non-empty array', proc.stderr)

    # 3d. Declared counts disagree with actual lengths.
    def test_pin_count_disagreement_rejected(self) -> None:
        pin = self._read_pin(self.tmp)
        pin['counts']['vocabulary'] = pin['counts']['vocabulary'] + 1
        self._write_pin(self.tmp, pin)
        proc = self._run(self.tmp)
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn('does not match actual length', proc.stderr)

    # 3e. Invalid frozen revision.
    def test_pin_invalid_frozen_revision_rejected(self) -> None:
        pin = self._read_pin(self.tmp)
        pin['frozenAt'] = 'not-a-sha'
        self._write_pin(self.tmp, pin)
        proc = self._run(self.tmp)
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn('40-character commit SHA', proc.stderr)

    # 3f. Duplicate entries.
    def test_pin_duplicate_entries_rejected(self) -> None:
        pin = self._read_pin(self.tmp)
        pin['vocabulary'].append(pin['vocabulary'][0])
        pin['counts']['vocabulary'] = len(pin['vocabulary'])
        self._write_pin(self.tmp, pin)
        proc = self._run(self.tmp)
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn('duplicate', proc.stderr)

    # 4. The builder cannot silently use newly added teaching-bank entries.
    def test_builder_ignores_new_bank_entries(self) -> None:
        # Add a brand-new vocabulary row to the bank copy. It must not appear in
        # the inferred keys because the pin does not contain it.
        vocab = json.loads((self.tmp / 'data' / 'vocabulary.json').read_text(encoding='utf-8'))
        new_word = 'zzquirkynewword'
        vocab.append({'id': '99999', 'word': new_word, 'pos': 'n',
                      'meaning': 'a word that must never be inferred'})
        (self.tmp / 'data' / 'vocabulary.json').write_text(
            json.dumps(vocab, ensure_ascii=False), encoding='utf-8')
        proc = self._run(self.tmp)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        # The regenerated keys must be identical to the pinned baseline.
        keys_text = (self.tmp / 'data' / 'exam-answer-keys.json').read_text(encoding='utf-8')
        self.assertNotIn(new_word, keys_text)
        # And the output must match the committed keys byte-for-byte.
        committed = KEYS.read_text(encoding='utf-8')
        self.assertEqual(keys_text, committed)

    # 5. Failed execution does not corrupt or partially overwrite generated keys.
    def test_failed_build_does_not_overwrite_outputs(self) -> None:
        before = {f: self._sha256(f) for f in BUILDER_OUTPUTS if f.exists()}
        # Delete the pin so the build fails.
        self._pin_path(self.tmp).unlink()
        proc = self._run(self.tmp)
        self.assertNotEqual(proc.returncode, 0)
        after = {f: self._sha256(f) for f in BUILDER_OUTPUTS if f.exists()}
        self.assertEqual(before, after, 'a failed build must not touch the generated artifacts')

    # 6. Existing exam scoring and inference behaviour remains correct.
    def test_scoring_behaviour_unchanged(self) -> None:
        proc = self._run(self.tmp)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        keys = json.loads((self.tmp / 'data' / 'exam-answer-keys.json').read_text(encoding='utf-8'))
        self.assertEqual(len(keys['records']), 106)
        scored = sum(r['scoredCount'] for r in keys['records'])
        self.assertEqual(scored, 3011)
        total = sum(r['questionCount'] for r in keys['records'])
        self.assertEqual(total, 6804)
        missing = total - scored
        self.assertEqual(missing, 3793)


if __name__ == '__main__':
    unittest.main()
