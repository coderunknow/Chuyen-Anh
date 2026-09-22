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

## GitHub Actions

### Deploy `.github/workflows/deploy.yml`

Trigger path-based khi `main` thay đổi frontend, `data/**`, assets, validator hoặc workflow. Luồng là:

```text
checkout
  ↓
python scripts/validate_vocab.py
  ↓
stage index.html/style.css/app.js/data (không build)
  ↓
configure Pages
  ↓
upload static artifact
  ↓
deploy Pages
```

Workflow có concurrency `flashcard-pages` và `cancel-in-progress: true`. Không có `setup-node`, `npm install`, `npm ci`, bundler hoặc build frontend. Artifact chỉ chứa static app, không upload các PDF/ghi chú khác trong repository.

### CI `.github/workflows/ci.yml`

CI tách riêng cho PR/push: chạy validator Python, unit test Python và dependency-free Node built-in tests cho scheduler/search/persistence/import. CI không chạy npm install và không phải deployment.

GitHub Pages cần được bật với source **GitHub Actions** trong Settings → Pages. Không thể đo runtime deploy thật từ checkout local; sau lần merge đầu tiên, xem job summary của `Deploy Flashcard` để ghi nhận checkout, validation, upload và deploy trên GitHub-hosted runner.

## Kho đề

Các tài liệu đề chuyên Anh được giữ nguyên trong `De-chuyen-Anh-vao-10/` và không được đưa vào Pages artifact. `Learned_Vocabulary_List.md` vẫn được giữ để tham khảo lịch sử dữ liệu.
