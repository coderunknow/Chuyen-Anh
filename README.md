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

## Phiên bản

`index.html` trong cây nguồn này mang `APP_VERSION` = `v1.0.0-beta5` (hiển thị trong Cài đặt → Thông tin dữ liệu); các prerelease đã xuất bản trước đó là [`v1.0.0-beta3`](https://github.com/coderunknow/Chuyen-Anh/releases/tag/v1.0.0-beta3), [`v1.0.0-beta2`](https://github.com/coderunknow/Chuyen-Anh/releases/tag/v1.0.0-beta2) và [`v1.0.0-beta1`](https://github.com/coderunknow/Chuyen-Anh/releases/tag/v1.0.0-beta1). Trạng thái tag, release, danh sách asset, digest và bản build mà GitHub Pages đang phục vụ phải được xác minh trực tiếp trên GitHub; tệp này ghi nội dung mã nguồn, không ghi trạng thái publish. `DEPLOY_HOLD` nêu `v1.0.0-beta5`: cổng deploy chỉ đọc trạng thái publish thật của đúng tag trong `DEPLOY_HOLD`: khi prerelease đó chưa publish (`deploy=false (release v1.0.0-beta4 is missing; deployment held)`) thì cổng **đóng** và Pages giữ nguyên bản đã publish trước đó; chỉ khi prerelease đó được publish thì cổng mới mở. Thứ tự phát hành bắt buộc là merge → tag annotated trên merge commit → build và xác minh asset từ tag → publish prerelease → Pages deploy bản trên `main`. Kiểm tra cổng bằng `python scripts/deploy_gate.py --repo coderunknow/Chuyen-Anh`.

## Chạy ứng dụng

Mở `index.html` trực tiếp hoặc phục vụ thư mục bằng static server:

```bash
python -m http.server 8000
# mở http://localhost:8000
```

Chỉ cần giữ `index.html` khi sao chép/triển khai ứng dụng. Các tệp Markdown, JSON, script và test còn lại trong repository là nguồn dữ liệu, công cụ đồng bộ, kiểm tra và tài liệu phát triển.

## Tính năng học

- Ngôn ngữ giao diện Tiếng Việt/English trong Cài đặt; lựa chọn được lưu riêng trên thiết bị (`chuyen-anh.language.v1`), không thêm vào JSON sao lưu tiến độ v1. Nghĩa từ vựng và nội dung đề giữ nguyên ngôn ngữ nguồn.
- Recognition: English → Vietnamese.
- Recall: Vietnamese → English.
- Spelling: gõ từ tiếng Anh.
- Cloze/context: chọn từ trong câu ví dụ.
- Câu hỏi trắc nghiệm: ba phương án nhiễu được lấy cùng từ loại với từ đang hỏi khi dữ liệu có đủ (đo trên ứng dụng thật: 38,2% → 100% số phương án nhiễu cùng từ loại), không lặp lại văn bản của đáp án hay của nhau, và không dùng từ đã in sẵn trong câu cloze. Khi một từ loại quá ít từ (ví dụ `conj`, `grammar`), các chỗ còn lại được lấp bằng từ loại khác để câu hỏi vẫn đủ bốn lựa chọn.
- Scheduler deterministic: `new`, `learning`, `weak`, `review`, `mastered`; theo dõi đúng/sai, streak, difficulty, interval, last/next review.
- Session: đến hạn, từ yếu, từ mới, random, yêu thích, 10/20/30/50 từ. Phiên “đến hạn” chỉ lấy từ đã học tới lịch ôn; phiên nhanh ưu tiên từ đến hạn/từ yếu rồi mới lấp chỗ trống. Ở màn hình Học, nút gợi ý mở phiên đến hạn nếu có thẻ cần ôn; nếu không, gợi ý một phiên nhanh 10 từ. Các lựa chọn khác vẫn luôn sẵn có.
- **Học cấp tốc** (`selectSprintSession`): chế độ này dùng đúng mục tiêu “Số thẻ mặc định mỗi phiên” trong Cài đặt (10/20/30/50) và lấy từ toàn bộ kho đủ điều kiện, theo thứ tự ưu tiên đến hạn (từ yếu trước) → từ yếu → đang học → từ mới → ôn tập → thành thạo; nó **không** cắt kho từ xuống một con số cố định (trước v1.0.0-beta1 luôn chỉ xếp 7 từ) và không bỏ từ nào đủ điều kiện. Phương pháp của phiên là **thang truy xuất thích ứng + một lượt củng cố trễ**: mỗi từ được hỏi ở mức đã chứng minh (`sprintRetrievalDemand`: recognition → recall → spelling theo trạng thái, từ yếu lùi về recognition), và sau lượt đầu bị sai hoặc chỉ mới nhận ra, từ được xếp **một lượt củng cố** ở mức cao hơn (ít nhất recall) sau ít nhất ba thẻ khác khi kích thước phiên cho phép (`SPRINT_CONSOLIDATION_GAP = 3`; khoảng cách thực tế `min(3, N - 1)` được bảo toàn kể cả ở cuối hàng đợi và khi bấm Bỏ qua `skipSessionCard`, đồng thời thông báo trung thực số thẻ xen giữa thực tế nếu phiên ngắn dưới 4 thẻ). Lượt củng cố và lượt sửa lỗi là *practice-class*: không gọi `updateProgress`, không đổi `state`, `streak` ngày học, `ease`, `interval`, `lastReviewed`, `nextReview` hay độ chính xác lần đầu; chỉ lượt trả lời đầu tiên (`firstPass`) mới cập nhật tiến độ và chuỗi ngày học. Tối đa 3 lượt/từ (`sprintTurnBudget(size) = size * 3`, tức 21 lượt cho 10 từ trong bài đo). Sau câu trả lời đúng ở lượt đầu, phiên chuyển ngay sang thẻ kế tiếp qua `.handoff-strip` (`role="status"`, `aria-live="polite"`, trung vị độ trễ DOM `7 ms`); câu sai, lượt củng cố và lượt tự đánh giá vẫn dừng lại đầy đủ. Đo trên workload cố định 10 từ, `ROUNDS=3`, không loại ngoại lai (`outliersDropped = 0`), Chromium `133.0.6943.0` (`600/450 ms`): phiên cấp tốc đạt trung vị **20.984 ms / 21 lượt** (`999 ms/lượt`, khoảng cách củng cố `[3,3,3,3,3,3,5,5,3,3]`) so với **14.015 ms / 11 lượt** (`1.274 ms/lượt`) của phiên thường — giảm **21,5 % chi phí tương tác mỗi lượt** nhưng **lâu hơn 49,7 % mỗi phiên** vì thực hiện thêm 10 lượt truy xuất trễ. Số đo này chỉ phản ánh thông lượng giao diện; muốn đánh giá hiệu quả ghi nhớ thật phải thực hiện nghiên cứu người học có đối chứng với kiểm tra gợi nhớ trễ `>= 24 giờ` (quy trình 5 phần được đặc tả trong [`DESIGN_LOG.md`](DESIGN_LOG.md)).
- Giao diện học chuẩn hóa mọi mục chưa từng được chấm điểm về trạng thái `new` nhất quán trên tất cả chế độ (`new`, `random`, `favorites`, `sprint`, `mixed`, `due`, `weak`), chỉ thoát `new` khi có câu trả lời thực được chấm, đồng thời bảo toàn mọi tiến độ đã học/legacy hợp lệ và định dạng sao lưu JSON v1. Nhãn tiếng Anh dịch bằng bảng khớp chính xác + mẫu neo `^...$`, không thay thế chuỗi con làm biến dạng từ vựng hay văn bản đề thi.
- First look: từ đang ở trạng thái `new` được giới thiệu nghĩa trước khi bị kiểm tra — kèm họ từ, cụm từ, ghi chú và ví dụ nếu dữ liệu đã có. Lượt giới thiệu không phải câu trả lời: nó không ghi gì vào `localStorage`, không đổi lịch ôn hay streak, và từ đó không được giới thiệu lại trong cùng phiên. Sau khi bấm “Bắt đầu kiểm tra”, từ được hỏi ngay như bình thường nên lần trả lời đầu tiên mới là lượt ôn được ghi lại.
- Error-based feedback: xem đáp án, nghĩa, metadata có sẵn, ví dụ và số lần sai ngay sau câu trả lời. Nghĩa cũ của ID 448 được giữ nguyên trong `NOTES` nhưng luôn hiển thị dưới nhãn tiếng Việt nói rõ đây là nghĩa của phiên bản ứng dụng trước, chỉ để tham chiếu lịch sử và không phải nghĩa hiện tại; tiền tố metadata nội bộ không hiện cho người học. Mỗi từ trả lời sai được xếp một lượt gõ lại sau các thẻ còn lại (tối đa một lượt/từ). Lượt luyện không đổi progress hay lịch ôn và được báo riêng với độ chính xác lần đầu; `R` sau feedback cũng xếp lượt luyện thay vì tính như lần ôn mới.
- Tự đánh giá có khóa: khi bấm `Space` để lật đáp án, các lựa chọn hoặc ô gõ bị khóa và lượt đó chỉ được chấm bằng “Nhớ được”/“Chưa nhớ”; nút “Bỏ qua” cũng bị khóa để lượt đã xem đáp án không thể bỏ qua mà không tự đánh giá. Feedback nói rõ đây là tự đánh giá, nên điểm và lịch ôn không bao giờ đến từ một đáp án vừa được hiển thị. Mỗi lượt chỉ được chấm một lần kể cả khi bấm đúp nút tự đánh giá.
- Bài gõ chính tả bỏ trống hoặc chỉ có khoảng trắng không phải là một lượt trả lời: ứng dụng bỏ qua và nhắc nhập câu trả lời, không chấm sai hay xếp lượt luyện cho câu hỏi chưa thực sự trả lời.
- Search local theo English, Vietnamese, POS, tags, word family, metadata và example; filter theo state/favorite/due; pagination chỉ render 50 dòng một lần. Bật/tắt yêu thích ngay trong kết quả tìm kiếm chỉ vẽ lại danh sách kết quả, nên từ khóa, bộ lọc, thứ tự sắp xếp, trang hiện tại và tập kết quả được giữ nguyên (trừ khi chính bộ lọc yêu thích làm mục đó biến mất).
- Dashboard: tổng số từ, trạng thái học, độ chính xác, chuỗi ngày và lịch sử phiên; nhãn hướng tới người học được hiển thị bằng tiếng Việt. Lịch sử giữ cửa sổ 50 phiên gần nhất ở mọi nơi (`HISTORY_LIMIT`): trong bộ nhớ, trong `localStorage`, trong file export và khi import, nên một vòng export → import không làm mất phiên nào mà file backup đang có.
- Import/export JSON; import validate trước, lỗi không ghi đè backup cũ; reset tiến độ. Thông báo cho người học và lỗi tệp sao lưu được viết bằng tiếng Việt. Import hoặc reset kết thúc phiên đang học (hàng đợi, câu hỏi, trạng thái giới thiệu/tự đánh giá, thống kê phiên) nên quay lại Học sẽ thấy màn hình chọn phiên thay vì phiên cũ. Ghi `localStorage` được kiểm tra kết quả: khi ghi thất bại, ứng dụng báo lỗi thay vì báo thành công.
- **Phiên ưu tiên và trọng tâm.** Bốn nhóm cố định — đến hạn, từ yếu, từ mới (`new`) và ôn tập — bật/tắt riêng trên màn hình Học hoặc trong Cài đặt; nhóm được chọn làm **trọng tâm** nhận trước 60% cỡ phiên, phần còn lại chia đều giữa các nhóm đang bật. Từ được gộp theo ID nên không xuất hiện hai lần, số đếm trên bảng đúng với số từ thực sự có thể vào phiên (nhóm đã tắt không được tính), và khi không có từ nào ứng viên ứng dụng nói rõ thay vì lặng lẽ rơi về một chế độ khác. Trọng tâm chỉ đổi **từ nào được chọn**; nó không ghi `ease`, `interval`, `lastReviewed`, `nextReview`, trạng thái thành thạo hay lịch sử trả lời.
- **Bảy kiểu bài tập.** `MC_EN_VI` (chọn nghĩa), `MC_VI_EN` (chọn từ), `FILL_VI` (gõ nghĩa tiếng Việt), `FILL_EN` (gõ từ tiếng Anh), `CLOZE` (chọn từ còn thiếu trong câu ví dụ đã có), `MATCH` (nối cặp) và `FLASHCARD` (tự đánh giá). Mỗi kiểu bật/tắt riêng và một phiên có thể trộn nhiều kiểu; các lượt đơn được luân phiên không lặp liên tiếp, bàn nối cặp được đặt cách ít nhất một lượt đơn và không chiếm quá nửa số từ của phiên. Kiểu thiếu dữ liệu bị vô hiệu hóa kèm số từ khả dụng (CLOZE cần câu ví dụ đã kiểm chứng — dữ liệu hiện chỉ có ở ID 448 — và MATCH cần đủ bốn cặp cho mỗi bàn; cả hai mặc định tắt nhưng vẫn bật được và báo đúng số từ khả dụng trước khi bắt đầu), và không kiểu nào tự động thay bằng kiểu khác mà không nói cho người học. Bàn nối cặp dùng chính các cặp từ–nghĩa thật và chơi được hoàn toàn bằng bàn phím.
- **Chấm bài gõ.** Câu trả lời được chuẩn hóa Unicode NFC, khoảng trắng, chữ hoa/thường và dấu câu hai đầu, nhưng **không bao giờ bỏ dấu tiếng Việt**. Đáp án chuẩn được nhận trước, sau đó chỉ những cách viết biến thể mà dữ liệu khai báo (`aliases`) và các nghĩa đã ghi trong mục nhiều nghĩa; `SYNONYMS` và `NOTES` không bao giờ được dùng làm đáp án. Câu trả lời trùng nghĩa của một từ khác được coi là **mơ hồ**: ứng dụng hỏi lại/cho tự đánh giá thay vì chấm sai. Khi sai, người học thấy đáp án đúng và câu ví dụ sẵn có.
- **Bỏ qua, xem lại, trạng thái lượt.** Mỗi lượt là `pending`, `answered`, `skipped` hoặc `flagged` trong một máy trạng thái duy nhất: bỏ qua không được tính là đã trả lời, không ghi tiến độ và không thể bấm hai lần (kể cả nhấn giữ phím); danh sách “Đã bỏ qua (N)” ở đầu phiên cho phép mở lại câu đã bỏ qua; mỗi lượt chỉ được chấm một lần.
- **Luyện lại có kiểm soát.** Mỗi lượt sai được ghi **một** lần vào hàng đợi luyện lại, tối đa một lượt luyện cho mỗi từ; lượt luyện không cộng vào độ chính xác lần đầu, chuỗi ngày, độ thành thạo, `ease`, `interval` hay lịch ôn. Kết quả phiên tách riêng “lần đầu” và “luyện lại”, và không bao giờ hứa một lượt luyện không thực sự được xếp.
- **Danh sách từ khó.** Đánh dấu/bỏ đánh dấu ngay trong phiên (nút cờ hoặc phím `F`) và quản lý trong Cài đặt; thao tác lặp lại không tạo bản ghi trùng, dữ liệu nằm riêng ở `chuyen-anh.flagged.v1` (không sửa `data/vocabulary.json`), dùng được làm nguồn từ cho phiên “Từ khó”, và không làm hỏng bản sao lưu v1.
- **Luyện có giới hạn thời gian.** Bật trước khi bắt đầu phiên (Tự động, 10, 15, 20 hoặc 30 phút; Tự động = 20 giây/từ, tối thiểu 2 phút). Đồng hồ đếm thật theo thời gian trôi qua, hiện thời gian còn lại và số lượt đã làm; hết giờ thì phiên dừng và chuyển ngay sang kết quả, các câu chưa trả lời được báo là **bỏ trống** — không bị tính sai, không đổi lịch ôn, độ chính xác hay XP. Chỉ có một bộ đếm duy nhất dù thẻ được vẽ lại, và điều khiển không bị khóa.
- **XP, cấp độ và huy hiệu.** XP được **tính lại từ dữ liệu học thật** (`correctCount`, `wrongCount`, lịch sử phiên) chứ không cộng dồn khi bấm: mỗi sự kiện chỉ tính một lần, không có XP cho lượt luyện lại, lượt củng cố, tự chuyển thẻ, tải lại trang, bấm đúp hay câu bỏ qua; thưởng hoàn thành phiên chỉ nhận một lần khi phiên có ít nhất một lượt được chấm. Tám huy hiệu mang tính tất định, chỉ trao một lần và không trao lại sau khi khôi phục bản sao hay tải lại. Chuỗi ngày vẫn chỉ tính lượt trả lời đúng ở lần đầu. Bảng điều khiển hiển thị năm chỉ số — đến hạn, độ chính xác, độ thành thạo, từ yếu, chuỗi ngày — giữ nguyên định nghĩa thống kê cũ (mẫu số độ chính xác không đổi; độ thành thạo không suy ra từ XP).
- **Giao diện “Premium Academic” và chuyển động.** Nền sáng dịu, thanh điều hướng navy, accent xanh/tím, token cho màu, kiểu chữ, khoảng cách, bo góc, đổ bóng, vùng chạm, breakpoint và chuyển động; ba lựa chọn giao diện `system`/`light`/`dark` (mặc định theo `prefers-color-scheme`, ghi lựa chọn thủ công ở Cài đặt). Phản hồi đúng/sai tức thì, tiến trình có chuyển động, lật thẻ/nối cặp/tổng kết có hiệu ứng, confetti chỉ ở mốc thật (huy hiệu mới hoặc phiên hoàn hảo từ 5 lượt trở lên). Hiệu ứng chạy bằng CSS/canvas nội bộ (không thư viện ngoài), không chặn nhập liệu, không đẩy bố cục, không cướp focus, không phát âm thanh và tôn trọng `prefers-reduced-motion`.
- **Cấu hình phiên được lưu riêng.** Nhóm bật/tắt, trọng tâm, kiểu bài tập, cỡ phiên và giới hạn thời gian nằm ở `chuyen-anh.study.v1`; giao diện ở `chuyen-anh.theme.v1`; huy hiệu đã công bố ở `chuyen-anh.badges.v1`. Dữ liệu hỏng được sửa về mặc định thay vì chặn khởi động, và hồ sơ beta4 chưa có khối cấu hình vẫn dùng được.
- **Sao lưu tương thích v1.** Bản xuất vẫn là `version: 1` với các khối tùy chọn `study`, `flagged` và `achievements.seenBadges`. Nhập một bản sao cũ (không có các khối này) **giữ nguyên** cấu hình và danh sách từ khó trên thiết bị và nói rõ điều đó; khối tùy chọn sai định dạng bị từ chối trước khi ghi bất cứ thứ gì; nhập hoặc xóa dữ liệu luôn kết thúc phiên đang chạy.
- Giao diện co giãn cho điện thoại và desktop, ưu tiên lựa chọn học trước các bảng hỗ trợ trên màn hình hẹp; điều khiển có nhãn, focus-visible và reduced motion. Biểu tượng SVG được nhúng trong file. Các lựa chọn đáp án là nhóm nút có tên (`role="group"` + `aria-label`) đúng với điều khiển thật; phím tắt (`Space`, `1–4`, `Enter`, `R`) chỉ tác động lên thẻ đang hiển thị ở màn hình Học.

## Kho bản chép đề offline

- Kho gồm 106 bản chép Markdown thuộc các kỳ thi 2022–2026; lọc theo năm, tỉnh/thành, đơn vị và dạng nguồn, đồng thời tìm kiếm theo metadata. Danh sách được phân trang để giữ giao diện gọn.
- Mỗi bản giữ nguyên phần Markdown hiện có, ghi chú chất lượng, nguồn đăng lại, loại tệp và SHA-256 của nguồn. Trình đọc hiển thị toàn bộ nội dung đã nhúng, không cắt theo số dòng/ký tự; điều đó **không chứng minh bản PDF/DOCX gốc đầy đủ**. Cả 106 bản đều **chưa được soát riêng từng câu với bản gốc**; 22 bản HTML/OCR còn cần rà soát định dạng/nội dung.
- Có transcript kết thúc giữa câu bằng dấu ba chấm trong 2023 Đắk Lắk và các tệp 2026 An Giang, Bắc Ninh, Chuyên Khoa học Huế. Đây là phần thiếu ngay trong văn bản nguồn đã chuyển đổi, không phải cắt xén do giao diện. Kho hiện không có PDF/DOCX gốc đầy đủ để khôi phục các đoạn này; cần cung cấp nguồn gốc để hoàn thiện.
- **Prototype luyện tập không chấm điểm:** 84 bản PDF/DOCX có thể cung cấp câu/mục được trích tự động khi phát hiện được số thứ tự và lựa chọn/vạch trống hiện diện trong chính văn bản. Từng mục đều được đánh dấu chưa xác minh; parser có thể bỏ sót, ghép sai hoặc dừng trước phần đáp án. Không coi số mục trích ra là độ bao phủ của đề. 22 bản HTML/OCR và bản không phát hiện được cấu trúc đủ tin cậy vẫn chỉ đọc, không đoán cách ghép.
- Có thể điều hướng giữa các bản và các mục trích, theo dõi đã/chưa trả lời, chọn/đổi đáp án, xem lại trước khi nộp, nộp bài và xem tóm tắt chỉ gồm số đã/chưa trả lời. Lựa chọn chỉ nằm trong bộ nhớ trang hiện tại, được giữ để xem lại sau nộp và mất khi tải lại/đóng trang; không ghi vào localStorage, lịch sử luyện đề hay JSON backup.
- Chế độ luyện tập không nạp hoặc tiết lộ riêng đáp án; không có thời gian, chấm đúng/sai, điểm, xếp hạng hay lịch sử điểm. Bản Markdown đầy đủ vẫn hiển thị riêng bên dưới và có thể chứa nội dung đáp án đã nằm trong nguồn. Audio nghe không được nhúng hoặc bịa thêm. Thời lượng in trong nguồn không được chuẩn hóa/kiểm chứng chéo và không được trình bày như thời lượng chính thức.
- Nội dung đáp án trong nguồn là gợi ý provenance, không phải khóa chấm đã xác minh độc lập. Cấu trúc phiên tách riêng câu trả lời khỏi tiến độ flashcard, để sau này có thể thêm khóa đã xác minh, chấm điểm, thời gian và lịch sử trong một thiết kế riêng; các tính năng đó chưa được bật hoặc phê duyệt.
- Kho được nhúng trong `index.html`, không đi vào JSON sao lưu tiến độ. Hợp đồng sao lưu flashcard v1 không thay đổi; phiên luyện transcript hiện tại không tạo lịch sử lâu dài.

## GitHub Actions

### Deploy `.github/workflows/deploy.yml`

Khi nguồn dữ liệu, validator, bộ đồng bộ, kho đề hoặc app thay đổi trên `main`, workflow kiểm tra bảng/JSON/HTML và 106 bản chép đã được nhúng đồng bộ, chạy unit test Python và Node, rồi mới stage và upload **chỉ `index.html`** lên GitHub Pages. File này chứa cả dữ liệu từ vựng lẫn bản chép đề; không cần tệp chạy-time nào khác. Lỗi ở bất kỳ bước kiểm tra nào sẽ chặn deploy. Không có frontend bundler, npm install hay backend.

**Cổng deploy-hold (thứ tự release).** Tệp `DEPLOY_HOLD` ở gốc repo khai báo tag release phải được publish prerelease trước khi Pages được phép xuất bản; `scripts/deploy_gate.py` đánh giá trạng thái `draft`/`prerelease` qua GitHub API ngay sau checkout và fail-closed nếu trạng thái không rõ. Các bước kiểm tra luôn chạy; chỉ stage/upload/deploy bị hoãn khi cổng đóng. Marker hiện nêu `v1.0.0-beta4`; cổng ánh xạ trạng thái publish của đúng tag đó thành quyết định deploy (`missing`/`draft`/`not-prerelease` → giữ, `published` → mở), nên merge mang mã beta4 **không thể** publish beta4 lên Pages trước khi chính prerelease đó được tạo và publish. Trạng thái hiện tại của cổng phải được đọc bằng `python scripts/deploy_gate.py --repo coderunknow/Chuyen-Anh`, không suy ra từ tệp này; ở thời điểm chuẩn bị ứng viên beta4 cổng trả `deploy=false (release v1.0.0-beta4 is missing; deployment held)`. Cổng chỉ đọc đúng tag được nêu, không suy luận theo thứ tự semver. Lịch sử: marker lần lượt đi qua `v1.0.0-beta1`, `v1.0.0-beta2`, `v1.0.0-beta3` và nay nêu `v1.0.0-beta4` cho chu kỳ beta4. Muốn giữ deploy của một release tương lai thì đặt marker thành tag của release đó; nếu marker trỏ tới tag chưa publish thì Pages bị giữ (fail-closed). Không workflow nào bị tắt và không dùng `force_deploy`. Sự kiện `release.published` khởi chạy workflow dispatcher tối giản; workflow này gửi `workflow_dispatch` cho deploy workflow trên `main`, để tuân thủ chính sách môi trường Pages chỉ cho phép branch `main`. Deploy workflow sau đó đọc trạng thái release thật và đánh giá lại cổng; khi prerelease được publish, cổng mở cho lần deploy đó và mọi lần sau, không cần xóa marker. Thứ tự yêu cầu là merge → xác minh commit/tag → build và tải lại để kiểm chứng asset → publish prerelease → deploy. `force_deploy` chỉ dành cho maintainer chủ động dispatch và không thay thế các bước phát hành/kiểm chứng. Lịch sử: marker của dev3 đã được gỡ sau khi prerelease đó xuất bản; marker dev5 là một hold riêng. Nếu push chỉ đổi log và không khớp bộ lọc `paths`, cần dispatch workflow phù hợp thay vì bỏ qua cổng.

### Release artifacts `.github/workflows/release-artifacts.yml` + `scripts/release_artifacts.py`

Khi push tag khớp `v1.0.0-*` (prerelease `dev`/`beta`/`rc`; script chỉ chấp nhận `vMAJOR.MINOR.PATCH-(dev|beta|rc)N` và từ chối mọi ref khác, kể cả release cuối), workflow build artifact từ **đúng commit của tag** (`git archive`), chạy các kiểm tra dữ liệu/unit test ở source revision của tag, rồi đóng gói:

- `chuyen-anh-<tag>.html` — khớp từng byte với `index.html` của commit được tag.
- `chuyen-anh-<tag>.zip` — đúng ba tệp ở root: `index.html`, `README.md`, `LICENSE`; CRC và nội dung từng tệp được kiểm tra.
- `chuyen-anh-<tag>-checksums.txt` — manifest SHA-256 cho hai tệp trên, dùng được với `sha256sum -c`.

Script tạo draft prerelease (nếu release chưa tồn tại), upload asset còn thiếu, **tải lại toàn bộ asset từ GitHub và so sánh SHA-256** với artifact vừa build; asset trùng tên khác nội dung bị từ chối thay thế. Việc publish draft thành prerelease là thao tác riêng sau khi kiểm chứng. Quy trình có thể chạy lại an toàn với asset trùng khớp; asset hiện hữu khác nội dung sẽ làm quy trình dừng thay vì bị ghi đè.

Kiểm chứng một bản tải về:

```bash
sha256sum -c chuyen-anh-v1.0.0-beta1-checksums.txt
```

### CI `.github/workflows/ci.yml`

CI chạy trên PR và push `main` khi các tệp liên quan thay đổi: kiểm tra đồng bộ nguồn từ vựng/kho đề, validator Python, unit test Python và Node built-in tests cho scheduler/search/persistence/import, dữ liệu luyện đề và pipeline release/deploy-gate. Thay đổi nguồn Markdown hoặc manifest đề cũng chạy kiểm tra đồng bộ; nội dung mới không được tự chấp nhận khi chưa có trong manifest đã chọn. Workflow deploy tự chạy lại các kiểm tra này trước khi xuất bản, không giả định rằng workflow CI riêng đã chạy hoặc thành công. Node chỉ được dùng trong test; production không cần Node.

GitHub Pages cần được bật với source **GitHub Actions** trong Settings → Pages. Không thể xác nhận deploy thật từ checkout local; sau lần merge, kiểm tra job `Deploy Flashcard` trên GitHub.

## Kho đề và nguồn dữ liệu

106 tệp Markdown và manifest đã chọn nằm trong `De-chuyen-Anh-vao-10/` và `scripts/exams/selection.json`; build script chỉ nhúng các bản đã có trong manifest, không tự nhận đề mới. Nội dung trong Pages artifact được đóng gói trực tiếp vào `index.html`; GitHub Pages vẫn chỉ nhận một tệp. Các tệp nguồn được giữ nguyên để kiểm tra provenance và tái tạo payload. Phạm vi kho không khẳng định đã thu thập đủ toàn quốc; xem [`De-chuyen-Anh-vao-10/DO-PHU.md`](De-chuyen-Anh-vao-10/DO-PHU.md), [`NGUON-CHO-XU-LY.md`](De-chuyen-Anh-vao-10/NGUON-CHO-XU-LY.md) và sổ kiểm toán đầy đủ 106 bản chép tại [`docs/EXAM_AUDIT_LEDGER.md`](docs/EXAM_AUDIT_LEDGER.md) (`0` `official-verified`, `0` `non-official-source-compared`, `61` `partially-supported`, `21` `structure-metadata-only`, `24` `insufficient-source`). Bằng chứng và phương pháp rà soát 300 mục bổ sung được ghi tại [`docs/vocabulary-300-review.md`](docs/vocabulary-300-review.md). Báo cáo dev5 đọc đủ 913 hàng nguồn nhưng **không** tuyên bố đã tra từ điển cho cả 913: 145 mục có bằng chứng từ điển (127 kế thừa hồ sơ dev4, chưa tra lại trong lượt dev5; 18 được kiểm tra trực tiếp trong lượt này), 768 mục còn chờ xác minh headword; xem [`docs/vocabulary-audit-dev5.md`](docs/vocabulary-audit-dev5.md) và [`docs/vocabulary-audit-dev5.json`](docs/vocabulary-audit-dev5.json).

## Kiểm tra luồng học bằng trình duyệt (tùy chọn)

CI và runtime vẫn không có dependency mới. Bộ kiểm tra trình duyệt tùy chọn dùng Playwright Core với Chromium và phục vụ HTML qua static HTTP. `browser-learning.cjs` kiểm tra luồng flashcard, bàn phím/focus, responsive, import/export, reset và lưu trữ, cấu hình phiên ưu tiên (kể cả nhóm bị tắt), một phiên trộn chạm tới cả bảy kiểu bài tập, bàn nối cặp hoàn thành bằng bàn phím, câu bỏ qua được mở lại, một từ khó được đánh dấu rồi bỏ đánh dấu, một phiên có giới hạn thời gian **thật** (đồng hồ hệ thống, một phút) kết thúc ở màn hình kết quả với câu bỏ trống không bị tính sai và không cộng XP, một bản sao lưu v1 giữ danh sách từ khó trên thiết bị, và việc hiển thị tiếng Anh của mọi màn hình mới, cùng luồng “Học cấp tốc” thật (10 từ đã chọn, 21 lượt gồm 10 lượt đầu + 10 lượt củng cố + 1 lượt sửa lỗi, khoảng cách củng cố, tự chuyển chỉ sau câu đúng ở lượt đầu, thống kê lần đầu 90 % tách khỏi lượt củng cố, tiến độ còn nguyên sau khi tải lại và câu giải thích của lượt củng cố được dịch trong giao diện tiếng Anh); `browser-exams.cjs` kiểm tra archive offline, bộ lọc/provenance, source rendering an toàn, lựa chọn → đổi → review → submit → xem lại đáp án đã nộp, điều hướng giấy thi/câu hỏi, trạng thái answered/unanswered, phiên chỉ tồn tại trong bộ nhớ, fallback chỉ đọc cho HTML/OCR, không có timer/điểm và bố cục mobile/tablet/desktop; đồng thời bảo đảm không phát sinh network request. Để chạy trong sandbox Linux tối giản:

```bash
npm install --no-save --package-lock=false playwright-core @sparticuz/chromium@133.0.0
node tests/browser-learning.cjs
node tests/browser-exams.cjs
```

Có thể chỉ cài `playwright-core` và dùng `BROWSER_EXECUTABLE=/path/to/chromium node tests/browser-learning.cjs` hoặc `BROWSER_EXECUTABLE=/path/to/chromium node tests/browser-exams.cjs` với Chromium có sẵn. Không đưa `node_modules` vào Git; không cần các package này để sử dụng hay triển khai ứng dụng.
