"""A reference for a different part of speech must not validate a sense."""
import sys
from pathlib import Path
import unittest
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from cefr_senses import References, classify_entry

class PosScopeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls): cls.refs = References()

    def test_only_different_pos_is_explicitly_an_estimate(self):
        entry = {'id':'x', 'word':'Ravage', 'pos':'v', 'meaning':'tàn phá'}
        sense = classify_entry(entry, self.refs)[0]
        self.assertEqual(sense['evidence'], 'editorial_estimate')
        self.assertEqual(sense['confidence'], 'LOW')
        self.assertTrue(sense['needsIndependentValidation'])
        self.assertIn('different POS', sense['rationale'])

    def test_exact_reference_is_not_cross_validated_by_wrong_pos(self):
        entry = {'id':'x', 'word':'editorial', 'pos':'n', 'meaning':'bài xã luận'}
        sense = classify_entry(entry, self.refs)[0]
        self.assertNotEqual(sense['evidence'], 'cross_validated')
        self.assertTrue(all('oxford-5000' not in s['ref'] for s in sense['sources']))

if __name__ == '__main__': unittest.main()
