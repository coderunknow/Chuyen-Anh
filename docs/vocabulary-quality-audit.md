# Vocabulary quality audit — Chuyên Anh

Sinh bởi `scripts/audit_vocabulary_quality.py`. Báo cáo tất định (không có dấu thời gian),
nên `--check` chứng minh được artifact còn khớp nguồn.

Báo cáo này sinh tự động từ `Learned_Vocabulary_List.md`, `docs/vocabulary-curation.json`,
`data/vocab-seed/*.tsv` và 106 bản chép đề trong `De-chuyen-Anh-vao-10/`. Số liệu dưới đây
được tính lại mỗi lần chạy; không có số nào được chép tay từ báo cáo cũ.

## Kết quả chọn lọc

- Tổng số hàng: **5,852** · headword: **5,112** · dạng cùng gốc đã gộp: **740**.
- Bộ từ học mặc định (trọng tâm): **3,841** headword.
- Đưa ra khỏi bộ từ học mặc định (lưu trữ, giữ nguyên ID và tiến độ): **1,271** headword (1,271 hàng kể cả dạng cùng gốc).

### Bộ từ trọng tâm theo nhóm

| Trường | Phân bố |
| --- | --- |
| Level (biên tập) | (none): 843, B1: 162, B2: 883, C1: 1,279, C2: 674 |
| Type | (none): 843, academic: 1,037, confusable: 34, core: 122, linker: 59, topic: 1,667, word-formation: 79 |
| Topic | (none): 843, academic: 898, culture: 111, daily-life: 119, economics: 143, education: 100, environment: 240, family: 15, food: 50, health: 177, law: 91, media: 89, politics: 97, psychology: 220, science: 137, society: 184, sport: 32, technology: 98, travel: 85, work: 112 |
| Có bằng chứng xuất hiện trong bản chép đề | 2,918 |
| Không có bằng chứng bản chép (vẫn giữ theo loại từ/họ từ/legacy) | 923 |

### Mục đã lưu trữ theo lý do

| Nhóm | Số headword |
| --- | ---: |
| `basic-b1` — Từ B1 nền phổ thông (mọi chủ đề) | 516 |
| `everyday-object` — Đồ vật sinh hoạt, nội thất, dụng cụ, quần áo | 403 |
| `food-drink` — Món ăn, nguyên liệu, dụng cụ bếp | 189 |
| `nature-species` — Loài động vật, thực vật, khoáng vật | 163 |

Lý do và bằng chứng của từng nhóm nằm trong `docs/vocabulary-curation.json` (trường `rationale`,
`evidence`, và danh sách ngoại lệ đã rà). Quyết định của từng từ nằm trong JSON của báo cáo này
(trường `decisions`, gồm lô hạt giống, level biên tập, số bản chép đề có dạng từ).

## Kiểm chứng nguồn gốc

- Đã đo lại **5,112** hàng: **5,072** khớp giữa claim và số bản chép đề đo được.
- **40** hàng lệch; **7** trong số đó được giải thích bằng dạng chia ở đúng dòng được trích
  (ví dụ claim nêu `expenditures` trong khi headword là `expenditure`), và **33** hàng chưa giải thích.

| ID | Từ | Claim | Đo được | Dạng được trích |
| ---: | --- | ---: | ---: | --- |
| 749 | Expenditure | 1 | 0 | expenditures |
| 807 | Deceive | 1 | 0 | deceived |
| 823 | Intimidate | 1 | 0 | intimidated |
| 843 | Contaminate | 1 | 0 | contaminated |
| 861 | Erode | 1 | 0 | eroded |
| 868 | Frustrate | 1 | 0 | frustrates |
| 871 | Refine | 1 | 0 | refined |
| 631 | Distinguish | 1 | 11 | — |
| 638 | Exceed | 1 | 5 | — |
| 645 | Infer | 1 | 2 | — |
| 653 | Regulate | 1 | 3 | — |
| 657 | Restrict | 1 | 4 | — |

`supports` của các hàng 614–913 nay nêu đúng dạng nhìn thấy ở dòng được trích, nên không còn
câu "form occurs" ngụ ý rằng chính headword xuất hiện nguyên dạng.

## Các mục biên đã cân nhắc riêng

Những mục dưới đây không được quyết bởi luật: mỗi dòng ghi quyết định và lý do kiểm chứng được.

