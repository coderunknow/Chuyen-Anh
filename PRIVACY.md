# Privacy — Chuyên Anh

_Áp dụng cho `v1.0.0-rc5` và mọi bản dựng từ mã nguồn này._

## Tóm tắt

Ứng dụng là **một tệp HTML duy nhất**. Không có tài khoản, không có mã theo dõi của bên thứ ba và không nhúng khóa bí mật. Dữ liệu học
(tiến độ, yêu thích, chuỗi ngày, cấu hình phiên) chỉ nằm trong `localStorage` của trình duyệt bạn đang dùng, và không bao giờ được gửi đi.

Bản dựng này thêm **nhật ký chẩn đoán tùy chọn**, mặc định **tắt**. Từ rc5, nhật ký có thể được gửi tới máy chủ của chính dự án bằng
một nút bấm riêng; mục “Gửi nhật ký chẩn đoán” bên dưới mô tả chính xác đường đi và thời hạn lưu.

## Nhật ký chẩn đoán

**Cơ sở pháp lý / căn cứ:** sự đồng ý của bạn (opt-in rõ ràng). Không có dữ liệu nào được ghi trước khi bạn bật công tắc trong
**Cài đặt → Quyền riêng tư & nhật ký chẩn đoán**. Mỗi lần bật, thời điểm đồng ý được lưu cùng trạng thái.

**Ghi trên thiết bị:** nhật ký nằm ở `localStorage` khóa `chuyen-anh.telemetry.v1`, tối đa **200 mục** (mục cũ nhất bị bỏ).
Không có tác vụ nền nào gửi dữ liệu: chỉ một cú bấm *Gửi chẩn đoán* mới tạo đúng **một** yêu cầu `POST`, không thử lại, không xếp hàng.
Bạn cũng có thể bấm **Tải nhật ký JSON** và tự gửi tệp qua
[GitHub Issues của dự án](https://github.com/coderunknow/Chuyen-Anh/issues) nếu không muốn gửi trực tiếp.

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
nhật ký ngay lập tức và không gửi gì thêm**. Không cần tài khoản, không cần liên hệ ai.

## Gửi nhật ký chẩn đoán (rc5)

**Chỉ khi bạn bấm.** Nút *Gửi chẩn đoán* trong Cài đặt gửi **một** yêu cầu `POST` tới
`https://chuyen-anh-telemetry.vercel.app/api/telemetry` — hàm máy chủ của chính dự án ([`api/telemetry.js`](api/telemetry.js)), không
phải dịch vụ của bên thứ ba. Không cookie, không mã nhận dạng, không khóa bí mật trong trang.

**Nội dung một lần gửi:** `contract` (số phiên bản giao thức), `appVersion`, tối đa **50** mục nhật ký mới nhất và môi trường thô đã
lọc (`language` ∈ {vi, en}, `interface` ∈ {classic, modern}, `theme` ∈ {system, light, dark}, `viewport` ∈ {mobile, tablet, desktop},
`reducedMotion` boolean). Không có đáp án, không có chữ bạn gõ, không có từ bạn tra, không có user agent, không có múi giờ.

**Máy chủ làm gì:** kiểm tra `Origin` theo danh sách cho phép, kiểm tra `Content-Type`, giới hạn **16 KB** mỗi gói, kiểm tra
`contract`/`appVersion`, lọc lại từng sự kiện theo danh sách loại hợp lệ, cắt `note` tại dấu ngoặc đầu tiên, xóa mọi địa chỉ email
còn sót, giới hạn 50 sự kiện và 6 bộ đếm, rồi **dựng lại** gói tin trước khi ghi — trường lạ bị bỏ, không được lưu.

**Nơi lưu và thời hạn:** schema `telemetry` trong Supabase của dự án. RLS bật, **không có policy**, không vai trò `anon` hay
`authenticated` nào có quyền trên schema, bảng hay hàm; chỉ một hàm `security definer`
(`public.telemetry_ingest`) được cấp cho `service_role` và chỉ hàm đó ghi được dữ liệu. Mỗi bản ghi mang `retention_expires_at` =
**90 ngày** và bị xóa tự động (hàm dọn rác chạy tối đa mỗi giờ, gọi được bằng tay).

**Giới hạn tần suất:** 10 gói / 10 phút cho mỗi client và 120 gói / 10 phút toàn hệ thống. “Client” ở đây là một băm HMAC-SHA256
(32 ký tự hex) của địa chỉ IP với muối bí mật phía máy chủ; **địa chỉ IP không được lưu** cùng nhật ký và không xuất hiện trong log
của máy chủ.

**Khi gửi hỏng:** nhật ký **vẫn còn** trên thiết bị, bạn thấy một câu giải thích (hết thời gian chờ, không kết nối được, bị từ chối,
bị giới hạn tần suất) và có thể tải tệp JSON thay thế. Không có thử lại tự động.

## Dữ liệu khác

Kho đề, từ vựng và cụm từ nằm trong chính tệp HTML; không có yêu cầu mạng. Bản sao lưu JSON do bạn tự tạo và tự giữ. Xóa dữ liệu
học trong **Cài đặt → Sao lưu tiến độ** không ảnh hưởng nhật ký, và ngược lại.

## Liên hệ

Câu hỏi hoặc yêu cầu về dữ liệu: [GitHub Issues](https://github.com/coderunknow/Chuyen-Anh/issues) của dự án.

---

## English summary

The app is a single HTML file: no account, no third-party analytics, no embedded secret. Learning data stays in this browser's
`localStorage` and is never transmitted. The **diagnostics log is opt-in and off by default**; when you enable it, it stores at
most 200 events (timestamp, kind, short name, up to six numeric counters, a scrubbed error message) in `localStorage`. It never
records answers, typed text, search queries, backup contents, learning progress, user agent, device ids, timezone, IP address, or
an exact viewport size.

Since rc5 the log can be **sent**, but only when you press *Send diagnostics*: exactly one `POST` to
`https://chuyen-anh-telemetry.vercel.app/api/telemetry`, the project's own serverless function, carrying at most 50 recent entries
plus the coarse environment (language, interface, theme, viewport bucket, reduced-motion flag). No cookie, no retry, no background
queue. The server re-validates the request, rebuilds the payload from an allowlist (unknown fields are dropped, notes are cut at the
first quote, e-mail addresses are removed), then stores it in the project's Supabase schema `telemetry`, where RLS is enabled with
no policy and only one `security definer` function is executable by the service role. Records expire after **90 days**. Rate limits
are 10 reports per 10 minutes per client and 120 per 10 minutes overall; a client is a salted HMAC-SHA256 of the IP address, which
is never stored. A failed send leaves the log on your device and never reports success. You can view, download, delete it, or
withdraw consent at any time; switching the toggle off erases the log immediately and sends nothing further.
