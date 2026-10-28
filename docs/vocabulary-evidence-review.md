# Rà bằng chứng cho bộ từ trọng tâm

Báo cáo sinh tự động từ `scripts/vocabulary_evidence_review.py`; `--check` chứng minh tệp còn khớp dữ liệu.
Phạm vi: **923** headword đang ở bộ từ trọng tâm mà **không** có nguồn `exam-corpus`, trên tổng 5,112 headword.

Đây là bảng phân loại **nguyên nhân**, không phải kết luận từ nào không cần học. Một từ không xuất hiện trong 106 bản chép vẫn có thể cần cho đề: bản chép chỉ phủ 106 bộ đề, và dạng bài biến đổi từ kiểm tra gốc từ mà gốc không nhất thiết nằm trong bài đọc.

| Nhóm | Số headword | Nghĩa | Cách xử lý |
| --- | ---: | --- | --- |
| `phrase-in-corpus` | 14 | Cả cụm xuất hiện trong bản chép | Giữ; ghi nguồn cụm vào hàng khi rebuild. |
| `surface-variant` | 188 | Chỉ một dạng biến đổi của từ xuất hiện | Giữ; câu nguồn phải nêu đúng dạng đã thấy, không nhận là headword. |
| `multiword-words-only` | 5 | Các chữ của cụm cùng có trong một đề, nhưng không đứng cạnh nhau | Giữ nhưng hạ mức bằng chứng: chỉ là các chữ cùng xuất hiện trong một đề. |
| `exam-format-only` | 5 | Không có trong văn bản, nhưng thuộc dạng bài đề kiểm tra trực tiếp | Giữ: dạng bài từ loại/biến đổi từ/liên kết câu kiểm tra gốc từ, không cần gốc xuất hiện trong bài đọc. |
| `dictionary-only` | 698 | Chỉ có mục từ điển và nghĩa, không có bằng chứng trong đề | Giữ và đánh dấu: bằng chứng là mục từ điển, không phải đề thi. |
| `no-basis` | 13 | Chưa tìm được căn cứ nào để giữ — cần rà thủ công | Đánh dấu để rà thủ công; không tự xoá, không tự lưu trữ. |

## Phân bố theo level biên tập

| Nhóm | (none) | B1 | B2 | C1 | C2 |
| --- | ---: | ---: | ---: | ---: | ---: |
| `phrase-in-corpus` | 14 |  |  |  |  |
| `surface-variant` | 52 | 1 | 12 | 76 | 47 |
| `multiword-words-only` | 5 |  |  |  |  |
| `exam-format-only` |  |  |  | 1 | 4 |
| `dictionary-only` | 223 | 1 | 13 | 159 | 302 |
| `no-basis` | 13 |  |  |  |  |

## Bằng chứng mới tìm được

Cụm xuất hiện nguyên văn trong bản chép:

| Headword | Dòng dẫn | Số lần | Số đề |
| --- | --- | ---: | ---: |
| A bit of a stretch | `2026/tp-ho-chi-minh/ptnk.md:L59` | 1 | 1 |
| Agree to disagree | `2026/tp-ho-chi-minh/ptnk.md:L59` | 1 | 1 |
| Add up to | `2023/ba-ria-vung-tau/so.md:L353` | 4 | 3 |
| Land on | `2022/ha-noi/chuyen-su-pham.md:L119` | 4 | 3 |
| In the offing | `2026/tp-ho-chi-minh/ptnk.md:L154` | 1 | 1 |
| In the balance | `2026/nghe-an/so.md:L821` | 2 | 2 |
| On the back burner | `2026/tp-ho-chi-minh/ptnk.md:L154` | 1 | 1 |
| By virtue of | `2025/tuyen-quang/so.md:L148` | 2 | 2 |
| In the face of | `2022/dong-nai/so.md:L578` | 7 | 7 |
| Out on a limb | `2026/tp-ho-chi-minh/ptnk.md:L209` | 1 | 1 |

Headword không xuất hiện, nhưng một dạng biến đổi có:

| Headword | Dạng thấy | Dòng dẫn | Số đề |
| --- | --- | --- | ---: |
| Ambiguity | `ambiguities` | `2022/dak-lak/so.md:L431` | 1 |
| Concurrent | `concurrently` | `2023/hai-phong/so.md:L367` | 3 |
| Endorse | `endorsed` | `2022/tay-ninh/so.md:L289` | 1 |
| Incessant | `incessantly` | `2023/tp-ho-chi-minh/ptnk.md:L268` | 2 |
| Pertinent | `pertinently` | `2026/ninh-binh/so.md:L281` | 2 |
| Inadvertent | `inadvertently` | `2025/vinh-phuc/so.md:L309` | 1 |
| Placate | `placated` | `2026/dak-lak/so.md:L251` | 1 |
| Disparage | `disparaged` | `2023/vinh-phuc/so.md:L243` | 1 |
| Appraise | `appraised` | `2026/dak-lak/so.md:L229` | 1 |
| Articulate | `articulated` | `2023/tp-ho-chi-minh/ptnk.md:L262` | 1 |

## Danh sách cần rà thủ công (`no-basis`)

**13** mục. Không mục nào bị xoá hay lưu trữ: đây là danh sách để người biên tập quyết định.

Sound judgment, Snap judgment, Stick to one's guns, Play one's cards right, Follow one's nose, Throw one's hat in the ring, Pander to, Lest + S + (should) V-bare, Burn one's bridges/boats, Bide one's time, Cut one's losses, Rear its (ugly) head, Shrinking violet

## Giới hạn

- Bằng chứng 'surface-variant' là bằng chứng cho HỌ TỪ, không phải cho chính headword; câu nguồn phải nêu dạng đã thấy.
- Không tra từ điển trực tuyến trong phiên này: 'dictionary-only' chỉ nói rằng trong hàng có locator mục từ điển, không phải đã xác minh nghĩa.
- Không có từ nào bị xoá hay lưu trữ bởi báo cáo này; 'no-basis' là danh sách cần rà.