| Từ | Quyết định | Lý do |
| --- | --- | --- |
| result | archived | Danh từ B1 nền; giá trị thi của nó nằm ở kết hợp từ và liên từ, mà kho cụm từ đã dạy riêng: `result in` (P517), `result from` (P518), `as a result` (P635), `as a result of` (P489). Giữ lại từ đơn sẽ lặp lại nội dung đã có. |
| order | archived | Cụm mục đích `in order to` là linker-phrase P673 trong kho cụm từ; nghĩa “thứ tự/đặt hàng” của từ đơn là vốn phổ thông. |
| fact | archived | Cụm `in fact` là linker-phrase P696. Bản thân “fact” là danh từ B1 không phân loại năng lực. |
| example | archived | `for example` là linker-phrase P644; “example” xuất hiện ở 93 bản chép vì đó là từ của chính đề ("for example"), không phải từ vựng cần học riêng. |
| time | archived | Xuất hiện ở 106 bản chép, nhưng phần lớn là nhãn thời gian và cụm chức năng của đề (time limit, at the same time). Đây là từ tần suất cao vì văn bản đề, không phải vì đề kiểm tra nó. |
| word | archived | 106 bản chép vì hướng dẫn đề dùng “word” ("write ONE word"); tần suất này là của thể loại văn bản, không phải của bài kiểm tra từ vựng. |
| ability | kept (ngoại lệ) | B1 theo thẻ, nhưng là dạng phái sinh của `able` và xuất hiện trong cấu trúc “the ability to do”, một mẫu danh từ hoá mà đề dùng. |
| advice | kept (ngoại lệ) | Cặp dễ nhầm advice/advise (danh từ không đếm được) là dạng confusable quen thuộc của đề; cùng gốc với `advise` trong bảng. |
| choice | kept (ngoại lệ) | Cặp choose/choice và cấu trúc “have no choice but to” thuộc word formation và collocation. |
| lose | kept (ngoại lệ) | Cặp dễ nhầm lose/loose; đã có trong lô 09-word-formation-confusables. |
| marriage | kept (ngoại lệ) | Dạng danh từ của marry; đề dùng cả hai dạng trong câu về gia đình/hôn nhân. |
| interest | kept (ngoại lệ) | Đa nghĩa (quan tâm / lãi suất / sở thích) và có cụm “be interested in”, “take an interest in”. |
| quite | kept (ngoại lệ) | Cặp dễ nhầm quite/quiet và là trạng từ mức độ trong đề. |
| abroad | kept (ngoại lệ) | Cặp dễ nhầm abroad/aboard; trạng từ không có giới từ đi kèm là điểm ngữ pháp đề hỏi. |
| sole | kept (ngoại lệ) | Tính từ “duy nhất” và danh từ “lòng bàn chân” là cặp đồng âm khác nghĩa; đề dùng nghĩa tính từ. |
| artery | archived (đã cân nhắc giữ) | Đã cân nhắc giữ vì thuộc nhóm đọc hiểu sức khoẻ, nhưng **0/106** bản chép có dạng `artery`; giữ lại sẽ là một mục không có bằng chứng. Nếu sau này có bản chép dùng từ này, thêm lại bằng ngoại lệ trong khối 13. |
| kidney | archived (đã cân nhắc giữ) | Cùng lý do với `artery`: 0/106 bản chép. `lung` (13 dòng) và `muscle` (5 dòng) thì có bằng chứng nên được giữ. |
| fuse | archived | 0/106 bản chép; là tên vật thể cụ thể (cầu chì) nên không có giá trị phân loại. Nghĩa động từ “hợp nhất” chỉ có trong từ điển, không có trong bản chép. |
| canvas | kept (ngoại lệ) | Có 2 dòng trong bản chép (chất liệu vải); cặp canvas/canvass là bẫy chính tả quen thuộc, dù `canvass` không xuất hiện trong 106 bản chép này — phần này là đánh giá biên tập, không phải bằng chứng văn bản. |
| sole | kept (ngoại lệ) | Có 6 dòng trong bản chép. Từ này vừa là tính từ “duy nhất” vừa là danh từ “lòng bàn chân”, nên giữ lại để phân biệt nghĩa; quyết định dựa trên bằng chứng xuất hiện, không dựa trên danh sách chủ đề. |
| lung | kept (ngoại lệ) | 13 dòng trong bản chép, thuộc bài đọc về sức khoẻ/hô hấp — đúng loại văn bản đề dùng, không phải tên vật thể trong nhà. |
| muscle | kept (ngoại lệ) | 5 dòng trong bản chép, có cả trong bài đọc về dinh dưỡng (muscle/fat). |

## Bằng chứng theo mục trắc nghiệm

- Trích tự động **1,489** mục trắc nghiệm từ 106 bản chép (dòng đánh số + tối đa hai dòng có ≥3 nhãn A./B./C./D.); **5,602** dạng từ khác nhau nằm trong các mục đó.
- **1,286** headword trọng tâm (**33.5%** bộ từ) từng xuất hiện trong một mục trắc nghiệm; **380** mục lưu trữ cũng từng xuất hiện.

