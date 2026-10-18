#!/usr/bin/env python3
"""Embed the reviewed exam-archive transcriptions in the standalone HTML.

This is a deterministic packaging step only: it preserves each transcription body
and the selected-source manifest metadata, and does not parse questions or verify answers.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ARCHIVE = ROOT / 'De-chuyen-Anh-vao-10'
PLAN = ROOT / 'scripts/exams/selection.json'
HTML = ROOT / 'index.html'
MARKER = re.compile(
    r'(<script id="exam-data" type="application/json">)([\s\S]*?)(</script>)',
    re.IGNORECASE,
)


def transcription_body(path):
    text = path.read_text(encoding='utf-8')
    match = re.match(r'\A---\n[\s\S]*?\n---\n([\s\S]*)\Z', text)
    if not match:
        raise ValueError(f'Missing YAML front matter: {path.relative_to(ROOT)}')
    body = match.group(1)
    if len(body) < 5000:
        raise ValueError(f'Transcription is unexpectedly short: {path.relative_to(ROOT)}')
    return body


def build_payload():
    plan = json.loads(PLAN.read_text(encoding='utf-8'))
    keys = [record.get('key') for record in plan]
    if len(plan) != 106 or len(set(keys)) != len(keys):
        raise ValueError(f'Expected 106 unique selected records; got {len(plan)}')

    expected_paths = {ARCHIVE / f'{key}.md' for key in keys}
    actual_paths = set(ARCHIVE.glob('20*/*/*.md'))
    if expected_paths != actual_paths:
        missing = sorted(str(path.relative_to(ROOT)) for path in expected_paths - actual_paths)
        extra = sorted(str(path.relative_to(ROOT)) for path in actual_paths - expected_paths)
        raise ValueError(f'Archive/manifest mismatch; missing={missing}, extra={extra}')

    payload = []
    seen_ids = set()
    for record in plan:
        key = record['key']
        if not re.fullmatch(r'20\d\d/[a-z0-9-]+/[a-z0-9-]+', key):
            raise ValueError(f'Unsafe or malformed archive key: {key!r}')
        if record['year'] not in range(2022, 2027):
            raise ValueError(f'Unexpected exam year for {key}: {record["year"]!r}')
        if not record.get('province') or not record.get('unit_label') or not record.get('note'):
            raise ValueError(f'Incomplete archive metadata: {key}')
        source = record.get('source', '')
        if not source.startswith('https://'):
            raise ValueError(f'Expected an HTTPS provenance URL for {key}')

        body = transcription_body(ARCHIVE / f'{key}.md')
        entry_id = key.replace('/', '-')
        if entry_id in seen_ids:
            raise ValueError(f'Duplicate archive id: {entry_id}')
        seen_ids.add(entry_id)
        assets = []
        for asset in record.get('assets', []):
            if asset.get('type') not in {'pdf', 'docx', 'html'}:
                raise ValueError(f'Unsupported source type in {key}: {asset.get("type")!r}')
            assets.append({
                name: asset[name]
                for name in ('type', 'url', 'sha256', 'pages', 'label', 'original')
                if name in asset
            })
        if not assets:
            raise ValueError(f'Missing source-asset metadata: {key}')

        payload.append({
            'id': key,
            'year': record['year'],
            'province': record['province'],
            'unit': record['unit'],
            'unitLabel': record['unit_label'],
            'source': source,
            'assets': assets,
            'quality': record['quality'],
            'answers': record['answers'],
            'note': record['note'],
            'contentSha256': hashlib.sha256(body.encode('utf-8')).hexdigest(),
            'markdown': body,
        })
    return payload


def serialize_payload(payload):
    # A script element is parsed as raw text even when its type is application/json;
    # escape a slash-closing sequence so source text cannot terminate the data block.
    raw = json.dumps(payload, ensure_ascii=False, separators=(',', ':'))
    raw = raw.replace('</', '<\\/')
    return raw


def update_html(check=False):
    source = HTML.read_text(encoding='utf-8')
    matches = list(MARKER.finditer(source))
    if len(matches) != 1:
        raise ValueError(f'Expected exactly one exam-data script block; found {len(matches)}')
    payload = build_payload()
    serialized = serialize_payload(payload)
    match = matches[0]
    current = match.group(2).strip()
    if check:
        if current != serialized:
            raise SystemExit('Standalone HTML exam archive is out of sync; run python scripts/exams/embed_archive.py')
        print(f'Standalone HTML embeds {len(payload)} exam transcriptions ({sum(len(r["markdown"].encode("utf-8")) for r in payload):,} text bytes).')
        return

    updated = source[:match.start(2)] + '\n' + serialized + '\n' + source[match.end(2):]
    HTML.write_text(updated, encoding='utf-8')
    size = HTML.stat().st_size
    text_bytes = sum(len(record['markdown'].encode('utf-8')) for record in payload)
    print(f'Embedded {len(payload)} exam transcriptions ({text_bytes:,} text bytes); standalone HTML is {size:,} bytes.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='verify the HTML block without writing it')
    args = parser.parse_args()
    update_html(check=args.check)


if __name__ == '__main__':
    main()
