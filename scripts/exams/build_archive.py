#!/usr/bin/env python3
"""Build Markdown only from an explicitly reviewed selection (no automatic acceptance)."""
import hashlib
import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ARCHIVE = ROOT / 'De-chuyen-Anh-vao-10'
REVIEW = ROOT / '.source-review'
PLAN = ROOT / 'scripts/exams/selection.json'
DATE = '2026-09-19'


def body_of(asset):
    text = (REVIEW / asset['file']).read_text(encoding='utf-8')
    assert asset['sha256'] in text[:2000], f"Source changed: {asset['file']}"
    if asset['type'] == 'html':
        text = text.split('- Ngày truy cập: 2026-09-19', 1)[1].strip()
        marker = asset.get('start')
        if marker:
            assert marker in text, (asset['file'], marker)
            text = text[text.index(marker):]
    elif asset['type'] == 'pdf':
        text = text[text.index('## Trang 1'):]
    else:
        text = text.split('- SHA-256: ', 1)[1].split('\n\n', 1)[1]
    if asset.get('end'):
        assert asset['end'] in text
        text = text[:text.index(asset['end'])]
    # Explicit, documented redaction of an actual student's name on a scanned copy.
    text = text.replace('Trần Hà Quyên', '[đã ẩn tên thí sinh]')
    text = text.replace('SBD: 0567', 'SBD: [đã ẩn số báo danh]')
    text = text.replace('Họ và tên thí sinh: Phùn', 'Họ và tên thí sinh: [đã ẩn chữ viết tay]')
    text = text.replace('Họ và tên thí sinh:...TH Số báo danh: .......052.52....',
                        'Họ và tên thí sinh: [đã ẩn] Số báo danh: [đã ẩn]')
    if asset['type'] == 'docx':
        # Word exports can expose both Choice/Fallback copies of header badges.
        for badge in ('ĐỀ CHÍNH THỨC', 'ĐÁP ÁN THAM KHẢO', 'ĐÁP ÁN CHÍNH THỨC'):
            text = text.replace(badge + badge, badge)
        text = text.replace('****', '')  # Join adjacent bold runs, not exam wording.
    if asset['type'] != 'pdf':
        # GitHub must not silently renumber source question numbers as Markdown lists.
        text = re.sub(r'(?m)^(\d{1,3})\. ', r'\1\\. ', text)
    # Do not retain invisible tracking images, advertising, or executable markup.
    text = re.sub(r'!\[[^\]]*\]\([^\n]*\)', '[Hình trong nguồn — xem liên kết bản gốc]', text)
    assert not re.search(r'<(?:script|iframe)\b', text, re.I)
    return '\n'.join(line.rstrip() for line in text.strip().splitlines()) + '\n'


def build(plan):
    for record in plan:
        target = ARCHIVE / (record['key'] + '.md')
        target.parent.mkdir(parents=True, exist_ok=True)
        contents = []
        for asset in record['assets']:
            contents.append('## ' + asset.get('label', 'Nội dung đề và đáp án trong nguồn') + '\n\n' + body_of(asset))
        content = '\n'.join(contents)
        assert len(content) > 5000, record['key']
        meta = {
            'id': record['key'].replace('/', '-'),
            'nam_thi': record['year'],
            'nam_hoc': f"{record['year']}-{record['year']+1}",
            'tinh_thanh': record['province'],
            'don_vi': record['unit_label'],
            'nguon_trang': record['source'],
            'ngay_truy_cap': DATE,
            'xac_minh': 'ban-dang-lai-co-tieu-de-ky-thi',
            'chat_luong': record['quality'],
            'dap_an': record['answers'],
            'sha256_noi_dung': hashlib.sha256(content.encode()).hexdigest(),
        }
        front = '---\n' + ''.join(f'{k}: {json.dumps(v, ensure_ascii=False)}\n' for k, v in meta.items()) + '---\n\n'
        heading = f"# {record['province']} — Chuyên Anh vào 10 — {record['year']}-{record['year']+1}\n\n"
        heading += f"**Đơn vị/kỳ thi:** {record['unit_label']}.\n\n"
        heading += ('> **Bản chép từ nguồn đăng lại, không phải bản phát hành của Sở/trường.** '
                    'Đã kiểm tra nhãn kỳ thi, năm và môn chuyên trong nội dung nguồn; '
                    'chưa đối chiếu thủ công từng câu với bản gốc. Không coi bản này là bản chuẩn tuyệt đối.\n\n')
        heading += '## Nguồn và giới hạn\n\n'
        heading += f"- Trang đăng: [{record['source']}]({record['source']}).\n"
        for asset in record['assets']:
            heading += f"- Nội dung lấy từ [{asset['type'].upper()}]({asset['url']}); SHA-256 tệp nguồn: `{asset['sha256']}`.\n"
            if asset.get('original'):
                heading += f"  - Thành viên trong gói tải: `{asset['original']}`.\n"
            if asset.get('pages'):
                heading += f"  - Đã trích văn bản từ cả {asset['pages']} trang PDF; không thay trang ảnh trống bằng văn bản tự tạo.\n"
        heading += '- Đáp án: ' + record['answers'] + '. Không tự sinh đáp án còn thiếu.\n'
        heading += ('- File nghe: không nhúng vào Markdown; xem trang/gói nguồn. '
                    'Chưa xác minh khả năng phát hoặc sự đầy đủ của audio.\n')
        heading += '- ' + record['note'] + '\n'
        heading += ('- Giữ nguyên nội dung bài đọc và cả lỗi cố ý trong bài sửa lỗi; '
                    'không tự “sửa ngữ pháp” của đề.\n\n')
        target.write_text(front + heading + content, encoding='utf-8')
    return len(plan)


def indexes(plan):
    counts = Counter(r['year'] for r in plan)
    rows = ['# Danh mục bản chép đề thi\n',
            'Mỗi dòng là một bộ đề theo tỉnh/năm/đơn vị, không phải một mã đề duy nhất đã bao quát mọi biến thể. '
            'Đáp án chỉ được lưu khi có trong tài liệu nguồn. [Giới hạn và quy ước](README.md).\n',
            '| Năm thi | Tỉnh/thành | Đơn vị/kỳ thi | Bản Markdown | Chất lượng | Đáp án |',
            '| --- | --- | --- | --- | --- | --- |']
    for r in sorted(plan, key=lambda r: (r['year'], r['province'], r['key'])):
        rows.append(f"| {r['year']} | {r['province']} | {r['unit_label']} | [Đọc đề]({r['key']}.md) | {r['quality']} | {r['answers']} |")
    (ARCHIVE / 'DANH-MUC.md').write_text('\n'.join(rows) + '\n')
    return counts


def main():
    plan = json.loads(PLAN.read_text())
    assert len({r['key'] for r in plan}) == len(plan)
    print('Built', build(plan), 'records')
    print('By year:', dict(sorted(indexes(plan).items())))


if __name__ == '__main__':
    main()
