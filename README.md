# Chuyên Anh — static flashcard

Web flashcard học từ vựng Chuyên Anh, ưu tiên **static-first**:

```text
data/vocabulary.json
        ↓ fetch runtime
index.html + style.css + app.js
        ↓ GitHub Pages
static website
```

Không có backend, database, API, Node/npm hay bước build trong production. Tiến độ học được lưu bằng `localStorage` trên trình duyệt.

## Dữ liệu là source of truth

Chỉnh duy nhất `data/vocabulary.json` để thêm từ. Schema tối thiểu:

```json
{
  "id": "menial-task",
  "word": "menial task",
  "pos": "phrase",
  "meaning": "công việc lao dịch, tay chân vất vả, ít được coi trọng",
  "examples": [
    {
      "en": "He was tired of doing menial tasks all day.",
      "vi": "Anh ấy mệt mỏi vì phải làm những công việc tay chân cả ngày."
    }
  ],
  "tags": ["work", "daily-life"],
  "difficulty": 2
}
```

`examples`, nếu có, là một mảng các object `{ "en": string, "vi": string }`. `difficulty` nằm trong khoảng 0–5. Không hard-code từ vựng trong HTML hoặc JavaScript.

Kiểm tra local bằng Python chuẩn:

```bash
python scripts/validate_vocab.py
```

Validator kiểm tra JSON, cấu trúc, field bắt buộc, duplicate ID/word, examples, tags và difficulty. Lỗi trả về exit code khác 0 và workflow sẽ không deploy.

## Chạy local

Vì trình duyệt thường chặn `fetch()` khi mở `file://`, dùng một static file server (không cài dependency):

```bash
python -m http.server 8000
# mở http://localhost:8000
```

App chỉ cần các file runtime sau:

```text
index.html
style.css
app.js
data/vocabulary.json
assets/* (nếu có)
```

`app.js` tải JSON runtime với cache bypass nhẹ và tự tính fingerprint từ nội dung JSON. Vì vậy số lượng từ và data version trên UI luôn lấy từ dữ liệu thực tế; không cần regenerate bundle khi thêm từ.

## Tính năng học

- Recognition: English → Vietnamese.
- Recall: Vietnamese → English.
- Spelling: gõ từ tiếng Anh.
- Cloze/context: chọn từ trong câu ví dụ.
- Scheduler deterministic: `new`, `learning`, `weak`, `review`, `mastered`; theo dõi đúng/sai, streak, difficulty, interval, last/next review.
- Session: đến hạn, từ yếu, từ mới, random, yêu thích, 10/20/30 từ; due + weak được ưu tiên.
- Error-based feedback: xem đáp án, nghĩa, ví dụ và số lần sai ngay sau câu trả lời.
- Search local theo English, Vietnamese, POS, tag và example; filter theo state/favorite/due; pagination chỉ render 50 dòng một lần.
- Dashboard: total, new, learning, weak, mastered, due, accuracy, streak và lịch sử phiên.
- Import/export JSON; import validate trước, lỗi không ghi đè backup cũ; reset progress.
- Responsive, focus-visible, semantic controls, keyboard shortcuts (`Space`, `1–4`, `Enter`, `R`) và reduced motion.

## File flashcard một chặng: `flashcards.html`

`flashcards.html` là **một file HTML duy nhất, tự chứa và offline hoàn toàn** cho toàn bộ 913 từ
trong `Learned_Vocabulary_List.md`. Mở trực tiếp bằng trình duyệt (kể cả `file://`) là học được
ngay: không `fetch()`, không CDN, không font ngoài, không bước build.

Trong file có:

- 913 từ kèm mức khó 1–5, bậc ưu tiên 1–3 theo độ phủ trong đề, phiên âm IPA cho 822 từ.
- 300 từ có ngữ cảnh đề: họ từ, phân biệt, câu trong đề, chỗ trống điền từ và liên kết tới đúng
  dòng trong `De-chuyen-Anh-vao-10/`.
- 7 chế độ học, SRS, thống kê, tìm kiếm/lọc, xuất–nhập tiến độ; chi tiết nằm trong app ở mục
  “Phím tắt & cách học”.

Dữ liệu được sinh tự động, không sửa tay trong `flashcards.html`:

```text
Learned_Vocabulary_List.md + data/vocabulary.json + data/pronunciation.json
    + docs/vocabulary-300-{families,evidence}.json + De-chuyen-Anh-vao-10/*/*/*.md
        ↓ python3 scripts/build_flashcards.py
flashcards.html (một file, dấu vân tay dữ liệu in ở chân trang)
```

```bash
python3 scripts/build_flashcards.py               # sinh lại flashcards.html
python3 scripts/build_flashcards.py --check       # file còn khớp nguồn dữ liệu?
python3 scripts/build_flashcards.py --calibrate   # xem phân bố mức khó / bậc ưu tiên
python3 scripts/build_flashcards.py --refresh-ipa # cập nhật data/pronunciation.json từ CMUdict
```

Kiểm thử:

```bash
python3 -m unittest tests.test_flashcards -v      # dữ liệu dẫn xuất + tính toàn vẹn của file
node --test tests/flashcards.test.js              # logic app: SRS, chế độ học, lưu trữ, CSV
npm install --no-save jsdom@26 && node tests/flashcards-dom.mjs   # E2E trong DOM thật (tuỳ chọn)
```

Phiên âm lấy từ CMU Pronouncing Dictionary (BSD-2), chuyển ARPAbet → IPA; giấy phép nằm trong
`data/pronunciation.json` và trong chính file HTML. Tiến độ của file này lưu dưới khoá
`chuyen-anh.flashcards.v1.*`, tách hẳn khỏi tiến độ của app runtime.

## GitHub Actions

### Deploy `.github/workflows/deploy.yml`

Trigger path-based khi `main` thay đổi frontend, `data/**`, assets, validator hoặc workflow. Luồng là:

```text
checkout
  ↓
python scripts/validate_vocab.py
  ↓
stage index.html/style.css/app.js/flashcards.html/data (không build)
  ↓
configure Pages
  ↓
upload static artifact
  ↓
deploy Pages
```

Workflow có concurrency `flashcard-pages` và `cancel-in-progress: true`. Không có `setup-node`, `npm install`, `npm ci`, bundler hoặc build frontend. Artifact chỉ chứa static app, không upload các PDF/ghi chú khác trong repository.

### CI `.github/workflows/ci.yml`

CI tách riêng cho PR/push: chạy validator Python, unit test Python (bao gồm `--check` của
`flashcards.html`, nên file lỗi thời sẽ fail) và dependency-free Node built-in tests cho cả app
runtime lẫn `flashcards.html`. CI không chạy npm install và không phải deployment;
`tests/flashcards-dom.mjs` cần jsdom nên chỉ chạy khi cài thêm, thiếu jsdom thì tự bỏ qua.

GitHub Pages cần được bật với source **GitHub Actions** trong Settings → Pages. Không thể đo runtime deploy thật từ checkout local; sau lần merge đầu tiên, xem job summary của `Deploy Flashcard` để ghi nhận checkout, validation, upload và deploy trên GitHub-hosted runner.

## Kho đề

Các tài liệu đề chuyên Anh được giữ nguyên trong `De-chuyen-Anh-vao-10/` và không được đưa vào Pages artifact. `Learned_Vocabulary_List.md` vẫn được giữ để tham khảo lịch sử dữ liệu.
