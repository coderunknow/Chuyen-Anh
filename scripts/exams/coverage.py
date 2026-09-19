#!/usr/bin/env python3
"""Derive province/year coverage from the curated selection, not URL discovery counts."""
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'De-chuyen-Anh-vao-10'
PROVINCES = '''An Giang|Bà Rịa - Vũng Tàu|Bắc Giang|Bắc Kạn|Bạc Liêu|Bắc Ninh|Bến Tre|Bình Định|Bình Dương|Bình Phước|Bình Thuận|Cà Mau|Cần Thơ|Cao Bằng|Đà Nẵng|Đắk Lắk|Đắk Nông|Điện Biên|Đồng Nai|Đồng Tháp|Gia Lai|Hà Giang|Hà Nam|Hà Nội|Hà Tĩnh|Hải Dương|Hải Phòng|Hậu Giang|Hòa Bình|Hưng Yên|Khánh Hòa|Kiên Giang|Kon Tum|Lai Châu|Lâm Đồng|Lạng Sơn|Lào Cai|Long An|Nam Định|Nghệ An|Ninh Bình|Ninh Thuận|Phú Thọ|Phú Yên|Quảng Bình|Quảng Nam|Quảng Ngãi|Quảng Ninh|Quảng Trị|Sóc Trăng|Sơn La|Tây Ninh|Thái Bình|Thái Nguyên|Thanh Hóa|Huế|Tiền Giang|TP. Hồ Chí Minh|Trà Vinh|Tuyên Quang|Vĩnh Long|Vĩnh Phúc|Yên Bái'''.split('|')
CURRENT = '''An Giang|Bắc Ninh|Cà Mau|Cần Thơ|Cao Bằng|Đà Nẵng|Đắk Lắk|Điện Biên|Đồng Nai|Đồng Tháp|Gia Lai|Hà Nội|Hà Tĩnh|Hải Phòng|Hưng Yên|Khánh Hòa|Lai Châu|Lâm Đồng|Lạng Sơn|Lào Cai|Nghệ An|Ninh Bình|Phú Thọ|Quảng Ngãi|Quảng Ninh|Quảng Trị|Sơn La|Tây Ninh|Thái Nguyên|Thanh Hóa|Huế|TP. Hồ Chí Minh|Tuyên Quang|Vĩnh Long'''.split('|')


def main():
    plan = json.loads((ROOT / 'scripts/exams/selection.json').read_text())
    assert len(PROVINCES) == 63 and len(CURRENT) == 34
    normalize = lambda p: 'Huế' if p == 'Thừa Thiên Huế' else p
    provincial = {(normalize(r['province']), r['year']): r for r in plan if r['unit'] == 'so'}
    years = Counter(r['year'] for r in plan)
    ocr = sum('HTML' in r['quality'] for r in plan)
    n_answers = sum(not r['answers'].startswith('Chưa') for r in plan)
    lines = ['# Độ phủ tỉnh/thành × năm thi\n',
             '**Đây là bảng công việc còn thiếu, không phải tuyên bố đã thu thập hết toàn quốc.**\n',
             f"Chốt ngày 2026-09-19: **{len(plan)} bộ đề có nội dung `.md`**, trong đó **{len(plan)-ocr}** bộ từ PDF/DOCX và **{ocr}** bản HTML/OCR cần soát. "
             f"**{n_answers}** bộ có nội dung đáp án kèm theo (không đồng nghĩa tất cả là đáp án chính thức hoặc hoàn chỉnh).\n",
             '| Năm thi | Bộ đề đã nhập | Ô tỉnh–năm có bản của Sở | Tổng ô theo địa danh thời kỳ |',
             '| --- | ---: | ---: | ---: |']
    for year in range(2022, 2027):
        count = sum(y == year for _, y in provincial)
        lines.append(f'| {year} | {years[year]} | {count} | {34 if year == 2026 else 63} |')
    lines += ['\n## Quy ước\n',
              '- **B**: có bản chuyển từ PDF/DOCX; **O**: có bản HTML/OCR cần soát. Cả hai đều chưa được đối chiếu thủ công từng câu.\n'
              '- **Thiếu**: chưa có bản nội dung được nhập, không có nghĩa địa phương không tổ chức thi. Chưa rà hết nguồn của mọi ô.\n'
              '- **—**: không dùng tên đơn vị cũ làm một tỉnh riêng cho mùa thi 2026; không phải kết luận không có đề của trường tại địa bàn đó.\n'
              '- Các mùa 2022–2025 dùng danh mục địa danh trước sáp nhập; 2026 dùng 34 tên tỉnh/thành. Dòng Huế gộp nhãn Thừa Thiên Huế (đề cũ) và Huế để tra cứu, không đổi metadata của đề cũ.\n'
              '- Đề trường thuộc đại học ở bảng riêng bên dưới **không lấp ô còn thiếu của Sở**. Một ô có đề chưa chứng minh đã đủ mọi mã đề, trường, đợt thi hoặc phần thi.\n',
              '| Tỉnh/thành theo thời kỳ | 2022 | 2023 | 2024 | 2025 | 2026 |',
              '| --- | --- | --- | --- | --- | --- |']
    for province in PROVINCES:
        cells = []
        for year in range(2022, 2027):
            if year == 2026 and province not in CURRENT:
                cells.append('—')
            elif (province, year) in provincial:
                r = provincial[province, year]
                label = 'O' if 'HTML' in r['quality'] else 'B'
                cells.append(f"[{label}]({r['key']}.md)")
            else:
                cells.append('Thiếu')
        label = 'Thừa Thiên Huế / Huế' if province == 'Huế' else province
        lines.append('| ' + label + ' | ' + ' | '.join(cells) + ' |')
    lines += ['\n## Trường thuộc đại học / kỳ thi riêng\n', '| Năm | Đơn vị | Đề |', '| --- | --- | --- |']
    for r in plan:
        if r['unit'] != 'so':
            lines.append(f"| {r['year']} | {r['unit_label']} | [Đọc]({r['key']}.md) |")
    lines += ['\n## Ưu tiên tiếp theo\n',
              '1. Xin bản gốc/nguồn chính thức cho các ô thiếu; đặc biệt mùa 2024 còn ít bản.\n'
              '2. Xử lý danh sách [nguồn đang vướng](NGUON-CHO-XU-LY.md), không điền đề trống để làm đẹp độ phủ.\n'
              '3. Đối chiếu từng trang/câu, gạch chân, bảng và phần nghe của các bản O trước khi dùng để chấm điểm.\n'
              '4. Bổ sung nguồn độc lập từ Sở/trường; không dựa hoàn toàn vào một trang đăng lại.\n']
    (OUT / 'DO-PHU.md').write_text('\n'.join(lines).rstrip() + '\n')
    print('Records:', len(plan), 'PDF/DOCX:', len(plan)-ocr, 'HTML/OCR:', ocr, 'With answers:', n_answers)


if __name__ == '__main__':
    main()
