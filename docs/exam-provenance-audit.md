# Kiểm chứng nguồn và đáp án của kho đề

Sinh tự động bởi `scripts/audit_exam_provenance.py`; `--check` chứng minh tệp còn khớp dữ liệu.
Đối chiếu thủ công gần nhất: **2026-10-28**.

| Chỉ số | Giá trị |
| --- | ---: |
| Số bộ đề | 106 |
| Nội dung khớp SHA-256 ghi trong front matter | 106/106 |
| Số trang nguồn khác nhau | 1 |
| Bộ có nguồn chính thức của Sở/trường | 0 |
| Bộ đối chiếu được với bản gốc chính thức | 0 |
| Bộ đối chiếu thủ công với bản đăng lại độc lập | 3 |
| Bộ khai có đáp án | 74 |
| Bộ thực sự có mục đáp án trong bản chép | 66 |
| Bộ khai có đáp án nhưng bản chép không có mục đáp án | 8 |

## Nguồn theo tên miền

| Tên miền | Số bộ |
| --- | ---: |
| `tailieudieuky.com` | 106 |

## Chất lượng bản chép

| Nhãn | Số bộ |
| --- | ---: |
| DOCX | 28 |
| DOCX/PDF-text | 2 |
| HTML/OCR-cần-soát | 22 |
| PDF-text | 49 |
| PDF-text/DOCX | 5 |

## Đối chiếu thủ công

Mỗi bộ dưới đây được so từng mốc với bản đăng lại độc lập. Không bộ nào được coi là đã xác minh bản gốc.

| Bộ đề | Trạng thái | Mốc khớp | Khác biệt |
| --- | --- | ---: | --- |
| `2025-hai-phong-so` | consistent-with-independent-reproductions | 5/5 | Hướng dẫn phần nghe II: bản trong repo lấy từ HƯỚNG DẪN CHẤM (ONE WORD or A NUMBER), bản Springboard lấy từ đề (NO MORE THAN THREE WORDS). Khác biệt giữa hai tài liệu của cùng một kỳ thi, không kết luận bản nào sai. |
| `2023-dak-lak-so` | consistent-with-independent-reproductions | 6/6 | Số trang: bản chép ghi 'Đề thi gồm có 11 trang', bản sao College Sidekick ghi 10 trang. Cả hai đều là bản đăng lại; không xác định được bản nào đúng khi chưa có bản gốc. |
| `2025-binh-duong-so` | consistent-with-independent-reproductions | 4/4 | — |

### `2025-hai-phong-so`

| Mốc | Trong bản chép | Trong nguồn | Khớp |
| --- | --- | --- | --- |
| Thời gian làm bài | 150 phút | 150 phút | ✅ |
| Mã đề | 881 | 881 (bản tóm tắt nguồn) | ✅ |
| Số trang | 08 trang | 08 trang (bản tóm tắt nguồn) | ✅ |
| Cấu trúc | SECTION ONE: CONSTRUCTED-RESPONSE TEST | SECTION ONE: CONSTRUCTED-RESPONSE TEST | ✅ |
| Câu mở đầu bài nghe | You will hear part of a conversation between Jim - a student and a secretary on campus | You will hear part of a conversation between Jim – a student and a secretary on campus | ✅ |

- TailieuDieuKy (chính là trang nguồn ghi trong front matter): <https://tailieudieuky.com/baiviet/document/de-thi-ts-chuyen-anh-vao-lop-10-tran-phu-hai-phong-2025/>
- Springboard – Nhà Xuân: <https://springboard.vn/de-thi-chuyen-anh-10-hai-phong-2025-2026/>
- Nghengu.vn: <https://nghengu.vn/toan/de-thi-vao-10-hai-phong-11888.html>

### `2023-dak-lak-so`

| Mốc | Trong bản chép | Trong nguồn | Khớp |
| --- | --- | --- | --- |
| Thời gian làm bài | 150 phút | 150 phút | ✅ |
| Bài nghe part 2, câu 6-10 | destination / departure date / flight number / layover / request | cùng 5 câu, cùng phương án | ✅ |
| Đáp án câu 1 | Lynda | Lynda | ✅ |
| Đáp án câu 2 | 5577 | 5577 | ✅ |
| Đáp án câu 4 | AZ1985331 | AZ1985331 | ✅ |
| Đáp án câu 5 | September | September | ✅ |

- TailieuDieuKy (chính là trang nguồn ghi trong front matter): <https://tailieudieuky.com/baiviet/document/de-thi-chuyen-tieng-anh-vao-truong-thpt-chuyen-nguyen-du-dak-lak-nam-hoc-2023-2024-co-dap-an-va-audio-file-nghe-transcript/>
- College Sidekick (bản sao độc lập của cùng đề): <https://www.collegesidekick.com/study-docs/19895536>

### `2025-binh-duong-so`

| Mốc | Trong bản chép | Trong nguồn | Khớp |
| --- | --- | --- | --- |
| Thời gian làm bài | 150 phút | 150 phút | ✅ |
| Số trang | 10 trang | 10 trang | ✅ |
| Số phần | 5 phần | 5 phần | ✅ |
| Số câu | 140 câu, đánh số đủ 1..140 | 140 câu | ✅ |

- TailieuDieuKy (chính là trang nguồn ghi trong front matter): <https://tailieudieuky.com/baiviet/document/de-chuyen-anh-binh-duong-2025-2026/>

## Bộ khai có đáp án nhưng bản chép không có mục đáp án

Đây là **phép đo**, không phải kết luận rằng nhãn sai: trong phần nội dung của các bộ này không có
tiêu đề đáp án, không có bảng đáp án và không có dòng trả lời dạng chữ cái nào. Đáp án có thể đã bị
mất khi trích xuất, hoặc nằm trong ảnh không chép được, hoặc nhãn được đặt theo trang nguồn.
Nhãn trong front matter được giữ nguyên (không sửa dữ liệu lịch sử) cho tới khi có người mở bản gốc.

Đã đọc thủ công 1/8 bộ: `2026-quang-tri-so` chỉ có hướng dẫn chấm thi **nói**, không có đáp án cho
phần viết. Bảy bộ còn lại mới chỉ được đo, chưa đọc từng dòng.

- `2022-ha-noi-so`
- `2022-hai-duong-so`
- `2022-dong-thap-so`
- `2023-ba-ria-vung-tau-so`
- `2023-phu-yen-so`
- `2023-dong-nai-so`
- `2024-tp-ho-chi-minh-so`
- `2026-quang-tri-so`

## Giới hạn

- 0/106 bộ đề được đối chiếu với bản gốc do Sở/trường phát hành: chưa tìm thấy bản gốc cho bộ nào trong phạm vi phiên này.
- Cả 106 bộ đều lấy từ một trang đăng lại (tailieudieuky.com); không có nguồn chính thức nào trong kho.
- SHA-256 nội dung chứng minh tệp không bị sửa sau khi chép, không chứng minh bản chép đúng bản gốc.
- Đáp án chưa được đối chiếu với đáp án chính thức; chỉ có 3 bộ được đối chiếu thủ công với bản đăng lại độc lập (xem docs/exam-crosschecks.json).
