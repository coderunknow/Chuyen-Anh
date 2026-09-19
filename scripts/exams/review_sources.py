#!/usr/bin/env python3
"""Create explicitly UNREVIEWED Markdown transcriptions of downloaded public sources."""
import json
import re
from pathlib import Path

import fitz
from bs4 import BeautifulSoup
from markdownify import MarkdownConverter


class Converter(MarkdownConverter):
    def convert_u(self, el, text, parent_tags):
        return '<u>' + text + '</u>'

    def convert_span(self, el, text, parent_tags):
        if 'underline' in el.get('style', ''):
            return '<u>' + text + '</u>'
        return text


def main():
    root = Path('.cache/exams')
    out = Path('.source-review')
    out.mkdir(exist_ok=True)
    pages = json.loads((root / 'pages.json').read_text())
    pdfs = json.loads((root / 'pdfs.json').read_text())
    converter = Converter(heading_style='ATX', bullets='-', escape_underscores=True)
    for page in pages:
        if 'file' not in page:
            continue
        soup = BeautifulSoup((root / page['file']).read_bytes(), 'html.parser')
        body = (soup.select_one('.elementor-widget-theme-post-content')
                or soup.select_one('.entry-content') or soup.select_one('article') or soup)
        for el in body.select('script, style, nav, form, .sharedaddy, .related-posts, .toc, #ez-toc-container'):
            el.decompose()
        text = converter.convert(str(body))
        text = re.sub(r'\n{3,}', '\n\n', text)
        key = Path(page['file']).stem
        front = ('# CHƯA KIỂM DUYỆT — ' + page['title'] + '\n\n'
                 + '- URL: ' + page['url'] + '\n'
                 + '- SHA-256 HTML: ' + page['sha256'] + '\n'
                 + '- Ngày truy cập: 2026-09-19\n\n')
        (out / (key + '.md')).write_text(front + text + '\n')
    for pdf in pdfs:
        if 'file' not in pdf:
            continue
        doc = fitz.open(root / pdf['file'])
        text = '# CHƯA KIỂM DUYỆT — PDF\n\n- URL: ' + pdf['url'] + '\n'
        text += '- SHA-256 PDF: ' + pdf['sha256'] + '\n'
        text += '- Số trang PDF: ' + str(len(doc)) + '\n\n'
        lengths = []
        for i, page in enumerate(doc):
            page_text = page.get_text(sort=True)
            lengths.append(len(page_text.strip()))
            text += f'## Trang {i + 1}\n\n```text\n{page_text.strip()}\n```\n\n'
        pdf['page_characters'] = lengths
        (out / (Path(pdf['file']).stem + '.md')).write_text(text)
    (out / 'pages.json').write_text(json.dumps(pages, ensure_ascii=False, indent=2))
    (out / 'pdfs.json').write_text(json.dumps(pdfs, ensure_ascii=False, indent=2))
    (out / 'discovery.json').write_bytes((root / 'discovery.json').read_bytes())
    print('UNREVIEWED source files:', len(list(out.glob('*.md'))))


if __name__ == '__main__':
    main()
