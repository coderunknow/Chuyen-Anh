#!/usr/bin/env python3
"""Synchronise data/phrases.json into the standalone HTML phrase-data block.

The phrase block is inserted right after the vocabulary block on first run and
replaced in place afterwards, so the HTML stays reproducible from the two JSON
sources alone.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "index.html"
DATA_PATH = ROOT / "data" / "phrases.json"
BLOCK = re.compile(
    r'(<script\s+id="phrase-data"\s+type="application/json"\s*>)(.*?)(</script\s*>)',
    re.IGNORECASE | re.DOTALL,
)
ANCHOR = re.compile(
    r'(<script\s+id="vocabulary-data"\s+type="application/json"\s*>.*?</script\s*>)',
    re.IGNORECASE | re.DOTALL,
)


def replace_embedded_data(html: str, data: object) -> str:
    payload = json.dumps(data, ensure_ascii=False, indent=2).replace("<", "\\u003c")
    matches = list(BLOCK.finditer(html))
    if len(matches) > 1:
        raise ValueError(f"Expected at most one #phrase-data block; found {len(matches)}")
    if matches:
        match = matches[0]
        replacement = f"{match.group(1)}\n{payload}\n{match.group(3)}"
        return html[: match.start()] + replacement + html[match.end() :]
    anchors = list(ANCHOR.finditer(html))
    if len(anchors) != 1:
        raise ValueError(f"Expected exactly one #vocabulary-data anchor; found {len(anchors)}")
    anchor = anchors[0]
    block = f'\n  <script id="phrase-data" type="application/json">\n{payload}\n  </script>'
    return html[: anchor.end()] + block + html[anchor.end() :]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="fail if the HTML phrase block is stale")
    parser.add_argument("--html", type=Path, default=HTML_PATH)
    parser.add_argument("--json", type=Path, default=DATA_PATH)
    args = parser.parse_args()

    try:
        data = json.loads(args.json.read_text(encoding="utf-8"))
        original = args.html.read_text(encoding="utf-8")
        expected = replace_embedded_data(original, data)
    except (OSError, json.JSONDecodeError, ValueError) as error:
        print(f"Phrase embedding failed: {error}", file=sys.stderr)
        return 1

    if args.check:
        if original != expected:
            print("Embedded HTML phrase bank is out of sync; run python scripts/embed_phrases.py")
            return 1
        print(f"Standalone HTML embeds all {len(data)} phrase records.")
        return 0

    args.html.write_text(expected, encoding="utf-8")
    print(f"Embedded {len(data)} phrase records in {args.html.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
