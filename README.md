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
- Khi đồng bộ theo ID, `data/vocabulary.json` giữ metadata chỉ có trong ứng dụng (ví dụ: ví dụ, difficulty, ngày tạo và các trường chưa có trong bảng). Các trường do bảng nguồn quản lý, gồm cả `TAGS`, được đồng bộ từ Markdown. ID 448 giữ các tag app cũ `work` và `daily-life`, đồng thời thêm `easy` để chuyển dấu difficulty `-` trong bảng cũ thành tag; difficulty số `2` vẫn được giữ. Nghĩa chính dùng cách viết đã chọn từ Markdown; nghĩa app cũ được giữ trong `NOTES`. Với 300 mục mới, không có ví dụ, điểm difficulty hay ngày tạo nào được tự bịa; trường không có nguồn sẽ để rỗng hoặc không xuất hiện.

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
- Session: đến hạn, từ yếu, từ mới, random, yêu thích, 10/20/30/50 từ. Phiên “đến hạn” chỉ lấy từ đã học tới lịch ôn; phiên nhanh ưu tiên từ đến hạn/từ yếu rồi mới lấp chỗ trống.
- First look: từ đang ở trạng thái `new` được giới thiệu nghĩa trước khi bị kiểm tra — kèm họ từ, cụm từ, ghi chú và ví dụ nếu dữ liệu đã có. Lượt giới thiệu không phải câu trả lời: nó không ghi gì vào `localStorage`, không đổi lịch ôn hay streak, và từ đó không được giới thiệu lại trong cùng phiên. Sau khi bấm “Bắt đầu kiểm tra”, từ được hỏi ngay như bình thường nên lần trả lời đầu tiên mới là lượt ôn được ghi lại.
- Error-based feedback: xem đáp án, nghĩa, metadata có sẵn, ví dụ và số lần sai ngay sau câu trả lời. Mỗi từ trả lời sai được xếp một lượt gõ lại sau các thẻ còn lại (tối đa một lượt/từ). Lượt luyện không đổi progress hay lịch ôn và được báo riêng với độ chính xác lần đầu; `R` sau feedback cũng xếp lượt luyện thay vì tính như lần ôn mới.
- Tự đánh giá có khóa: khi bấm `Space` để lật đáp án, các lựa chọn hoặc ô gõ bị khóa và lượt đó chỉ được chấm bằng “Nhớ được”/“Chưa nhớ”. Feedback nói rõ đây là tự đánh giá, nên điểm và lịch ôn không bao giờ đến từ một đáp án vừa được hiển thị.
- Search local theo English, Vietnamese, POS, tags, word family, metadata và example; filter theo state/favorite/due; pagination chỉ render 50 dòng một lần.
- Dashboard: total, new, learning, weak, mastered, due, accuracy, streak và lịch sử phiên.
- Import/export JSON; import validate trước, lỗi không ghi đè backup cũ; reset progress.
- Responsive, focus-visible, semantic controls, keyboard shortcuts (`Space`, `1–4`, `Enter`, `R`) và reduced motion.

## GitHub Actions

### Deploy `.github/workflows/deploy.yml`

Khi nguồn dữ liệu, validator, bộ đồng bộ hoặc app thay đổi trên `main`, workflow kiểm tra bảng/JSON/HTML đã đồng bộ, chạy toàn bộ unit test Python và Node, rồi mới stage và upload **chỉ `index.html`** lên GitHub Pages. Lỗi ở bất kỳ bước kiểm tra nào sẽ chặn deploy. Không có frontend bundler, npm install hay backend.

### CI `.github/workflows/ci.yml`

CI chạy trên PR và push `main` khi các tệp liên quan thay đổi: kiểm tra đồng bộ nguồn, validator Python, unit test Python và Node built-in tests cho scheduler/search/persistence/import. Thay đổi `deploy.yml` cũng kích hoạt CI. Workflow deploy tự chạy lại các kiểm tra này trước khi xuất bản, không giả định rằng workflow CI riêng đã chạy hoặc thành công. Node chỉ được dùng trong test; production không cần Node.

GitHub Pages cần được bật với source **GitHub Actions** trong Settings → Pages. Không thể xác nhận deploy thật từ checkout local; sau lần merge, kiểm tra job `Deploy Flashcard` trên GitHub.

## Kho đề

Các tài liệu đề chuyên Anh được giữ nguyên trong `De-chuyen-Anh-vao-10/` và không được đưa vào Pages artifact. Bằng chứng và phương pháp rà soát 300 mục bổ sung được ghi tại [`docs/vocabulary-300-review.md`](docs/vocabulary-300-review.md).

## Kiểm tra luồng học bằng trình duyệt (tùy chọn)

CI và runtime vẫn không có dependency mới. Bộ kiểm tra trình duyệt dùng Playwright Core với Chromium, phục vụ HTML qua static HTTP và kiểm tra feedback → luyện lại → summary, phím tắt/focus, bỏ qua, reload, import/export, theme và viewport mobile. Để chạy trong sandbox Linux tối giản:

```bash
npm install --no-save --package-lock=false playwright-core @sparticuz/chromium@133.0.0
node tests/browser-learning.cjs
```

Có thể chỉ cài `playwright-core` và dùng `BROWSER_EXECUTABLE=/path/to/chromium node tests/browser-learning.cjs` với Chromium có sẵn. Không đưa `node_modules` vào Git; không cần các package này để sử dụng hay triển khai ứng dụng.
