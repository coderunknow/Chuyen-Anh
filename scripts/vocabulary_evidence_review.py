#!/usr/bin/env python3
"""Classify the focus headwords that have no direct corpus evidence.

`docs/vocabulary-quality-audit.json` reports a review queue: headwords that stay
in the learning deck without an `exam-corpus` source. A queue of that size is not
useful unless the causes are separated, and the causes are very different:

* the headword is a **phrase** and the whole phrase occurs in a transcription;
* the headword never occurs, but a **regular inflection or derivation** of it
  does (`endorsed` for `endorse`) — evidence of the word family, not of the
  headword form;
* the headword is a **multi-word item** whose words occur in one paper but not
  together — weak, and said so;
* the item belongs to an **exam format** the paper tests directly
  (word formation, confusable pairs, linkers), where the base form is not
  expected to appear in the prose;
* the row is backed by a **dictionary entry locator** and a gloss only;
* nothing above applies: **no basis found** — flagged for review, never deleted.

Nothing here decides that a word is worthless. The output is a review aid: it
records a checkable reason per headword, the bucket it falls in, and the
evidence locator when there is one. It is deterministic and `--check` proves the
committed artifacts still match the data.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from collections import Counter
from pathlib import Path
from typing import Any, Iterable

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from vocabulary_curation import is_archived, load_spec  # noqa: E402
from vocab_sources import EXAM_ROOT, exam_files, exam_lines, word_key  # noqa: E402

DEFAULT_JSON = ROOT / "docs" / "vocabulary-evidence-review.json"
DEFAULT_MD = ROOT / "docs" / "vocabulary-evidence-review.md"

# Suffixes that build a regular inflection or a common derivation of a base
# word. Deliberately conservative: no prefix stripping, no compounding, no
# "looks similar" matching, so a hit is a form a learner would recognise as the
# same word. Anything the list misses stays in the flagged bucket instead of
# being guessed at.
SUFFIXES = (
    "s", "es", "ed", "d", "ing", "ly", "er", "est", "ies", "ied", "ier", "iest",
    "ily", "ness", "ment", "ments", "ion", "ions", "ation", "ations", "ity", "ally",
)
EXAM_FORMAT_TYPES = {"word-formation", "confusable", "linker"}
BUCKET_LABELS = {
    "phrase-in-corpus": "Cả cụm xuất hiện trong bản chép",
    "surface-variant": "Chỉ một dạng biến đổi của từ xuất hiện",
    "multiword-words-only": "Các chữ của cụm cùng có trong một đề, nhưng không đứng cạnh nhau",
    "exam-format-only": "Không có trong văn bản, nhưng thuộc dạng bài đề kiểm tra trực tiếp",
    "dictionary-only": "Chỉ có mục từ điển và nghĩa, không có bằng chứng trong đề",
    "no-basis": "Chưa tìm được căn cứ nào để giữ — cần rà thủ công",
}
BUCKET_ACTIONS = {
    "phrase-in-corpus": "Giữ; ghi nguồn cụm vào hàng khi rebuild.",
    "surface-variant": "Giữ; câu nguồn phải nêu đúng dạng đã thấy, không nhận là headword.",
    "multiword-words-only": "Giữ nhưng hạ mức bằng chứng: chỉ là các chữ cùng xuất hiện trong một đề.",
    "exam-format-only": "Giữ: dạng bài từ loại/biến đổi từ/liên kết câu kiểm tra gốc từ, không cần gốc xuất hiện trong bài đọc.",
    "dictionary-only": "Giữ và đánh dấu: bằng chứng là mục từ điển, không phải đề thi.",
    "no-basis": "Đánh dấu để rà thủ công; không tự xoá, không tự lưu trữ.",
}


def normalize(text: str) -> str:
    """Lowercase, accent-free, punctuation-folded text for phrase matching."""
    decomposed = unicodedata.normalize("NFD", text)
    stripped = "".join(char for char in decomposed if unicodedata.category(char) != "Mn")
    stripped = stripped.replace("đ", "d").replace("Đ", "D").lower()
    return re.sub(r"[^a-z0-9' ]+", " ", stripped)


def build_line_index() -> tuple[dict[str, list[tuple[str, int]]], list[tuple[str, int, str]]]:
    """Token -> cited lines, plus the normalized lines for phrase matching."""
    tokens: dict[str, list[tuple[str, int]]] = {}
    lines: list[tuple[str, int, str]] = []
    for path in exam_files():
        relative = path.relative_to(EXAM_ROOT).as_posix()
        for number, text in exam_lines(path):
            lines.append((relative, number, normalize(text)))
            for token in re.findall(r"[a-z][a-z'’-]*", text.lower()):
                tokens.setdefault(token.strip("'-"), []).append((relative, number))
    return tokens, lines


def variants_of(word: str, headword_keys: set[str]) -> list[str]:
    """Regular inflections/derivations of one single-word headword.

    A variant that is itself a headword is skipped: its occurrences belong to
    that row, and counting them here would double-count one corpus line.
    """
    base = word.lower().strip()
    if len(base) < 4 or not re.fullmatch(r"[a-z][a-z'-]*", base):
        return []
    found: set[str] = set(base + suffix for suffix in SUFFIXES)
    if base.endswith("e"):
        stem = base[:-1]
        found |= {stem + "ing", stem + "ed", stem + "er", stem + "est", stem + "ation"}
    if base.endswith("y") and len(base) > 2:
        stem = base[:-1]
        found |= {stem + "ies", stem + "ied", stem + "ier", stem + "iest",
                  stem + "ily", stem + "iness"}
    if (len(base) > 3 and base[-1] not in "aeiouwy"
            and base[-2] in "aeiou" and base[-3] not in "aeiou"):
        found |= {base + base[-1] + "ed", base + base[-1] + "ing",
                  base + base[-1] + "er", base + base[-1] + "est"}
    found.discard(base)
    return sorted(
        variant for variant in found
        if len(variant) > 3 and word_key(variant) not in headword_keys
    )


def phrase_hits(phrase: str, lines: Iterable[tuple[str, int, str]]) -> list[tuple[str, int]]:
    needle = f" {normalize(phrase)} "
    return [(relative, number) for relative, number, text in lines
            if needle in f" {text} "]


def classify(row: dict[str, Any], tokens: dict[str, list[tuple[str, int]]],
             lines: list[tuple[str, int, str]], headword_keys: set[str]) -> dict[str, Any]:
    word = row["word"]
    multi_word = " " in word.strip() or "/" in word
    types = {tag.split(":", 1)[1] for tag in row.get("tags") or [] if tag.startswith("type:")}
    has_dictionary = any(source.get("ref") == "cambridge" for source in row.get("sources") or [])
    record: dict[str, Any] = {"id": row["id"], "word": word, "multiWord": multi_word,
                              "type": sorted(types), "dictionaryLocator": has_dictionary}
    if multi_word:
        hits = phrase_hits(word, lines)
        if hits:
            record.update(bucket="phrase-in-corpus", evidence=hits[0], occurrences=len(hits),
                          papers=len({paper for paper, _ in hits}))
            return record
        parts = [word_key(part) for part in re.split(r"[\s/]+", word.strip()) if part]
        shared: set[str] | None = None
        for part in parts:
            papers = {paper for paper, _ in tokens.get(part, [])}
            shared = papers if shared is None else shared & papers
        if shared:
            record.update(bucket="multiword-words-only", papers=len(shared))
        elif types & EXAM_FORMAT_TYPES:
            record.update(bucket="exam-format-only", evidence=None)
        elif has_dictionary:
            record.update(bucket="dictionary-only", evidence=None)
        else:
            record.update(bucket="no-basis", evidence=None)
        return record
    best: tuple[str, int, str, int] | None = None
    for variant in variants_of(word, headword_keys):
        hits = tokens.get(word_key(variant))
        if not hits:
            continue
        papers = len({paper for paper, _ in hits})
        if best is None or papers > best[3]:
            best = (variant, hits[0][0], hits[0][1], papers)
    if best:
        variant, paper, number, papers = best
        record.update(bucket="surface-variant", variant=variant,
                      evidence=[paper, number], papers=papers, occurrences=len(tokens[word_key(variant)]))
        return record
    if types & EXAM_FORMAT_TYPES:
        record.update(bucket="exam-format-only", evidence=None)
    elif has_dictionary:
        record.update(bucket="dictionary-only", evidence=None)
    else:
        record.update(bucket="no-basis", evidence=None)
    return record


def build_report() -> dict[str, Any]:
    rows = json.loads((ROOT / "data" / "vocabulary.json").read_text(encoding="utf-8"))
    headwords = [row for row in rows if not row.get("familyHead")]
    headword_keys = {word_key(row["word"]) for row in headwords}
    spec = load_spec()
    queue = [
        row for row in headwords
        if not is_archived(row.get("tags"))
        and not any(source.get("ref") == "exam-corpus" for source in row.get("sources") or [])
    ]
    tokens, lines = build_line_index()
    reviewed = [classify(row, tokens, lines, headword_keys) for row in queue]
    buckets = Counter(item["bucket"] for item in reviewed)
    by_level = Counter()
    levels = {row["id"]: next((tag.split(":", 1)[1] for tag in row.get("tags") or []
                               if tag.startswith("level:")), None) for row in queue}
    for item in reviewed:
        by_level[(item["bucket"], levels[item["id"]] or "(none)")] += 1
    return {
        "generatedBy": "scripts/vocabulary_evidence_review.py",
        "generatedFrom": "data/vocabulary.json + De-chuyen-Anh-vao-10/**/*.md + docs/vocabulary-curation.json",
        "method": {
            "queue": "headword đang ở bộ từ trọng tâm, không có nguồn exam-corpus",
            "phrase": "cả cụm (đã chuẩn hoá dấu/case) xuất hiện trên một dòng của bản chép",
            "variant": "chỉ ghép hậu tố thường gặp; dạng trùng với một headword khác bị bỏ",
            "examFormat": "tag type:word-formation / type:confusable / type:linker",
            "dictionary": "có locator mục từ điển cambridge trong sources",
        },
        "totals": {
            "focusHeadwords": len(headwords),
            "queue": len(reviewed),
            "phraseInCorpus": buckets["phrase-in-corpus"],
            "surfaceVariant": buckets["surface-variant"],
            "multiwordWordsOnly": buckets["multiword-words-only"],
            "examFormatOnly": buckets["exam-format-only"],
            "dictionaryOnly": buckets["dictionary-only"],
            "noBasis": buckets["no-basis"],
        },
        "buckets": {
            bucket: {
                "label": BUCKET_LABELS[bucket],
                "action": BUCKET_ACTIONS[bucket],
                "count": buckets[bucket],
                "byLevel": {level: count for (name, level), count in sorted(by_level.items())
                            if name == bucket},
                "examples": [item["word"] for item in reviewed if item["bucket"] == bucket][:15],
            }
            for bucket in BUCKET_LABELS
        },
        "curationCategories": {category: sum(1 for row in headwords if not is_archived(row.get("tags"))) for category in []},
        "reviewed": reviewed,
        "limits": [
            "Bằng chứng 'surface-variant' là bằng chứng cho HỌ TỪ, không phải cho chính headword; câu nguồn phải nêu dạng đã thấy.",
            "Không tra từ điển trực tuyến trong phiên này: 'dictionary-only' chỉ nói rằng trong hàng có locator mục từ điển, không phải đã xác minh nghĩa.",
            "Không có từ nào bị xoá hay lưu trữ bởi báo cáo này; 'no-basis' là danh sách cần rà.",
        ],
    }


def render(report: dict[str, Any]) -> str:
    lines: list[str] = []
    add = lines.append
    totals = report["totals"]
    add("# Rà bằng chứng cho bộ từ trọng tâm")
    add("")
    add("Báo cáo sinh tự động từ `scripts/vocabulary_evidence_review.py`; `--check` chứng minh tệp còn khớp dữ liệu.")
    add("Phạm vi: **" + f"{totals['queue']:,}" + "** headword đang ở bộ từ trọng tâm mà **không** có nguồn `exam-corpus`, "
        "trên tổng " + f"{totals['focusHeadwords']:,}" + " headword.")
    add("")
    add("Đây là bảng phân loại **nguyên nhân**, không phải kết luận từ nào không cần học. "
        "Một từ không xuất hiện trong 106 bản chép vẫn có thể cần cho đề: bản chép chỉ phủ 106 bộ đề, "
        "và dạng bài biến đổi từ kiểm tra gốc từ mà gốc không nhất thiết nằm trong bài đọc.")
    add("")
    add("| Nhóm | Số headword | Nghĩa | Cách xử lý |")
    add("| --- | ---: | --- | --- |")
    for bucket, data in report["buckets"].items():
        add(f"| `{bucket}` | {data['count']:,} | {data['label']} | {data['action']} |")
    add("")
    add("## Phân bố theo level biên tập")
    add("")
    add("| Nhóm | " + " | ".join(sorted({level for data in report["buckets"].values() for level in data["byLevel"]})) + " |")
    add("| --- |" + " ---: |" * len({level for data in report["buckets"].values() for level in data["byLevel"]}))
    levels = sorted({level for data in report["buckets"].values() for level in data["byLevel"]})
    for bucket, data in report["buckets"].items():
        add(f"| `{bucket}` | " + " | ".join(str(data["byLevel"].get(level, "")) for level in levels) + " |")
    add("")
    add("## Bằng chứng mới tìm được")
    add("")
    variant_examples = [item for item in report["reviewed"] if item["bucket"] == "surface-variant"][:10]
    phrase_examples = [item for item in report["reviewed"] if item["bucket"] == "phrase-in-corpus"][:10]
    if phrase_examples:
        add("Cụm xuất hiện nguyên văn trong bản chép:")
        add("")
        add("| Headword | Dòng dẫn | Số lần | Số đề |")
        add("| --- | --- | ---: | ---: |")
        for item in phrase_examples:
            add(f"| {item['word']} | `{item['evidence'][0]}:L{item['evidence'][1]}` | "
                f"{item.get('occurrences', 0)} | {item.get('papers', 0)} |")
        add("")
    if variant_examples:
        add("Headword không xuất hiện, nhưng một dạng biến đổi có:")
        add("")
        add("| Headword | Dạng thấy | Dòng dẫn | Số đề |")
        add("| --- | --- | --- | ---: |")
        for item in variant_examples:
            add(f"| {item['word']} | `{item['variant']}` | `{item['evidence'][0]}:L{item['evidence'][1]}` | "
                f"{item.get('papers', 0)} |")
        add("")
    add("## Danh sách cần rà thủ công (`no-basis`)")
    add("")
    no_basis = [item["word"] for item in report["reviewed"] if item["bucket"] == "no-basis"]
    add(f"**{len(no_basis):,}** mục. Không mục nào bị xoá hay lưu trữ: đây là danh sách để người biên tập quyết định.")
    add("")
    add(", ".join(no_basis) if no_basis else "_(không có)_")
    add("")
    add("## Giới hạn")
    add("")
    for limit in report["limits"]:
        add(f"- {limit}")
    add("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="fail if the committed artifacts are stale")
    parser.add_argument("--json", type=Path, default=DEFAULT_JSON)
    parser.add_argument("--md", type=Path, default=DEFAULT_MD)
    args = parser.parse_args()
    report = build_report()
    payload = json.dumps(report, ensure_ascii=False, indent=1, sort_keys=False) + "\n"
    markdown = render(report)
    if args.check:
        problems = []
        for path, expected in ((args.json, payload), (args.md, markdown)):
            if not path.exists():
                problems.append(f"{path.relative_to(ROOT)} is missing")
            elif path.read_text(encoding="utf-8") != expected:
                problems.append(f"{path.relative_to(ROOT)} is stale; run python scripts/vocabulary_evidence_review.py")
        if problems:
            print("\n".join(problems))
            return 1
        print(f"Evidence review matches ({report['totals']['queue']:,} queued headwords classified).")
        return 0
    args.json.write_text(payload, encoding="utf-8")
    args.md.write_text(markdown, encoding="utf-8")
    print(f"Wrote {args.json.relative_to(ROOT)} and {args.md.relative_to(ROOT)}: "
          f"{report['totals']['queue']:,} queued headwords classified.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
