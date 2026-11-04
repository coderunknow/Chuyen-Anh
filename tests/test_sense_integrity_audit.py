"""Detection, not approval, of ambiguous sense-to-gloss and POS evidence."""
import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('sense_integrity_audit', ROOT / 'scripts/sense_integrity_audit.py')
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)

class SenseIntegrityAuditTests(unittest.TestCase):
    def test_pos_level_is_checked_at_the_reference_row_not_word_level(self):
        row = {'pos_levels': {'v': 'A2', 'n': 'B1'}, 'levels': ['A2', 'B1']}
        self.assertEqual(audit.pos_level(row, 'n'), 'B1')
        self.assertEqual(audit.pos_level(row, 'v'), 'A2')
        self.assertIsNone(audit.pos_level(row, 'adj'))

    def test_duplicate_and_order_based_glosses_are_not_assumed_verified(self):
        entry = {'id': 'x', 'word': 'example', 'pos': 'n', 'meaning': 'alpha; beta', 'senses': [
            {'meaning': 'beta', 'cefr': 'A2', 'sources': []},
            {'meaning': 'alpha', 'cefr': 'B1', 'sources': []}]}
        issues = audit.entry_issues(entry, {})
        self.assertIn('multi-sense mapping requires independent verification', issues)
        entry['senses'][1]['meaning'] = 'beta'
        self.assertIn('duplicate gloss across senses', audit.entry_issues(entry, {}))

    def test_multi_sense_headword_agreement_does_not_prove_sense_agreement(self):
        entry = {'id': 'x', 'word': 'example', 'pos': 'n', 'meaning': 'a', 'senses': [
            {'meaning': 'a', 'cefr': 'A2', 'evidence': 'cross_validated', 'sources': []},
            {'meaning': 'b', 'cefr': 'B1', 'sources': []}]}
        self.assertIn('sense cross-validation has unverified scope', audit.entry_issues(entry, {}))

    def test_single_retained_homograph_still_requires_mapping_review(self):
        entry = {'id': 'x', 'word': 'example', 'pos': 'n', 'meaning': 'a', 'senses': [
            {'meaning': 'a', 'cefr': 'A2', 'sources': [{'ref': 'editorial-curation-map',
                'locator': 'docs/sense-gloss-mappings.json: x'}]}]}
        self.assertIn('editorial gloss mapping requires independent verification', audit.entry_issues(entry, {}))

    def test_bad_reference_level_is_flagged(self):
        entry = {'id': 'x', 'word': 'ring', 'pos': 'n', 'meaning': 'a', 'senses': [
            {'meaning': 'a', 'cefr': 'A2', 'sources': [{'ref': 'oxford-3000-wordlist', 'locator': 'oxford-3000.en.tsv:42: ring'}]}]}
        rows = {('oxford-3000.en.tsv', 42): {'pos_levels': {'n': 'B1', 'v': 'A2'}, 'levels': ['A2', 'B1']}}
        self.assertIn('Oxford POS-specific level mismatch', audit.entry_issues(entry, rows))
