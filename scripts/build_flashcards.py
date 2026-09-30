#!/usr/bin/env python3
"""Build flashcards.html - one self-contained study file from the learned list.

Everything the study file shows is derived from the repository:

* ``Learned_Vocabulary_List.md``         - the 913 learned words (id | word | pos | meaning)
* ``data/vocabulary.json``               - base meaning for ids 1-613
* ``data/pronunciation.json``            - IPA per word (optional, see --refresh-ipa)
* ``docs/vocabulary-300-evidence.json``  - exam line, cited form and excerpt (614-913)
* ``docs/vocabulary-300-families.json``  - curated word-family forms per word
* ``De-chuyen-Anh-vao-10/**/*.md``       - the 106 exam transcriptions used for context

Derived, never invented: corpus coverage counts real exam files, examples are
the cited exam sentences, and the difficulty/priority tiers are an explicit
heuristic (see ``LEVEL_NOTE`` and ``TIER_NOTE``), not a CEFR claim.

Usage::

    python scripts/build_flashcards.py               # write flashcards.html
    python scripts/build_flashcards.py --calibrate    # print dataset statistics
    python scripts/build_flashcards.py --check        # fail if the file is stale
    python scripts/build_flashcards.py --refresh-ipa  # rebuild data/pronunciation.json (needs cmudict)
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import unicodedata
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LEARNED = ROOT / "Learned_Vocabulary_List.md"
BASE_VOCAB = ROOT / "data" / "vocabulary.json"
PRONUNCIATION = ROOT / "data" / "pronunciation.json"
EVIDENCE = ROOT / "docs" / "vocabulary-300-evidence.json"
FAMILIES = ROOT / "docs" / "vocabulary-300-families.json"
CORPUS_DIR = ROOT / "De-chuyen-Anh-vao-10"
CORPUS_GLOB = "*/*/*.md"
CORPUS_SECTION = "## Đề thi và phần kèm theo trong nguồn"
TEMPLATE = ROOT / "src" / "flashcards" / "template.html"
STYLESHEET = ROOT / "src" / "flashcards" / "style.css"
APP = ROOT / "src" / "flashcards" / "app.js"
ARTIFACT = ROOT / "flashcards.html"

TITLE = "913 từ đã học · Flashcard"
LEVEL_NOTE = (
    "Độ khó 1-5 là thang nội bộ của file này, tính từ số chữ cái, số âm tiết, "
    "tiền/hậu tố, dạng cụm từ/thành ngữ và mức xuất hiện trong kho đề; "
    "từ xuất hiện ở 10 đề trở lên bị hạ xuống tối đa mức 3, từ 20 đề trở lên tối đa mức 2. "
    "Đây không phải chuẩn CEFR."
)
TIER_NOTE = (
    "Ưu tiên ôn dựa trên dữ liệu repo: bậc 1 = từ có họ từ/phân biệt kèm nguồn đề "
    "hoặc xuất hiện ở 8 đề trở lên; bậc 2 = xuất hiện ở 3-7 đề; bậc 3 = các từ còn lại."
)
CORPUS_NOTE = (
    "Số đề chứa từ, tính trên 106 đề trong repo (khớp cả dạng chia của từ theo "
    "danh sách họ từ). Đây là độ phủ trong kho đề, không phải tần suất tiếng Anh nói chung."
)
IPA_NOTE = (
    "Phiên âm Anh-Mỹ sinh từ CMU Pronouncing Dictionary (Carnegie Mellon University, "
    "giấy phép BSD-2) rồi chuyển sang IPA; vài từ hiếm hoặc cụm từ không có phiên âm."
)
IPA_SOURCE = "CMU Pronouncing Dictionary (BSD-2), chuyển tự ARPAbet -> IPA"
IPA_LICENSE = (
    "Copyright (C) 1993-2015 Carnegie Mellon University. All rights reserved. "
    "Redistribution and use in source and binary forms, with or without modification, "
    'are permitted provided that the copyright notice, this list of conditions and the '
    "following disclaimer are retained (BSD-2-Clause). THE SOFTWARE IS PROVIDED "
    '"AS IS", WITHOUT WARRANTY OF ANY KIND.'
)

# Derivation of the internal 1-5 difficulty scale (kept explicit and testable).
VOWELS = "aeiouy"
SUFFIXES = (
    "ation", "ition", "tion", "sion", "ment", "ness", "ance", "ence", "ity",
    "ety", "ious", "eous", "ous", "ative", "ive", "ical", "ial", "al", "ical",
    "ic", "ate", "ise", "ize", "ify", "able", "ible", "ism", "ist",
    "ology", "graphy", "ship", "hood", "wards", "esque", "aceous",
)
LEVEL_BANDS = ((4.0, 5), (3.1, 4), (2.1, 3), (1.2, 2))  # score >= threshold -> this level
COVERAGE_CAPS = ((20, 2), (10, 3))  # many exams -> cannot be a "hard" word


# --------------------------------------------------------------------------- #
# small text helpers
# --------------------------------------------------------------------------- #
def strip_accents(text: str) -> str:
    text = unicodedata.normalize("NFD", text)
    return "".join(ch for ch in text if unicodedata.category(ch) != "Mn")


def letters_only(text: str) -> str:
    return re.sub(r"[^a-z]", "", text.casefold())


def syllable_count(word: str) -> int:
    """Fallback syllable estimate: vowel groups, silent final -e removed."""
    lowered = word.casefold()
    groups = re.findall(r"[aeiouy]+", lowered)
    count = len(groups)
    if count > 1 and lowered.endswith("e") and not lowered.endswith(("le", "ee")):
        count -= 1
    return max(1, count)


def clean_markup(text: str) -> str:
    """Turn exam-transcription markup into plain, displayable text."""
    text = text.replace("**", "")
    text = re.sub(r"</?u>", "", text)
    text = re.sub(r"<[^>]+>", "", text)
    text = text.replace("\\_", "_").replace("\\*", "*").replace("\\.", ".")
    text = text.replace("\u2019", "'").replace("\u201c", '"').replace("\u201d", '"')
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def difficulty_score(entry: dict) -> float:
    word = entry["word"]
    letters = len(letters_only(word))
    score = min(4.0, max(0.0, (letters - 4) / 4.5))
    syllables = entry.get("syllables") or syllable_count(word)
    score += min(2.0, (syllables - 1) * 0.5)
    lowered = word.casefold()
    score += 0.35 * min(2, sum(1 for suffix in SUFFIXES if lowered.endswith(suffix)))
    if " " in word:
        score += 1.2
    if "'" in word or "-" in word:
        score += 0.8
    if entry["documented"]:
        score += 0.5
    if entry["corpusFiles"] == 0:
        score += 0.4
    elif entry["corpusFiles"] >= 6:
        score -= 0.4
    return round(score, 3)


def difficulty_level(score: float, coverage: int = 0) -> int:
    level = 1
    for threshold, candidate in LEVEL_BANDS:
        if score >= threshold:
            level = candidate
            break
    for files, cap in COVERAGE_CAPS:
        if coverage >= files:
            level = min(level, cap)
            break
    return level


def priority_tier(entry: dict) -> int:
    if entry["documented"] or entry["corpusFiles"] >= 8:
        return 1
    if entry["corpusFiles"] >= 3:
        return 2
    return 3


# --------------------------------------------------------------------------- #
# sources
# --------------------------------------------------------------------------- #
def load_learned(path: Path = LEARNED) -> list[dict]:
    """The learned list is the single source of truth for which words to study."""
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not re.match(r"^\d+\|", line):
            continue
        ident, word, pos, meaning = line.split("|", 3)
        rows.append({"id": ident, "word": word.strip(), "pos": pos.strip(), "raw": meaning.strip()})
    return rows


def split_documented(raw: str) -> dict:
    """Split a documented meaning into meaning / family / distinction / citation."""
    text = raw.strip()
    out = {"meaning": text, "family": "", "distinction": "", "citation": ""}
    markers = (("family", "**Họ từ:**"), ("distinction", "**Phân biệt:**"), ("citation", "**Nguồn:**"))
    positions = {key: text.find(marker) for key, marker in markers}
    present = [key for key, _ in markers if positions[key] != -1]
    if not present:
        return out
    out["meaning"] = text[: positions[present[0]]].strip()
    for index, (key, marker) in enumerate(markers):
        if positions[key] == -1:
            continue
        start = positions[key] + len(marker)
        end = len(text)
        for later, _ in markers[index + 1:]:
            if positions[later] != -1 and positions[later] > positions[key]:
                end = min(end, positions[later])
        out[key] = text[start:end].strip()
    link = re.search(r"\[([^\]]+):(\d+)\]\(([^)]+)\)", out["citation"])
    if link:
        out["source_path"] = link.group(1)
        out["source_line"] = int(link.group(2))
        out["source_url"] = link.group(3)
    form = re.search(r"\(dạng trong nguồn:\s*([^)]+)\)", out["citation"])
    if form:
        out["source_form"] = form.group(1).strip()
    out["citation"] = re.sub(r"\s*\(dạng trong nguồn:[^)]*\)", "", out["citation"]).strip()
    return out


def inflection_forms(word: str) -> list[str]:
    """Regular English inflections; used only to look the word up in the corpus."""
    base = word.casefold()
    forms = {base}
    if " " in base:
        head, _, tail = base.partition(" ")
        for form in inflection_forms(head):
            forms.add(f"{form} {tail}")
        return sorted(forms)
    if base.endswith(("s", "x", "z", "ch", "sh")):
        forms.add(base + "es")
    elif base.endswith("y") and len(base) > 2 and base[-2] not in VOWELS:
        forms.add(base[:-1] + "ies")
    else:
        forms.add(base + "s")
    if base.endswith("e") and not base.endswith("ee"):
        forms.add(base + "d")
        forms.add(base[:-1] + "ing")
    else:
        forms.add(base + "ed")
        forms.add(base + "ing")
    if len(base) > 3 and base[-1] not in VOWELS and base[-2] in "aeiou" and base[-3] not in VOWELS:
        forms.add(base + base[-1] + "ing")
        forms.add(base + base[-1] + "ed")
    if base.endswith("y") and len(base) > 2 and base[-2] not in VOWELS:
        forms.add(base[:-1] + "ied")
    return sorted(forms)


def build_corpus_index() -> tuple[dict[str, set[str]], list[str]]:
    """Map every English token to the set of exam files that contain it."""
    token = re.compile(r"(?<![\w-])[A-Za-z]+(?:-[A-Za-z]+)*(?![\w-])")
    index: dict[str, set[str]] = {}
    files: list[str] = []
    for path in sorted(CORPUS_DIR.glob(CORPUS_GLOB)):
        lines = path.read_text(encoding="utf-8").splitlines()
        if CORPUS_SECTION not in lines:
            continue
        relative = path.relative_to(ROOT).as_posix()
        files.append(relative)
        body = "\n".join(lines[lines.index(CORPUS_SECTION) + 1:])
        body = re.sub(r"<[^>]*>", "", body)
        body = re.sub(r"\]\([^)]*\)", "]", body)
        body = body.replace("\u2014", " ").replace("\u2013", " ")
        for match in token.finditer(body):
            index.setdefault(match.group().casefold(), set()).add(relative)
    return index, files


# --------------------------------------------------------------------------- #
# pronunciation (derived once from CMUdict, committed as data/pronunciation.json)
# --------------------------------------------------------------------------- #
ARPABET_IPA = {
    "AA": "ɑː", "AE": "æ", "AH": "ʌ", "AO": "ɔː", "AW": "aʊ", "AY": "aɪ",
    "B": "b", "CH": "tʃ", "D": "d", "DH": "ð", "EH": "e", "ER": "ɜː", "EY": "eɪ",
    "F": "f", "G": "ɡ", "HH": "h", "IH": "ɪ", "IY": "iː", "JH": "dʒ", "K": "k",
    "L": "l", "M": "m", "N": "n", "NG": "ŋ", "OW": "oʊ", "OY": "ɔɪ", "P": "p",
    "R": "r", "S": "s", "SH": "ʃ", "T": "t", "TH": "θ", "UH": "ʊ", "UW": "uː",
    "V": "v", "W": "w", "Y": "j", "Z": "z", "ZH": "ʒ",
}
UNSTRESSED = {"AH": "ə", "ER": "ɚ", "IY": "i", "UW": "u"}
# Legal English syllable onsets (ARPAbet) - a stress mark may only move in
# front of a cluster that can actually start a syllable, so /prægˈmætɪk/ keeps
# its /g/ as the coda instead of becoming /præˈgmætɪk/.
SINGLE_ONSETS = {"B", "CH", "D", "DH", "F", "G", "HH", "JH", "K", "L", "M", "N",
                 "P", "R", "S", "SH", "T", "TH", "V", "W", "Y", "Z", "ZH"}
CLUSTER_ONSETS = {
    "PL", "PR", "BL", "BR", "TR", "DR", "KL", "KR", "GL", "GR", "FL", "FR",
    "THR", "SHR", "SP", "ST", "SK", "SM", "SN", "SW", "TW", "KW", "DW", "GW",
    "HW", "THW", "SF", "SV", "SL",
    "SPR", "SPL", "STR", "SKR", "SKW", "SKL", "SPY", "SKY", "STY",
}
LEGAL_ONSETS = SINGLE_ONSETS | CLUSTER_ONSETS
VOWEL_PHONES = {"AA", "AE", "AH", "AO", "AW", "AY", "EH", "ER", "EY", "IH", "IY", "OW", "OY", "UH", "UW"}
MAX_ONSET = 3  # consonants that can move in front of the stress mark


def arpabet_to_ipa(phones: list[str]) -> tuple[str, int]:
    """ARPAbet -> IPA with the stress mark moved to the syllable onset."""
    pieces: list[dict] = []
    syllables = 0
    for phone in phones:
        match = re.match(r"^([A-Z]+)([012])?$", phone)
        if not match:
            continue
        symbol, digit = match.group(1), match.group(2) or "0"
        if symbol in VOWEL_PHONES:
            syllables += 1
            text = UNSTRESSED.get(symbol, ARPABET_IPA[symbol]) if digit == "0" else ARPABET_IPA[symbol]
            pieces.append({"text": text, "key": symbol, "vowel": True, "stress": int(digit)})
        else:
            pieces.append({"text": ARPABET_IPA.get(symbol, ""), "key": symbol, "vowel": False, "stress": 0})
    for index, piece in enumerate(pieces):
        if not piece["vowel"] or piece["stress"] != 1:
            continue
        run: list[str] = []
        cursor = index
        while cursor > 0 and not pieces[cursor - 1]["vowel"] and len(run) < MAX_ONSET:
            run.insert(0, pieces[cursor - 1]["key"])
            cursor -= 1
        onset = 0
        for length in range(len(run), 0, -1):
            if "".join(run[-length:]) in LEGAL_ONSETS:
                onset = length
                break
        pieces[index - onset]["mark"] = "ˈ"
    text = "".join((piece.get("mark") or "") + piece["text"] for piece in pieces)
    return f"/{text}/", max(1, syllables)


def cmudict_lookup() -> dict:
    try:  # optional dependency: pip install cmudict
        import cmudict  # type: ignore

        return cmudict.dict()
    except Exception:  # pragma: no cover - dependency is optional by design
        return {}


def lookup_ipa(word: str, dictionary: dict) -> tuple[str, int]:
    key = word.casefold()
    entries = dictionary.get(key) or dictionary.get(key.replace("-", "").replace("'", ""))
    if not entries:
        return "", 0
    return arpabet_to_ipa(entries[0])


def load_pronunciation() -> dict[str, dict]:
    if not PRONUNCIATION.exists():
        return {}
    data = json.loads(PRONUNCIATION.read_text(encoding="utf-8"))
    return data.get("words", {})


def refresh_pronunciation() -> int:
    """Regenerate data/pronunciation.json from the installed cmudict package."""
    dictionary = cmudict_lookup()
    if not dictionary:
        print("cmudict is not installed: pip install cmudict", file=sys.stderr)
        return 1
    words = {}
    covered = 0
    for row in load_learned():
        ipa, syllables = lookup_ipa(row["word"], dictionary)
        if ipa:
            words[f"{row['word'].casefold()}|{row['pos']}"] = {"ipa": ipa, "syllables": syllables}
            covered += 1
    payload = {"source": IPA_SOURCE, "license": IPA_LICENSE, "count": covered, "words": words}
    PRONUNCIATION.write_text(
        json.dumps(payload, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8"
    )
    print(f"✅ Wrote {PRONUNCIATION} ({covered}/{len(load_learned())} words)")
    return 0


# --------------------------------------------------------------------------- #
# exam context and cloze
# --------------------------------------------------------------------------- #
OPTIONS_ROW = re.compile(r"\|\s*\*\*[A-D]\.\s")
OPTION_GRID = re.compile(r"\|\s*[A-D]\.\s|^\s*[A-D]\.\s")
ANSWER_KEY = re.compile(r"^\s*\(\s*[A-Za-z][A-Za-z /-]*\)\s*$")
NUMBER_PREFIX = re.compile(r"^\s*(?:\*\*)?\d+[.)]\s*(?:\*\*)?\s*")


LIST_START = re.compile(r"^\s*(?:[-*\u2022\u2013]|\(?\d{1,2}[.)]|[A-Da-d][.)])\s+")


def clean_excerpt(line: str) -> str:
    return NUMBER_PREFIX.sub("", clean_markup(line)).strip()


def sentence_window(lines: list[str], line_number: int, limit: int = 3, backwards: int = 2) -> str:
    """Ghép các dòng liền kề của cùng một đoạn để câu trong đề không bị cắt giữa chừng.

    Dừng ở dòng trống, ở mục danh sách mới (đề thường xuống dòng cho từng ý) hoặc ở
    dòng nhiễu như chân trang.
    """
    def usable(candidate: str) -> bool:
        return bool(candidate) and "\u00a9" not in candidate and len(candidate) >= 25 and not LIST_START.match(candidate)

    parts = [lines[line_number - 1].strip()] if line_number <= len(lines) else []
    for offset in range(1, limit):
        at = line_number - 1 + offset
        if at >= len(lines):
            break
        candidate = lines[at].strip()
        if not usable(candidate):
            break
        if re.search(r"[.!?][\"')\]]?$", parts[-1]):
            break
        parts.append(candidate)
    for offset in range(1, backwards + 1):
        at = line_number - 1 - offset
        if at < 0:
            break
        candidate = lines[at].strip()
        if not usable(candidate):
            break
        parts.insert(0, candidate)
    return " ".join(parts)


def sentence_around(line: str, forms: list[str], limit: int = 260, prefer: str = "") -> tuple[str, str] | None:
    """Return (sentence, matched_form) for the first family form on the line.

    ``prefer`` (usually the headword) wins over an earlier inflected form so that
    "Consumption" is illustrated by a sentence about consumption, not one that
    happens to contain "consumes" first.
    """
    text = clean_excerpt(line)
    haystack = text.casefold()
    found, at = "", -1
    if prefer:
        match = re.search(rf"(?<![\w-]){re.escape(prefer)}(?![\w-])", haystack)
        if match:
            at, found = match.start(), prefer
    for form in sorted(forms, key=len, reverse=True):
        if at != -1:
            break
        match = re.search(rf"(?<![\w-]){re.escape(form)}(?![\w-])", haystack)
        if match and (at == -1 or match.start() < at):
            at, found = match.start(), form
    if at == -1:
        return None
    start = 0
    for stop in re.finditer(r"[.!?]\s", text):
        if stop.end() < at:
            start = stop.end()
        else:
            break
    end = len(text)
    tail = re.search(r"[.!?](\s|$)", text[at:])
    if tail:
        end = at + tail.end()
    sentence = text[start:end].strip(" -–—")
    if not sentence:
        return None
    if len(sentence) > limit:
        lead = max(0, at - start - limit // 2)
        sentence = ("…" if lead else "") + sentence[lead:lead + limit].strip() + "…"
    return sentence, found


def usable_context(text: str, form: str, min_length: int) -> bool:
    """Reject option grids, answer keys and truncated fragments as study context."""
    if len(text) < min_length or OPTION_GRID.search(text) or ANSWER_KEY.match(text):
        return False
    if OPTIONS_ROW.search(text):
        return False
    return bool(re.search(rf"(?<![\w-]){re.escape(form)}(?![\w-])", text.casefold()))


def cloze_ready(text: str, form: str) -> bool:
    """A cloze hạn chế hơn ví dụ: cần đủ dài và không sẵn chỗ trống khác."""
    if len(re.findall(r"[A-Za-z']+", text)) < 7:
        return False
    if re.search(r"_{3,}", text):
        # Dòng đề đã có chỗ trống riêng: điền thêm một chỗ trống nữa sẽ rối.
        return False
    return usable_context(text, form, 40)


def build_cloze(line: str, forms: list[str], prefer: str = "") -> dict | None:
    found = sentence_around(line, forms, prefer=prefer)
    if not found:
        return None
    sentence, form = found
    if not cloze_ready(sentence, form):
        return None
    match = re.search(rf"(?<![\w-])({re.escape(form)})(?![\w-])", sentence, re.IGNORECASE)
    if not match:
        return None
    blank = f"{sentence[:match.start()]}_____{sentence[match.end():]}"
    return {"text": blank, "answer": match.group(1), "form": form}


# --------------------------------------------------------------------------- #
# payload
# --------------------------------------------------------------------------- #
def build_payload() -> dict:
    learned = load_learned()
    vocabulary = json.loads(BASE_VOCAB.read_text(encoding="utf-8"))
    meanings = {str(item["id"]): item for item in vocabulary}
    evidence = {str(item["id"]): item for item in json.loads(EVIDENCE.read_text(encoding="utf-8"))}
    family_spec = json.loads(FAMILIES.read_text(encoding="utf-8"))
    families = {str(item["id"]): item for item in family_spec["entries"]}
    index, corpus_files = build_corpus_index()
    pronouncing = load_pronunciation()

    entries: list[dict] = []
    for row in learned:
        ident, word = row["id"], row["word"]
        documented = ident in evidence
        rich = split_documented(row["raw"])
        base = meanings.get(ident)
        forms = families[ident]["forms"] if ident in families else inflection_forms(word)
        files = sorted(set().union(*(index.get(form.casefold(), set()) for form in forms)) or set())
        record = pronouncing.get(f"{word.casefold()}|{row['pos']}")
        ipa = record["ipa"] if record else ""
        syllables = record["syllables"] if record else syllable_count(word)
        context_forms = forms + [word.casefold()]
        entry = {
            "id": ident,
            "word": word,
            "pos": row["pos"] or (base["pos"] if base else ""),
            "meaning": rich["meaning"] or (base["meaning"].strip() if base else ""),
            "documented": documented,
            "corpusFiles": len(files),
            "syllables": syllables,
            "ipa": ipa if " " not in word else "",
        }
        if documented:
            cite = evidence[ident]
            lines = (ROOT / cite["path"]).read_text(encoding="utf-8").splitlines()
            block = sentence_window(lines, cite["line"])
            context = sentence_around(block, context_forms, prefer=word.casefold())
            example = context[0] if context else clean_excerpt(line)
            form = context[1] if context else cite.get("form", word)
            if not usable_context(example, form, 25):
                example, form = "", ""
            entry.update({
                "family": rich["family"],
                "distinction": rich["distinction"],
                "example": example,
                "exampleForm": form or word,
                "cloze": build_cloze(block, context_forms, prefer=word.casefold()),
                "ref": {
                    "path": cite["path"],
                    "line": cite["line"],
                    "url": rich.get("source_url") or (
                        "https://github.com/coderunknow/Chuyen-Anh/blob/main/"
                        f"{cite['path']}#L{cite['line']}"
                    ),
                },
            })
        entry["level"] = difficulty_level(difficulty_score(entry), entry["corpusFiles"])
        entry["tier"] = priority_tier(entry)
        entries.append(entry)

    level_counts = Counter(entry["level"] for entry in entries)
    tier_counts = Counter(entry["tier"] for entry in entries)
    payload = {
        "v": 1,
        "meta": {
            "title": TITLE,
            "sourceList": LEARNED.name,
            "sources": [
                LEARNED.name,
                BASE_VOCAB.relative_to(ROOT).as_posix(),
                PRONUNCIATION.relative_to(ROOT).as_posix(),
                EVIDENCE.relative_to(ROOT).as_posix(),
                FAMILIES.relative_to(ROOT).as_posix(),
                f"{CORPUS_DIR.name}/{CORPUS_GLOB} ({len(corpus_files)} đề)",
            ],
            "total": len(entries),
            "documented": sum(1 for entry in entries if entry["documented"]),
            "cloze": sum(1 for entry in entries if entry.get("cloze")),
            "withIpa": sum(1 for entry in entries if entry["ipa"]),
            "corpusFiles": len(corpus_files),
            "grounded": sum(1 for entry in entries if entry["corpusFiles"]),
            "levelCounts": {str(level): level_counts[level] for level in sorted(level_counts)},
            "tierCounts": {str(tier): tier_counts[tier] for tier in sorted(tier_counts)},
            "notes": {"level": LEVEL_NOTE, "tier": TIER_NOTE, "corpus": CORPUS_NOTE, "ipa": IPA_NOTE},
            "ipaSource": IPA_SOURCE,
            "fingerprint": "",
        },
        "entries": entries,
    }
    payload["meta"]["fingerprint"] = fingerprint(payload)
    return payload


def fingerprint(payload: dict) -> str:
    """Stable id of the study data (everything except optional pronunciation)."""
    stripped = [
        {key: value for key, value in entry.items() if key not in ("ipa", "syllables")}
        for entry in payload["entries"]
    ]
    blob = json.dumps(stripped, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(blob).hexdigest()


def json_for_script(payload: dict) -> str:
    """JSON that stays inert inside <script type="application/json">."""
    return (
        json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        .replace("<", "\\u003c")
        .replace(">", "\\u003e")
        .replace("&", "\\u0026")
    )


def render(payload: dict) -> str:
    template = TEMPLATE.read_text(encoding="utf-8")
    values = {
        "TITLE": payload["meta"]["title"],
        "DESCRIPTION": f"{payload['meta']['total']} từ vựng chuyên Anh, học trong một file HTML duy nhất.",
        "DATA_JSON": json_for_script(payload),
        "CSS": STYLESHEET.read_text(encoding="utf-8").strip(),
        "APP_JS": APP.read_text(encoding="utf-8").strip(),
        "FOOTER_NOTE": (
            f"{payload['meta']['total']} từ · {payload['meta']['documented']} từ có ngữ cảnh đề thi · "
            f"{payload['meta']['cloze']} câu điền từ · fingerprint {payload['meta']['fingerprint'][:12]}"
        ),
    }
    for placeholder, value in values.items():
        template = template.replace("{{" + placeholder + "}}", value)
    leftover = re.findall(r"\{\{[A-Z_]+\}\}", template)
    if leftover:
        raise SystemExit(f"Unresolved placeholders: {sorted(set(leftover))}")
    return template


def check() -> int:
    if not ARTIFACT.exists():
        print("flashcards.html is missing; run: python scripts/build_flashcards.py", file=sys.stderr)
        return 1
    html = ARTIFACT.read_text(encoding="utf-8")
    match = re.search(r'"fingerprint":"([0-9a-f]{12,64})"', html)
    payload = build_payload()
    current = payload["meta"]["fingerprint"]
    if not match or match.group(1) != current:
        print("flashcards.html is stale; run: python scripts/build_flashcards.py", file=sys.stderr)
        return 1
    print(f"✅ flashcards.html is up to date ({payload['meta']['total']} entries, fingerprint {current[:12]})")
    return 0


def calibrate(payload: dict) -> int:
    meta, entries = payload["meta"], payload["entries"]
    total = meta["total"]
    print(f"Entries        : {total}")
    print(f"Documented     : {meta['documented']} (cloze {meta['cloze']})")
    print(f"IPA coverage   : {meta['withIpa']}")
    print(f"Corpus files   : {meta['corpusFiles']} · words seen in exams: {meta['grounded']}")
    print("Levels         : " + ", ".join(
        f"L{level} {count} ({count * 100 // total}%)" for level, count in meta["levelCounts"].items()))
    print("Priority tiers : " + ", ".join(
        f"T{tier} {count}" for tier, count in meta["tierCounts"].items()))
    print("Fingerprint    : " + meta["fingerprint"][:12])
    by_pos = Counter(entry["pos"] for entry in entries)
    print("POS            : " + ", ".join(f"{pos} {count}" for pos, count in by_pos.most_common(8)))
    for level in sorted(meta["levelCounts"], key=int):
        sample = [entry["word"] for entry in entries if str(entry["level"]) == level][:6]
        print(f"L{level} sample   : " + ", ".join(sample))
    print("No IPA         : " + ", ".join(entry["word"] for entry in entries if not entry["ipa"])[:200])
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--calibrate", action="store_true", help="print dataset statistics")
    parser.add_argument("--check", action="store_true", help="verify flashcards.html is current")
    parser.add_argument("--refresh-ipa", action="store_true", help="rewrite data/pronunciation.json")
    parser.add_argument("--out", type=Path, default=ARTIFACT, help="output file")
    args = parser.parse_args(argv)
    if args.refresh_ipa:
        return refresh_pronunciation()
    if args.check:
        return check()
    payload = build_payload()
    html = render(payload)
    args.out.write_text(html, encoding="utf-8")
    print(f"Fingerprint: {payload['meta']['fingerprint'][:12]}")
    print(f"✅ Wrote {args.out} ({len(html.encode('utf-8')) / 1024:.0f} KB, self-contained)")
    if args.calibrate:
        calibrate(payload)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
