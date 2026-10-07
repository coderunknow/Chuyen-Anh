# Chuyên Anh — standalone flashcards

Web flashcard từ vựng Chuyên Anh, chạy như **một file HTML độc lập**. `index.html` chứa toàn bộ HTML, CSS, JavaScript và 913 mục từ; ứng dụng không gọi API, không tải tệp dữ liệu/tài nguyên bên ngoài và có thể mở trực tiếp trên trình duyệt. Tiến độ học được lưu trong `localStorage` của trình duyệt.

## Dữ liệu và quy trình cập nhật

```text
Learned_Vocabulary_List.md  (bảng từ vựng có cấu trúc)
           ↓ python scripts/build_vocabulary.py
 data/vocabulary.json       (dữ liệu ứng dụng + metadata cũ được giữ lại)
           ↓ python scripts/embed_vocabulary.py
 index.html                 (file duy nhất cần triển khai)
```

`Learned_Vocabulary_List.md` là bảng Markdown có các cột:

```text
ID | WORD | POS | MEANING | WORD_FAMILY | SYNONYMS | ANTONYMS |
COLLOCATIONS | REGISTER | CONNOTATION | NOTES | TAGS
```

- `ID` là số; `WORD`, `POS`, `MEANING`, `WORD_FAMILY`, `REGISTER`, `CONNOTATION` và `NOTES` là ô văn bản. `SYNONYMS`, `ANTONYMS`, `COLLOCATIONS` và `TAGS` là mảng JSON trong từng ô; dùng `[]` khi nguồn không cung cấp dữ liệu.
- Các ô văn bản để trống khi chưa có thông tin. Dấu `|` có trong nội dung được escape theo Markdown; parser đọc lại nguyên vẹn.
- Từ ID 614–913, `WORD_FAMILY` chỉ lấy nội dung đã được ghi nhãn là họ từ. `NOTES` giữ nguyên phần phân biệt và nguồn trích dẫn; không tự phân loại chúng thành từ đồng nghĩa, trái nghĩa, kết hợp từ, văn phong hoặc sắc thái.
- ID 448 dùng nghĩa trong danh sách làm nghĩa chính. Nghĩa trước đây trong app được giữ trong `NOTES` và ghi rõ là định nghĩa app cũ.
- `data/vocabulary.json` giữ lại metadata ứng dụng đã tồn tại (ví dụ, tags, ví dụ, difficulty và ngày tạo) khi đồng bộ theo ID. Với 300 mục mới, không có ví dụ, điểm difficulty hay ngày tạo nào được tự bịa; trường không có nguồn sẽ để rỗng hoặc không xuất hiện.

Sau khi chỉnh bảng từ vựng, chạy:

```bash
python scripts/build_vocabulary.py
python scripts/embed_vocabulary.py
python scripts/validate_vocab.py
```

Có thể kiểm tra hai bước đồng bộ mà không ghi tệp:

```bash
python scripts/build_vocabulary.py --check
python scripts/embed_vocabulary.py --check
```

Validator kiểm tra schema, kiểu dữ liệu, ID/từ trùng lặp và các trường bắt buộc. CI cũng xác nhận rằng JSON và dữ liệu nhúng trong HTML khớp nhau.

## Chạy ứng dụng

Mở `index.html` trực tiếp hoặc phục vụ thư mục bằng static server:

```bash
python -m http.server 8000
# mở http://localhost:8000
```

Chỉ cần giữ `index.html` khi sao chép/triển khai ứng dụng. Các tệp Markdown, JSON, script và test còn lại trong repository là nguồn dữ liệu, công cụ đồng bộ, kiểm tra và tài liệu phát triển.

## Tính năng học

- Recognition: English → Vietnamese.
- Recall: Vietnamese → English.
- Spelling: gõ từ tiếng Anh.
- Cloze/context: chọn từ trong câu ví dụ.
- Scheduler deterministic: `new`, `learning`, `weak`, `review`, `mastered`; theo dõi đúng/sai, streak, difficulty, interval, last/next review.
- Session: đến hạn, từ yếu, từ mới, random, yêu thích, 10/20/30/50 từ; due + weak được ưu tiên.
- Error-based feedback: xem đáp án, nghĩa, metadata có sẵn, ví dụ và số lần sai ngay sau câu trả lời.
- Search local theo English, Vietnamese, POS, tags, word family, metadata và example; filter theo state/favorite/due; pagination chỉ render 50 dòng một lần.
- Dashboard: total, new, learning, weak, mastered, due, accuracy, streak và lịch sử phiên.
- Import/export JSON; import validate trước, lỗi không ghi đè backup cũ; reset progress.
- Responsive, focus-visible, semantic controls, keyboard shortcuts (`Space`, `1–4`, `Enter`, `R`) và reduced motion.

## GitHub Actions

### Deploy `.github/workflows/deploy.yml`

Khi nguồn dữ liệu, validator, bộ đồng bộ hoặc app thay đổi trên `main`, workflow kiểm tra JSON, kiểm tra bảng/JSON/HTML đã đồng bộ, rồi upload **chỉ `index.html`** lên GitHub Pages. Không có frontend bundler, npm install hay backend.

### CI `.github/workflows/ci.yml`

CI chạy validator Python, unit test Python, kiểm tra đồng bộ nguồn, kiểm tra cấu trúc file HTML độc lập và Node built-in tests cho scheduler/search/persistence/import. Node chỉ được dùng trong CI để chạy test.

GitHub Pages cần được bật với source **GitHub Actions** trong Settings → Pages. Không thể xác nhận deploy thật từ checkout local; sau lần merge, kiểm tra job `Deploy Flashcard` trên GitHub.

## Kho đề

Các tài liệu đề chuyên Anh được giữ nguyên trong `De-chuyen-Anh-vao-10/` và không được đưa vào Pages artifact. Bằng chứng và phương pháp rà soát 300 mục bổ sung được ghi tại [`docs/vocabulary-300-review.md`](docs/vocabulary-300-review.md).
