#!/usr/bin/env python3
"""Measure what the exam archive can and cannot prove about its own sources.

The archive stores 106 transcriptions. Each one carries front matter naming the
page it was captured from, the capture date, an answer-key claim, a quality
label and a SHA-256 of the transcribed content. Those claims are checkable
offline, and this script checks them:

* the **content hash** must match the body the file actually stores, so a silent
  edit to a transcription cannot go unnoticed;
* the **source host** is counted, and the result is blunt: every paper comes from
  one commercial republisher, so no paper is backed by an official
  Sở/trường page;
* the **answer claim** is compared with what the body contains (an answer
  section or an answer table), which separates "claimed and present" from
  "claimed but not found in the body" — the second group is flagged, not
  silently corrected, because the missing evidence may have been dropped during
  extraction and cannot be replaced from here;
* manual cross-checks against independent reproductions live in
  `docs/exam-crosschecks.json`; this script validates and renders them, and never
  upgrades a paper to "verified" on its own.

`verification` is therefore one of: `unverified` (nothing beyond the capture),
`cross-checked-secondary` (a manual entry in the cross-check file agrees), and
`verified-primary` — which no paper has, because no official original was
obtained.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from collections import Counter
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / "De-chuyen-Anh-vao-10"
CROSSCHECKS = ROOT / "docs" / "exam-crosschecks.json"
DEFAULT_JSON = ROOT / "docs" / "exam-provenance-audit.json"
DEFAULT_MD = ROOT / "docs" / "exam-provenance-audit.md"
YEAR_RE = re.compile(r"^20\d\d$")
FRONT_RE = re.compile(r"\A---\n(?P<front>.*?)\n---\n", re.S)
LIMITS_HEADING = "## Nguồn và giới hạn"
ANSWER_PATTERNS = (
    re.compile(r"^## .*Đáp án", re.M),
    re.compile(r"ĐÁP ÁN"),
    re.compile(r"^## .*Answer", re.M | re.I),
    re.compile(r"(?m)^\|\s*\d{1,3}\s*\|\s*[A-Da-d]\s*\|"),
)


def paper_paths() -> list[Path]:
    return sorted(path for path in ARCHIVE.rglob("*.md")
                  if YEAR_RE.match(path.relative_to(ARCHIVE).parts[0]))


def parse_front_matter(text: str) -> dict[str, str]:
    match = FRONT_RE.match(text)
    if not match:
        raise ValueError("missing front matter")
    meta: dict[str, str] = {}
    for line in match.group("front").splitlines():
        key, _, raw = line.partition(":")
        if not raw:
            continue
        raw = raw.strip()
        try:
            meta[key.strip()] = json.loads(raw)
        except ValueError:
            meta[key.strip()] = raw.strip('"')
    return meta


def transcribed_body(text: str) -> str:
    """The bytes the content hash covers: everything after the archive's own notes."""
    match = FRONT_RE.match(text)
    assert match, "front matter is required"
    body = text[match.end():]
    start = body.index(LIMITS_HEADING)
    next_heading = body.index("## ", start + len(LIMITS_HEADING))
    return body[next_heading:]


def has_answer_evidence(body: str) -> bool:
    return any(pattern.search(body) for pattern in ANSWER_PATTERNS)


