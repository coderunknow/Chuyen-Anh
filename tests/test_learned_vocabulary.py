"""Offline checks for the 300 source-backed additions; not a semantic validator."""
import json
from pathlib import Path
import re
import unittest
import unicodedata
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from audit_learned_vocab import recount, tokens

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
                self.assertIn(record[2], {'n', 'v', 'adj', 'adv', 'conj', 'n/v', 'v/n', 'adj/n', 'n/adj', 'adj/v'})
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

    def test_explicit_forms_and_counts(self):
        spec = json.loads((ROOT / 'docs/vocabulary-300-families.json').read_text())
        saved = json.loads((ROOT / 'docs/vocabulary-300-counts.json').read_text())
        evidence = json.loads((ROOT / 'docs/vocabulary-300-evidence.json').read_text())
        self.assertEqual(saved, recount())
        self.assertEqual(saved['corpus_file_count'], spec['corpus']['file_count'])
        self.assertEqual([(e['id'], e['word']) for e in spec['entries']],
                         [(e['id'], e['word']) for e in evidence])
        records = [line.split('|') for line in
                   (ROOT / 'Learned_Vocabulary_List.md').read_text().splitlines()
                   if re.match(r'^\d+\|', line)]
        heads = {normalized(r[1]) for r in records}
        for family, count, source in zip(spec['entries'], saved['entries'], evidence):
            with self.subTest(word=family['word']):
                self.assertEqual(family['forms'], sorted(set(family['forms'])))
                self.assertIn(normalized(family['word']), family['forms'])
                self.assertIn(source['form'].casefold(), family['forms'])
                self.assertIn(source['path'], count['files'])
                self.assertEqual(count['file_count'], len(count['files']))
                # Editorial allowlists must not count another headword as new.
                self.assertEqual(set(family['forms']) & heads, {normalized(family['word'])})
                for form in family['forms']:
                    self.assertRegex(form, r'^[a-z]+(?:-[a-z]+)*$')

    def test_exact_tokens_not_prefixes(self):
        self.assertEqual(tokens('<b>relatively</b> unrelated relation relationships'),
                         {'relatively', 'unrelated', 'relation', 'relationships'})
        self.assertNotIn('superior', tokens('superiority'))
        self.assertNotIn('renewable', tokens('non-renewable'))
        self.assertEqual(tokens('[shown](https://example.com/hidden) <i>SHOWN</i>'), {'shown'})

    def test_known_family_regressions(self):
        spec = json.loads((ROOT / 'docs/vocabulary-300-families.json').read_text())
        forms = {e['word']: set(e['forms']) for e in spec['entries']}
        self.assertNotIn('Consequently', forms)
        self.assertIn('consequently', forms['Consequence'])
        self.assertNotIn('Biodiversity', forms)
        self.assertIn('biodiversity', forms['Diverse'])
        self.assertNotIn('superlative', forms['Superior'])
        self.assertNotIn('objection', forms['Objective'])
        self.assertNotIn('long-lived', forms['Longevity'])
        records = {r[1]: r[3] for r in
                   (line.split('|') for line in
                    (ROOT / 'Learned_Vocabulary_List.md').read_text().splitlines()
                    if re.match(r'^\d+\|', line))}
        family_text = lambda word: records[word].split('**Họ từ:**')[1].split('**Phân biệt:**')[0]
        self.assertNotIn('superlative', family_text('Superior'))
        self.assertNotIn('objection', family_text('Objective'))
        for word in ('Cease', 'Refine', 'Frustrate'):
            self.assertIn('**Nguồn:**', records[word])


if __name__ == '__main__':
    unittest.main()
