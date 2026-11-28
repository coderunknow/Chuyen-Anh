#!/usr/bin/env python3
"""Re-created reproduction helper (round-8): the session-local one-off whose
behavior is described in browser-session-method.md step 2. Emits the
de-duplicated list of file-asset URLs (assets[].url ending .pdf/.zip) from
scripts/exams/selection.json, with per-URL record counts — the input the
browser digest helpers fetch.

Usage: python3 extract_asset_list.py [--json]
This file is a faithful re-creation written from the documented behavior
(NOT the original session code, which was never committed)."""
import json, collections, pathlib, sys

REPO = pathlib.Path(__file__).resolve().parents[6]
selection = json.loads((REPO / 'scripts' / 'exams' / 'selection.json').read_text(encoding='utf-8'))

def url_ext(url: str) -> str:
    tail = url.split('?')[0].rsplit('/', 1)[-1]
    return tail.rsplit('.', 1)[1].lower() if '.' in tail else ''

assets = [(str(a.get('type', '')), str(a.get('url', '')))
          for r in selection for a in (r.get('assets') or [])]
file_recs = [(t, u) for t, u in assets if url_ext(u) in ('pdf', 'zip')]
per_url = collections.Counter(u for _, u in file_recs)
multi = sum(1 for c in per_url.values() if c >= 2)

result = {
    'filter': "assets[].url ends in .pdf or .zip (URL extension, not type)",
    'assetRecordsTotal': len(assets),
    'fileAssetRecords': len(file_recs),
    'uniqueUrls': len(per_url),
    'urlsCarryingTwoOrMoreRecords': multi,
    'typeFilterContrast': {
        'pdfOrDocxTypedRecords': sum(1 for t, _ in assets if t in ('pdf', 'docx')),
        'uniqueUrlsByType': len({u for t, u in assets if t in ('pdf', 'docx')}),
    },
    'urls': sorted(per_url),
}
if '--json' in sys.argv:
    print(json.dumps(result, indent=1))
else:
    print(f"file-asset records: {len(file_recs)}  unique URLs: {len(per_url)}  URLs with >=2 records: {multi}")
