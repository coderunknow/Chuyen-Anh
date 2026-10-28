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
URL_RE = re.compile(r"https?://\S+")
# The archive's own bookkeeping, not the exam: its source/limits section, its
# provenance blockquote and every URL. Counting these as exam text inflated
# claims such as `document` -> 106 papers (it is the archive's word, not the
# exam's); the audit in scripts/audit_vocabulary_quality.py measures the same
# body text, so a row's claim and the audit cannot drift apart.
ARCHIVE_NOTE_SECTION = "## Nguồn và giới hạn"
ARCHIVE_NOTE_QUOTES = ("> **Bản chép", "> **Nội dung", "> **Đáp án")
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


def _front_matter_end(lines: list[str]) -> int:
    """Index of the first body line after a leading YAML block, or 0."""
    if lines and lines[0].strip() == "---":
        for index in range(1, len(lines)):
            if lines[index].strip() == "---":
                return index + 1
    return 0


def exam_lines(path: Path) -> list[tuple[int, str]]:
    """Return the exam body of one transcription as `(line_number, text)` pairs.

    `line_number` is the line number *in the file*, so a locator such as
    `2023/dak-lak/so.md:L513` can be opened and read. Removed from the body:
    YAML front matter, URLs (the archive's file links), the archive's own
    "Nguồn và giới hạn" section and its provenance blockquotes. What stays is
    the transcribed exam pages, their answer section and their transcript.
    """
    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    kept: list[tuple[int, str]] = []
    skip_section = False
    for index in range(_front_matter_end(lines), len(lines)):
        line = lines[index]
        if line.startswith("## "):
            skip_section = line.strip() == ARCHIVE_NOTE_SECTION
            if skip_section:
                continue
        if skip_section:
            continue
        if line.startswith(ARCHIVE_NOTE_QUOTES):
            continue
        kept.append((index + 1, URL_RE.sub(" ", line)))
    return kept


def exam_text(path: Path) -> str:
    """Return only the exam body of one transcription (see `exam_lines`)."""
    return "\n".join(line for _, line in exam_lines(path))


def build_exam_index(root: Path = EXAM_ROOT) -> dict[str, dict[str, Any]]:
    """Map a lowercase token to its first transcription hit and document count.

    Only the exam body counts as evidence (see `exam_text`): the archive's own
    metadata can never attest a word. Hyphen/apostrophe variants are indexed
    separately: no aggressive folding is used for evidence.
    """
    index: dict[str, dict[str, Any]] = {}
    for path in exam_files(root):
        relative = path.relative_to(root).as_posix()
        for number, line in exam_lines(path):
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


MC_NUMBER_RE = re.compile(r"^\s{0,12}\d{1,2}[.)]\s")
MC_OPTION_RE = re.compile(r"(?:^|\s)([ABCD])\.\s")


def exam_items_from_lines(lines: list[tuple[int, str]]) -> list[tuple[int, str]]:
    """Return the multiple-choice items of one exam body as `(line, text)`.

    An item is a numbered line plus the following unnumbered lines (at most two)
    that carry at least three `A.`/`B.`/`C.`/`D.` option markers. This is a
    mechanical extraction, not a verified question bank: it finds the lexical
    choices an exam paper offers, which is a much narrower signal than "the word
    occurs somewhere in the transcription". Sections written as prose, gap-fill
    tables and error-correction lines are not captured.
    """
    texts = [text for _, text in lines]
    items: list[tuple[int, str]] = []
    for position, line in enumerate(texts):
        if not MC_NUMBER_RE.match(line):
            continue
        block = [line.strip()]
        cursor = position + 1
        while cursor < len(texts) and cursor <= position + 2:
            following = texts[cursor].strip()
            if not following or MC_NUMBER_RE.match(following):
                break
            block.append(following)
            cursor += 1
        joined = " ".join(block)
        if len(MC_OPTION_RE.findall(joined)) >= 3:
            items.append((lines[position][0], joined))
    return items


def exam_items(text: str) -> list[tuple[int, str]]:
    """`exam_lines` for callers that only hold the body text (1-based lines)."""
    return exam_items_from_lines(list(enumerate(text.splitlines(), start=1)))


def build_item_index(root: Path = EXAM_ROOT) -> dict[str, dict[str, Any]]:
    """Map a lowercase token to the items and papers that offer it as a choice.

    Only tokens inside extracted multiple-choice items count; the index says
    nothing about which option is correct, so it is evidence of *exposure to a
    lexical decision*, never of the answer.
    """
    index: dict[str, dict[str, Any]] = {}
    for path in exam_files(root):
        relative = path.relative_to(root).as_posix()
        for line, text in exam_items_from_lines(exam_lines(path)):
            for match in TOKEN_RE.finditer(text):
                token = match.group(0).lower().strip("'-")
                if len(token) < 2:
                    continue
                record = index.get(token)
                if record is None:
                    index[token] = {
                        "locator": f"{relative}:L{line}",
                        "items": {f"{relative}:L{line}"},
                        "documents": {relative},
                    }
                else:
                    record["items"].add(f"{relative}:L{line}")
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
    shown = words[hits.index(best)]
    shared = set.intersection(*(hit["documents"] for hit in hits))
    if len(words) == 1:
        return {"locator": best["locator"], "documents": len(best["documents"]), "words": words, "shown": shown}
    if not shared:
        return None
    return {"locator": best["locator"], "documents": len(shared), "words": words, "shown": shown}


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


def exam_source(locator: str, documents: int, form: str | None = None,
                words: list[str] | None = None, shown: str | None = None) -> dict[str, str]:
    """One transcription hit.

    `form` names the exact surface form the locator shows. Without it the claim
    is about a single-word headword. A multi-word headword is different: the
    count is the number of papers where *every* word occurs, while the locator
    line shows only the rarest one, so `words`/`shown` make the claim say that
    instead of pretending the whole phrase was seen.
    """
    if form:
        supports = f"form {form!r} occurs in {documents} transcribed exam(s)"
    elif words and len(words) > 1:
        supports = (f"headword words occur in {documents} transcribed exam(s); "
                    f"the locator shows {shown!r}")
    else:
        supports = f"form occurs in {documents} transcribed exam(s)"
    return {"ref": "exam-corpus", "locator": locator, "supports": supports}


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
