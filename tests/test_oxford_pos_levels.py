"""Oxford POS-tagged levels are distinct from a row's combined level list."""
import sys
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from cefr_senses import References, _oxford_pos_levels, classify_entry

class OxfordPosLevelTests(unittest.TestCase):
    def test_levels_parse_after_normalization(self):
        self.assertEqual(_oxford_pos_levels('v. A2, n. B1'), {'v': 'A2', 'n': 'B1'})
        self.assertEqual(_oxford_pos_levels('adj. C1, adv. B2'), {'adj': 'C1', 'adv': 'B2'})
        self.assertEqual(_oxford_pos_levels('v., n.'), {})

    def test_vote_locator_points_to_the_row_that_supplied_selected_level(self):
        refs = References.__new__(References)
        refs.cefrj, refs.octanove = {}, {}
        refs.oxford = {'example': [
            {'pos': 'n', 'pos_levels': {}, 'levels': ['B2'], 'line': 9,
             'file': 'earlier', 'source': 'oxford3000', 'raw_level': 'B2'},
            {'pos': 'n', 'pos_levels': {}, 'levels': ['A1'], 'line': 10,
             'file': 'later', 'source': 'oxford3000', 'raw_level': 'A1'},
        ]}
        vote = refs.votes_for('example', 'n')['oxford']
        self.assertEqual((vote['level'], vote['file'], vote['line']), ('A1', 'later', 10))
        self.assertEqual(vote['raw_level'], 'A1')

    def test_headword_agreement_does_not_validate_an_individual_sense(self):
        refs = References()
        entry = {'id': '7900', 'word': 'bank', 'pos': 'n', 'meaning': 'ngân hàng; bờ sông'}
        for sense in classify_entry(entry, refs):
            self.assertNotEqual(sense['evidence'], 'cross_validated')
            self.assertTrue(sense['needsIndependentValidation'])
            self.assertIn('mapping', sense['rationale'])

    def test_multi_sense_uses_level_for_matching_pos_not_row_minimum(self):
        refs = References()
        entry = {'id': '7900', 'word': 'bank', 'pos': 'n', 'meaning': 'ngân hàng; bờ sông'}
        first = refs.oxford['bank'][0]
        first['pos_levels'] = {'n': 'B2', 'v': 'A1'}
        first['levels'] = ['A1', 'B2']
        senses = classify_entry(entry, refs)
        self.assertEqual(senses[0]['cefr'], 'B2')
        self.assertIn('n. B2', senses[0]['rationale'])

if __name__ == '__main__':
    unittest.main()
