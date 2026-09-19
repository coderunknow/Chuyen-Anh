"""Offline checks: structure/provenance, not a claim that every exam answer is correct."""
import hashlib
import io
import json
import re
import unittest
import zipfile
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[2]
ARCHIVE = ROOT / 'De-chuyen-Anh-vao-10'


def metadata(path):
    text = path.read_text(encoding='utf-8')
    _, front, body = text.split('---\n', 2)
    meta = {line.split(': ', 1)[0]: json.loads(line.split(': ', 1)[1]) for line in front.strip().splitlines()}
    return meta, body


class ArchiveTests(unittest.TestCase):
    def test_selection_and_documents_match(self):
        plan = json.loads((ROOT / 'scripts/exams/selection.json').read_text())
        self.assertEqual(len(plan), len({r['key'] for r in plan}))
        expected = {ARCHIVE / (r['key'] + '.md') for r in plan}
        actual = set(ARCHIVE.glob('20*/*/*.md'))
        self.assertEqual(expected, actual)
        ids, hashes, years = set(), set(), set()
        for path in sorted(actual):
            with self.subTest(file=str(path)):
                meta, body = metadata(path)
                self.assertNotIn(meta['id'], ids)
                ids.add(meta['id'])
                years.add(meta['nam_thi'])
                self.assertIn(meta['nam_thi'], range(2022, 2027))
                self.assertEqual(meta['nam_hoc'], f"{meta['nam_thi']}-{meta['nam_thi']+1}")
                self.assertEqual(meta['xac_minh'], 'ban-dang-lai-co-tieu-de-ky-thi')
                self.assertTrue(meta['nguon_trang'].startswith('https://'))
                self.assertIn('2026-09-19', meta['ngay_truy_cap'])
                self.assertIn('chưa đối chiếu thủ công từng câu', body)
                self.assertIn('SHA-256 tệp nguồn', body)
                self.assertNotIn('CHƯA KIỂM DUYỆT', body)
                self.assertNotIn('Trần Hà Quyên', body)
                self.assertEqual(body.count('```') % 2, 0)
                self.assertNotRegex(body, r'<(?:script|iframe)\b')
                # The exact content section, excluding repository-added metadata/notes.
                sections = re.search(r'^## (?:Nội dung đề|Đề thi|Đáp án)', body, re.M)
                self.assertIsNotNone(sections)
                content = body[sections.start():]
                self.assertGreater(len(content), 5000)
                digest = hashlib.sha256(content.encode()).hexdigest()
                self.assertEqual(digest, meta['sha256_noi_dung'])
                self.assertNotIn(digest, hashes, 'Duplicate exam content')
                hashes.add(digest)
        self.assertEqual(years, set(range(2022, 2027)))

    def test_relative_links(self):
        for path in ARCHIVE.rglob('*.md'):
            for target in re.findall(r'\]\(([^\s)]+)', path.read_text()):
                if '://' in target or target.startswith(('#', 'mailto:', 'data:')):
                    continue
                target = unquote(target.split('#')[0])
                self.assertTrue((path.parent / target).exists(), f'{path}: {target}')

    def test_curated_metadata(self):
        plan = json.loads((ROOT / 'scripts/exams/selection.json').read_text())
        for record in plan:
            for asset in record['assets']:
                self.assertRegex(asset['sha256'], r'^[a-f0-9]{64}$')
                self.assertIn(asset['type'], ('pdf', 'docx', 'html'))
            self.assertTrue(record['note'])
            self.assertTrue(record['answers'])


class ConversionTests(unittest.TestCase):
    def test_docx_text_underline_and_table(self):
        from packages import docx_markdown
        xml = '''<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
        <w:p><w:r><w:rPr><w:u w:val="single"/></w:rPr><w:t>ship</w:t></w:r></w:p>
        <w:tbl><w:tr><w:tc><w:p><w:r><w:t>A | B</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
        </w:body></w:document>'''
        data = io.BytesIO()
        with zipfile.ZipFile(data, 'w') as z:
            z.writestr('word/document.xml', xml)
        text, images = docx_markdown(data.getvalue())
        self.assertIn('<u>ship</u>', text)
        self.assertIn('A \\| B', text)
        self.assertEqual(images, 0)

    def test_html_underline(self):
        from review_sources import Converter
        self.assertIn('<u>ch</u>', Converter().convert('<u>ch</u>air'))
        self.assertIn('<u>ea</u>', Converter().convert('<span style="text-decoration:underline">ea</span>t'))


if __name__ == '__main__':
    unittest.main()
