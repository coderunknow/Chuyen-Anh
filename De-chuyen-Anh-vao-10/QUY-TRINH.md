# Quy trình thu thập và kiểm tra

Ngày chốt lần nhập: **2026-09-19**. Phạm vi do chủ repo chọn: mùa thi 2022–2026, nội dung Markdown, đáp án nếu lấy được, chấp nhận bản đăng lại có thông tin kỳ thi.

## 1. Khám phá không đồng nghĩa với chấp nhận

Tra cứu các tuyển tập, API bài viết công khai và liên kết tài liệu. Chỉ tải tài liệu không cần đăng nhập. Tác vụ có giới hạn thời gian, kích thước tải và giải nén; không giải nén đường dẫn do ZIP cung cấp ra hệ thống tệp. PDF/Word/ZIP/audio không được thêm vào thư mục đề chính thức.

Đã dùng GitHub Actions vì môi trường làm việc không tải trực tiếp được các website tài liệu. Các bản chép chưa duyệt được tạm đưa lên nhánh PR để rà soát, **không đưa trực tiếp vào `main`**. Toàn bộ thư mục trung gian được bỏ khỏi thay đổi cuối cùng. Workflow lưu trong repo ở trạng thái cuối chỉ có quyền đọc, chạy thủ công và xuất artifact; **không có bước commit/push/merge tự động**.

## 2. Chọn bản để nhập

- Dùng năm thi đầu tiên trong năm học, kiểm tra lại trên phần đầu nội dung đề.
- Kiểm tra môn chuyên và đối tượng dự thi. Tên trường “chuyên” một mình không chứng minh đây là môn Anh chuyên.
- Loại đề đại trà, thi thử, HSG, tài liệu khác năm và tài liệu đính kèm không liên quan.
- Ưu tiên tệp Word hoặc PDF có lớp văn bản của cả tệp, tránh dùng đoạn trích giới thiệu khi lấy được tệp đầy đủ.
- Không nhập PDF toàn ảnh như thể đã chép xong. Những bản HTML/OCR còn dùng được có cảnh báo riêng; các bản có mâu thuẫn năm hoặc hỏng nặng được đưa vào danh sách chờ.
- Chọn một bản theo bộ tỉnh/năm/đơn vị để tránh đếm trùng. Không có cam kết bao phủ mọi mã đề. Một số tệp chứa nhiều phần hoặc đáp án xen kẽ, được giữ theo thứ tự của nguồn.
- Đáp án ghi “chính thức” trong tệp đăng lại vẫn chỉ là **theo nguồn đăng lại**, không biến thành nguồn chính thức của repo. Có phân biệt các tệp ghi rõ “tham khảo”.

Danh sách được chọn, loại nguồn, đường dẫn, SHA-256, thành viên trong ZIP và ghi chú biên tập nằm trong [`selection.json`](../scripts/exams/selection.json). Đây là metadata kỹ thuật; **toàn bộ nội dung đề trong thư mục này là `.md`**.

## 3. Chuyển đổi

- PDF: trích toàn bộ trang, giữ ranh giới trang và khối `text`. Không OCR tự động rồi tuyên bố đó là văn bản đã xác minh.
- DOCX: đọc OOXML, chuyển đoạn/bảng; giữ gạch chân bằng `<u>`, dùng nhãn khi gặp hình/đối tượng không chuyển được. Ưu tiên bản không có hình; trường hợp có hình được ghi chú.
- HTML: tách nội dung đề khỏi lời giới thiệu và quảng cáo, giữ nội dung có trong nguồn, không tự viết tiếp phần thiếu.
- Chuẩn hóa khoảng trắng cuối dòng và ngăn Markdown tự đánh lại số câu. Gộp các run chữ đậm liền nhau và nhãn đầu trang bị Word xuất lặp. Không sửa từ hoặc ngữ pháp của câu hỏi: đề có thể cố ý chứa lỗi.
- Ẩn một số thông tin thí sinh đã điền trên bản scan (chữ viết tay/số báo danh); giữ mẫu trường thông tin và **không ẩn mã đề**. Không đưa bài làm cá nhân vào kho để nhận diện thí sinh.

Không sửa đoán các lỗi OCR như năm 2022 bị đọc thành 2012/2017. Chưa có kiểm chứng độc lập toàn bộ bản gốc; một trang có nhiều ký tự không chứng minh mọi hình, gạch chân hoặc ô bảng đã được trích đúng.

## 4. Kiểm tra tự động

```bash
python -m venv .venv
.venv/bin/pip install -r scripts/exams/requirements.txt
.venv/bin/python scripts/exams/test_archive.py
.venv/bin/python scripts/exams/coverage.py
```

Kiểm tra:

- Tệp Markdown khớp danh sách đã chọn, không có ID hoặc nội dung trùng hệt.
- Đúng khoảng năm, năm học khớp năm thi, có URL nguồn và SHA-256.
- Có nội dung đề, không chỉ là trang metadata/link; kiểm tra checksum nội dung.
- Link nội bộ tồn tại, khối code cân bằng, không có script/iframe trong bản chép.
- Chuyển đổi gạch chân HTML/DOCX và dấu `|` trong bảng hoạt động.
- CI dựng lại bảng độ phủ từ manifest và kiểm tra không lệch với bản đã lưu.

**Các kiểm tra này không xác minh đúng/sai của đáp án, không phát hiện được mọi câu bị thiếu hoặc lỗi OCR.** Cần một lượt soát thủ công từng trang/câu nữa trước khi gọi bộ sưu tập là bản chuẩn.

## 5. Bổ sung hoặc dựng lại

1. Chạy workflow **Collect public exam sources** thủ công, hoặc chạy các script `discover.py`, `review_sources.py`, `packages.py` ở môi trường có kết nối đến nguồn.
2. Tải artifact chờ duyệt từ GitHub, đặt các bản chép nguồn vào `.source-review/` (được `.gitignore` bỏ qua).
3. Rà soát nội dung; sửa/bổ sung `selection.json` bằng quyết định có kiểm chứng. Không tự chấp nhận toàn bộ đầu ra của crawler.
4. Chạy `build_archive.py`, `coverage.py` và bộ test. Trình dựng từ chối nguồn có SHA-256 khác bản đã duyệt; nếu nguồn thay đổi, phải duyệt lại và cập nhật manifest.
5. Cập nhật danh sách còn thiếu, xem diff, mở PR. Không thêm cache hoặc tệp nhị phân lớn.

```bash
.venv/bin/python scripts/exams/build_archive.py
.venv/bin/python scripts/exams/coverage.py
.venv/bin/python scripts/exams/test_archive.py
```

Script dựng cần bản chép nguồn trung gian; các tệp này không cần thiết để đọc kho hoặc chạy kiểm tra offline trên bản đã nhập. Có thể tải tài liệu gốc từ URL đã lưu để đối chiếu hash; nguồn mạng có thể bị gỡ hoặc thay đổi sau ngày truy cập.
