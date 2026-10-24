#!/usr/bin/env python3
"""Shared provenance helpers for the vocabulary and phrase-bank tables.

The vocabulary table stores one `SOURCES` JSON array per row. Every element is
an object:

    {"ref": "<registry id>", "locator": "<where>", "supports": "<what it backs>"}

`ref` must exist in `docs/vocabulary-sources.json`. `locator` points at a file
and line (exam transcriptions in this repository), a dictionary headword, or a
phrase-entry path. `supports` states exactly what the source backs: an
occurrence in an exam text is *not* dictionary evidence for a meaning.

Nothing here infers a vocabulary fact. The exam index only records that a form
appears in a transcribed exam; the dictionary reference resolves to a stable
entry URL that a reader can open, and it is never claimed as fetched when the
offline build could not fetch it.
"""
from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path
from typing import Any, Iterable

ROOT = Path(__file__).resolve().parents[1]
REGISTRY_PATH = ROOT / "docs" / "vocabulary-sources.json"
EXAM_ROOT = ROOT / "De-chuyen-Anh-vao-10"
YEAR_DIR_RE = re.compile(r"^20\d\d$")
FRONT_MATTER_RE = re.compile(r"\A---\n.*?\n---\n", re.DOTALL)
TOKEN_RE = re.compile(r"[A-Za-z][A-Za-z'’-]*")

# The runtime's word key (mirrors normalize() in index.html and
# validate_vocab.normalize_word): NFD, combining marks removed, đ→d, casefolded,
# whitespace collapsed. Used for collision detection only, never for display.
_MARKS = re.compile(r"[\u0300-\u036f]")


def word_key(value: str) -> str:
    decomposed = unicodedata.normalize("NFD", value)
    decomposed = _MARKS.sub("", decomposed).replace("đ", "d").replace("Đ", "D")
    return " ".join(decomposed.lower().split())


def load_registry(path: Path = REGISTRY_PATH) -> dict[str, dict[str, Any]]:
    """Return the source registry keyed by `id`."""
    data = json.loads(path.read_text(encoding="utf-8"))
    sources = data["sources"] if isinstance(data, dict) else data
    registry: dict[str, dict[str, Any]] = {}
    for item in sources:
        if not isinstance(item, dict) or not isinstance(item.get("id"), str):
            raise ValueError(f"source registry item without a string id: {item!r}")
        if item["id"] in registry:
            raise ValueError(f"duplicate source registry id {item['id']!r}")
        registry[item["id"]] = item
    return registry


def exam_files(root: Path = EXAM_ROOT) -> list[Path]:
    """Transcribed exams only: `<root>/<year>/....md`, never the archive's own docs."""
    files: list[Path] = []
    for path in sorted(root.rglob("*.md")):
        relative = path.relative_to(root).parts
        if len(relative) >= 2 and YEAR_DIR_RE.match(relative[0]):
            files.append(path)
    return files


def build_exam_index(root: Path = EXAM_ROOT) -> dict[str, dict[str, Any]]:
    """Map a lowercase token to its first transcription hit and document count.

    Front matter (source metadata) is removed so a token that only appears in
    the provenance block is not counted as exam text. Hyphen/apostrophe variants
    are indexed separately: no aggressive folding is used for evidence.
    """
    index: dict[str, dict[str, Any]] = {}
    for path in exam_files(root):
        text = FRONT_MATTER_RE.sub("", path.read_text(encoding="utf-8", errors="replace"))
        relative = path.relative_to(root).as_posix()
        for number, line in enumerate(text.splitlines(), start=1):
            for match in TOKEN_RE.finditer(line):
                token = match.group(0).lower().strip("'-")
                if len(token) < 3:
                    continue
                record = index.get(token)
                if record is None:
                    index[token] = {
                        "locator": f"{relative}:L{number}",
                        "documents": {relative},
                        "count": 1,
                    }
                else:
                    record["count"] += 1
                    record["documents"].add(relative)
    return index


def exam_locator(index: dict[str, dict[str, Any]], word: str) -> dict[str, Any] | None:
    """Return the evidence record for one headword, if the corpus shows it.

    Multi-word headwords are looked up as their first content word only when
    every word of the headword appears in the same transcription; the locator of
    the rarest component is returned.
    """
    parts = [part for part in re.split(r"[\s/]+", word.strip().lower()) if part]
    if not parts:
        return None
    hits = [index.get(re.sub(r"[^A-Za-z'’-]", "", part)) for part in parts]
    if any(hit is None for hit in hits):
        return None
    words = [re.sub(r"[^A-Za-z'’-]", "", part) for part in parts]
    best = min(hits, key=lambda hit: hit["count"])
    shared = set.intersection(*(hit["documents"] for hit in hits))
    if len(words) == 1:
        return {"locator": best["locator"], "documents": len(best["documents"])}
    if not shared:
        return None
    return {"locator": best["locator"], "documents": len(shared)}


def dictionary_source(word: str, slug: str | None = None) -> dict[str, str]:
    """Cambridge Dictionary entry reference for one headword.

    This is a locator, not a claim that the page was fetched: the offline build
    cannot reach dictionary.cambridge.org, so the `supports` text names only what
    the entry itself is expected to back (headword spelling and part of speech).
    """
    entry = slug or word.strip().lower()
    return {
        "ref": "cambridge",
        "locator": f"entry:{entry}",
        "supports": "headword spelling and part of speech",
        "url": f"https://dictionary.cambridge.org/dictionary/english/{entry.replace(' ', '-')}",
    }


def origin_source(note: str) -> dict[str, str]:
    return {"ref": "learner-list", "supports": note}


def exam_source(locator: str, documents: int) -> dict[str, str]:
    return {
        "ref": "exam-corpus",
        "locator": locator,
        "supports": f"form occurs in {documents} transcribed exam(s)",
    }


def dedupe_sources(sources: Iterable[dict[str, str]]) -> list[dict[str, str]]:
    """Keep the first source per (ref, locator), preserving order."""
    seen: set[tuple[str, str]] = set()
    result: list[dict[str, str]] = []
    for source in sources:
        key = (source["ref"], source.get("locator", ""))
        if key in seen:
            continue
        seen.add(key)
        result.append(source)
    return result


def validate_sources(sources: Any, registry: dict[str, dict[str, Any]]) -> list[str]:
    """Return human-readable problems with one row's SOURCES value."""
    problems: list[str] = []
    if not isinstance(sources, list) or not sources:
        return ["SOURCES must be a non-empty array"]
    for position, source in enumerate(sources, start=1):
        if not isinstance(source, dict):
            problems.append(f"SOURCES[{position}] must be an object")
            continue
        ref = source.get("ref")
        if not isinstance(ref, str) or not ref.strip():
            problems.append(f"SOURCES[{position}] has no ref")
        elif ref not in registry:
            problems.append(f"SOURCES[{position}] ref {ref!r} is not in the source registry")
        if not isinstance(source.get("supports"), str) or not source["supports"].strip():
            problems.append(f"SOURCES[{position}] has no supports statement")
        if "url" in source and not str(source["url"]).startswith("https://"):
            problems.append(f"SOURCES[{position}].url must be an https URL")
    return problems
