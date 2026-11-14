"""A teaching lexicon is never an answer key for a historical exam."""
import json
from pathlib import Path
import unittest
ROOT = Path(__file__).resolve().parents[1]

class NoTeachingBankAnswerTests(unittest.TestCase):
    def test_no_shipped_answer_is_generated_by_automatic_provisional_inference(self):
        data = json.loads((ROOT / 'data/exam-answer-keys.json').read_text(encoding='utf-8'))
        offenders = [(paper['id'], key['questionId']) for paper in data['records']
                     for key in paper['answerKeys']
                     if any(source.get('kind') == 'provisional-inference' for source in key.get('sources', []))]
        self.assertEqual(offenders, [], f'{len(offenders)} automatically inferred answers must remain ungraded')

if __name__ == '__main__': unittest.main()
