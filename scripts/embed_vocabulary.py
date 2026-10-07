#!/usr/bin/env python3
"""Synchronize data/vocabulary.json into the standalone HTML data block."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "index.html"
DATA_PATH = ROOT / "data" / "vocabulary.json"
BLOCK = re.compile(
    r'(<script\s+id="vocabulary-data"\s+type="application/json"\s*>)(.*?)(</script\s*>)',
    re.IGNORECASE | re.DOTALL,
)


def replace_embedded_data(html: str, data: object) -> str:
    matches = list(BLOCK.finditer(html))
    if len(matches) != 1:
        raise ValueError(f"Expected exactly one #vocabulary-data block; found {len(matches)}")
    payload = json.dumps(data, ensure_ascii=False, indent=2).replace("<", "\\u003c")
    match = matches[0]
    replacement = f"{match.group(1)}\n{payload}\n{match.group(3)}"
    return html[: match.start()] + replacement + html[match.end() :]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="fail if the HTML data block is stale")
    parser.add_argument("--html", type=Path, default=HTML_PATH)
    parser.add_argument("--json", type=Path, default=DATA_PATH)
    args = parser.parse_args()

    try:
        data = json.loads(args.json.read_text(encoding="utf-8"))
        original = args.html.read_text(encoding="utf-8")
        expected = replace_embedded_data(original, data)
    except (OSError, json.JSONDecodeError, ValueError) as error:
        print(f"HTML embedding failed: {error}", file=sys.stderr)
        return 1

    if args.check:
        if original != expected:
            print("Embedded HTML vocabulary is out of sync; run python scripts/embed_vocabulary.py")
            return 1
        print(f"Standalone HTML embeds all {len(data)} vocabulary records.")
        return 0

    args.html.write_text(expected, encoding="utf-8")
    print(f"Embedded {len(data)} vocabulary records in {args.html.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