def build_report() -> dict[str, Any]:
    crosschecks = json.loads(CROSSCHECKS.read_text(encoding="utf-8"))
    checked = {entry["id"]: entry for entry in crosschecks["papers"]}
    papers: list[dict[str, Any]] = []
    ids: set[str] = set()
    content_hash_ok = 0
    for path in paper_paths():
        text = path.read_text(encoding="utf-8")
        meta = parse_front_matter(text)
        body = transcribed_body(text)
        stored = hashlib.sha256(body.encode("utf-8")).hexdigest()
        declared = meta.get("sha256_noi_dung", "")
        answer_present = has_answer_evidence(body)
        answer_claim = meta.get("dap_an", "")
        claims_answer = answer_claim.startswith("Có")
        entry = checked.get(meta["id"])
        if stored == declared:
            content_hash_ok += 1
        ids.add(meta["id"])
        papers.append({
            "id": meta["id"],
            "path": path.relative_to(ROOT).as_posix(),
            "year": meta.get("nam_thi"),
            "province": meta.get("tinh_thanh"),
            "unit": meta.get("don_vi"),
            "sourceHost": urlsplit(meta.get("nguon_trang", "")).hostname or "",
            "sourceUrl": meta.get("nguon_trang", ""),
            "accessed": meta.get("ngay_truy_cap"),
            "verificationLabel": meta.get("xac_minh"),
            "quality": meta.get("chat_luong"),
            "answerClaim": answer_claim,
            "answerClaimed": claims_answer,
            "answerSectionInBody": answer_present,
            "answerClaimWithoutSection": claims_answer and not answer_present,
            "contentHashMatches": stored == declared,
            "verification": ("cross-checked-secondary" if entry else "unverified"),
            "crossCheckStatus": entry["status"] if entry else None,
        })
    papers.sort(key=lambda item: (item["year"], item["province"], item["id"]))
    unsupported = [paper for paper in papers if paper["answerClaimWithoutSection"]]
    missing_ids = sorted(set(checked) - ids)
    if missing_ids:
        raise ValueError(f"cross-check entries name unknown papers: {missing_ids}")
    return {
        "generatedBy": "scripts/audit_exam_provenance.py",
        "generatedFrom": "De-chuyen-Anh-vao-10/**/*.md + docs/exam-crosschecks.json",
        "crossCheckedAt": crosschecks.get("checkedAt"),
        "totals": {
            "papers": len(papers),
            "contentHashMatches": content_hash_ok,
            "distinctSourceHosts": len({paper["sourceHost"] for paper in papers}),
            "papersWithOfficialSource": 0,
            "verifiedPrimary": sum(1 for paper in papers if paper["verification"] == "verified-primary"),
            "crossCheckedSecondary": sum(1 for paper in papers if paper["verification"] == "cross-checked-secondary"),
            "answerClaimed": sum(1 for paper in papers if paper["answerClaimed"]),
            "answerSectionInBody": sum(1 for paper in papers if paper["answerSectionInBody"]),
            "answerClaimWithoutSection": len(unsupported),
        },
        "byYear": dict(sorted(Counter(str(paper["year"]) for paper in papers).items())),
        "byQuality": dict(sorted(Counter(paper["quality"] or "(none)" for paper in papers).items())),
        "bySourceHost": dict(sorted(Counter(paper["sourceHost"] for paper in papers).items())),
        "answerClaimWithoutSectionIds": [paper["id"] for paper in unsupported],
        "crosschecks": [
            {
                "id": entry["id"],
                "status": entry["status"],
                "primarySourceFound": entry["primarySourceFound"],
                "reproductions": entry["reproductions"],
                "anchors": entry["anchors"],
                "differences": entry.get("differences", []),
            }
            for entry in crosschecks["papers"]
        ],
        "papers": papers,
        "limits": [
            "0/106 bộ đề được đối chiếu với bản gốc do Sở/trường phát hành: chưa tìm thấy bản gốc cho bộ nào trong phạm vi phiên này.",
            "Cả 106 bộ đều lấy từ một trang đăng lại (tailieudieuky.com); không có nguồn chính thức nào trong kho.",
            "SHA-256 nội dung chứng minh tệp không bị sửa sau khi chép, không chứng minh bản chép đúng bản gốc.",
            "Đáp án chưa được đối chiếu với đáp án chính thức; chỉ có 3 bộ được đối chiếu thủ công với bản đăng lại độc lập (xem docs/exam-crosschecks.json).",
        ],
    }


