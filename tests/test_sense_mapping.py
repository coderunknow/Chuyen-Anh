"""Source rows must have explicit reviewed gloss mappings, never positional guesses."""
import sys
from pathlib import Path
import unittest
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from cefr_senses import References, classify_entry

class SenseMappingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls): cls.refs = References()

    def test_lie_and_rock_preserve_gloss_scope(self):
        cases = [
            ({'id':'8576','word':'lie','pos':'v','meaning':'nói dối, nằm'}, {'A1':'nằm','B1':'nói dối'}),
            ({'id':'8677','word':'rock','pos':'n','meaning':'đá; thể loại nhạc phương Tây'}, {'(music)':'thể loại nhạc phương Tây','(stone)':'đá'}),
        ]
        for entry, expected in cases:
            senses = classify_entry(entry, self.refs)
            actual = {s['cefr'] if entry['word'] == 'lie' else s['label']: s['meaning'] for s in senses}
            self.assertEqual(actual, expected)
            self.assertTrue(all(s['needsIndependentValidation'] for s in senses))

    def test_row_order_does_not_decide_meaning(self):
        entry = {'id':'8677','word':'rock','pos':'n','meaning':'đá; thể loại nhạc phương Tây'}
        original = self.refs.oxford['rock']
        try:
            first = {s['label']: s['meaning'] for s in classify_entry(entry, self.refs)}
            self.refs.oxford['rock'] = list(reversed(original))
            second = {s['label']: s['meaning'] for s in classify_entry(entry, self.refs)}
            self.assertEqual(first, second)
        finally:
            self.refs.oxford['rock'] = original

    def test_stale_or_missing_mapping_is_rejected_not_guessed(self):
        for entry in (
            {'id':'8677','word':'rock','pos':'n','meaning':'edited gloss'},
            {'id':'unreviewed','word':'rock','pos':'n','meaning':'đá; nhạc'},
        ):
            with self.subTest(entry=entry), self.assertRaisesRegex(ValueError, 'mapping'):
                classify_entry(entry, self.refs)

    def test_only_glossed_homographs_are_emitted(self):
        for entry, label in [
            ({'id':'1902','word':'rest','pos':'n','meaning':'sự nghỉ ngơi'}, '(sleep/relax)'),
            ({'id':'3839','word':'ring','pos':'n','meaning':'nhẫn'}, 'sense 1'),
            ({'id':'8780','word':'tear','pos':'n','meaning':'nước mắt'}, 'sense 2'),
            ({'id':'8816','word':'used','pos':'adj','meaning':'đã từng dùng, cũ'}, 'sense 2'),
        ]:
            senses = classify_entry(entry, self.refs)
            self.assertEqual(len(senses), 1)
            self.assertEqual(senses[0]['label'], label)
            self.assertEqual(senses[0]['meaning'], entry['meaning'])
