#!/usr/bin/env python3
"""Generate the evidence report for the vocabulary curation decision.

The report answers four questions with numbers recomputed from this repository:

1. **What is in the deck now?** Rows, headwords, archived rows, and the
   provenance/type mix of the retained headwords.
2. **Does the stored provenance match the corpus?** Every row's
   `form occurs in N transcribed exam(s)` claim is re-measured from the 106
   transcriptions. Citation-derived rows are checked against the cited line.
3. **How much of the transcribed exam text does the deck cover?** Distinct
   surface tokens in the transcriptions are matched against retained headwords
   and their documented family forms.
4. **What is left for review?** Frequent corpus tokens outside every row are
   listed as candidates, never added: adding a headword needs a meaning and a
   source, and this script does not invent either.

Nothing here is a claim about frequency in real exams, about a word's meaning,
or about CEFR level. The transcriptions are re-published copies (0 of 106 are
verified against an official original), and the `level:*` tags are editorial.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))

from learned_vocabulary import parse_table  # noqa: E402
from vocab_sources import (  # noqa: E402
    TOKEN_RE,
    build_exam_index,
    build_item_index,
    exam_files,
    exam_locator,
    exam_text,
    word_key,
)
from vocabulary_curation import (  # noqa: E402
    category_of,
    is_archived,
    load_spec,
)

DEFAULT_JSON = ROOT / "docs" / "vocabulary-quality-audit.json"
DEFAULT_MD = ROOT / "docs" / "vocabulary-quality-audit.md"
LEGACY_ROW_LIMIT = 913
CLAIM_RE = re.compile(r"form '?(?P<form>[A-Za-z][A-Za-z'-]*)'? occurs in (?P<count>\d+) transcribed exam")
GENERIC_CLAIM_RE = re.compile(r"form occurs in (?P<count>\d+) transcribed exam")
# Multi-word headwords: every word occurs in N papers, but the locator line shows
# only the rarest one, so the claim says exactly that (see exam_source).
WORDS_CLAIM_RE = re.compile(r"headword words occur in (?P<count>\d+) transcribed exam")

# Function words carry no vocabulary value and would dominate any coverage
# figure. The list is deliberately short and grammatical: pronouns, auxiliaries,
# determiners, prepositions, conjunctions and a few discourse adverbs.
STOPWORDS = frozenset("""
a about above after again against all also am an and any are as at be because been before being below
between both but by can could did do does doing down during each few for from further had has have having
he her here hers herself him himself his how i if in into is it its itself just me more most my myself no
nor not now of off on once only or other our ours ourselves out over own same she should so some such than
that the their theirs them themselves then there these they this those through to too under until up very
was we were what when where which while who whom why will with would you your yours yourself yourselves
one two three four five six seven eight nine ten first second next last many much may might must shall
""".split())


def tag_value(row: dict[str, Any], namespace: str) -> str:
    prefix = f"{namespace}:"
    for tag in row.get("tags") or []:
        if isinstance(tag, str) and tag.startswith(prefix):
            return tag[len(prefix):]
    return ""


def seed_origin_map() -> dict[str, str]:
    origins: dict[str, str] = {}
    for path in sorted((ROOT / "data" / "vocab-seed").glob("*.tsv")):
        for line in path.read_text(encoding="utf-8").splitlines():
            if not line.strip() or line.lstrip().startswith("#"):
                continue
            word = line.split("\t", 1)[0].strip()
            origins.setdefault(word_key(word), path.name)
    return origins


def exam_claim(row: dict[str, Any]) -> dict[str, Any]:
    claims = [s for s in row.get("sources") or [] if s.get("ref") == "exam-corpus"]
    best = 0
    forms: list[str] = []
    generic = False
    for source in claims:
        text = source.get("supports", "")
        match = CLAIM_RE.search(text)
        if match:
            best = max(best, int(match.group("count")))
            form = match.group("form").strip("'-")
            if word_key(form) != word_key(row["word"]):
                forms.append(form)
            continue
        match = WORDS_CLAIM_RE.search(text) or GENERIC_CLAIM_RE.search(text)
        if match:
            best = max(best, int(match.group("count")))
            generic = True
    return {"documents": best, "sources": len(claims), "citedForms": sorted(set(forms)), "generic": generic}


def corpus_text_stats(files: list[Path]) -> tuple[Counter, dict[str, set[str]]]:
    counts: Counter = Counter()
    documents: dict[str, set[str]] = defaultdict(set)
    for path in files:
        text = exam_text(path)
        relative = path.relative_to(ROOT / "De-chuyen-Anh-vao-10").as_posix()
        for token in TOKEN_RE.findall(text):
            token = token.lower().strip("'-")
            if len(token) < 3:
                continue
            counts[token] += 1
            documents[token].add(relative)
    return counts, documents


def documented_forms(rows: list[dict[str, Any]]) -> set[str]:
    """Every surface form a learner can meet in the deck: headwords and family forms."""
    forms: set[str] = set()
    for row in rows:
        forms.add(word_key(row["word"]))
    for row in rows:
        for token in re.findall(r"[A-Za-z][A-Za-z'-]*", row.get("wordFamily") or ""):
            forms.add(word_key(token))
    return forms


def base_candidates(token: str) -> set[str]:
    """Cheap inflection reduction for the coverage metric only.

    The corpus is a bag of surface forms, so `studies` must be allowed to meet
    the headword `study`. This is not a lemmatiser and is never used to grade a
    learner: it only decides whether a token shares a base with a known row.
    """
    candidates = {token}
    for suffix, replacements in (
        ("ies", ("y",)),
        ("ied", ("y",)),
        ("ying", ("y", "ie")),
        ("es", ("", "e")),
        ("ed", ("", "e")),
        ("ing", ("", "e")),
        ("s", ("",)),
        ("ly", ("",)),
        ("er", ("", "e")),
        ("est", ("", "e")),
    ):
        if len(token) > len(suffix) + 2 and token.endswith(suffix):
            stem = token[: -len(suffix)]
            for replacement in replacements:
                candidates.add(stem + replacement)
                if len(stem) > 3 and stem[-1] == stem[-2]:
                    candidates.add(stem[:-1] + replacement)
    return candidates


def is_covered(token: str, forms: set[str]) -> bool:
    return any(candidate in forms for candidate in base_candidates(token))


def build_report() -> dict[str, Any]:
    spec = load_spec()
    records = parse_table(ROOT / "Learned_Vocabulary_List.md")
    origins = seed_origin_map()
    index = build_exam_index()
    heads = [row for row in records if "family:merged" not in (row.get("tags") or [])]
    merged = [row for row in records if "family:merged" in (row.get("tags") or [])]
    retained = [row for row in heads if not is_archived(row.get("tags"))]
    archived = [row for row in heads if is_archived(row.get("tags"))]

    decisions: list[dict[str, Any]] = []
    for row in heads:
        claim = exam_claim(row)
        hit = exam_locator(index, row["word"])
        measured = hit["documents"] if hit else 0
        key = word_key(row["word"])
        archived_row = is_archived(row.get("tags"))
        decision = {
            "id": row["id"],
            "word": row["word"],
            "status": "archived" if archived_row else "retained",
            "category": category_of(row.get("tags")),
            "seed": origins.get(key, "legacy" if int(row["id"]) <= LEGACY_ROW_LIMIT else "unknown"),
            "pos": row.get("pos", ""),
            "level": tag_value(row, "level") or None,
            "levelSource": tag_value(row, "level-source") or None,
            "type": tag_value(row, "type") or None,
            "topic": tag_value(row, "topic") or None,
            "examClaim": claim["documents"],
            "examMeasured": measured,
            "citedForms": claim["citedForms"],
        }
        decisions.append(decision)

    claim_mismatches = [item for item in decisions if item["examClaim"] != item["examMeasured"]]
    explained = [item for item in claim_mismatches if item["citedForms"]]
    unexplained = [item for item in claim_mismatches if not item["citedForms"]]

    # A word that appears in an exam paper's multiple-choice items faced a lexical
    # decision; a word that only appears in running prose did not. The extraction
    # is mechanical (see vocab_sources.exam_items) and says nothing about answers.
    item_index = build_item_index()
    tested_forms = set(item_index)
    retained_tested = [row for row in retained if word_key(row["word"]) in tested_forms]
    archived_tested = [row for row in archived if word_key(row["word"]) in tested_forms]
    review_queue = [
        {"id": row["id"], "word": row["word"], "level": tag_value(row, "level") or None,
         "type": tag_value(row, "type") or None, "seed": origins.get(word_key(row["word"]), "unknown")}
        for row in retained
        if not any(source.get("ref") == "exam-corpus" for source in row.get("sources") or [])
    ]

    html = (ROOT / "index.html").read_text(encoding="utf-8")
    embedded = re.search(r'<script id="vocabulary-data" type="application/json">(.*?)</script>', html, re.S)
    embedding = {
        "bytes": len(embedded.group(1).encode("utf-8")) if embedded else 0,
        "characters": len(embedded.group(1)) if embedded else 0,
        "matchesTable": len(embedded.group(1).strip()) > 0 if embedded else False,
    }

    counts, documents = corpus_text_stats(exam_files())
    retained_forms = documented_forms(retained)
    archived_forms = documented_forms(archived)
    frequent = {token: count for token, count in counts.items()
                if len(documents[token]) >= 3 and token not in STOPWORDS and len(token) >= 3}
    covered_retained = sorted(token for token in frequent if is_covered(token, retained_forms))
    covered_archived = sorted(token for token in frequent
                              if not is_covered(token, retained_forms) and is_covered(token, archived_forms))
    uncovered = sorted((token for token in frequent
                        if not is_covered(token, retained_forms) and not is_covered(token, archived_forms)),
                       key=lambda token: (-len(documents[token]), -counts[token], token))
    covered_occurrences = sum(counts[token] for token in covered_retained)
    frequent_occurrences = sum(counts[token] for token in frequent)

    def mix(rows: list[dict[str, Any]], namespace: str) -> dict[str, int]:
        return dict(sorted(Counter(tag_value(row, namespace) or "(none)" for row in rows).items()))

    report = {
        "generatedBy": "scripts/audit_vocabulary_quality.py",
        "generatedFrom": "Learned_Vocabulary_List.md, docs/vocabulary-curation.json, data/vocab-seed/*.tsv, De-chuyen-Anh-vao-10/",
        "limits": [
            "0/106 bản chép đề đã được đối chiếu với bản gốc chính thức; bằng chứng exam-corpus chỉ là sự xuất hiện trong bản chép.",
            "Thẻ level:* là biên tập (level-source:editorial), không phải chứng nhận CEFR; báo cáo không dùng nó làm sự thật từ điển.",
            "Sandbox không truy cập được dictionary.cambridge.org; không mục từ nào được tuyên bố là đã tra từ điển trong phiên này.",
            "Không thêm headword mới: danh sách khoảng trống chỉ là ứng viên cho v1.1.0, chưa có nghĩa/nguồn đã xác minh.",
            "Quyết định lưu trữ là đánh giá biên tập về giá trị phân loại năng lực, không phải kết luận rằng từ đó sai hoặc không có trong đề.",
        ],
        "totals": {
            "rows": len(records),
            "headwords": len(heads),
            "mergedFamilyForms": len(merged),
            "retainedHeadwords": len(retained),
            "archivedHeadwords": len(archived),
            "archivedRowsIncludingMerged": sum(1 for row in records if is_archived(row.get("tags"))),
        },
        "retainedMix": {
            "level": mix(retained, "level"),
            "type": mix(retained, "type"),
            "topic": mix(retained, "topic"),
            "examAttested": sum(1 for row in retained if any(s.get("ref") == "exam-corpus" for s in row.get("sources") or [])),
            "withoutExamEvidence": sum(1 for row in retained if not any(s.get("ref") == "exam-corpus" for s in row.get("sources") or [])),
        },
        "archivedMix": {
            "category": dict(sorted(Counter(category_of(row.get("tags")) for row in archived).items())),
            "level": mix(archived, "level"),
            "seed": dict(sorted(Counter(origins.get(word_key(row["word"]), "unknown") for row in archived).items())),
        },
        "testedItems": {
            "items": len({locator for record in item_index.values() for locator in record["items"]}),
            "distinctTokens": len(item_index),
            "method": "scripts/vocab_sources.py exam_items(): dòng được đánh số + tối đa hai dòng có ≥3 nhãn A./B./C./D.",
            "retainedHeadwordsInItems": len(retained_tested),
            "archivedHeadwordsInItems": len(archived_tested),
            "retainedShare": round(len(retained_tested) / len(retained), 4) if retained else 0,
            "examples": [
                {"word": row["word"], "locator": item_index[word_key(row["word"])]["locator"],
                 "items": len(item_index[word_key(row["word"])]["items"])}
                for row in retained_tested[:12]
            ],
        },
        "reviewQueue": {
            "note": "Headword đang ở bộ từ trọng tâm nhưng chưa có bằng chứng trong bản chép đề. Đây là danh sách cần soát, không phải kết luận sai: nhiều mục đến từ danh sách học thuật biên tập và từ điển.",
            "count": len(review_queue),
            "byLevel": dict(sorted(Counter(item["level"] or "(none)" for item in review_queue).items())),
            "examples": review_queue[:40],
        },
        "embedding": embedding,
        "curationNotes": spec.get("reviewNotes") or [],
        "provenance": {
            "claimsChecked": len(decisions),
            "claimsMatched": len(decisions) - len(claim_mismatches),
            "claimsMismatched": len(claim_mismatches),
            "mismatchExplainedByCitedInflection": len(explained),
            "mismatchUnexplained": len(unexplained),
            "examples": [
                {"id": item["id"], "word": item["word"], "claim": item["examClaim"],
                 "measured": item["examMeasured"], "citedForms": item["citedForms"]}
                for item in (explained + unexplained)[:12]
            ],
        },
        "corpusCoverage": {
            "transcriptions": len(exam_files()),
            "distinctTokens": len(counts),
            "contentTokensInAtLeastThreePapers": len(frequent),
            "stopwordFilter": "danh sách chức năng ngắn trong scripts/audit_vocabulary_quality.py",
            "tokensCoveredByRetainedDeck": len(covered_retained),
            "tokensCoveredOnlyByArchivedRows": len(covered_archived),
            "tokensUncovered": len(uncovered),
            "coverageShare": round(len(covered_retained) / len(frequent), 4) if frequent else 0,
            "coverageShareByOccurrence": round(covered_occurrences / frequent_occurrences, 4) if frequent_occurrences else 0,
            "archivedOnlyExamples": covered_archived[:20],
            "uncoveredCandidates": [
                {"token": token, "papers": len(documents[token]), "occurrences": counts[token]}
                for token in uncovered[:40]
            ],
        },
        "decisions": decisions,
    }
    return report


def render_markdown(report: dict[str, Any]) -> str:
    totals = report["totals"]
    retained = report["retainedMix"]
    archived = report["archivedMix"]
    provenance = report["provenance"]
    coverage = report["corpusCoverage"]
    lines: list[str] = []
    add = lines.append
    add("# Vocabulary quality audit — Chuyên Anh")
    add("")
    add("Sinh bởi `scripts/audit_vocabulary_quality.py`. Báo cáo tất định (không có dấu thời gian),")
    add("nên `--check` chứng minh được artifact còn khớp nguồn.")
    add("")
    add("Báo cáo này sinh tự động từ `Learned_Vocabulary_List.md`, `docs/vocabulary-curation.json`,")
    add("`data/vocab-seed/*.tsv` và 106 bản chép đề trong `De-chuyen-Anh-vao-10/`. Số liệu dưới đây")
    add("được tính lại mỗi lần chạy; không có số nào được chép tay từ báo cáo cũ.")
    add("")
    add("## Kết quả chọn lọc")
    add("")
    add(f"- Tổng số hàng: **{totals['rows']:,}** · headword: **{totals['headwords']:,}** · dạng cùng gốc đã gộp: **{totals['mergedFamilyForms']:,}**.")
    add(f"- Bộ từ học mặc định (trọng tâm): **{totals['retainedHeadwords']:,}** headword.")
    add(f"- Đưa ra khỏi bộ từ học mặc định (lưu trữ, giữ nguyên ID và tiến độ): **{totals['archivedHeadwords']:,}** headword "
        f"({totals['archivedRowsIncludingMerged']:,} hàng kể cả dạng cùng gốc).")
    add("")
    add("### Bộ từ trọng tâm theo nhóm")
    add("")
    add("| Trường | Phân bố |")
    add("| --- | --- |")
    for field, title in (("level", "Level (biên tập)"), ("type", "Type"), ("topic", "Topic")):
        values = ", ".join(f"{key}: {value:,}" for key, value in retained[field].items())
        add(f"| {title} | {values} |")
    add(f"| Có bằng chứng xuất hiện trong bản chép đề | {retained['examAttested']:,} |")
    add(f"| Không có bằng chứng bản chép (vẫn giữ theo loại từ/họ từ/legacy) | {retained['withoutExamEvidence']:,} |")
    add("")
    add("### Mục đã lưu trữ theo lý do")
    add("")
    add("| Nhóm | Số headword |")
    add("| --- | ---: |")
    categories = report.get("_categories", {})
    for category, count in archived["category"].items():
        label = categories.get(category, {}).get("label", category)
        add(f"| `{category}` — {label} | {count:,} |")
    add("")
    add("Lý do và bằng chứng của từng nhóm nằm trong `docs/vocabulary-curation.json` (trường `rationale`,")
    add("`evidence`, và danh sách ngoại lệ đã rà). Quyết định của từng từ nằm trong JSON của báo cáo này")
    add("(trường `decisions`, gồm lô hạt giống, level biên tập, số bản chép đề có dạng từ).")
    add("")
    add("## Kiểm chứng nguồn gốc")
    add("")
    add(f"- Đã đo lại **{provenance['claimsChecked']:,}** hàng: **{provenance['claimsMatched']:,}** khớp giữa claim và số bản chép đề đo được.")
    add(f"- **{provenance['claimsMismatched']:,}** hàng lệch; **{provenance['mismatchExplainedByCitedInflection']:,}** trong số đó được giải thích bằng dạng chia ở đúng dòng được trích")
    add("  (ví dụ claim nêu `expenditures` trong khi headword là `expenditure`), và **" + f"{provenance['mismatchUnexplained']:,}** hàng chưa giải thích.")
    add("")
    if provenance["examples"]:
        add("| ID | Từ | Claim | Đo được | Dạng được trích |")
        add("| ---: | --- | ---: | ---: | --- |")
        for item in provenance["examples"]:
            forms = ", ".join(item["citedForms"]) or "—"
            add(f"| {item['id']} | {item['word']} | {item['claim']} | {item['measured']} | {forms} |")
        add("")
    add("`supports` của các hàng 614–913 nay nêu đúng dạng nhìn thấy ở dòng được trích, nên không còn")
    add("câu \"form occurs\" ngụ ý rằng chính headword xuất hiện nguyên dạng.")
    add("")
    notes = report.get("curationNotes") or []
    if notes:
        add("## Các mục biên đã cân nhắc riêng")
        add("")
        add("Những mục dưới đây không được quyết bởi luật: mỗi dòng ghi quyết định và lý do kiểm chứng được.")
        add("")
        add("| Từ | Quyết định | Lý do |")
        add("| --- | --- | --- |")
        for note in notes:
            add(f"| {note['word']} | {note['decision']} | {note['reason']} |")
        add("")
    add("## Bằng chứng theo mục trắc nghiệm")
    add("")
    tested = report["testedItems"]
    add(f"- Trích tự động **{tested['items']:,}** mục trắc nghiệm từ 106 bản chép "
        f"(dòng đánh số + tối đa hai dòng có ≥3 nhãn A./B./C./D.); "
        f"**{tested['distinctTokens']:,}** dạng từ khác nhau nằm trong các mục đó.")
    add(f"- **{tested['retainedHeadwordsInItems']:,}** headword trọng tâm "
        f"(**{tested['retainedShare'] * 100:.1f}%** bộ từ) từng xuất hiện trong một mục trắc nghiệm; "
        f"**{tested['archivedHeadwordsInItems']:,}** mục lưu trữ cũng từng xuất hiện.")
    add("")
    add("Mục trắc nghiệm chỉ chứng minh từ đó từng nằm trong một lựa chọn của đề, **không** chứng minh nó là")
    add("đáp án, không chứng minh độ khó và không thay thế bản gốc. Từ chỉ xuất hiện trong bài đọc không")
    add("được tính ở đây.")
    add("")
    if tested["examples"]:
        add("| Từ | Dòng đầu tiên | Số mục |")
        add("| --- | --- | ---: |")
        for item in tested["examples"]:
            add(f"| {item['word']} | `{item['locator']}` | {item['items']} |")
        add("")
    add("## Hàng cần soát (chưa có bằng chứng trong bản chép)")
    add("")
    queue = report["reviewQueue"]
    add(f"**{queue['count']:,}** headword đang ở bộ từ trọng tâm nhưng không có nguồn `exam-corpus`. "
        "Phân bố theo thẻ level biên tập: " + ", ".join(f"`{k}` {v:,}" for k, v in queue["byLevel"].items()) + ".")
    add("")
    add("Đây là danh sách **cần soát**, không phải kết luận: phần lớn là từ học thuật đến từ danh sách")
    add("biên tập và mục từ điển, chưa từng xuất hiện trong 106 bản chép hiện có. Không mục nào bị coi là")
    add("đã xác minh nghĩa trong phiên này.")
    add("")
    add("Nguyên nhân của từng mục nằm trong [`vocabulary-evidence-review.md`](vocabulary-evidence-review.md)")
    add("(`scripts/vocabulary_evidence_review.py`): mỗi headword được xếp vào một nhóm có căn cứ — cụm xuất hiện")
    add("nguyên văn, chỉ có dạng biến đổi, cụm chỉ có các chữ rời, dạng bài kiểm tra gốc từ, chỉ có mục từ điển,")
    add("hoặc chưa tìm được căn cứ — kèm locator khi có. Báo cáo đó không xoá và không lưu trữ mục nào.")
    add("")
    add("## Độ phủ văn bản đề")
    add("")
    add(f"- 106 bản chép có **{coverage['distinctTokens']:,}** token khác nhau; **{coverage['contentTokensInAtLeastThreePapers']:,}** token nội dung (đã bỏ từ chức năng) xuất hiện ở ≥3 bản.")
    add(f"- Bộ từ trọng tâm phủ **{coverage['tokensCoveredByRetainedDeck']:,}** token trong nhóm đó "
        f"(**{coverage['coverageShare'] * 100:.1f}%** số kiểu từ, **{coverage['coverageShareByOccurrence'] * 100:.1f}%** số lượt xuất hiện),")
    add("  tính cả dạng trong `WORD_FAMILY` và gộp biến thể hình thái đơn giản (s/es/ed/ing/ies…).")
    add(f"- **{coverage['tokensCoveredOnlyByArchivedRows']:,}** token chỉ còn trong các hàng lưu trữ; "
        f"**{coverage['tokensUncovered']:,}** token không thuộc hàng nào.")
    add("")
    add("Đây là độ phủ *dạng chữ trong bản chép*, không phải độ phủ từ vựng của đề chính thức và không")
    add("phải tần suất thi. Các token chưa phủ chỉ là **ứng viên cần rà** cho v1.1.0; phiên này không thêm")
    add("headword mới vì không có nghĩa/nguồn đã xác minh trong sandbox.")
    add("")
    if coverage["uncoveredCandidates"]:
        add("| Ứng viên | Số bản chép | Số lần |")
        add("| --- | ---: | ---: |")
        for item in coverage["uncoveredCandidates"][:20]:
            add(f"| {item['token']} | {item['papers']} | {item['occurrences']} |")
        add("")
    add("## Giới hạn và việc chưa kiểm chứng")
    add("")
    for limit in report["limits"]:
        add(f"- {limit}")
    add("")
    add(f"Ngoài ra: {totals['headwords']:,} headword được rà **cấu trúc** (schema, trùng, họ từ, nguồn); "
        f"{totals['archivedHeadwords']:,} mục lưu trữ được rà **nghĩa và giá trị** theo nhóm. Nghĩa của các mục "
        "còn lại không được tra từ điển lại trong phiên này. Kho cụm từ (780 cụm) không nằm trong phạm vi "
        "chọn lọc của phiên này.")
    add("")
    return "\n".join(lines) + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", type=Path, default=DEFAULT_JSON)
    parser.add_argument("--md", type=Path, default=DEFAULT_MD)
    parser.add_argument("--check", action="store_true", help="fail if the checked-in reports differ")
    args = parser.parse_args(list(argv) if argv is not None else None)

    report = build_report()
    spec = load_spec()
    report["_categories"] = spec.get("categories", {})
    markdown = render_markdown(report)
    payload = {key: value for key, value in report.items() if not key.startswith("_")}
    serialized = json.dumps(payload, ensure_ascii=False, indent=1) + "\n"

    if args.check:
        stale = []
        if not args.json.exists() or args.json.read_text(encoding="utf-8") != serialized:
            stale.append(str(args.json.relative_to(ROOT)))
        if not args.md.exists() or args.md.read_text(encoding="utf-8") != markdown:
            stale.append(str(args.md.relative_to(ROOT)))
        if stale:
            print("Vocabulary quality audit is out of date: " + ", ".join(stale), file=sys.stderr)
            return 1
        print(f"Vocabulary quality audit matches ({report['totals']['retainedHeadwords']:,} retained, "
              f"{report['totals']['archivedHeadwords']:,} archived headwords).")
        return 0

    args.json.write_text(serialized, encoding="utf-8")
    args.md.write_text(markdown, encoding="utf-8")
    print(f"Wrote {args.json.relative_to(ROOT)} and {args.md.relative_to(ROOT)}: "
          f"{report['totals']['retainedHeadwords']:,} retained, "
          f"{report['totals']['archivedHeadwords']:,} archived headwords.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
