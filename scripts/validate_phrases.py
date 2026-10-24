#!/usr/bin/env python3
"""Validate data/phrases.json: schema, IDs, phrase uniqueness, tags and sources.

Independent of the build script: it re-reads the JSON and the source registry and
reports every problem instead of trusting that generation was correct.
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))

from phrase_bank import PHRASE_ID_RE, TYPES, TAG_NAMESPACES, TAG_RE, phrase_key  # noqa: E402
from vocab_sources import load_registry, validate_sources, word_key  # noqa: E402

DEFAULT_PATH = ROOT / "data" / "phrases.json"
VOCAB_PATH = ROOT / "data" / "vocabulary.json"


def validate(data: Any, vocabulary: Any = None, registry: dict[str, dict[str, Any]] | None = None) -> list[str]:
    registry = load_registry() if registry is None else registry
    errors: list[str] = []
    if not isinstance(data, list):
        return ["Document\nPhrase: (none)\nProblem: root value must be a JSON array"]
    if not data:
        return ["Document\nPhrase: (none)\nProblem: phrase bank must not be empty"]

    def problem(entry: Any, message: str) -> None:
        entry_id = entry.get("id", "(missing)") if isinstance(entry, dict) else "(malformed)"
        phrase = entry.get("phrase", "(missing)") if isinstance(entry, dict) else "(missing)"
        errors.append(f"Entry: {entry_id}\nPhrase: {phrase}\nProblem: {message}")

    ids: dict[str, int] = {}
    keys: dict[str, list[str]] = defaultdict(list)
    word_keys = {word_key(entry["word"]) for entry in (vocabulary or []) if isinstance(entry, dict) and isinstance(entry.get("word"), str)}

    for index, entry in enumerate(data, start=1):
        if not isinstance(entry, dict):
            problem(entry, "entry must be an object")
            continue
        entry_id = entry.get("id")
        if not isinstance(entry_id, str) or not PHRASE_ID_RE.fullmatch(entry_id):
            problem(entry, "id must look like P001")
        elif entry_id in ids:
            problem(entry, f"duplicate phrase id (also at index {ids[entry_id]})")
        else:
            ids[entry_id] = index

        phrase = entry.get("phrase")
        if not isinstance(phrase, str) or not phrase.strip():
            problem(entry, "missing or empty phrase")
        elif len(phrase.strip().split()) < 2:
            problem(entry, "phrase must contain at least two words; single words belong in the vocabulary table")
        elif len(phrase.strip()) > 120:
            problem(entry, "phrase is too long")
        else:
            keys[phrase_key(phrase)].append(entry_id if isinstance(entry_id, str) else f"#{index}")
            if word_key(phrase) in word_keys:
                problem(entry, "phrase duplicates a single-word vocabulary headword")

        if entry.get("type") not in TYPES:
            problem(entry, f"type must be one of {list(TYPES)}")
        for field in ("meaning", "pattern"):
            if not isinstance(entry.get(field), str) or not entry[field].strip():
                problem(entry, f"missing or empty {field}")
        if not isinstance(entry.get("usage"), str):
            problem(entry, "usage must be a string (use an empty string when unknown)")

        tags = entry.get("tags")
        if not isinstance(tags, list) or any(not isinstance(tag, str) or not tag.strip() for tag in tags):
            problem(entry, "tags must be an array of non-empty strings")
        else:
            for tag in tags:
                if not TAG_RE.fullmatch(tag):
                    problem(entry, f"tag {tag!r} is not a lowercase slug or namespaced tag")
                elif ":" in tag and tag.split(":", 1)[0] not in TAG_NAMESPACES:
                    problem(entry, f"tag {tag!r} uses an unknown namespace")

        for message in validate_sources(entry.get("sources"), registry):
            problem(entry, message)

    for key, entries in keys.items():
        if len(entries) > 1:
            errors.append(
                f"Entry: {', '.join(entries)}\nPhrase: {key}\n"
                "Problem: duplicate phrase (same after case, Unicode, punctuation and spacing folding)"
            )
    return errors


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Validate the Chuyen-Anh phrase bank")
    parser.add_argument("path", nargs="?", type=Path, default=DEFAULT_PATH)
    args = parser.parse_args(argv)
    print("Phrase bank validation")
    try:
        data = json.loads(args.path.read_text(encoding="utf-8"))
        vocabulary = json.loads(VOCAB_PATH.read_text(encoding="utf-8")) if VOCAB_PATH.exists() else []
    except FileNotFoundError:
        print(f"❌ Phrase file not found: {args.path}")
        return 1
    except json.JSONDecodeError as error:
        print(f"❌ invalid JSON at line {error.lineno}, column {error.colno}: {error.msg}")
        return 1
    except OSError as error:
        print(f"❌ Cannot read phrase data: {error}")
        return 1

    errors = validate(data, vocabulary)
    print(f"Total phrases: {len(data) if isinstance(data, list) else 0}")
    if errors:
        print(f"\n❌ Phrase validation failed ({len(errors)} problem(s))\n")
        for item in errors:
            print(item)
            print()
        return 1
    print("Duplicate IDs: 0")
    print("Duplicate phrases: 0")
    print("✅ Phrase validation passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
