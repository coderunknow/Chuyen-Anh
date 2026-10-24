#!/usr/bin/env python3
"""Small, dependency-free validator for data/vocabulary.json.

This is intentionally independent from Node/npm so CI and deployment can check
the app data before verifying its embedded copy in the standalone HTML.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PATH = ROOT / "data" / "vocabulary.json"
REGISTRY_PATH = ROOT / "docs" / "vocabulary-sources.json"
ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
COMBINING_MARKS_RE = re.compile(r"[\u0300-\u036f]")
TAG_NAMESPACES = {"level", "level-source", "topic", "type", "skill", "source"}
TAG_RE = re.compile(r"^[a-z][a-z-]*(?::[A-Za-z0-9][A-Za-z0-9-]*)?$")
SOURCE_KEYS = {"ref", "supports", "locator", "url"}


def normalize_word(value: str) -> str:
    """Return the runtime's accent-, case- and whitespace-insensitive word key.

    Mirrors `normalize()` in index.html so the validator reports the same
    headword collisions the app itself would reject at load time.
    """
    decomposed = unicodedata.normalize("NFD", value)
    decomposed = COMBINING_MARKS_RE.sub("", decomposed).replace("đ", "d").replace("Đ", "d")
    return " ".join(decomposed.lower().split())


def load_source_registry(path: Path = REGISTRY_PATH) -> set[str]:
    """Return the set of known provenance source ids (empty when unreadable)."""
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        sources = data["sources"] if isinstance(data, dict) else data
        return {item["id"] for item in sources if isinstance(item, dict) and isinstance(item.get("id"), str)}
    except (OSError, json.JSONDecodeError, KeyError, TypeError):
        return set()


def lexical_key(value: str) -> str:
    """Collision key that also folds hyphens and edge punctuation.

    `well-being` and `wellbeing`, or `co-operate` and `cooperate`, are one
    vocabulary unit; the runtime key alone (word boundaries) would keep both.
    The fold stops at hyphens and punctuation: nothing else is rewritten, so
    unrelated words never collapse into each other.
    """
    text = normalize_word(value)
    text = re.sub(r"[\u2010-\u2015-]", " ", text)
    text = re.sub(r"[^a-z0-9 ]+", "", text)
    return " ".join(text.split())


def problem(errors: list[str], index: int, entry: Any, message: str) -> None:
    entry_id = entry.get("id", "(missing)") if isinstance(entry, dict) else "(malformed)"
    word = entry.get("word", "(missing)") if isinstance(entry, dict) else "(missing)"
    errors.append(
        f"Entry: {entry_id} (index {index})\n"
        f"Word: {word}\n"
        f"Problem: {message}"
    )


def validate(data: Any) -> list[str]:
    """Return human-readable validation errors. An empty list means valid."""
    errors: list[str] = []
    if not isinstance(data, list):
        return ["Document\nWord: (none)\nProblem: root value must be a JSON array"]
    if not data:
        return ["Document\nWord: (none)\nProblem: vocabulary must not be empty"]

    registry = load_source_registry()
    ids: dict[str, list[int]] = defaultdict(list)
    words: dict[str, list[int]] = defaultdict(list)
    lexical: dict[str, list[int]] = defaultdict(list)
    for index, entry in enumerate(data, start=1):
        if not isinstance(entry, dict):
            problem(errors, index, entry, "entry must be an object")
            continue

        entry_id = entry.get("id")
        word = entry.get("word")
        pos = entry.get("pos")
        meaning = entry.get("meaning")
        if not isinstance(entry_id, str) or not entry_id.strip():
            problem(errors, index, entry, "missing or empty id")
        elif not ID_RE.fullmatch(entry_id.strip()):
            problem(errors, index, entry, "id may only contain letters, numbers, dot, underscore, and hyphen")
        else:
            ids[entry_id.strip().casefold()].append(index)

        if not isinstance(word, str) or not word.strip():
            problem(errors, index, entry, "missing or empty word")
        elif len(word.strip()) > 120:
            problem(errors, index, entry, f"word is too long ({len(word.strip())} characters)")
        else:
            words[normalize_word(word.strip())].append(index)
            lexical[lexical_key(word.strip())].append(index)

        if not isinstance(pos, str) or not pos.strip():
            problem(errors, index, entry, "missing or empty pos")
        if not isinstance(meaning, str) or not meaning.strip():
            problem(errors, index, entry, "missing or empty meaning")
        elif re.search(r"\|[+-]{1,2}$", meaning.strip()):
            problem(errors, index, entry, "meaning contains an unconverted legacy difficulty marker")

        examples = entry.get("examples")
        if not isinstance(examples, list):
            problem(errors, index, entry, "examples must be an array")
        else:
            for example_index, example in enumerate(examples, start=1):
                if not isinstance(example, dict):
                    problem(errors, index, entry, f"examples[{example_index}] must be an object with en and vi")
                    continue
                if not isinstance(example.get("en"), str) or not example["en"].strip():
                    problem(errors, index, entry, f"examples[{example_index}].en must be a non-empty string")
                if not isinstance(example.get("vi"), str) or not example["vi"].strip():
                    problem(errors, index, entry, f"examples[{example_index}].vi must be a non-empty string")

        for field in ("wordFamily", "register", "connotation", "notes"):
            if not isinstance(entry.get(field), str):
                problem(errors, index, entry, f"{field} must be a string (use an empty string when unknown)")
        for field in ("synonyms", "antonyms", "collocations"):
            values = entry.get(field)
            if not isinstance(values, list) or any(not isinstance(value, str) or not value.strip() for value in values):
                problem(errors, index, entry, f"{field} must be an array of non-empty strings (use [] when unknown)")

        tags = entry.get("tags")
        if not isinstance(tags, list) or any(not isinstance(tag, str) or not tag.strip() for tag in tags):
            problem(errors, index, entry, "tags must be an array of non-empty strings")
        else:
            for tag in tags:
                if not TAG_RE.fullmatch(tag):
                    problem(errors, index, entry, f"tag {tag!r} must be a lowercase slug, optionally namespaced (e.g. topic:environment, level:B2)")
                elif ":" in tag and tag.split(":", 1)[0] not in TAG_NAMESPACES:
                    problem(errors, index, entry, f"tag {tag!r} uses an unknown namespace; expected one of {sorted(TAG_NAMESPACES)}")

        sources = entry.get("sources")
        if not isinstance(sources, list) or not sources:
            problem(errors, index, entry, "sources must be a non-empty array of source objects")
        else:
            for source_index, source in enumerate(sources, start=1):
                if not isinstance(source, dict):
                    problem(errors, index, entry, f"sources[{source_index}] must be an object")
                    continue
                unknown = set(source) - SOURCE_KEYS
                if unknown:
                    problem(errors, index, entry, f"sources[{source_index}] has unknown keys {sorted(unknown)}")
                ref = source.get("ref")
                if not isinstance(ref, str) or not ref.strip():
                    problem(errors, index, entry, f"sources[{source_index}] has no ref")
                elif registry and ref not in registry:
                    problem(errors, index, entry, f"sources[{source_index}] ref {ref!r} is not in docs/vocabulary-sources.json")
                if not isinstance(source.get("supports"), str) or not source["supports"].strip():
                    problem(errors, index, entry, f"sources[{source_index}] has no supports statement")
                if "url" in source and not str(source["url"]).startswith("https://"):
                    problem(errors, index, entry, f"sources[{source_index}].url must be an https URL")
        difficulty = entry.get("difficulty")
        if "difficulty" in entry and (isinstance(difficulty, bool) or not isinstance(difficulty, (int, float)) or not 0 <= difficulty <= 5):
            problem(errors, index, entry, "difficulty, when provided, must be a number from 0 to 5")

    for entry_id, indexes in ids.items():
        if len(indexes) > 1:
            errors.append(f"Entry: {', '.join(map(str, indexes))}\nWord: (duplicate id)\nProblem: duplicate id {entry_id!r}")
    for word, indexes in words.items():
        if len(indexes) > 1:
            errors.append(
                f"Entry: {', '.join(map(str, indexes))}\n"
                f"Word: {word}\n"
                f"Problem: duplicate word (same after the app's case, accent and whitespace normalization)"
            )
    for word, indexes in lexical.items():
        if len(indexes) > 1 and words.get(word, []) != indexes:
            errors.append(
                f"Entry: {', '.join(map(str, indexes))}\n"
                f"Word: {word}\n"
                f"Problem: duplicate headword once hyphens, edge punctuation and spacing are folded"
            )
    return errors


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Validate Chuyen-Anh vocabulary JSON")
    parser.add_argument("path", nargs="?", type=Path, default=DEFAULT_PATH)
    args = parser.parse_args(argv)
    print("Vocabulary validation")
    try:
        raw = args.path.read_text(encoding="utf-8")
        data = json.loads(raw)
    except FileNotFoundError:
        print(f"❌ Vocabulary file not found: {args.path}")
        return 1
    except json.JSONDecodeError as error:
        print("❌ Vocabulary validation failed")
        print(f"Problem: invalid JSON at line {error.lineno}, column {error.colno}: {error.msg}")
        return 1
    except OSError as error:
        print(f"❌ Cannot read vocabulary: {error}")
        return 1

    errors = validate(data)
    total = len(data) if isinstance(data, list) else 0
    print(f"Total entries: {total}")
    if errors:
        print(f"\n❌ Vocabulary validation failed ({len(errors)} problem(s))\n")
        for item in errors:
            print(item)
            print()
        return 1
    print("Duplicate IDs: 0")
    print("Duplicate words: 0")
    print("✅ Vocabulary validation passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
