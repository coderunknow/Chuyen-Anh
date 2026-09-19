#!/usr/bin/env python3
"""Extract text from public exam ZIP/DOCX files without writing archive paths to disk.

This stage produces review material only. It does not decide exam authenticity.
Limits prevent unbounded downloads/archive expansion. Audio/images stay at source.
"""
import hashlib
import io
import json
import re
import time
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

import fitz

from discover import OUT, download

NS = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
W = '{' + NS['w'] + '}'


def docx_markdown(data):
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        if sum(i.file_size for i in z.infolist()) > 80 * 1024 * 1024:
            raise ValueError('Expanded DOCX too large')
        root = ET.fromstring(z.read('word/document.xml'))
        styles, nums, counters = {}, {}, {}
        if 'word/numbering.xml' in z.namelist():
            nr = ET.fromstring(z.read('word/numbering.xml'))
            for node in nr.findall('w:abstractNum', NS):
                levels = {}
                for level in node.findall('w:lvl', NS):
                    def val(tag, default):
                        el = level.find('w:' + tag, NS)
                        return el.get(W + 'val', default) if el is not None else default
                    levels[level.get(W + 'ilvl')] = (val('lvlText', '%1.'), val('numFmt', 'decimal'), int(val('start', '1')))
                styles[node.get(W + 'abstractNumId')] = levels
            for node in nr.findall('w:num', NS):
                abstract = node.find('w:abstractNumId', NS)
                if abstract is not None:
                    nums[node.get(W + 'numId')] = styles.get(abstract.get(W + 'val'), {})
        images = 0
        def paragraph(p):
            nonlocal images
            chunks = []
            for r in p.iter(W + 'r'):
                content = []
                for el in r:
                    if el.tag == W + 't':
                        text = (el.text or '').replace('\\', '\\\\').replace('*', '\\*').replace('_', '\\_')
                        content.append(text)
                    elif el.tag == W + 'tab':
                        content.append('    ')
                    elif el.tag in (W + 'br', W + 'cr'):
                        content.append('<br>')
                    elif el.tag in (W + 'drawing', W + 'pict', W + 'object'):
                        images += 1
                        content.append(' [HÌNH/ĐỐI TƯỢNG TRONG BẢN GỐC — xem nguồn] ')
                text = ''.join(content)
                props = r.find('w:rPr', NS)
                if props is not None and text.strip():
                    u = props.find('w:u', NS)
                    if u is not None and u.get(W + 'val', 'single') != 'none':
                        text = '<u>' + text + '</u>'
                    b = props.find('w:b', NS)
                    if b is not None and b.get(W + 'val', '1') not in ('0', 'false'):
                        text = '**' + text + '**'
                    i = props.find('w:i', NS)
                    if i is not None and i.get(W + 'val', '1') not in ('0', 'false'):
                        text = '*' + text + '*'
                chunks.append(text)
            text = ''.join(chunks).strip()
            num = p.find('w:pPr/w:numPr', NS)
            if num is not None and text:
                nid = num.find('w:numId', NS)
                lvl = num.find('w:ilvl', NS)
                if nid is not None:
                    nid = nid.get(W + 'val')
                    lvl = lvl.get(W + 'val') if lvl is not None else '0'
                    template, fmt, start = nums.get(nid, {}).get(lvl, ('%1.', 'decimal', 1))
                    key = (nid, lvl)
                    counters[key] = counters.get(key, start - 1) + 1
                    number = counters[key]
                    if fmt == 'bullet':
                        prefix = '-'
                    else:
                        n = chr(96 + number) if fmt == 'lowerLetter' and number <= 26 else str(number)
                        prefix = re.sub(r'%\d', n, template)
                    text = prefix + ' ' + text
            return text
        def table(t):
            rows = []
            for row in t.findall('w:tr', NS):
                cells = []
                for cell in row.findall('w:tc', NS):
                    cells.append('<br>'.join(paragraph(p) for p in cell.findall('w:p', NS)).replace('|', '\\|'))
                rows.append(cells)
            width = max(map(len, rows), default=0)
            if not width:
                return ''
            lines = ['| ' + ' | '.join(row + [''] * (width - len(row))) + ' |' for row in rows]
            lines.insert(1, '| ' + ' | '.join(['---'] * width) + ' |')
            return '\n'.join(lines)
        parts = []
        for el in root.find('w:body', NS):
            if el.tag == W + 'p':
                parts.append(paragraph(el))
            elif el.tag == W + 'tbl':
                parts.append(table(el))
        return '\n\n'.join(p for p in parts if p) + '\n', images


def main():
    pages = json.loads((OUT / 'pages.json').read_text())
    out = Path('.source-review')
    results, seen = [], set()
    for page in pages:
        if not any(s in page['url'] for s in ['chuyen', 'springboard']):
            continue
        for link in page.get('links', []):
            url = link['url']
            if not re.search(r'\.(zip|docx)(?:$|[?#])', url, re.I) or url in seen:
                continue
            seen.add(url)
            if len(seen) > 120:
                break
            record = {'url': url, 'parent': page['url'], 'files': []}
            try:
                data, _ = download(url)
                record['sha256'] = hashlib.sha256(data).hexdigest()
                if re.search(r'\.docx(?:$|[?#])', url, re.I):
                    files = [(url.rsplit('/', 1)[-1], data)]
                else:
                    with zipfile.ZipFile(io.BytesIO(data)) as z:
                        infos = [i for i in z.infolist() if i.filename.lower().endswith(('.docx', '.pdf')) and not i.filename.startswith('__MACOSX')]
                        if len(infos) > 40 or sum(i.file_size for i in infos) > 80 * 1024 * 1024:
                            raise ValueError('Archive exceeds expansion limits')
                        files = [(i.filename, z.read(i)) for i in infos]
                for name, payload in files:
                    key = hashlib.sha256((url + '#' + name).encode()).hexdigest()[:20]
                    entry = {'name': name, 'file': key + '.md', 'sha256': hashlib.sha256(payload).hexdigest()}
                    if name.lower().endswith('.docx'):
                        text, images = docx_markdown(payload)
                        entry['images'] = images
                    else:
                        doc = fitz.open(stream=payload, filetype='pdf')
                        texts = [p.get_text(sort=True) for p in doc]
                        entry['page_characters'] = [len(t.strip()) for t in texts]
                        text = '\n\n'.join(f'## Trang {n}\n\n```text\n{t.strip()}\n```' for n, t in enumerate(texts, 1))
                    entry['characters'] = len(text)
                    (out / entry['file']).write_text('# CHƯA KIỂM DUYỆT — ' + name + '\n\n- URL: ' + url + '\n- SHA-256: ' + entry['sha256'] + '\n\n' + text)
                    record['files'].append(entry)
            except Exception as exc:
                record['error'] = str(exc)
            results.append(record)
            time.sleep(.5)
    (out / 'packages.json').write_text(json.dumps(results, ensure_ascii=False, indent=2))
    print('Packages:', len(results), 'extracted files:', sum(len(x['files']) for x in results))


if __name__ == '__main__':
    main()
