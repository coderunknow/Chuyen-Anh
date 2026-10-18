import hashlib
import json
import re
import unittest
from pathlib import Path

from scripts.exams.embed_archive import ARCHIVE, HTML, MARKER, build_payload, serialize_payload

ROOT = Path(__file__).resolve().parents[1]


class ExamArchiveEmbedTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.payload = build_payload()
        cls.html = HTML.read_text(encoding='utf-8')
        matches = list(MARKER.finditer(cls.html))
        if len(matches) != 1:
            raise AssertionError(f'Expected one exam-data block, found {len(matches)}')
        cls.embedded = matches[0].group(2).strip()

    def test_standalone_block_matches_deterministic_archive_build(self):
        self.assertEqual(self.embedded, serialize_payload(self.payload))
        data = json.loads(self.embedded)
        self.assertEqual(len(data), 106)
        self.assertEqual(len({record['id'] for record in data}), 106)
        self.assertNotRegex(self.embedded, r'</script')
        self.assertGreater(sum(len(record['markdown'].encode('utf-8')) for record in data), 3_900_000)

    def test_each_embedded_body_matches_the_archive_without_front_matter_edits(self):
        for record in self.payload:
            with self.subTest(record=record['id']):
                text = (ARCHIVE / f"{record['id']}.md").read_text(encoding='utf-8')
                match = re.match(r'\A---\n[\s\S]*?\n---\n([\s\S]*)\Z', text)
                self.assertIsNotNone(match)
                body = match.group(1)
                self.assertEqual(record['markdown'], body)
                self.assertEqual(
                    record['contentSha256'],
                    hashlib.sha256(body.encode('utf-8')).hexdigest(),
                )
                self.assertEqual(record['source'].split('/')[2], 'tailieudieuky.com')
                self.assertTrue(record['assets'])
                self.assertTrue(all(re.fullmatch(r'[a-f0-9]{64}', asset['sha256']) for asset in record['assets']))

    def test_only_expected_manifest_metadata_is_embedded(self):
        plan = json.loads((ROOT / 'scripts/exams/selection.json').read_text(encoding='utf-8'))
        self.assertEqual([record['id'] for record in self.payload], [record['key'] for record in plan])
        self.assertEqual(sum('HTML/OCR' in record['quality'] for record in self.payload), 22)
        self.assertEqual(sum(record['answers'].startswith('Chưa') for record in self.payload), 32)
        self.assertTrue(all('score' not in record and 'answerKey' not in record for record in self.payload))


if __name__ == '__main__':
    unittest.main()
