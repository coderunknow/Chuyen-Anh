# Chuyên Anh — Flashcard Từ Vựng & Kho Đề

## Flashcard Từ Vựng Chuyên Anh

Web flashcard học từ vựng **frontend-only**, nhanh, mượt, hoạt động offline với localStorage, hệ thống học dựa trên **active recall, spaced repetition, retrieval practice, interleaving**.

- **Live website**: Sau khi merge vào `main`, GitHub Actions tự build và deploy lên GitHub Pages
- **Source of truth**: `data/vocabulary.json` — thêm từ vào đây là đủ
- **Pipeline**: `main` → validate → test → build → deploy (nhanh, có cache)

### Cách thêm từ mới

1. Mở `data/vocabulary.json`
2. Thêm entry theo schema:
```json
{
  "id": "614",
  "word": "menial task",
  "pos": "phrase",
  "meaning": "công việc lao dịch, tay chân vất vả, ít được coi trọng",
  "examples": ["He was tired of doing menial tasks all day."],
  "tags": [],
  "difficulty": 0
}
```
3. Chạy `npm run validate:vocab` local để kiểm tra
4. Tạo PR → merge vào `main` → web tự cập nhật

**Lưu ý**: `id` không trùng, `word` không trùng nghĩa, không thiếu field bắt buộc.

### Chạy local

```bash
npm ci
npm run validate:vocab
npm run test
npm run dev
# mở http://localhost:5173
npm run build
npm run preview
```

### Kiến trúc

```
data/vocabulary.json  → validate → build → dist/ → GitHub Pages
```

- Frontend: Vite + Vanilla JS (bundle ~40KB JS gzipped ~12KB)
- Storage: localStorage (progress, favorites, streak, history)
- Scheduler: SM-2 inspired, states: new → learning → weak → review → mastered
- Modes: recognition, recall, spelling, cloze/context
- Search: client-side, hỗ trợ English/Vietnamese/POS/tag/state

### Tính năng học

- Session: Due Today, Weak Words, New Words, Random, Favorites, Quick 10/20/30
- Dashboard: total, learned, mastered, due, weak, accuracy, streak
- Filter/Sort: All/New/Learning/Weak/Mastered/Due/Favorites + A-Z, difficulty, most wrong...
- Keyboard: 1-4 chọn, Enter xác nhận, N bỏ qua, F yêu thích, Space tiếp
- Import/Export progress JSON
- Responsive, accessibility, reduced-motion support

### GitHub Actions

Workflow `.github/workflows/deploy.yml`:

- Trigger: push `main` với paths `data/**`, `src/**`, `public/**`, package files
- Concurrency: `flashcard-main` cancel-in-progress
- Steps: checkout → setup-node (cache npm) → npm ci → validate → test → build → deploy
- Deploy: `actions/deploy-pages@v4` → GitHub Pages
- Nếu validation fail hoặc build fail → không deploy

---

## Kho đề chuyên Anh vào lớp 10

- [Đề thi 2022–2026 dạng Markdown](De-chuyen-Anh-vao-10/README.md)
- [Danh mục đề](De-chuyen-Anh-vao-10/DANH-MUC.md) · [Độ phủ và các tỉnh/năm còn thiếu](De-chuyen-Anh-vao-10/DO-PHU.md)

Bộ sưu tập đang bổ sung, có ghi nguồn và cảnh báo chất lượng; chưa đầy đủ toàn quốc và chưa đối chiếu từng câu với bản gốc.

### Từ vựng cũ

File `Learned_Vocabulary_List.md` được giữ lại để tham khảo, đã được convert sang `data/vocabulary.json` làm source of truth mới.

### Validation

```bash
npm run validate:vocab
# Output:
# Vocabulary validation
# Total entries: 613
# Duplicates: 0
# Invalid: 0
# ✓ Validation passed
```

### Tests

```bash
npm run test
# 23 tests: scheduler, search, vocab, modes
```
