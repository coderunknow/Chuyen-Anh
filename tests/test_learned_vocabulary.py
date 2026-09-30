"""Offline checks for the 300 source-backed additions; not a semantic validator."""
import json
from pathlib import Path
import re
import unittest
import unicodedata

ROOT = Path(__file__).resolve().parents[1]


def normalized(word):
    return ' '.join(unicodedata.normalize('NFKC', word).casefold().split())


class LearnedVocabularyTests(unittest.TestCase):
    def test_additions_and_sources(self):
        records = [line.split('|') for line in
                   (ROOT / 'Learned_Vocabulary_List.md').read_text().splitlines()
                   if re.match(r'^\d+\|', line)]
        self.assertEqual([int(r[0]) for r in records], list(range(1, 914)))
        words = [normalized(r[1]) for r in records]
        self.assertEqual(len(words), len(set(words)), 'Duplicate headwords')
        evidence = json.loads((ROOT / 'docs/vocabulary-300-evidence.json').read_text())
        self.assertEqual([r['id'] for r in evidence], list(range(614, 914)))
        for record, source in zip(records[613:], evidence):
            with self.subTest(word=source['word']):
                self.assertEqual(len(record), 4)
                self.assertEqual(record[1], source['word'])
                self.assertIn(record[2], {'n', 'v', 'adj', 'adv', 'n/v', 'v/n', 'adj/n', 'n/adj', 'adj/v'})
                for label in ['**Họ từ:**', '**Phân biệt:**', '**Nguồn:**']:
                    self.assertIn(label, record[3])
                path = ROOT / source['path']
                self.assertTrue(path.resolve().is_relative_to(ROOT / 'De-chuyen-Anh-vao-10'))
                text = path.read_text()
                line = text.splitlines()[source['line'] - 1]
                self.assertIn(source['excerpt'], line)
                self.assertRegex(source['excerpt'], r'(?i)\b' + re.escape(source['form']) + r'\b')
                self.assertIn(source['path'] + '#L' + str(source['line']), record[3])
                self.assertIn('## Đề thi và phần kèm theo trong nguồn', '\n'.join(text.splitlines()[:source['line']]))


if __name__ == '__main__':
    unittest.main()
