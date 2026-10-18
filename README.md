# Chuyên Anh — flashcards & kho đề offline

Ứng dụng flashcard Chuyên Anh và kho bản chép đề offline, chạy như **một file HTML độc lập**. `index.html` chứa HTML, CSS, JavaScript, 913 mục từ và toàn bộ 106 bản chép đề thi 2022–2026. Không có API, backend hay tài nguyên tự tải; có thể mở trực tiếp trên trình duyệt. Chỉ tiến độ flashcard được lưu trong `localStorage`; kho đề là dữ liệu đọc trong file.

## Dữ liệu và quy trình cập nhật

```text
Learned_Vocabulary_List.md  (bảng từ vựng có cấu trúc)
           ↓ python scripts/build_vocabulary.py
 data/vocabulary.json       (dữ liệu ứng dụng + metadata cũ được giữ lại)
           ↓ python scripts/embed_vocabulary.py

De-chuyen-Anh-vao-10/*.md + scripts/exams/selection.json
           ↓ python scripts/exams/embed_archive.py
index.html                  (vocabulary-data + exam-data; file duy nhất cần triển khai)
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
python scripts/exams/embed_archive.py
python scripts/validate_vocab.py
```

Có thể kiểm tra hai bước đồng bộ mà không ghi tệp:

```bash
python scripts/build_vocabulary.py --check
python scripts/embed_vocabulary.py --check
python scripts/exams/embed_archive.py --check
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
- Câu hỏi trắc nghiệm: ba phương án nhiễu được lấy cùng từ loại với từ đang hỏi khi dữ liệu có đủ (đo trên ứng dụng thật: 38,2% → 100% số phương án nhiễu cùng từ loại), không lặp lại văn bản của đáp án hay của nhau, và không dùng từ đã in sẵn trong câu cloze. Khi một từ loại quá ít từ (ví dụ `conj`, `grammar`), các chỗ còn lại được lấp bằng từ loại khác để câu hỏi vẫn đủ bốn lựa chọn.
- Scheduler deterministic: `new`, `learning`, `weak`, `review`, `mastered`; theo dõi đúng/sai, streak, difficulty, interval, last/next review.
- Session: đến hạn, từ yếu, từ mới, random, yêu thích, 10/20/30/50 từ. Phiên “đến hạn” chỉ lấy từ đã học tới lịch ôn; phiên nhanh ưu tiên từ đến hạn/từ yếu rồi mới lấp chỗ trống. Ở màn hình Học, nút gợi ý mở phiên đến hạn nếu có thẻ cần ôn; nếu không, gợi ý một phiên nhanh 10 từ. Các lựa chọn khác vẫn luôn sẵn có.
- Giao diện học hiển thị trạng thái từ và loại phiên bằng tiếng Việt, trong khi các khóa scheduler và giá trị lưu trữ vẫn giữ nguyên để tương thích với dữ liệu hiện có.
- First look: từ đang ở trạng thái `new` được giới thiệu nghĩa trước khi bị kiểm tra — kèm họ từ, cụm từ, ghi chú và ví dụ nếu dữ liệu đã có. Lượt giới thiệu không phải câu trả lời: nó không ghi gì vào `localStorage`, không đổi lịch ôn hay streak, và từ đó không được giới thiệu lại trong cùng phiên. Sau khi bấm “Bắt đầu kiểm tra”, từ được hỏi ngay như bình thường nên lần trả lời đầu tiên mới là lượt ôn được ghi lại.
- Error-based feedback: xem đáp án, nghĩa, metadata có sẵn, ví dụ và số lần sai ngay sau câu trả lời. Nghĩa cũ của ID 448 được giữ nguyên trong `NOTES` nhưng luôn hiển thị dưới nhãn tiếng Việt nói rõ đây là nghĩa của phiên bản ứng dụng trước, chỉ để tham chiếu lịch sử và không phải nghĩa hiện tại; tiền tố metadata nội bộ không hiện cho người học. Mỗi từ trả lời sai được xếp một lượt gõ lại sau các thẻ còn lại (tối đa một lượt/từ). Lượt luyện không đổi progress hay lịch ôn và được báo riêng với độ chính xác lần đầu; `R` sau feedback cũng xếp lượt luyện thay vì tính như lần ôn mới.
- Tự đánh giá có khóa: khi bấm `Space` để lật đáp án, các lựa chọn hoặc ô gõ bị khóa và lượt đó chỉ được chấm bằng “Nhớ được”/“Chưa nhớ”. Feedback nói rõ đây là tự đánh giá, nên điểm và lịch ôn không bao giờ đến từ một đáp án vừa được hiển thị.
- Search local theo English, Vietnamese, POS, tags, word family, metadata và example; filter theo state/favorite/due; pagination chỉ render 50 dòng một lần. Bật/tắt yêu thích ngay trong kết quả tìm kiếm chỉ vẽ lại danh sách kết quả, nên từ khóa, bộ lọc, thứ tự sắp xếp, trang hiện tại và tập kết quả được giữ nguyên (trừ khi chính bộ lọc yêu thích làm mục đó biến mất).
- Dashboard: tổng số từ, trạng thái học, độ chính xác, chuỗi ngày và lịch sử phiên; nhãn hướng tới người học được hiển thị bằng tiếng Việt. Lịch sử giữ cửa sổ 50 phiên gần nhất ở mọi nơi (`HISTORY_LIMIT`): trong bộ nhớ, trong `localStorage`, trong file export và khi import, nên một vòng export → import không làm mất phiên nào mà file backup đang có.
- Import/export JSON; import validate trước, lỗi không ghi đè backup cũ; reset tiến độ. Thông báo cho người học và lỗi tệp sao lưu được viết bằng tiếng Việt. Import hoặc reset kết thúc phiên đang học (hàng đợi, câu hỏi, trạng thái giới thiệu/tự đánh giá, thống kê phiên) nên quay lại Học sẽ thấy màn hình chọn phiên thay vì phiên cũ. Ghi `localStorage` được kiểm tra kết quả: khi ghi thất bại, ứng dụng báo lỗi thay vì báo thành công.
- Giao diện co giãn cho điện thoại và desktop, ưu tiên lựa chọn học trước các bảng hỗ trợ trên màn hình hẹp; điều khiển có nhãn, focus-visible và reduced motion. Biểu tượng SVG được nhúng trong file. Các lựa chọn đáp án là nhóm nút có tên (`role="group"` + `aria-label`) đúng với điều khiển thật; phím tắt (`Space`, `1–4`, `Enter`, `R`) chỉ tác động lên thẻ đang hiển thị ở màn hình Học.

## Kho bản chép đề offline

- Kho gồm 106 bản chép Markdown thuộc các kỳ thi 2022–2026; lọc theo năm, tỉnh/thành, đơn vị và dạng nguồn, đồng thời tìm kiếm theo metadata. Danh sách được phân trang để giữ giao diện gọn.
- Mỗi bản giữ nguyên nội dung chép, ghi chú chất lượng, nguồn đăng lại, loại tệp và SHA-256 của nguồn. Cả 106 bản đều **chưa được soát riêng từng câu với bản gốc**; 22 bản HTML/OCR còn cần rà soát định dạng/nội dung.
- **Phạm vi hiện tại là duyệt và đọc nguyên bản chép.** Chưa có bản nào được cấu trúc và review theo câu, nên không có mục lục/điều hướng câu hỏi, đồng hồ hay phiên làm bài. Các tiêu đề vốn có trong bản chép chỉ được hiển thị trong nội dung nguồn, không được coi là cấu trúc câu hỏi đã xác minh.
- Nội dung đáp án trong nguồn là gợi ý provenance, không phải khóa chấm đã xác minh độc lập; ứng dụng không tự chấm. Audio nghe không được nhúng và tính đầy đủ/khả dụng không được xác nhận. Thời lượng in trong nguồn không được chuẩn hóa hoặc kiểm chứng chéo và không được trình bày như thời lượng chính thức.
- Chỉ sau khi từng đề có schema câu hỏi và metadata review riêng mới nên mở điều hướng theo câu hoặc timed attempts. Thời lượng cần provenance nguồn rõ ràng; chấm tự động tiếp tục yêu cầu khóa đáp án được xác minh độc lập.
- Kho được nhúng trong `index.html`, không đi vào JSON sao lưu tiến độ. Hợp đồng sao lưu flashcard v1 không thay đổi; bản archive-only hiện tại không tạo lịch sử hay ghi chú luyện đề.

## GitHub Actions

### Deploy `.github/workflows/deploy.yml`

Khi nguồn dữ liệu, validator, bộ đồng bộ, kho đề hoặc app thay đổi trên `main`, workflow kiểm tra bảng/JSON/HTML và 106 bản chép đã được nhúng đồng bộ, chạy unit test Python và Node, rồi mới stage và upload **chỉ `index.html`** lên GitHub Pages. File này chứa cả dữ liệu từ vựng lẫn bản chép đề; không cần tệp chạy-time nào khác. Lỗi ở bất kỳ bước kiểm tra nào sẽ chặn deploy. Không có frontend bundler, npm install hay backend.

### CI `.github/workflows/ci.yml`

CI chạy trên PR và push `main` khi các tệp liên quan thay đổi: kiểm tra đồng bộ nguồn từ vựng/kho đề, validator Python, unit test Python và Node built-in tests cho scheduler/search/persistence/import và dữ liệu luyện đề. Thay đổi nguồn Markdown hoặc manifest đề cũng chạy kiểm tra đồng bộ; nội dung mới không được tự chấp nhận khi chưa có trong manifest đã chọn. Workflow deploy tự chạy lại các kiểm tra này trước khi xuất bản, không giả định rằng workflow CI riêng đã chạy hoặc thành công. Node chỉ được dùng trong test; production không cần Node.

GitHub Pages cần được bật với source **GitHub Actions** trong Settings → Pages. Không thể xác nhận deploy thật từ checkout local; sau lần merge, kiểm tra job `Deploy Flashcard` trên GitHub.

## Kho đề và nguồn dữ liệu

106 tệp Markdown và manifest đã chọn nằm trong `De-chuyen-Anh-vao-10/` và `scripts/exams/selection.json`; build script chỉ nhúng các bản đã có trong manifest, không tự nhận đề mới. Nội dung trong Pages artifact được đóng gói trực tiếp vào `index.html`; GitHub Pages vẫn chỉ nhận một tệp. Các tệp nguồn được giữ nguyên để kiểm tra provenance và tái tạo payload. Phạm vi kho không khẳng định đã thu thập đủ toàn quốc; xem [`De-chuyen-Anh-vao-10/DO-PHU.md`](De-chuyen-Anh-vao-10/DO-PHU.md) và [`NGUON-CHO-XU-LY.md`](De-chuyen-Anh-vao-10/NGUON-CHO-XU-LY.md). Bằng chứng và phương pháp rà soát 300 mục bổ sung được ghi tại [`docs/vocabulary-300-review.md`](docs/vocabulary-300-review.md).

## Kiểm tra luồng học bằng trình duyệt (tùy chọn)

CI và runtime vẫn không có dependency mới. Bộ kiểm tra trình duyệt tùy chọn dùng Playwright Core với Chromium và phục vụ HTML qua static HTTP. `browser-learning.cjs` kiểm tra luồng flashcard, bàn phím/focus, responsive, import/export, reset và lưu trữ; `browser-exams.cjs` kiểm tra duyệt archive offline, bộ lọc, provenance/hash, cảnh báo, an toàn render, việc khóa điều hướng/timer/chấm điểm đến khi có review từng đề, không phát sinh network request và bố cục mobile/tablet/desktop. Để chạy trong sandbox Linux tối giản:

```bash
npm install --no-save --package-lock=false playwright-core @sparticuz/chromium@133.0.0
node tests/browser-learning.cjs
node tests/browser-exams.cjs
```

Có thể chỉ cài `playwright-core` và dùng `BROWSER_EXECUTABLE=/path/to/chromium node tests/browser-learning.cjs` hoặc `BROWSER_EXECUTABLE=/path/to/chromium node tests/browser-exams.cjs` với Chromium có sẵn. Không đưa `node_modules` vào Git; không cần các package này để sử dụng hay triển khai ứng dụng.
