#!/usr/bin/env python3
"""Recount selected word forms in local exam transcriptions, without stemming.

The explicit allowlists are editorial selections, not exhaustive word families.
Counts include instructions/options/keys/transcripts and are not sense-tagged.
No network, NLP packages or generated prefix variants are used.
"""
from __future__ import annotations

import argparse
from collections import defaultdict
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
FORMS = ROOT / 'docs/vocabulary-300-families.json'
OUTPUT = ROOT / 'docs/vocabulary-300-counts.json'
TOKEN = re.compile(r'(?<![\w-])[A-Za-z]+(?:-[A-Za-z]+)*(?![\w-])')


def tokens(text: str) -> set[str]:
    """Keep displayed English tokens; ignore HTML tags and Markdown link URLs."""
    text = re.sub(r'<[^>]*>', '', text)
    text = re.sub(r'\]\([^)]*\)', ']', text)
    return {m.group().casefold() for m in TOKEN.finditer(text)}


def recount(root: Path = ROOT) -> dict:
    spec = json.loads((root / FORMS.relative_to(ROOT)).read_text())
    corpus = spec['corpus']
    index: dict[str, set[str]] = defaultdict(set)
    paths = []
    for path in sorted(root.glob(corpus['glob'])):
        lines = path.read_text().splitlines()
        if corpus['section'] not in lines:
            continue
        start = lines.index(corpus['section']) + 1
        relative = path.relative_to(root).as_posix()
        paths.append(relative)
        for token in tokens('\n'.join(lines[start:])):
            index[token].add(relative)

    def count(entry: dict) -> dict:
        forms = entry['forms']
        files = sorted(set().union(*(index[form] for form in forms)))
        result = {'word': entry['word'], 'file_count': len(files), 'files': files,
                  'attested_forms': {form: len(index[form]) for form in forms if index[form]}}
        if 'id' in entry:
            result = {'id': entry['id'], **result}
        return result

    return {'corpus_file_count': len(paths), 'corpus_files': paths,
            'entries': [count(e) for e in spec['entries']],
            'reviewed_excluded': [count(e) for e in spec['reviewed_excluded']]}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='fail if saved counts are stale')
    args = parser.parse_args()
    content = json.dumps(recount(), ensure_ascii=False, indent=2) + '\n'
    if args.check:
        if not OUTPUT.exists() or OUTPUT.read_text() != content:
            print('Vocabulary counts are stale; run python scripts/audit_learned_vocab.py')
            return 1
        print('Vocabulary counts match the explicit allowlists and local corpus.')
    else:
        OUTPUT.write_text(content)
        print(f'Wrote {OUTPUT.relative_to(ROOT)}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