Mục trắc nghiệm chỉ chứng minh từ đó từng nằm trong một lựa chọn của đề, **không** chứng minh nó là
đáp án, không chứng minh độ khó và không thay thế bản gốc. Từ chỉ xuất hiện trong bài đọc không
được tính ở đây.

| Từ | Dòng đầu tiên | Số mục |
| --- | --- | ---: |
| Deteriorate | `2023/ba-ria-vung-tau/so.md:L119` | 2 |
| Indispensable | `2025/kon-tum/so.md:L132` | 1 |
| Alleviate | `2022/dak-lak/so.md:L217` | 1 |
| Comprehensive | `2022/ninh-binh/so.md:L277` | 3 |
| Diligent | `2025/hai-phong/so.md:L417` | 1 |
| Ephemeral | `2024/ha-noi/chuyen-su-pham.md:L135` | 1 |
| Eradicate | `2024/da-nang/so.md:L220` | 1 |
| Feasible | `2024/thanh-hoa/so.md:L346` | 3 |
| Imperative | `2025/vinh-phuc/so.md:L123` | 1 |
| Inevitable | `2023/bac-ninh/so.md:L309` | 2 |
| Subtle | `2022/hai-phong/so.md:L318` | 3 |
| Unprecedented | `2022/hai-phong/so.md:L514` | 1 |

## Hàng cần soát (chưa có bằng chứng trong bản chép)

**923** headword đang ở bộ từ trọng tâm nhưng không có nguồn `exam-corpus`. Phân bố theo thẻ level biên tập: `(none)` 307, `B1` 2, `B2` 25, `C1` 236, `C2` 353.

Đây là danh sách **cần soát**, không phải kết luận: phần lớn là từ học thuật đến từ danh sách
biên tập và mục từ điển, chưa từng xuất hiện trong 106 bản chép hiện có. Không mục nào bị coi là
đã xác minh nghĩa trong phiên này.

## Độ phủ văn bản đề

- 106 bản chép có **21,321** token khác nhau; **8,179** token nội dung (đã bỏ từ chức năng) xuất hiện ở ≥3 bản.
- Bộ từ trọng tâm phủ **4,597** token trong nhóm đó (**56.2%** số kiểu từ, **46.3%** số lượt xuất hiện),
  tính cả dạng trong `WORD_FAMILY` và gộp biến thể hình thái đơn giản (s/es/ed/ing/ies…).
- **1,039** token chỉ còn trong các hàng lưu trữ; **2,543** token không thuộc hàng nào.

Đây là độ phủ *dạng chữ trong bản chép*, không phải độ phủ từ vựng của đề chính thức và không
phải tần suất thi. Các token chưa phủ chỉ là **ứng viên cần rà** cho v1.1.0; phiên này không thêm
headword mới vì không có nghĩa/nguồn đã xác minh trong sandbox.

| Ứng viên | Số bản chép | Số lần |
| --- | ---: | ---: |
| answer | 106 | 977 |
| following | 106 | 924 |
| read | 106 | 546 |
| best | 105 | 572 |
| use | 104 | 802 |
| new | 104 | 665 |
| way | 104 | 598 |
| like | 102 | 699 |
| made | 102 | 392 |
| take | 101 | 442 |
| good | 100 | 529 |
| end | 100 | 329 |
| given | 99 | 535 |
| reading | 99 | 296 |
| correct | 98 | 550 |
| even | 98 | 449 |
| used | 98 | 408 |
| get | 96 | 575 |
| using | 93 | 303 |
| day | 92 | 313 |

## Giới hạn và việc chưa kiểm chứng

- 0/106 bản chép đề đã được đối chiếu với bản gốc chính thức; bằng chứng exam-corpus chỉ là sự xuất hiện trong bản chép.
- Thẻ level:* là biên tập (level-source:editorial), không phải chứng nhận CEFR; báo cáo không dùng nó làm sự thật từ điển.
- Sandbox không truy cập được dictionary.cambridge.org; không mục từ nào được tuyên bố là đã tra từ điển trong phiên này.
- Không thêm headword mới: danh sách khoảng trống chỉ là ứng viên cho v1.1.0, chưa có nghĩa/nguồn đã xác minh.
- Quyết định lưu trữ là đánh giá biên tập về giá trị phân loại năng lực, không phải kết luận rằng từ đó sai hoặc không có trong đề.

Ngoài ra: 5,112 headword được rà **cấu trúc** (schema, trùng, họ từ, nguồn); 1,271 mục lưu trữ được rà **nghĩa và giá trị** theo nhóm. Nghĩa của các mục còn lại không được tra từ điển lại trong phiên này. Kho cụm từ (780 cụm) không nằm trong phạm vi chọn lọc của phiên này.

