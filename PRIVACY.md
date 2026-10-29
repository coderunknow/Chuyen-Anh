# Privacy — Chuyên Anh

_Áp dụng cho `v1.0.0-rc4` và mọi bản dựng từ mã nguồn này._

## Tóm tắt

Ứng dụng là **một tệp HTML duy nhất**. Không có máy chủ, không có tài khoản, không có mã theo dõi của bên thứ ba. Dữ liệu học
(tiến độ, yêu thích, chuỗi ngày, cấu hình phiên) chỉ nằm trong `localStorage` của trình duyệt bạn đang dùng.

Bản dựng này thêm **nhật ký chẩn đoán tùy chọn**, mặc định **tắt**, để người duy trì có thể tìm lỗi khi bạn báo lỗi.

## Nhật ký chẩn đoán

**Cơ sở pháp lý / căn cứ:** sự đồng ý của bạn (opt-in rõ ràng). Không có dữ liệu nào được ghi trước khi bạn bật công tắc trong
**Cài đặt → Quyền riêng tư & nhật ký chẩn đoán**. Mỗi lần bật, thời điểm đồng ý được lưu cùng trạng thái.

**Chỉ ghi trên thiết bị:** nhật ký nằm ở `localStorage` khóa `chuyen-anh.telemetry.v1`, tối đa **200 mục** (mục cũ nhất bị bỏ),
và **ứng dụng không tự gửi dữ liệu đi đâu** — không `fetch`, không `XMLHttpRequest`, không `sendBeacon`, không điểm cuối cấu hình.
Muốn gửi, bạn bấm **Tải nhật ký JSON** rồi tự đính kèm tệp vào
[GitHub Issues của dự án](https://github.com/coderunknow/Chuyen-Anh/issues).

**Được ghi:**

| trường | ví dụ | mục đích |
|---|---|---|
| `at` | `2026-10-28T12:00:00.000Z` | thời điểm sự kiện |
| `kind` | `boot`, `session-end`, `backup`, `error`, `search-open` | loại sự kiện |
| `name` | `app-boot`, `import-error` | tên ngắn của sự kiện |
| `counters` | `{ turns: 20, correct: 17 }` | tối đa 6 số, không phải nội dung |
| `note` | `Import thất bại:` | thông báo lỗi, cắt từ dấu ngoặc đầu tiên |

**Không bao giờ ghi:** đáp án hay chữ bạn gõ, từ bạn tra cứu, nội dung tệp sao lưu, tiến độ/yêu thích/chuỗi ngày, user agent,
mã thiết bị, múi giờ, địa chỉ IP hay kích thước màn hình chính xác (chỉ phân loại `mobile` / `tablet` / `desktop`).

**Quyền của bạn:** xem (mở tệp tải về), xóa (nút *Xóa nhật ký*), rút lại đồng ý bất cứ lúc nào — **tắt công tắc sẽ xóa toàn bộ
nhật ký ngay lập tức**. Không cần tài khoản, không cần liên hệ ai.

## Dữ liệu khác

Kho đề, từ vựng và cụm từ nằm trong chính tệp HTML; không có yêu cầu mạng. Bản sao lưu JSON do bạn tự tạo và tự giữ. Xóa dữ liệu
học trong **Cài đặt → Sao lưu tiến độ** không ảnh hưởng nhật ký, và ngược lại.

## Liên hệ

Câu hỏi hoặc yêu cầu về dữ liệu: [GitHub Issues](https://github.com/coderunknow/Chuyen-Anh/issues) của dự án.

---

## English summary

The app is a single HTML file: no server, no account, no third-party analytics. Learning data stays in this browser's
`localStorage`. The **diagnostics log is opt-in and off by default**; when you enable it, it stores at most 200 events
(timestamp, kind, short name, up to six numeric counters, a scrubbed error message) in `localStorage` and **the app transmits
nothing** — you download the JSON and send it yourself. It never records answers, typed text, search queries, backup contents,
learning progress, user agent, device ids, timezone, IP address, or an exact viewport size. You can view, download, delete it, or
withdraw consent at any time; switching the toggle off erases the log immediately.