def render(report: dict[str, Any]) -> str:
    totals = report["totals"]
    lines: list[str] = []
    add = lines.append
    add("# Kiểm chứng nguồn và đáp án của kho đề")
    add("")
    add("Sinh tự động bởi `scripts/audit_exam_provenance.py`; `--check` chứng minh tệp còn khớp dữ liệu.")
    add("Đối chiếu thủ công gần nhất: **" + str(report["crossCheckedAt"]) + "**.")
    add("")
    add("| Chỉ số | Giá trị |")
    add("| --- | ---: |")
    add(f"| Số bộ đề | {totals['papers']} |")
    add(f"| Nội dung khớp SHA-256 ghi trong front matter | {totals['contentHashMatches']}/{totals['papers']} |")
    add(f"| Số trang nguồn khác nhau | {totals['distinctSourceHosts']} |")
    add(f"| Bộ có nguồn chính thức của Sở/trường | {totals['papersWithOfficialSource']} |")
    add(f"| Bộ đối chiếu được với bản gốc chính thức | {totals['verifiedPrimary']} |")
    add(f"| Bộ đối chiếu thủ công với bản đăng lại độc lập | {totals['crossCheckedSecondary']} |")
    add(f"| Bộ khai có đáp án | {totals['answerClaimed']} |")
    add(f"| Bộ thực sự có mục đáp án trong bản chép | {totals['answerSectionInBody']} |")
    add(f"| Bộ khai có đáp án nhưng bản chép không có mục đáp án | {totals['answerClaimWithoutSection']} |")
    add("")
    add("## Nguồn theo tên miền")
    add("")
    add("| Tên miền | Số bộ |")
    add("| --- | ---: |")
    for host, count in report["bySourceHost"].items():
        add(f"| `{host}` | {count} |")
    add("")
    add("## Chất lượng bản chép")
    add("")
    add("| Nhãn | Số bộ |")
    add("| --- | ---: |")
    for quality, count in report["byQuality"].items():
        add(f"| {quality} | {count} |")
    add("")
    add("## Đối chiếu thủ công")
    add("")
    add("Mỗi bộ dưới đây được so từng mốc với bản đăng lại độc lập. Không bộ nào được coi là đã xác minh bản gốc.")
    add("")
    add("| Bộ đề | Trạng thái | Mốc khớp | Khác biệt |")
    add("| --- | --- | ---: | --- |")
    for entry in report["crosschecks"]:
        matched = sum(1 for anchor in entry["anchors"] if anchor["match"])
        differences = " ".join(entry["differences"]) or "—"
        add(f"| `{entry['id']}` | {entry['status']} | {matched}/{len(entry['anchors'])} | {differences} |")
    add("")
    for entry in report["crosschecks"]:
        add(f"### `{entry['id']}`")
        add("")
        add("| Mốc | Trong bản chép | Trong nguồn | Khớp |")
        add("| --- | --- | --- | --- |")
        for anchor in entry["anchors"]:
            add(f"| {anchor['fact']} | {anchor['repo']} | {anchor['source']} | "
                f"{'✅' if anchor['match'] else '❌'} |")
        add("")
        for reproduction in entry["reproductions"]:
            add(f"- {reproduction['publisher']}: <{reproduction['url']}>")
        add("")
    add("## Bộ khai có đáp án nhưng bản chép không có mục đáp án")
    add("")
    add("Đây là **phép đo**, không phải kết luận rằng nhãn sai: trong phần nội dung của các bộ này không có")
    add("tiêu đề đáp án, không có bảng đáp án và không có dòng trả lời dạng chữ cái nào. Đáp án có thể đã bị")
    add("mất khi trích xuất, hoặc nằm trong ảnh không chép được, hoặc nhãn được đặt theo trang nguồn.")
    add("Nhãn trong front matter được giữ nguyên (không sửa dữ liệu lịch sử) cho tới khi có người mở bản gốc.")
    add("")
    add("Đã đọc thủ công 1/8 bộ: `2026-quang-tri-so` chỉ có hướng dẫn chấm thi **nói**, không có đáp án cho")
    add("phần viết. Bảy bộ còn lại mới chỉ được đo, chưa đọc từng dòng.")
    add("")
    for paper_id in report["answerClaimWithoutSectionIds"]:
        add(f"- `{paper_id}`")
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
    payload = json.dumps(report, ensure_ascii=False, indent=1) + "\n"
    markdown = render(report)
    if args.check:
        problems = []
        for path, expected in ((args.json, payload), (args.md, markdown)):
            if not path.exists():
                problems.append(f"{path.relative_to(ROOT)} is missing")
            elif path.read_text(encoding="utf-8") != expected:
                problems.append(f"{path.relative_to(ROOT)} is stale; run python scripts/audit_exam_provenance.py")
        if problems:
            print("\n".join(problems))
            return 1
        print(f"Exam provenance audit matches ({report['totals']['papers']} papers, "
              f"{report['totals']['contentHashMatches']} content hashes verified).")
        return 0
    args.json.write_text(payload, encoding="utf-8")
    args.md.write_text(markdown, encoding="utf-8")
    print(f"Wrote {args.json.relative_to(ROOT)} and {args.md.relative_to(ROOT)}: "
          f"{report['totals']['papers']} papers, {report['totals']['contentHashMatches']} content hashes verified, "
          f"{report['totals']['answerClaimWithoutSection']} answer claims without a section.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
