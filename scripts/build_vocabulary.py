#!/usr/bin/env python3
"""Build the app vocabulary JSON from the structured Markdown source.

App-only metadata already present for an ID (examples, difficulty, createdAt,
and other unmodelled fields) is retained. Missing new metadata is left empty or
omitted; this script does not infer vocabulary facts.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_JSON = ROOT / "data" / "vocabulary.json"
sys.path.insert(0, str(Path(__file__).resolve().parent))
from learned_vocabulary import parse_table  # noqa: E402


def build_vocabulary(records: list[dict[str, Any]], existing: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_id: dict[str, dict[str, Any]] = {}
    for entry in existing:
        if not isinstance(entry, dict) or not isinstance(entry.get("id"), str):
            raise ValueError("Existing vocabulary JSON contains an entry without a string id")
        if entry["id"] in by_id:
            raise ValueError(f"Existing vocabulary JSON contains duplicate id {entry['id']!r}")
        by_id[entry["id"]] = entry

    result: list[dict[str, Any]] = []
    for record in records:
        entry = dict(by_id.get(record["id"], {}))
        entry.update({
            "id": record["id"],
            "word": record["word"],
            "pos": record["pos"],
            "meaning": record["meaning"],
            "examples": entry.get("examples", []),
            "tags": record["tags"],
            "wordFamily": record["wordFamily"],
            "synonyms": record["synonyms"],
            "antonyms": record["antonyms"],
            "collocations": record["collocations"],
            "register": record["register"],
            "connotation": record["connotation"],
            "notes": record["notes"],
        })
        result.append(entry)
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="fail if JSON is not synchronized with the Markdown table")
    parser.add_argument("--markdown", type=Path, default=ROOT / "Learned_Vocabulary_List.md")
    parser.add_argument("--json", type=Path, default=DEFAULT_JSON)
    args = parser.parse_args()

    try:
        records = parse_table(args.markdown)
        current = json.loads(args.json.read_text(encoding="utf-8"))
        if not isinstance(current, list):
            raise ValueError("Existing vocabulary JSON must be an array")
        expected = build_vocabulary(records, current)
        serialized = json.dumps(expected, ensure_ascii=False, indent=2) + "\n"
    except (OSError, json.JSONDecodeError, ValueError) as error:
        print(f"Vocabulary build failed: {error}", file=sys.stderr)
        return 1

    if args.check:
        if args.json.read_text(encoding="utf-8") != serialized:
            print("Vocabulary JSON is out of sync; run python scripts/build_vocabulary.py")
            return 1
        print(f"Vocabulary JSON matches {len(records)} Markdown records.")
        return 0

    args.json.write_text(serialized, encoding="utf-8")
    print(f"Wrote {len(records)} records to {args.json.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
