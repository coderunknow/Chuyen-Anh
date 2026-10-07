# Đối chiếu 300 mục từ mới (614–913)

## Kết luận rà soát — 2026-09-30

- Giữ **đúng 300 đầu mục mới**, tổng nhật ký 913 mục. Không trùng đầu mục với 613 mục lịch sử sau chuẩn hóa Unicode, hoa/thường và khoảng trắng; không dùng số nhiều/quá khứ để tăng số đầu mục.
- Mỗi mục có nghĩa tiếng Việt, từ loại, họ từ/dạng biến tố, phân biệt cách dùng và ít nhất một vị trí xuất hiện trong bản chép đề chuyên Anh 2022–2026. Nguồn bao gồm bài đọc, câu hỏi, phương án, đáp án, hướng dẫn và transcript; **không khẳng định mọi từ được kiểm tra trực tiếp hoặc là đáp án đúng**.
- Đã rà soát biên tập toàn bộ 300 mục về nghĩa, từ loại, nhánh nghĩa của họ từ và các phát biểu quá tuyệt đối. Đây là bộ học thiên về đọc hiểu, viết, biến đổi từ và cặp dễ nhầm, **không phải bảng xếp hạng xác suất ra thi**. Không phát hiện đầu mục mới nào cần dùng theo nghĩa cổ/obsolete; điều này không phải chứng nhận từ điển cho mọi dạng phái sinh.
- Không sửa 613 mục lịch sử, không chạy converter và **không thay `data/vocabulary.json`**. Một số mục lịch sử vốn có quan hệ họ từ; lần này không nhân rộng cách đếm đó.

## Quy ước chống trùng

“Không trùng” ở đây trước hết là không lặp đầu mục và không lấy biến tố hoặc dạng phái sinh trực tiếp để tăng số lượng. Những trường hợp cùng gốc xa nhưng có nghĩa và cách dùng riêng như **credible–credulous/credence**, **capacity–capable** được ghi liên hệ, không coi là từ thay thế nhau. Không tuyên bố 300 mục hoàn toàn tách biệt về từ nguyên; nếu gộp theo mọi gốc Latin thì sẽ mất nhiều cặp phân biệt đáng học. Riêng các họ mở rộng đã có mục lịch sử như rational–rationale được ưu tiên bỏ để dành chỗ, không vì hai từ dùng được thay nhau.

## Đính chính phương pháp của lượt trước

Bỏ kết luận “18 từ ít gặp nên thay bằng từ hữu ích hơn” và ngưỡng loại dưới 5 đề. Bộ đếm theo tiền tố ở lượt trước có thể gộp từ không cùng họ; số lần có mặt trong một kho nhỏ cũng không chứng minh từ hiếm/cổ hay ít giá trị học tập.

Lần này dùng [`vocabulary-300-families.json`](vocabulary-300-families.json): danh sách dạng **viết cụ thể**, được biên tập riêng cho từng mục, có cả một số biến tố và cách viết Anh–Mỹ. Không sinh họ từ bằng tiền tố, stemming hay thêm hậu tố tự động. Các danh sách này là **tập dạng được chọn để đếm**, không phải tuyên bố liệt kê đầy đủ mọi họ từ. Từ ghép/liên hệ nghĩa như long-lived không tự động được tính cho longevity. Với từ dễ lẫn đồng hình như found, account, short, không đưa dạng quá rộng vào số đếm phụ trợ.

[`vocabulary-300-counts.json`](vocabulary-300-counts.json) lưu số tệp, danh sách tệp và số tệp có từng dạng. Có thể tái lập offline:

```sh
python scripts/audit_learned_vocab.py --check
```

Phạm vi: **106 tệp bản chép**, chỉ từ sau tiêu đề `## Đề thi và phần kèm theo trong nguồn`, bỏ thẻ HTML và URL đích của liên kết Markdown. Khớp nguyên token, không phân biệt hoa/thường, giữ từ có dấu nối thành một token. Mỗi dạng/họ chỉ tính một lần trong một tệp.

**Giới hạn:** tệp có thể chứa nhiều đề/phần kèm theo; các tệp có thể dùng lại đoạn đọc. Đếm chưa tách nghĩa/từ loại, chưa loại hướng dẫn, đáp án, distractor hay văn bản trùng liên tệp; lỗi OCR và khác kiểu gạch nối có thể làm bỏ sót. Vì vậy, “13/106 tệp” **không** có nghĩa “ra ở 13 đề độc lập”, càng không phải xác suất ra thi. Tần suất chỉ hỗ trợ nhận diện độ phủ, không là tiêu chí loại duy nhất.

## Các sửa chữa quan trọng

- **Consequently → Deceive:** consequently đã nằm trong họ consequence (728), không dùng thêm một đầu mục mới cho cùng họ.
- **Biodiversity → Degrade:** biodiversity là từ ghép từ bio- + diversity; giữ giải thích trong Diverse (685), không tính thêm đầu mục.
- **Substance → Versatile; Neglect → Empathy; Rational → Humiliate; Compulsory → Deduction:** tránh mở rộng lại các họ đã có Substantial (50), Negligent (42), Rationale (426), Compel (393). Đây là lựa chọn chống lặp cho bộ 300, không nói rằng các cặp đồng nghĩa hay dùng thay được cho nhau.
- **Furthermore → Intimidate; Relatively → Refine; Approximately → Defy; Remarkable → Nevertheless; Sophisticated → Guarantee; Guarantee ở vị trí cũ → Clarification; Nevertheless ở vị trí cũ → Applaud.** Vẫn giữ linker Nevertheless/Moreover/Whereas và nhóm học thuật/viết luận, nhưng cân bằng thêm các họ từ và cấu trúc chuyên Anh. Không xếp các từ bị bỏ là cổ hay vô ích.
- **Superior:** bỏ superlative khỏi họ từ; giữ superiority; ghi inferior to là trái nghĩa, không phải phái sinh.
- **Objective:** bỏ objection khỏi họ; giữ objectivity/objectively và giải thích rõ hai nhánh nghĩa.
- Sửa nghĩa/từ loại theo ngữ cảnh: conduct oneself, degrade có thể không có tân ngữ, gradual là tính từ, principle là nguyên lý (không đồng nhất với định lý), virtual/virtually theo từng nghĩa.
- Sửa phát biểu quá tuyệt đối: also có thể đứng đầu câu; nevertheless không chỉ đứng đầu câu; advertise không chỉ dùng trong thương mại; perceptive còn mô tả nhận xét; sufficient dùng được sau be; comprising là dạng -ing nhưng không vì vậy mà dùng thể tiếp diễn với nghĩa gồm có.
- Bỏ bớt dạng phụ ít cần học như hostilely, relevantly, mutuality, circumstantially, interpersonally khỏi phần học chính. Không bịa danh từ/động từ chỉ để điền đủ họ từ.
- Chọn lại một số trích dẫn: cease từ **ceased to find** thay vì **without cease** (danh từ); discriminate từ phương án trong đề thay vì **discriminate nest builders**; intelligible từ phương án từ vựng thay vì tiêu chí chữ viết; virtually, ambition, bargain, refine, frustrate, eligible từ ngữ cảnh rõ hơn.

## Đối chiếu lại 18 quyết định thay từ của lượt trước

Cột “cũ → mới” dưới đây chỉ là lịch sử thay ở lượt trước, không phải hai từ đồng nghĩa. Số tệp được đếm lại theo danh sách dạng tường minh; quyết định hiện tại xét cả chống lặp, word formation, cấu trúc và cân bằng nội dung.

| Cũ → mới (lượt trước) | Tệp cũ → mới | Quyết định hiện tại |
|---|---:|---|
| Legitimate → Nevertheless | 2 → 26 | Giữ Nevertheless cho nhượng bộ; legitimate không cổ nhưng chưa ưu tiên trong bộ giới hạn 300. |
| Applaud → Furthermore | 8 → 27 | Khôi phục Applaud: applaud/applause, hành động vỗ tay và khen ngợi. Moreover đã bao phủ chức năng bổ sung ý. |
| Unveil → Moreover | 2 → 26 | Giữ Moreover cho tổ chức lập luận; unveil có giá trị nhưng phạm vi công bố sản phẩm/sự kiện hẹp hơn trong bộ này. |
| Tuition → Consequently | 2 → 53 | Bỏ Consequently vì đã có Consequence. Chưa chọn lại Tuition; không gán tutor/tutorial thành phái sinh trực tiếp của tuition. |
| Deceive → Whereas | 5 → 21 | Giữ cả hai ở vị trí khác nhau: deceive/deception, câu viết lại pull the wool over; whereas nối hai ý đối chiếu. |
| Humiliate → Relatively | 2 → 87 | Khôi phục Humiliate: humiliating/humiliated và mức độ mạnh hơn embarrass; không cần gom cả họ relate chỉ để tăng độ phủ. |
| Famine → Increasingly | 3 → 86 | Giữ Increasingly cho mô tả xu hướng; famine không cổ nhưng chủ đề hẹp hơn mục tiêu ưu tiên hiện tại. |
| Defy → Approximately | 3 → 18 | Khôi phục Defy: defy limitations/predictions, defiant và câu viết lại PTNK; không thay chỉ vì số tệp thấp. |
| Rehabilitate → Eventually | 3 → 35 | Giữ Eventually: kết cục theo thời gian, phân biệt possibly/finally; rehabilitate để nhóm sức khỏe/xã hội mở rộng. |
| Empathy → Sufficient | 3 → 35 | Giữ cả hai: empathy trong đọc hiểu tâm lý/AI, khác sympathy; sufficient/enough cho cấu trúc và viết. |
| Livelihood → Principle | 3 → 22 | Giữ Principle: principle/principal và nguyên lý/nguyên tắc; livelihood vẫn là từ hữu ích, không bị coi cổ. |
| Clarification → Guarantee | 13 → 16 | Giữ cả hai: clarification/clarify/clarity có 13 tệp; guarantee có cấu trúc và nghĩa riêng với ensure/promise. |
| Deduction → Superior | 3 → 11 | Giữ cả hai: deduction gồm suy luận và khấu trừ; superior to là cấu trúc dễ nhầm, không học superlative như cùng họ. |
| Surplus → Phenomenon | 4 → 24 | Giữ Phenomenon: phenomenon/phenomena và dùng trong đọc hiểu khoa học. Surplus không bị đánh giá là vô ích. |
| Versatile → Remarkable | 4 → 22 | Khôi phục Versatile: versatile/versatility, đối chiếu flexible; không thay họ từ hữu ích chỉ vì độ phủ thấp. |
| Degrade → Sophisticated | 6 → 15 | Khôi phục Degrade: degradation/degradable, cả tự suy giảm và làm suy giảm; thay mục compound Biodiversity đã gộp dưới Diverse. |
| Intimidate → Promote | 5 → 47 | Giữ cả hai: intimidating/intimidated, gây sợ/mất tự tin; promote cho thúc đẩy/quảng bá/thăng chức. |
| Refine → Emphasize | 5 → 24 | Giữ cả hai: refine/refinement/refinery trong tinh chế/cải tiến; emphasize/emphasis và cách viết emphasise. |

## Những mục dưới 5 tệp vẫn giữ và lý do

Không dùng ngưỡng 5 làm chuẩn “hữu ích”. Các mục dưới đây có ngữ cảnh xác định được, và cấu trúc/nhánh nghĩa đáng học:

| Mục | Số tệp | Lý do giữ |
|---|---:|---|
| Allocate | 4 | allocate time/budget; phân biệt allocate với distribute, biến đổi allocation. |
| Eligible | 3 | eligible for; bài word formation ELIGIBLE → eligibility trong Bình Dương 2025. |
| Humiliate | 2 | humiliate/ humiliation/ humiliating/ humiliated; phân biệt mức độ với embarrass, có transcript/ngữ cảnh trong đề. |
| Recession | 4 | economic recession; dùng trong ngữ cảnh kinh tế và viết lại câu (Nghệ An 2026). |
| Versatile | 4 | versatile/versatility; đối chiếu flexible; bài đọc công nghệ/giáo dục trong nhiều tỉnh. |
| Deduction | 3 | deduction/deduct/deduce/deductive; hai nhánh khấu trừ và suy luận đều có ngữ cảnh trong kho. |
| Defy | 3 | defy limitations/predictions; defiant trong câu viết lại PTNK 2026. |
| Empathy | 3 | đọc hiểu tâm lý/AI và kỹ năng xã hội; phân biệt empathy/sympathy. |

## Từ điển/nguồn ngữ pháp tra bổ sung

Truy cập 2026-09-30. Chỉ liệt kê các điểm đã tra bổ sung; **không tuyên bố tra độc lập mọi mục/họ từ**:

- [Also, as well or too — Cambridge Grammar](https://dictionary.cambridge.org/grammar/british-grammar/also-as-well-or-too): also có thể đứng đầu hoặc giữa câu.
- [Consist, comprise or compose — Cambridge Grammar](https://dictionary.cambridge.org/grammar/british-grammar/consist-comprise-or-compose): nghĩa cấu thành, thể tiếp diễn và be comprised of.
- [Advertise](https://dictionary.cambridge.org/dictionary/english/advertise): thông báo công khai, gồm cả việc tuyển người; không chỉ quảng cáo hàng hóa.
- [Substitute](https://dictionary.cambridge.org/dictionary/english/substitute): substitute A for B; có cả cấu trúc substitute B with A, cần đọc đúng vai A/B.
- [Deceive](https://dictionary.cambridge.org/dictionary/english/deceive), [Empathy](https://dictionary.cambridge.org/dictionary/english/empathy), [Versatile](https://dictionary.cambridge.org/dictionary/english/versatile): nghĩa và dạng liên quan. Nhãn trình độ cao không đồng nghĩa với cổ/obsolete.
- [Deduction](https://dictionary.cambridge.org/dictionary/english/deduction): suy luận và khoản khấu trừ là hai nhánh cần phân biệt.
- [Renewable](https://dictionary.cambridge.org/dictionary/english/renewable): nguồn năng lượng tái tạo và giấy tờ/hợp đồng được gia hạn.
- [Capacious](https://dictionary.cambridge.org/dictionary/english/capacious): có sức chứa lớn, văn phong trang trọng; không thay cho capable trong mọi nghĩa.
- [Legitimate](https://dictionary.cambridge.org/dictionary/english/legitimate): hợp pháp hoặc chính đáng; vẫn hữu ích dù không chọn trong bộ 300 hiện tại.

## Bằng chứng xuất hiện và số đếm phụ trợ

Trích đoạn giữ nguyên bản chép, có thể cắt hai đầu. **Không dùng làm câu mẫu ngữ pháp:** nguồn có OCR, câu sửa lỗi và phương án nhiễu. Liên kết ghim vào commit nguồn để kiểm tra dòng và metadata tài liệu. Họ từ để học không nhất thiết xuất hiện đầy đủ trong trích đoạn; không đánh đồng dạng phái sinh với đầu mục.

### 614. Acquire

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/ba-ria-vung-tau/so.md#L102); dạng xuất hiện: **acquire**.
- Độ phủ theo tập dạng đã chọn: **24/106 tệp**; các dạng có mặt: acquire, acquired, acquires, acquiring, acquisition.
```text
**3. **In today’s <u>competitive</u> job market, one needs to acquire <u>enhanced</u> IT skills to remain <u>relevant</u> and improve their <u>employment<…
```

### 615. Adapt

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/ha-noi/so.md#L215); dạng xuất hiện: **adapt**.
- Độ phủ theo tập dạng đã chọn: **48/106 tệp**; các dạng có mặt: adapt, adaptability, adaptable, adaptation, adaptations, adapted, adapting, adapts.
```text
we adapt by putting on a sweater, the situation is much more serious for the Monarchs. Temper…
```

### 616. Allocate

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/binh-duong/so.md#L562); dạng xuất hiện: **allocating**.
- Độ phủ theo tập dạng đã chọn: **4/106 tệp**; các dạng có mặt: allocated, allocates, allocating.
```text
135\. The government should prioritize education when allocating the budget. (GIVE)
```

### 617. Anticipate

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2024/tp-ho-chi-minh/so.md#L107); dạng xuất hiện: **anticipate**.
- Độ phủ theo tập dạng đã chọn: **15/106 tệp**; các dạng có mặt: anticipate, anticipated, anticipates, anticipation.
```text
of who we would like to be, not who we actually are. We anticipate photos of people in a celebratory mood while attending major
```

### 618. Assess

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2026/nghe-an/so.md#L566); dạng xuất hiện: **assess**.
- Độ phủ theo tập dạng đã chọn: **23/106 tệp**; các dạng có mặt: assess, assessed, assessing, assessment, assessments, assessors.
```text
- suggest better ways for schools to teach and assess students’ use of AI;
```

### 619. Assume

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2026/ha-tinh/so.md#L190); dạng xuất hiện: **assume**.
- Độ phủ theo tập dạng đã chọn: **32/106 tệp**; các dạng có mặt: assume, assumed, assumes, assuming, assumption, assumptions.
```text
…scriptive of the unique dual parenting role that this generation assume.
```

### 620. Clarification

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/tuyen-quang/so.md#L322); dạng xuất hiện: **clarification**.
- Độ phủ theo tập dạng đã chọn: **13/106 tệp**; các dạng có mặt: clarification, clarified, clarity.
```text
…d mark for a project I did and I knew that if I’d just asked for clarification on what we were supposed to do, I could have done well. Next time there was somethin…
```

### 621. Conduct

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2023/tp-ho-chi-minh/so.md#L294); dạng xuất hiện: **conduct**.
- Độ phủ theo tập dạng đã chọn: **25/106 tệp**; các dạng có mặt: conduct, conducted, conducting, conductors.
```text
       3         conduct themselves. People may be said to have no manners if they speak rudely to someone, y…
```

### 622. Confirm

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2023/ba-ria-vung-tau/so.md#L236); dạng xuất hiện: **confirm**.
- Độ phủ theo tập dạng đã chọn: **21/106 tệp**; các dạng có mặt: confirm, confirmation, confirmed, confirming, confirms.
```text
confirm that extroverts post more messages and photos on social-networking sites than
```

### 623. Considerable

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/khanh-hoa/so.md#L42); dạng xuất hiện: **considerable**.
- Độ phủ theo tập dạng đã chọn: **83/106 tệp**; các dạng có mặt: consider, considerable, considerably, considerate, considerately, consideration, considerations, considered, considering, considers.
```text
**1. **Lucy has been under considerable \_\_\_\_\_\_\_\_\_\_ lately because she has a lot of personal problems.
```

### 624. Consistent

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2023/dong-nai/so.md#L292); dạng xuất hiện: **consistent**.
- Độ phủ theo tập dạng đã chọn: **26/106 tệp**; các dạng có mặt: consistency, consistent, consistently, inconsistencies, inconsistent, inconsistently.
```text
…orkforce, Australian research studies over the last 15 years are consistent in showing that
```

### 625. Conventional

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/nghe-an/so.md#L343); dạng xuất hiện: **conventional**.
- Độ phủ theo tập dạng đã chọn: **18/106 tệp**; các dạng có mặt: convention, conventional, conventionally, conventions, unconventional.
```text
      Since concerns over the effects of conventional farming on both human health and the environment first (8)         ,
```

### 626. Crucial

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/tp-ho-chi-minh/so.md#L196); dạng xuất hiện: **crucial**.
- Độ phủ theo tập dạng đã chọn: **28/106 tệp**; các dạng có mặt: crucial.
```text
    It’s crucial to re-evaluate our relationship with food. The ideal diet should consist of fruits, …
```

### 627. Superior

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2026/nghe-an/so.md#L390); dạng xuất hiện: **superior**.
- Độ phủ theo tập dạng đã chọn: **11/106 tệp**; các dạng có mặt: superior, superiority, superiors.
```text
11\. It presents pre-industrial sleep patterns as morally superior to modern educational timetables.
```

### 628. Demonstrate

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2024/tp-ho-chi-minh/so.md#L176); dạng xuất hiện: **demonstrate**.
- Độ phủ theo tập dạng đã chọn: **35/106 tệp**; các dạng có mặt: demonstrate, demonstrated, demonstrates, demonstrating, demonstration, demonstrations.
```text
their development, the aim with these ambassador robots was to demonstrate the technological prowess of their makers, by
```

### 629. Detect

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2024/tp-ho-chi-minh/so.md#L245); dạng xuất hiện: **detect**.
- Độ phủ theo tập dạng đã chọn: **14/106 tệp**; các dạng có mặt: detect, detectable, detected, detection, detectors, detects.
```text
(D) However, scientists are able to detect the presence of black holes in space because of their effect on an observed area
```

### 630. Determine

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/nam-dinh/so.md#L342); dạng xuất hiện: **determine**.
- Độ phủ theo tập dạng đã chọn: **56/106 tệp**; các dạng có mặt: determination, determine, determined, determines, determining.
```text
is very difficult to determine the proper amount of treatment, since the levels of the chemical in herbs
```

### 631. Distinguish

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2022/ha-noi/chuyen-su-pham.md#L181); dạng xuất hiện: **distinguish**.
- Độ phủ theo tập dạng đã chọn: **25/106 tệp**; các dạng có mặt: distinction, distinctions, distinctive, distinctively, distinguish, distinguishable, distinguished, distinguishes, distinguishing.
```text
 less control over their attention, and were much less able to distinguish important information from trivia. The
```

### 632. Efficient

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/ha-noi/so.md#L375); dạng xuất hiện: **efficient**.
- Độ phủ theo tập dạng đã chọn: **47/106 tệp**; các dạng có mặt: efficiency, efficient, efficiently, inefficient, inefficiently.
```text
  The benefits are obvious. It’s quicker, cheaper and more efficient. The really dull components,
```

### 633. Eliminate

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2026/tay-ninh/so.md#L148); dạng xuất hiện: **eliminate**.
- Độ phủ theo tập dạng đã chọn: **23/106 tệp**; các dạng có mặt: eliminate, eliminated, eliminates, eliminating, elimination.
```text
19\. Stir microwave-heated food halfway through to eliminate     where bacteria may remain.
```

### 634. Enhance

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2024/tp-ho-chi-minh/so.md#L179); dạng xuất hiện: **enhance**.
- Độ phủ theo tập dạng đã chọn: **21/106 tệp**; các dạng có mặt: enhance, enhanced, enhancement, enhances, enhancing.
```text
…o perfect bipedal locomotion continues, as researchers strive to enhance balance, agility and energy
```

### 635. Ensure

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/tp-ho-chi-minh/so.md#L367); dạng xuất hiện: **ensure**.
- Độ phủ theo tập dạng đã chọn: **43/106 tệp**; các dạng có mặt: ensure, ensured, ensures, ensuring.
```text
8. If you don’t spend hours reviewing, you can’t ensure good results in the upcoming exam. (likely)
```

### 636. Establish

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2026/ha-tinh/so.md#L465); dạng xuất hiện: **establish**.
- Độ phủ theo tập dạng đã chọn: **42/106 tệp**; các dạng có mặt: establish, established, establishing, establishment.
```text
movement to establish relationships and maintain order. Leadership within a herd is not always based
```

### 637. Evaluate

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/ba-ria-vung-tau/so.md#L387); dạng xuất hiện: **evaluate**.
- Độ phủ theo tập dạng đã chọn: **17/106 tệp**; các dạng có mặt: evaluate, evaluated, evaluating, evaluation.
```text
*Some believe exams are one of the effective ways to evaluate students**’** performance.*
```

### 638. Exceed

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2023/binh-thuan/so.md#L565); dạng xuất hiện: **exceed**.
- Độ phủ theo tập dạng đã chọn: **30/106 tệp**; các dạng có mặt: exceed, exceeded, exceeding, exceeds, excess, excessive, excessively.
```text
with all the information clearly signposted and should not exceed two pages. Include your name, address
```

### 639. Expand

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/dong-nai/so.md#L81); dạng xuất hiện: **expand**.
- Độ phủ theo tập dạng đã chọn: **33/106 tệp**; các dạng có mặt: expand, expanded, expanding, expansion, expansions.
```text
| **A.** dissolve | **B.** strengthen | **C.** dilute | **D.** expand |
```

### 640. Exploit

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/tp-ho-chi-minh/so.md#L288); dạng xuất hiện: **exploit**.
- Độ phủ theo tập dạng đã chọn: **24/106 tệp**; các dạng có mặt: exploit, exploitation, exploited, exploiting, exploits.
```text
of consumer desires. Some companies exploit the addictive nature of blind boxes by creating ultra-rare figures
```

### 641. Facilitate

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2022/dak-lak/so.md#L218); dạng xuất hiện: **facilitate**.
- Độ phủ theo tập dạng đã chọn: **10/106 tệp**; các dạng có mặt: facilitate, facilitated, facilitates, facilitating, facilitator.
```text
…te              B. probe                C. strengthen         D. facilitate
```

### 642. Generate

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2024/ha-noi/chuyen-su-pham.md#L168); dạng xuất hiện: **generate**.
- Độ phủ theo tập dạng đã chọn: **60/106 tệp**; các dạng có mặt: generate, generated, generates, generating, generation, generations, generator, generators.
```text
high-pressure steam, which is used to turn turbines and so generate electricity. This heat is also used directly in
```

### 643. Implement

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/ha-noi/so.md#L411); dạng xuất hiện: **implement**.
- Độ phủ theo tập dạng đã chọn: **18/106 tệp**; các dạng có mặt: implement, implementation, implemented, implementing, implements.
```text
  By far the easiest form of online testing to implement is multiple choice. A student can take the
```

### 644. Imply

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/tp-ho-chi-minh/so.md#L204); dạng xuất hiện: **imply**.
- Độ phủ theo tập dạng đã chọn: **31/106 tệp**; các dạng có mặt: implications, implied, implies, imply, implying.
```text
2. What does the author imply about social isolation among obese children?
```

### 645. Infer

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/tien-giang/so.md#L114); dạng xuất hiện: **infer**.
- Độ phủ theo tập dạng đã chọn: **50/106 tệp**; các dạng có mặt: infer, inference, inferential, inferred.
```text
18. A. conquer           B. enter             C. infer             D. utter
```

### 646. Interpret

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2026/nghe-an/so.md#L155); dạng xuất hiện: **interpret**.
- Độ phủ theo tập dạng đã chọn: **22/106 tệp**; các dạng có mặt: interpret, interpretation, interpretations, interpreted, interpreter, interpreters, interpreting.
```text
…at do Matthew and Emma agree makes holiday research difficult to interpret?
```

### 647. Justify

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2022/tp-ho-chi-minh/ptnk.md#L998); dạng xuất hiện: **justify**.
- Độ phủ theo tập dạng đã chọn: **13/106 tệp**; các dạng có mặt: justifiably, justification, justifications, justified, justifies, justify.
```text
Can we really justify the idea that human lives matter more than nonhuman lives? WEIGHT Is it possible for…
```

### 648. Maintain

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/ha-noi/so.md#L319); dạng xuất hiện: **maintain**.
- Độ phủ theo tập dạng đã chọn: **53/106 tệp**; các dạng có mặt: maintain, maintained, maintaining, maintains, maintenance.
```text
us about dates, names and major events, but we maintain the richness of feeling that comes from
```

### 649. Obtain

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2024/ha-noi/chuyen-su-pham.md#L127); dạng xuất hiện: **obtain**.
- Độ phủ theo tập dạng đã chọn: **19/106 tệp**; các dạng có mặt: obtain, obtainable, obtained, obtaining, obtains.
```text
27. A defense attorney’s role is not only to obtain exculpation for his or her client, but also to reduce the risk of
```

### 650. Perceive

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/nghe-an/so.md#L340); dạng xuất hiện: **perceive**.
- Độ phủ theo tập dạng đã chọn: **36/106 tệp**; các dạng có mặt: perceive, perceived, perceptible, perception, perceptions, perceptive.
```text
…consumers are anything but discouraged from purchasing what they perceive to be much
```

### 651. Predict

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/tp-ho-chi-minh/so.md#L318); dạng xuất hiện: **predict**.
- Độ phủ theo tập dạng đã chọn: **34/106 tệp**; các dạng có mặt: predict, predictable, predicted, predicting, prediction, predictions, predicts, unpredictable.
```text
     5      noted that, while some analysts predict digital book sales will soon overpace those of printed books,
```

### 652. Prioritize

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/quang-ngai/so.md#L244); dạng xuất hiện: **prioritize**.
- Độ phủ theo tập dạng đã chọn: **25/106 tệp**; các dạng có mặt: priorities, prioritised, prioritize, prioritized, prioritizes, prioritizing, priority.
```text
  Green cities are urban areas that prioritize sustainability, environmental conservation, and the well-
```

### 653. Regulate

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/kon-tum/so.md#L103); dạng xuất hiện: **regulate**.
- Độ phủ theo tập dạng đã chọn: **28/106 tệp**; các dạng có mặt: regulate, regulated, regulates, regulating, regulation, regulations, regulatory.
```text
11. Sleep helps the body regulate its vital functions and also gives the __________ a chance to
```

### 654. Reinforce

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2023/nam-dinh/so.md#L182); dạng xuất hiện: **reinforce**.
- Độ phủ theo tập dạng đã chọn: **13/106 tệp**; các dạng có mặt: reinforce, reinforced, reinforcement, reinforces, reinforcing.
```text
…d day at work, for example. Past (5. ASSOCIATE) ____________ can reinforce bad eating habits
```

### 655. Require

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/tp-ho-chi-minh/so.md#L254); dạng xuất hiện: **require**.
- Độ phủ theo tập dạng đã chọn: **82/106 tệp**; các dạng có mặt: require, required, requirement, requirements, requires, requiring.
```text
…lement, rather than supplant, coal power stations. Coal stations require days to
```

### 656. Resolve

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2026/lao-cai/so.md#L457); dạng xuất hiện: **resolve**.
- Độ phủ theo tập dạng đã chọn: **16/106 tệp**; các dạng có mặt: resolute, resolution, resolutions, resolve, resolved, resolving.
```text
**9.** To resolve the issue of incomplete historical records, the French team employed a \_\_\_\_\_\_\…
```

### 657. Restrict

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2024/vinh-phuc/so.md#L703); dạng xuất hiện: **restrict**.
- Độ phủ theo tập dạng đã chọn: **24/106 tệp**; các dạng có mặt: restrict, restricted, restricting, restriction, restrictions, restrictive, restricts, unrestricted.
```text
the tutor has advised us to restrict participants to a maximum of 10 per session
```

### 658. Specify

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2023/dong-nai/so.md#L59); dạng xuất hiện: **specify**.
- Độ phủ theo tập dạng đã chọn: **48/106 tệp**; các dạng có mặt: specific, specifically, specifications, specified, specify.
```text
6.    A. inherit              B. specify             C. modernize          D. educate
```

### 659. Submit

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2024/ben-tre/so.md#L105); dạng xuất hiện: **submit**.
- Độ phủ theo tập dạng đã chọn: **14/106 tệp**; các dạng có mặt: submission, submit, submitted, submitting.
```text
8. __________ the regular written work, you will be required to submit a long essay.
```

### 660. Transform

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2024/ha-noi/chuyen-su-pham.md#L166); dạng xuất hiện: **transform**.
- Độ phủ theo tập dạng đã chọn: **29/106 tệp**; các dạng có mặt: transform, transformation, transformative, transformed, transforming, transforms.
```text
… expensive imported coal from Europe, has harnessed this heat to transform its power
```

### 661. Transmit

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/nghe-an/so.md#L497); dạng xuất hiện: **transmit**.
- Độ phủ theo tập dạng đã chọn: **16/106 tệp**; các dạng có mặt: transmissible, transmission, transmissions, transmit, transmitted, transmitter, transmitting.
```text
transmit other, less beneficial shared outcomes—like disease outbreaks. As fears about COVID-…
```

### 662. Verify

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2023/ha-noi/chuyen-su-pham.md#L734); dạng xuất hiện: **verify**.
- Độ phủ theo tập dạng đã chọn: **5/106 tệp**; các dạng có mặt: verifiable, verification, verified, verify.
```text
85\. The police have to verify the details of everyone taking part in the event today. → Everyone taking part in th…
```

### 663. Withdraw

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2026/nghe-an/chuyen-dai-hoc-vinh.md#L625); dạng xuất hiện: **withdraw**.
- Độ phủ theo tập dạng đã chọn: **6/106 tệp**; các dạng có mặt: withdraw, withdrawal, withdrawn.
```text
| **31.** belittle | **32. **activated | **33. **withdraw | **34.** anti-aging | **35. **dietician |
```

### 664. Accurate

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/ha-noi/so.md#L388); dạng xuất hiện: **accurate**.
- Độ phủ theo tập dạng đã chọn: **36/106 tệp**; các dạng có mặt: accuracy, accurate, accurately, inaccuracies, inaccuracy, inaccurate.
```text
from each paper, it’s hard to get an accurate feel of exactly what a student does and doesn’t know.
```

### 665. Adequate

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2026/da-nang/so.md#L153); dạng xuất hiện: **adequate**.
- Độ phủ theo tập dạng đã chọn: **16/106 tệp**; các dạng có mặt: adequate, adequately, inadequate.
```text
…propriately to complex distress signals, which possibly leads to adequate guidance during vulnerable moments.
```

### 666. Alternative

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2024/ha-noi/so.md#L360); dạng xuất hiện: **alternative**.
- Độ phủ theo tập dạng đã chọn: **42/106 tệp**; các dạng có mặt: alternate, alternated, alternating, alternative, alternatively, alternatives.
```text
 an Earthwatch project is a positive alternative to wildlife-watching expeditions, as we offer members
```

### 667. Apparent

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2026/dak-lak/so.md#L275); dạng xuất hiện: **apparent**.
- Độ phủ theo tập dạng đã chọn: **27/106 tệp**; các dạng có mặt: apparent, apparently.
```text
…cording to paragraph 3, why did Kramer use mirrors to change the apparent position of the Sun?
```

### 668. Appropriate

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2023/tp-ho-chi-minh/so.md#L298); dạng xuất hiện: **appropriate**.
- Độ phủ theo tập dạng đã chọn: **54/106 tệp**; các dạng có mặt: appropriate, appropriately, inappropriate, inappropriately.
```text
       7         Ideas about appropriate personal behaviour vary from country to country and  it seems to be no universal
```

### 669. Artificial

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/ha-noi/so.md#L807); dạng xuất hiện: **artificial**.
- Độ phủ theo tập dạng đã chọn: **32/106 tệp**; các dạng có mặt: artificial, artificially.
```text
The blog’s smart science is about artificial intelligence. Like the other day they did an article on
```

### 670. Beneficial

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2026/ninh-binh/so.md#L66); dạng xuất hiện: **beneficial**.
- Độ phủ theo tập dạng đã chọn: **72/106 tệp**; các dạng có mặt: beneficial, benefit, benefited, benefiting, benefits.
```text
- A practical, **(2)** \_\_\_\_\_\_\_\_\_\_, beneficial consumer product
```

### 671. Capable

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/ha-noi/so.md#L395); dạng xuất hiện: **capable**.
- Độ phủ theo tập dạng đã chọn: **34/106 tệp**; các dạng có mặt: capabilities, capability, capable, incapable.
```text
teaching only what technology is capable of assessing. “Rather, we have to look at how IT is used in
```

### 672. Cautious

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/ha-noi/so.md#L474); dạng xuất hiện: **cautious**.
- Độ phủ theo tập dạng đã chọn: **18/106 tệp**; các dạng có mặt: caution, cautions, cautious, cautiously.
```text
75. We decided to be cautious and stick to the original plan. (ERR)
```

### 673. Cognitive

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2022/ha-noi/chuyen-su-pham.md#L160); dạng xuất hiện: **cognitive**.
- Độ phủ theo tập dạng đã chọn: **14/106 tệp**; các dạng có mặt: cognition, cognitive.
```text
…ens of studies on how different media technologies influence our cognitive
```

### 674. Commercial

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2022/ha-noi/chuyen-su-pham.md#L321); dạng xuất hiện: **commercial**.
- Độ phủ theo tập dạng đã chọn: **26/106 tệp**; các dạng có mặt: commerce, commercial, commercialising, commercialization, commercially.
```text
 young. This is the age group that created Netscape, the first commercial web browser; Napster, the music-
```

### 675. Comparable

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2024/ha-noi/so.md#L289); dạng xuất hiện: **comparable**.
- Độ phủ theo tập dạng đã chọn: **49/106 tệp**; các dạng có mặt: comparable, compare, compared, compares, comparing, comparison.
```text
books, and the plundering of nature is comparable to the random discarding of whole volumes without
```

### 676. Competent

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2026/quang-tri/so.md#L378); dạng xuất hiện: **competent**.
- Độ phủ theo tập dạng đã chọn: **16/106 tệp**; các dạng có mặt: competence, competencies, competency, competent, incompetence, incompetent.
```text
doctors would typically conclude that Watson wasn’t competent. And the machine wouldn’t be able to
```

### 677. Complex

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2024/ha-noi/so.md#L198); dạng xuất hiện: **complex**.
- Độ phủ theo tập dạng đã chọn: **52/106 tệp**; các dạng có mặt: complex, complexes, complexity.
```text
as the implications of a large-scale project are both complex and far-reaching. Therefore, it is now widely
```

### 678. Concrete

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/dak-lak/so.md#L205); dạng xuất hiện: **concrete**.
- Độ phủ theo tập dạng đã chọn: **10/106 tệp**; các dạng có mặt: concrete.
```text
…ty they are facing is \_\_\_\_\_\_\_\_\_\_ their intentions into concrete action.
```

### 679. Conscious

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2022/ha-noi/chuyen-su-pham.md#L205); dạng xuất hiện: **conscious**.
- Độ phủ theo tập dạng đã chọn: **30/106 tệp**; các dạng có mặt: conscious, consciously, consciousness, unconscious, unconsciously.
```text
 and cognitive processes unavailable  to conscious  deliberation. We usually make  better decisions,  his
```

### 680. Contemporary

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/tp-ho-chi-minh/so.md#L232); dạng xuất hiện: **contemporary**.
- Độ phủ theo tập dạng đã chọn: **11/106 tệp**; các dạng có mặt: contemporaries, contemporary.
```text
…What is highlighted regarding a paradoxical relationship between contemporary culture and health?
```

### 681. Controversial

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2023/ha-noi/chuyen-su-pham.md#L656); dạng xuất hiện: **controversial**.
- Độ phủ theo tập dạng đã chọn: **14/106 tệp**; các dạng có mặt: controversial, controversy.
```text
…personal abuse against a well-known person, for example. Another controversial issue is that
```

### 682. Credible

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2024/ben-tre/so.md#L183); dạng xuất hiện: **credible**.
- Độ phủ theo tập dạng đã chọn: **29/106 tệp**; các dạng có mặt: credibility, credible, incredible, incredibly.
```text
  The most credible explanations center on functions inside the brain. It has been shown that the brain’…
```

### 683. Critical

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2022/ha-noi/chuyen-su-pham.md#L174); dạng xuất hiện: **critical**.
- Độ phủ theo tập dạng đã chọn: **59/106 tệp**; các dạng có mặt: critic, critical, critically, criticise, criticised, criticises, criticism, criticisms, criticize, criticized, criticizing, critics.
```text
 critical thinking and imagination’. We’re becoming, in a word, shallower.
```

### 684. Deliberate

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2023/ha-noi/chuyen-su-pham.md#L654); dạng xuất hiện: **deliberate**.
- Độ phủ theo tập dạng đã chọn: **20/106 tệp**; các dạng có mặt: deliberate, deliberately, deliberation.
```text
… from attacks carried out by internet vandals intending to cause deliberate (65)
```

### 685. Diverse

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2023/ha-noi/so.md#L432); dạng xuất hiện: **diverse**.
- Độ phủ theo tập dạng đã chọn: **33/106 tệp**; các dạng có mặt: biodiversity, diverse, diversified, diversity.
```text
82\. As a pop singer, Kay has recently become involved in more diverse styles of music. BRANCHED
```

### 686. Domestic

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/thai-binh/so.md#L319); dạng xuất hiện: **domestic**.
- Độ phủ theo tập dạng đã chọn: **23/106 tệp**; các dạng có mặt: domestic, domesticated, domestication.
```text
include domestic dust mites, animals with fur, cockroaches, pollens, and molds. [III] By avoiding the…
```

### 687. Eligible

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/binh-duong/so.md#L273); dạng xuất hiện: **eligible**.
- Độ phủ theo tập dạng đã chọn: **3/106 tệp**; các dạng có mặt: eligibility, eligible.
```text
34\. They may be eligible for tax incentives and rebates.
```

### 688. Ethical

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2024/ha-noi/so.md#L315); dạng xuất hiện: **ethical**.
- Độ phủ theo tập dạng đã chọn: **15/106 tệp**; các dạng có mặt: ethical, ethically, ethics, unethical.
```text
In practice, this means that many tour operators, guided by ethical policies, now use the services of local
```

### 689. Explicit

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/kon-tum/so.md#L217); dạng xuất hiện: **explicit**.
- Độ phủ theo tập dạng đã chọn: **7/106 tệp**; các dạng có mặt: explicit, explicitly.
```text
…cussions of cultural diversity, attention has focused on visible explicit aspects of culture,
```

### 690. Extensive

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2023/ha-noi/so.md#L350); dạng xuất hiện: **extensive**.
- Độ phủ theo tập dạng đã chọn: **67/106 tệp**; các dạng có mặt: extend, extended, extending, extends, extension, extensive, extensively, extent.
```text
64\. We have become more willing to confide in an extensive number of people.
```

### 691. External

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2024/ha-noi/chuyen-su-pham.md#L385); dạng xuất hiện: **external**.
- Độ phủ theo tập dạng đã chọn: **9/106 tệp**; các dạng có mặt: external, externalize.
```text
…ientists use a material called PEDOT to cover the bricks with an external layer of
```

### 692. Flexible

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2026/nghe-an/chuyen-dai-hoc-vinh.md#L333); dạng xuất hiện: **flexible**.
- Độ phủ theo tập dạng đã chọn: **18/106 tệp**; các dạng có mặt: flexibility, flexible, flexibly, inflexible.
```text
… of self-employment enables people to choose their projects, set flexible schedules, and work independently.**
```

### 693. Fundamental

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2023/tp-ho-chi-minh/so.md#L132); dạng xuất hiện: **fundamental**.
- Độ phủ theo tập dạng đã chọn: **19/106 tệp**; các dạng có mặt: fundamental, fundamentally.
```text
   The environment is the fundamental source of all possible existence on planet Earth. However, over the recent years, th…
```

### 694. Genuine

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/ha-noi/so.md#L881); dạng xuất hiện: **genuine**.
- Độ phủ theo tập dạng đã chọn: **14/106 tệp**; các dạng có mặt: genuine, genuinely.
```text
the ice with his fishing rod, as if that was somehow more genuine or worthwhile. I have no time for
```

### 695. Gradual

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2023/tp-ho-chi-minh/so.md#L135); dạng xuất hiện: **gradual**.
- Độ phủ theo tập dạng đã chọn: **30/106 tệp**; các dạng có mặt: gradual, gradually.
```text
landfills are some of the major factors that cause the gradual deterioration of the environment. With the disastrous pace of climate
```

### 696. Hostile

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2023/vinh-phuc/so.md#L394); dạng xuất hiện: **hostile**.
- Độ phủ theo tập dạng đã chọn: **5/106 tệp**; các dạng có mặt: hostile, hostility.
```text
…e fact that the island remained intact in what  is often quite a hostile sea
```

### 697. Immune

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2022/tp-ho-chi-minh/ptnk.md#L1022); dạng xuất hiện: **IMMUNE**.
- Độ phủ theo tập dạng đã chọn: **12/106 tệp**; các dạng có mặt: immune, immunisation, immunity.
```text
We often refused to accept new ideas as we grew old. IMMUNE We often
```

### 698. Independent

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2024/ha-noi/chuyen-su-pham.md#L175); dạng xuất hiện: **independent**.
- Độ phủ theo tập dạng đã chọn: **76/106 tệp**; các dạng có mặt: depend, depended, dependence, dependent, depending, depends, independence, independent, independently.
```text
and power plants. The ultimate goal of the city is to be independent of fossil fuels by 2050. It is also believed that
```

### 699. Initial

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/tp-ho-chi-minh/so.md#L272); dạng xuất hiện: **initial**.
- Độ phủ theo tập dạng đã chọn: **34/106 tệp**; các dạng có mặt: initial, initially, initiate, initiated.
```text
(C) The initial investment - dam construction, turbine installation, and power line networks - is su…
```

### 700. Intensive

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2022/ha-noi/chuyen-su-pham.md#L182); dạng xuất hiện: **intensive**.
- Độ phủ theo tập dạng đã chọn: **41/106 tệp**; các dạng có mặt: intense, intensely, intensified, intensifies, intensify, intensifying, intensity, intensive, intensively.
```text
 researchers were surprised by the results. They expected the intensive multitaskers to have gained some mental
```

### 701. Internal

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2022/ha-noi/chuyen-su-pham.md#L330); dạng xuất hiện: **internal**.
- Độ phủ theo tập dạng đã chọn: **13/106 tệp**; các dạng có mặt: internal, internally.
```text
 the abilities to navigate internal bureaucracies and please your superiors the most valued skills. Today’s
```

### 702. Applaud

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/hai-phong/so.md#L407); dạng xuất hiện: **applaud**.
- Độ phủ theo tập dạng đã chọn: **8/106 tệp**; các dạng có mặt: applaud, applauded, applause.
```text
    A. commend               B. applaud                C. compliment            D. punish
```

### 703. Mutual

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/bac-giang/so.md#L172); dạng xuất hiện: **mutual**.
- Độ phủ theo tập dạng đã chọn: **11/106 tệp**; các dạng có mặt: mutual, mutually.
```text
boundaries and tap into a mutual understanding of the world, irrespective of where we grew up.
```

### 704. Objective

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/ha-noi/so.md#L813); dạng xuất hiện: **objective**.
- Độ phủ theo tập dạng đã chọn: **14/106 tệp**; các dạng có mặt: objective, objectives, objectivity.
```text
the writers are objective in their attitude, presenting both sides, which is rare in a world nowadays
```

### 705. Permanent

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2026/nghe-an/chuyen-dai-hoc-vinh.md#L198); dạng xuất hiện: **permanent**.
- Độ phủ theo tập dạng đã chọn: **28/106 tệp**; các dạng có mặt: permanence, permanent, permanently.
```text
…e unwavering patriotism of the Vietnamese people now shines as a permanent beacon of love for our homeland.
```

### 706. Potential

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2024/ha-noi/chuyen-su-pham.md#L392); dạng xuất hiện: **Potential**.
- Độ phủ theo tập dạng đã chọn: **44/106 tệp**; các dạng có mặt: potential, potentially.
```text
                   Potential applications for these energy-stored bricks are endless and developers say they
```

### 707. Precise

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/ha-noi/so.md#L380); dạng xuất hiện: **precise**.
- Độ phủ theo tập dạng đã chọn: **23/106 tệp**; các dạng có mặt: precise, precisely, precision.
```text
   Students can also benefit. “Markers can now give much more precise feedback”, says Kathleen
```

### 708. Profound

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2022/long-an/so.md#L128); dạng xuất hiện: **profound**.
- Độ phủ theo tập dạng đã chọn: **20/106 tệp**; các dạng có mặt: profound, profoundly.
```text
The Glen Canyon (10), which is 24 kilometers upstream, has had a profound impact on the Colorado river.
```

### 709. Humiliate

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/nghe-an/so.md#L1380); dạng xuất hiện: **humiliate**.
- Độ phủ theo tập dạng đã chọn: **2/106 tệp**; các dạng có mặt: humiliate, humiliation.
```text
Whenever I made a mistake, she’d do her best to humiliate me in front of all the other girls. The result
```

### 710. Relevant

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/ha-noi/so.md#L532); dạng xuất hiện: **relevant**.
- Độ phủ theo tập dạng đã chọn: **55/106 tệp**; các dạng có mặt: irrelevance, irrelevant, relevance, relevant.
```text
Give reasons for your answer and include any relevant examples from your knowledge or experience.
```

### 711. Reliable

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2023/ha-noi/chuyen-su-pham.md#L654); dạng xuất hiện: **reliable**.
- Độ phủ theo tập dạng đã chọn: **54/106 tệp**; các dạng có mặt: reliability, reliable, reliably, relied, relies, rely, relying, unreliable.
```text
…ere opinion. And even sites which were once OBJECT thought to be reliable now suffer from attacks carried out by internet vandals intending to cause deliberat…
```

### 712. Remote

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2023/tp-ho-chi-minh/ptnk.md#L186); dạng xuất hiện: **remote**.
- Độ phủ theo tập dạng đã chọn: **22/106 tệp**; các dạng có mặt: remote, remotely, remoteness.
```text
A poignant documentary tells the paradoxical story of a vast, remote cave in Vietnam that looks likely to turn into a major tourist attraction
```

### 713. Valid

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2023/dak-lak/so.md#L918); dạng xuất hiện: **valid**.
- Độ phủ theo tập dạng đã chọn: **9/106 tệp**; các dạng có mặt: invalidated, valid, validated, validation, validity.
```text
solution. The quick answer is that while the question is valid from a grammatical viewpoint,
```

### 714. Accountability

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2026/an-giang/so.md#L331); dạng xuất hiện: **accountability**.
- Độ phủ theo tập dạng đã chọn: **7/106 tệp**; các dạng có mặt: accountability, accountable.
```text
…ld never guess it. He admitted to feeling “a heightened sense of accountability” when portraying a living person in his last film, despite having no direct interact…
```

### 715. Achievement

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2024/tp-ho-chi-minh/so.md#L247); dạng xuất hiện: **achievement**.
- Độ phủ theo tập dạng đã chọn: **59/106 tệp**; các dạng có mặt: achievable, achieve, achieved, achievement, achievements, achieves, achieving.
```text
…ed by the Event Horizon Telescope in 2019, marking a significant achievement
```

### 716. Admission

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/phu-tho/so.md#L425); dạng xuất hiện: **admission**.
- Độ phủ theo tập dạng đã chọn: **36/106 tệp**; các dạng có mặt: admissible, admission, admit, admits, admitted, admitting.
```text
…is to inquire as to the status of Mike Marston’s application for admission
```

### 717. Agriculture

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/thai-nguyen/so.md#L56); dạng xuất hiện: **agriculture**.
- Độ phủ theo tập dạng đã chọn: **23/106 tệp**; các dạng có mặt: agricultural, agriculture.
```text
– the Nile provided food and resources, land for agriculture, a means of travel, and was critical in the
```

### 718. Ambition

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2022/ha-noi/chuyen-su-pham.md#L332); dạng xuất hiện: **ambition**.
- Độ phủ theo tập dạng đã chọn: **19/106 tệp**; các dạng có mặt: ambition, ambitions, ambitious.
```text
 from job to job is now a sign of ambition and initiative. Today’s young people are valued as workers for different
```

### 719. Analysis

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2026/nghe-an/chuyen-dai-hoc-vinh.md#L438); dạng xuất hiện: **analysis**.
- Độ phủ theo tập dạng đã chọn: **32/106 tệp**; các dạng có mặt: analyse, analysed, analyses, analysing, analysis, analysts, analytical, analyze, analyzed.
```text
**17.** Lynch’s analysis of past oil predictions revealed bias as well as \_\_\_\_\_\_\_\_\_\_, suggesting th…
```

### 720. Anxiety

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2024/ha-noi/so.md#L370); dạng xuất hiện: **anxiety**.
- Độ phủ theo tập dạng đã chọn: **35/106 tệp**; các dạng có mặt: anxieties, anxiety, anxious, anxiously.
```text
A great deal of anxiety is being expressed over children not getting enough sleep. Teachers and parents
```

### 721. Apology

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2022/an-giang/so.md#L188); dạng xuất hiện: **apology**.
- Độ phủ theo tập dạng đã chọn: **17/106 tệp**; các dạng có mặt: apologetic, apologize, apologized, apologizing, apology.
```text
… feel (3) _______ and try to come up with some sort of excuse or apology.
```

### 722. Awareness

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2024/ha-noi/so.md#L353); dạng xuất hiện: **awareness**.
- Độ phủ theo tập dạng đã chọn: **64/106 tệp**; các dạng có mặt: aware, awareness, unaware.
```text
 documentaries. Greater awareness of the planet has led to an increased demand for wildlife tours or
```

### 723. Capacity

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/ha-noi/so.md#L174); dạng xuất hiện: **capacity**.
- Độ phủ theo tập dạng đã chọn: **21/106 tệp**; các dạng có mặt: capacities, capacity, incapacitated, incapacities.
```text
found that many 16- to 20-year-olds had less aerobic capacity and muscle strength than healthy 60-
```

### 724. Circumstance

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2022/long-an/so.md#L356); dạng xuất hiện: **circumstance**.
- Độ phủ theo tập dạng đã chọn: **17/106 tệp**; các dạng có mặt: circumstance, circumstances.
```text
C. circumstance
```

### 725. Commitment

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2024/ha-noi/chuyen-su-pham.md#L188); dạng xuất hiện: **commitment**.
- Độ phủ theo tập dạng đã chọn: **36/106 tệp**; các dạng có mặt: commit, commitment, commitments, commits, committed, committing.
```text
…carbon emissions as the country had to revert to fossil fuels. A commitment has been made by Fukushima’s
```

### 726. Competition

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2023/ha-noi/so.md#L278); dạng xuất hiện: **competition**.
- Độ phủ theo tập dạng đã chọn: **57/106 tệp**; các dạng có mặt: compete, competed, competing, competition, competitions, competitive, competitor, competitors.
```text
…m the judges, the highest possible marks anyone could get in the competition.
```

### 727. Concentration

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2024/ha-noi/chuyen-su-pham.md#L159); dạng xuất hiện: **concentration**.
- Độ phủ theo tập dạng đã chọn: **37/106 tệp**; các dạng có mặt: concentrate, concentrated, concentrates, concentrating, concentration.
```text
concentration of gold and platinum eco-design rated buildings in the US are to be found there, inc…
```

### 728. Consequence

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2024/ben-tre/so.md#L202); dạng xuất hiện: **consequence**.
- Độ phủ theo tập dạng đã chọn: **53/106 tệp**; các dạng có mặt: consequence, consequences, consequent, consequential, consequently.
```text
  A consequence of right-hand dominance is that most common consumer products are geared to right-
```

### 729. Conservation

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2024/ha-noi/so.md#L317); dạng xuất hiện: **conservation**.
- Độ phủ theo tập dạng đã chọn: **29/106 tệp**; các dạng có mặt: conservation, conservationist, conservationists, conserve, conserved, conserves, conserving.
```text
communities, train local guides and have close ties to conservation projects. Tour operator Rekero, for
```

### 730. Consumption

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2024/ha-noi/chuyen-su-pham.md#L176); dạng xuất hiện: **consumption**.
- Độ phủ theo tập dạng đã chọn: **54/106 tệp**; các dạng có mặt: consume, consumed, consumer, consumers, consumes, consuming, consumption.
```text
the city can reduce its energy consumption by focusing on improving building standards and energy efficiency.
```

### 731. Contribution

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2024/ha-noi/so.md#L303); dạng xuất hiện: **contribution**.
- Độ phủ theo tập dạng đã chọn: **48/106 tệp**; các dạng có mặt: contribute, contributed, contributes, contributing, contribution, contributions, contributor, contributors, contributory.
```text
Matthews recognises the contribution that television has made to our knowledge of nature, but he says
```

### 732. Convenience

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/tp-ho-chi-minh/so.md#L193); dạng xuất hiện: **convenience**.
- Độ phủ theo tập dạng đã chọn: **26/106 tệp**; các dạng có mặt: convenience, conveniences, convenient, conveniently, inconvenience, inconveniences, inconvenient.
```text
convenience foods in the hope of sparing more time for work. This reflects a culture that promot…
```

### 733. Cooperation

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/ha-nam/so.md#L415); dạng xuất hiện: **Cooperation**.
- Độ phủ theo tập dạng đã chọn: **13/106 tệp**; các dạng có mặt: co-operate, co-operation, cooperate, cooperated, cooperating, cooperation, cooperative.
```text
…g where problems can be discussed and resolved by majority vote. Cooperation is the key,
```

### 734. Curriculum

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/tp-ho-chi-minh/so.md#L176); dạng xuất hiện: **curriculum**.
- Độ phủ theo tập dạng đã chọn: **17/106 tệp**; các dạng có mặt: curricula, curriculum, extra-curricular, extracurricular.
```text
…ponsibility for marginalizing physical education due to national curriculum
```

### 735. Deforestation

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2023/tp-ho-chi-minh/so.md#L134); dạng xuất hiện: **deforestation**.
- Độ phủ theo tập dạng đã chọn: **12/106 tệp**; các dạng có mặt: deforestation, deforested, reforest, reforestation, reforesting.
```text
… water and land, mining, industrialisation, modern urbanization, deforestation, release of chemical (3) _______ and
```

### 736. Deficiency

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/bac-giang/so.md#L265); dạng xuất hiện: **deficiency**.
- Độ phủ theo tập dạng đã chọn: **5/106 tệp**; các dạng có mặt: deficiency, deficient.
```text
…ncer. Too little sunlight, on the other hand, leads to vitamin-D deficiency and rickets. The
```

### 737. Demand

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2022/ha-noi/so.md#L115); dạng xuất hiện: **demand**.
- Độ phủ theo tập dạng đã chọn: **53/106 tệp**; các dạng có mặt: demand, demanded, demanding, demands.
```text
…are interviewing job applicants, one quality that they generally demand  is
```

### 738. Discipline

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/ha-noi/so.md#L178); dạng xuất hiện: **discipline**.
- Độ phủ theo tập dạng đã chọn: **15/106 tệp**; các dạng có mặt: discipline, disciplined, disciplines.
```text
particular discipline. It’s all very well talking about the benefits of exercising but when you’re faced
```

### 739. Disposal

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2024/tp-ho-chi-minh/so.md#L284); dạng xuất hiện: **disposal**.
- Độ phủ theo tập dạng đã chọn: **20/106 tệp**; các dạng có mặt: disposable, disposal, dispose, disposed, disposing.
```text
       2       we rely on for food. However, improperly disposal of plastic has created the Great Pacific Garbage Patch, a
```

### 740. Distribution

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2023/ha-noi/so.md#L76); dạng xuất hiện: **distribution**.
- Độ phủ theo tập dạng đã chọn: **14/106 tệp**; các dạng có mặt: distribute, distributed, distributes, distributing, distribution, distributor.
```text
A. food production B. transport of food to landfill sites C. distribution of food product
```

### 741. Economy

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2023/tp-ho-chi-minh/ptnk.md#L204); dạng xuất hiện: **economy**.
- Độ phủ theo tập dạng đã chọn: **55/106 tệp**; các dạng có mặt: economic, economical, economically, economics, economies, economist, economists, economy.
```text
Certainly. It is hard to imagine a rapidly growing economy writing off its most potentially lucrative wonder so a few wealthy tourists can enjo…
```

### 742. Emission

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/ha-noi/so.md#L196); dạng xuất hiện: **emission**.
- Độ phủ theo tập dạng đã chọn: **22/106 tệp**; các dạng có mặt: emission, emissions, emit, emitted.
```text
emission in New York can affect a diminishing rainforest in Brazil. The truth is, every singl…
```

### 743. Employment

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2022/quang-ninh/so.md#L47); dạng xuất hiện: **employment**.
- Độ phủ theo tập dạng đã chọn: **62/106 tệp**; các dạng có mặt: employ, employed, employee, employees, employer, employers, employing, employment, employs, unemployed, unemployment.
```text
Part 1: You will hear a woman who works at an employment agency talking to a man about jobs he can apply
```

### 744. Encounter

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2023/tp-ho-chi-minh/ptnk.md#L298); dạng xuất hiện: **encounter**.
- Độ phủ theo tập dạng đã chọn: **21/106 tệp**; các dạng có mặt: encounter, encountered, encountering, encounters.
```text
…'s objection was only the first of many hardships I was bound to encounter.
```

### 745. Enthusiasm

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2022/ha-noi/chuyen-su-pham.md#L154); dạng xuất hiện: **enthusiasm**.
- Độ phủ theo tập dạng đã chọn: **24/106 tệp**; các dạng có mặt: enthusiasm, enthusiast, enthusiastic, enthusiasts.
```text
…ownpours had drenched Hanoi all day, but that did not dampen the enthusiasm of red-clad spectators.
```

### 746. Equality

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2026/hue/chuyen-khoa-hoc-hue.md#L156); dạng xuất hiện: **equality**.
- Độ phủ theo tập dạng đã chọn: **33/106 tệp**; các dạng có mặt: equal, equaled, equality, equally, equals, inequalities, inequality, unequal.
```text
…\_\_\_\_ the principle of respect for independence, sovereignty, equality and mutual benefit.
```

### 747. Evidence

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2026/tp-ho-chi-minh/ptnk.md#L118); dạng xuất hiện: **evidence**.
- Độ phủ theo tập dạng đã chọn: **57/106 tệp**; các dạng có mặt: evidence, evidenced, evident.
```text
**14. **For basing their argument on \_\_\_\_\_\_\_\_\_\_ evidence rather than verified documentation, the plaintiff’s civil lawsuit was dismissed.
```

### 748. Exhibition

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/ha-noi/so.md#L293); dạng xuất hiện: **exhibition**.
- Độ phủ theo tập dạng đã chọn: **30/106 tệp**; các dạng có mặt: exhibit, exhibited, exhibiting, exhibition, exhibitions, exhibits.
```text
Revolution, but, due to its overwhelming success, the exhibition was later relocated to a park in south
```

### 749. Expenditure

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/binh-duong/so.md#L235); dạng xuất hiện: **expenditures**.
- Độ phủ theo tập dạng đã chọn: **57/106 tệp**; các dạng có mặt: expend, expenditures, expense, expenses, expensive, inexpensive.
```text
19\. The building may require greater operational expenditures.
```

### 750. Expertise

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/binh-phuoc/so.md#L119); dạng xuất hiện: **expertise**.
- Độ phủ theo tập dạng đã chọn: **57/106 tệp**; các dạng có mặt: expert, expertise, experts.
```text
**12.** Parents interested in coaching must already possess expertise in the specific sports they wish to coach.
```

### 751. Exposure

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/binh-duong/so.md#L114); dạng xuất hiện: **exposure**.
- Độ phủ theo tập dạng đã chọn: **39/106 tệp**; các dạng có mặt: expose, exposed, exposes, exposing, exposure, exposures.
```text
- Our **(19)**     are affected by light exposure, too. The sleep hormone, melatonin, is naturally produced in darkness, but **(20)** …
```

### 752. Extinction

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/ha-nam/so.md#L307); dạng xuất hiện: **extinction**.
- Độ phủ theo tập dạng đã chọn: **18/106 tệp**; các dạng có mặt: extinct, extinction, extinctions.
```text
for nutrients, shelter, and other benefits. The extinction of one species can set off a chain reaction that
```

### 753. Failure

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2022/ha-noi/chuyen-su-pham.md#L267); dạng xuất hiện: **failure**.
- Độ phủ theo tập dạng đã chọn: **69/106 tệp**; các dạng có mặt: fail, failed, failing, failings, fails, failure, failures.
```text
… effect of being willing to take risks. Teens are less afraid of failure, and one of the biggest
```

### 754. Increasingly

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2026/quang-tri/so.md#L802); dạng xuất hiện: **increasingly**.
- Độ phủ theo tập dạng đã chọn: **86/106 tệp**; các dạng có mặt: increase, increased, increases, increasing, increasingly.
```text
**Question 10:** Fast food is becoming increasingly popular among teenagers.
```

### 755. Fatigue

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/binh-duong/so.md#L112); dạng xuất hiện: **fatigue**.
- Độ phủ theo tập dạng đã chọn: **6/106 tệp**; các dạng có mặt: fatigue, fatigued.
```text
…truggle with poor attention rates, **(18)**    **,** and daytime fatigue.
```

### 756. Fluency

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2023/soc-trang/so.md#L154); dạng xuất hiện: **fluency**.
- Độ phủ theo tập dạng đã chọn: **8/106 tệp**; các dạng có mặt: fluency, fluent, fluently.
```text
succeed beyond school, digital literacy and tech and systems fluency can give them a big boost. Practicing
```

### 757. Foundation

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2024/vinh-phuc/so.md#L255); dạng xuất hiện: **foundation**.
- Độ phủ theo tập dạng đã chọn: **27/106 tệp**; các dạng có mặt: foundation, foundations, founded, founder, founders, founding.
```text
…l Navy. Because of his experience aboard the Beagle, he laid the foundation for his Theory of Evolution
```

### 758. Funding

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2026/tp-ho-chi-minh/ptnk.md#L259); dạng xuất hiện: **funding**.
- Độ phủ theo tập dạng đã chọn: **30/106 tệp**; các dạng có mặt: fund, funded, funding, funds.
```text
**39. **Our dean announced extra funding for the faculty, only \_\_\_\_\_\_\_\_\_\_ it withdrawn two weeks later.
```

### 759. Guidance

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/binh-phuoc/so.md#L125); dạng xuất hiện: **guidance**.
- Độ phủ theo tập dạng đã chọn: **40/106 tệp**; các dạng có mặt: guidance, guide, guided, guides, guiding.
```text
…en to choose their teams while providing parents with additional guidance.
```

### 760. Habitat

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2024/ha-noi/chuyen-su-pham.md#L323); dạng xuất hiện: **habitat**.
- Độ phủ theo tập dạng đã chọn: **28/106 tệp**; các dạng có mặt: habitat, habitats.
```text
…ir own affairs. No other large animal has had so wide a range of habitat, from mountain forests
```

### 761. Heritage

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/ha-noi/so.md#L273); dạng xuất hiện: **heritage**.
- Độ phủ theo tập dạng đã chọn: **9/106 tệp**; các dạng có mặt: heritage.
```text
…es than they are about hearing about the past, but for me, local heritage has always been something
```

### 762. Identity

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2026/tp-ho-chi-minh/ptnk.md#L248); dạng xuất hiện: **identity**.
- Độ phủ theo tập dạng đã chọn: **63/106 tệp**; các dạng có mặt: identification, identified, identifies, identify, identifying, identities, identity.
```text
…res vocal precision that is \_\_\_\_\_\_\_\_\_\_ to the region’s identity.
```

### 763. Impact

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2023/tp-ho-chi-minh/ptnk.md#L146); dạng xuất hiện: **impact**.
- Độ phủ theo tập dạng đã chọn: **53/106 tệp**; các dạng có mặt: impact, impacted, impacting, impacts.
```text
6\. What impact could an apprenticeship program combining education and work have on the
```

### 764. Infrastructure

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2024/ha-noi/chuyen-su-pham.md#L180); dạng xuất hiện: **infrastructure**.
- Độ phủ theo tập dạng đã chọn: **6/106 tệp**; các dạng có mặt: infrastructure.
```text
infrastructure to encourage even more bicycle use in one of the world’s most bicycle-friendly citie…
```

### 765. Innovation

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2023/hai-phong/so.md#L494); dạng xuất hiện: **innovation**.
- Độ phủ theo tập dạng đã chọn: **28/106 tệp**; các dạng có mặt: innovate, innovating, innovation, innovations, innovative.
```text
and innovation are critical in a rapidly changing and highly competitive marketplace.
```

### 766. Insight

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/ha-noi/so.md#L821); dạng xuất hiện: **insight**.
- Độ phủ theo tập dạng đã chọn: **20/106 tệp**; các dạng có mặt: insight, insightful, insights.
```text
download and print them off. They give you a real insight into the challenges designers are facing,
```

### 767. Insurance

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2023/bac-ninh/so.md#L101); dạng xuất hiện: **Insurance**.
- Độ phủ theo tập dạng đã chọn: **17/106 tệp**; các dạng có mặt: insurance, insure.
```text
2. Julie is working as a manager in Cawley Life Insurance Company.
```

### 768. Interaction

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/quang-ngai/so.md#L253); dạng xuất hiện: **interaction**.
- Độ phủ theo tập dạng đã chọn: **43/106 tệp**; các dạng có mặt: interact, interacted, interacting, interaction, interactions, interactive, interacts.
```text
promote walkability and community interaction. Green building practices are also emphasized, with
```

### 769. Investment

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2026/tp-ho-chi-minh/ptnk.md#L233); dạng xuất hiện: **investment**.
- Độ phủ theo tập dạng đã chọn: **31/106 tệp**; các dạng có mặt: invest, invested, investing, investment, investments, investor, investors.
```text
…often an economic \_\_\_\_\_\_\_\_\_\_ to encourage spending and investment.
```

### 770. Isolation

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/tp-ho-chi-minh/so.md#L204); dạng xuất hiện: **isolation**.
- Độ phủ theo tập dạng đã chọn: **17/106 tệp**; các dạng có mặt: isolated, isolating, isolation.
```text
2. What does the author imply about social isolation among obese children?
```

### 771. Literacy

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/thai-binh/so.md#L412); dạng xuất hiện: **literacy**.
- Độ phủ theo tập dạng đã chọn: **7/106 tệp**; các dạng có mặt: illiterate, literacy, literate.
```text
management of complex variables, communication, literacy and problem-solving, on top of the necessary computer
```

### 772. Principle

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2026/bac-ninh/so.md#L831); dạng xuất hiện: **principle**.
- Độ phủ theo tập dạng đã chọn: **22/106 tệp**; các dạng có mặt: principle, principled, principles.
```text
**Dr. Lafford: **Well, the basic principle behind forensic science is that every contact leaves a trace. Wherever we go, whatev…
```

### 773. Migration

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/ha-noi/so.md#L209); dạng xuất hiện: **migration**.
- Độ phủ theo tập dạng đã chọn: **13/106 tệp**; các dạng có mặt: migrate, migrated, migrating, migration, migratory.
```text
Part 2. Read this passage from an American magazine about the migration habits of the Monarch
```

### 774. Motivation

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/nghe-an/so.md#L291); dạng xuất hiện: **motivation**.
- Độ phủ theo tập dạng đã chọn: **37/106 tệp**; các dạng có mặt: motivate, motivated, motivates, motivating, motivation, motivational, motivations.
```text
        1        Cash rewards is a common form of motivation used by parents with high expectations
```

### 775. Nutrition

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2022/dong-thap/so.md#L262); dạng xuất hiện: **nutrition**.
- Độ phủ theo tập dạng đã chọn: **26/106 tệp**; các dạng có mặt: nutrient, nutrients, nutrition, nutritional, nutritious.
```text
…nd other (2) agan2 now offer ORGANIZE information about diet and nutrition in the hope that it will
```

### 776. Obstacle

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2023/tp-ho-chi-minh/so.md#L200); dạng xuất hiện: **obstacle**.
- Độ phủ theo tập dạng đã chọn: **12/106 tệp**; các dạng có mặt: obstacle, obstacles.
```text
2. Innocent’s major obstacle to marketing their smoothies was _______.
```

### 777. Opportunity

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/ha-noi/so.md#L298); dạng xuất hiện: **opportunity**.
- Độ phủ theo tập dạng đã chọn: **53/106 tệp**; các dạng có mặt: opportunities, opportunity.
```text
wonderful opportunity to explore ideas of the past and future, as well as to experience the wonders
```

### 778. Participant

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/vinh-phuc/so.md#L343); dạng xuất hiện: **participant**.
- Độ phủ theo tập dạng đã chọn: **37/106 tệp**; các dạng có mặt: participant, participants, participate, participated, participates, participating, participation, participatory.
```text
  A variant on the observation technique, participant observation requires that the anthropologist not
```

### 779. Perspective

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2022/ha-noi/chuyen-su-pham.md#L196); dạng xuất hiện: **perspective**.
- Độ phủ theo tập dạng đã chọn: **18/106 tệp**; các dạng có mặt: perspective, perspectives.
```text
 a fresh perspective and a burst of creativity. Research by Dutch psychologist Ap Dijksterhuis indicates …
```

### 780. Poverty

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/da-nang/so.md#L108); dạng xuất hiện: **poverty**.
- Độ phủ theo tập dạng đã chọn: **58/106 tệp**; các dạng có mặt: impoverish, impoverished, impoverishing, poor, poorer, poorest, poorly, poverty.
```text
… you should \_\_\_\_\_\_\_\_\_\_ a thought for those who live in poverty.
```

### 781. Prejudice

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/thai-nguyen/so.md#L114); dạng xuất hiện: **prejudice**.
- Độ phủ theo tập dạng đã chọn: **6/106 tệp**; các dạng có mặt: prejudice, prejudiced.
```text
10. A. prejudice          B. prejudice          C. permanence       D. subsequent
```

### 782. Privacy

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2023/tp-ho-chi-minh/so.md#L297); dạng xuất hiện: **privacy**.
- Độ phủ theo tập dạng đã chọn: **43/106 tệp**; các dạng có mặt: privacy, private.
```text
       6       own achievements and who respects the privacy of others, is much more likely to win approval and respect.
```

### 783. Procedure

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2026/nghe-an/so.md#L204); dạng xuất hiện: **procedure**.
- Độ phủ theo tập dạng đã chọn: **21/106 tệp**; các dạng có mặt: procedure, procedures.
```text
…s that all medical equipment      thoroughly after each surgical procedure.
```

### 784. Productivity

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2026/nghe-an/chuyen-dai-hoc-vinh.md#L206); dạng xuất hiện: **productivity**.
- Độ phủ theo tập dạng đã chọn: **98/106 tệp**; các dạng có mặt: produce, produced, produces, producing, product, production, productions, productive, productively, productivity, products, unproductive.
```text
…the new management team’s efforts to streamline the company, the productivity levels in the two departments remain \_\_\_\_\_\_\_\_\_\_ different.
```

### 785. Prospect

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2026/tp-ho-chi-minh/ptnk.md#L102); dạng xuất hiện: **prospect**.
- Độ phủ theo tập dạng đã chọn: **15/106 tệp**; các dạng có mặt: prospect, prospective, prospects.
```text
**11. **Fans are excited at the prospect of a \_\_\_\_\_\_\_\_\_\_ between two beloved anime franchises.
```

### 786. Qualification

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2026/nghe-an/so.md#L434); dạng xuất hiện: **qualification**.
- Độ phủ theo tập dạng đã chọn: **30/106 tệp**; các dạng có mặt: disqualification, disqualified, qualification, qualifications, qualified, qualify, qualifying, unqualified.
```text
8\. Which statement best captures the author’s qualification of school start-time reform?
```

### 787. Recession

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/tuyen-quang/so.md#L182); dạng xuất hiện: **recession**.
- Độ phủ theo tập dạng đã chọn: **4/106 tệp**; các dạng có mặt: recession, recessions.
```text
…\_\_\_\_\_\_\_\_\_\_ from the difficulties he encountered in the recession.
```

### 788. Reputation

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2026/nghe-an/chuyen-dai-hoc-vinh.md#L426); dạng xuất hiện: **reputation**.
- Độ phủ theo tập dạng đã chọn: **14/106 tệp**; các dạng có mặt: reputation, reputations.
```text
**12.** Hubbert has a high-profile reputation amongst ODAC members.
```

### 789. Resource

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/tp-ho-chi-minh/so.md#L276); dạng xuất hiện: **resource**.
- Độ phủ theo tập dạng đã chọn: **51/106 tệp**; các dạng có mặt: resource, resourceful, resourcefulness, resources.
```text
… ways of managing hydroelectric facilities to conserve the water resource.
```

### 790. Revenue

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2024/ha-noi/so.md#L325); dạng xuất hiện: **revenue**.
- Độ phủ theo tập dạng đã chọn: **5/106 tệp**; các dạng có mặt: revenue.
```text
source of revenue and even manpower. The World Wildlife Fund, for example, runs trips that give donors
```

### 791. Scholarship

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2026/thanh-hoa/so.md#L145); dạng xuất hiện: **scholarship**.
- Độ phủ theo tập dạng đã chọn: **19/106 tệp**; các dạng có mặt: scholarly, scholars, scholarship, scholarships.
```text
…eas several times, the students were determined to apply for the scholarship.
```

### 792. Security

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2024/ha-noi/chuyen-su-pham.md#L316); dạng xuất hiện: **security**.
- Độ phủ theo tập dạng đã chọn: **30/106 tệp**; các dạng có mặt: insecure, insecurity, secure, secured, securely, securing, security.
```text
E The slender security of this privilege makes it doubly sad that many visitors bring their own pace with t…
```

### 793. Shortage

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2024/ha-noi/so.md#L852); dạng xuất hiện: **shortage**.
- Độ phủ theo tập dạng đã chọn: **11/106 tệp**; các dạng có mặt: shortage, shortages.
```text
… might never have done so had it not been for the chronic labour shortage caused by the nation’s
```

### 794. Significance

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/ha-noi/so.md#L530); dạng xuất hiện: **significance**.
- Độ phủ theo tập dạng đã chọn: **56/106 tệp**; các dạng có mặt: insignificant, significance, significant, significantly.
```text
Discuss the significance of regular exercise for students, considering both physical and mental
```

### 795. Species

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/tp-ho-chi-minh/so.md#L116); dạng xuất hiện: **species**.
- Độ phủ theo tập dạng đã chọn: **51/106 tệp**; các dạng có mặt: species.
```text
   The 300 or so species of octopuses have been around for over 250 million years and are known to (1)
```

### 796. Strategy

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/tp-ho-chi-minh/so.md#L273); dạng xuất hiện: **strategy**.
- Độ phủ theo tập dạng đã chọn: **28/106 tệp**; các dạng có mặt: strategic, strategically, strategies, strategy.
```text
(D) Another resource-saving strategy involves developing pump-storage dams.
```

### 797. Versatile

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2026/gia-lai/so.md#L192); dạng xuất hiện: **versatile**.
- Độ phủ theo tập dạng đã chọn: **4/106 tệp**; các dạng có mặt: versatile.
```text
…sively on a single learning style, adopting a more adaptable and versatile approach is generally regarded as **(40)** \_\_\_\_\_\_\_\_\_\_ beneficial.
```

### 798. Substitute

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2026/nghe-an/so.md#L489); dạng xuất hiện: **substitute**.
- Độ phủ theo tập dạng đã chọn: **7/106 tệp**; các dạng có mặt: substitute, substitutes, substituting.
```text
| **vii** | Abundant contact as a substitute for mutual vulnerability |
```

### 799. Phenomenon

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/ha-noi/so.md#L244); dạng xuất hiện: **phenomenon**.
- Độ phủ theo tập dạng đã chọn: **24/106 tệp**; các dạng có mặt: phenomena, phenomenal, phenomenon.
```text
encroach upon open space in North America (a phenomenon known as urban sprawl).
```

### 800. Survey

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/ha-noi/so.md#L173); dạng xuất hiện: **survey**.
- Độ phủ theo tập dạng đã chọn: **26/106 tệp**; các dạng có mặt: survey, surveyed, surveys.
```text
…fitness, the UK’s teenagers are lagging worse behind. A national survey recently
```

### 801. Tendency

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2022/ha-noi/chuyen-su-pham.md#L268); dạng xuất hiện: **tendency**.
- Độ phủ theo tập dạng đã chọn: **56/106 tệp**; các dạng có mặt: tend, tended, tendencies, tendency, tending, tends.
```text
 limitations people face in life is the tendency not to try something new because they might fail. Teens, however,
```

### 802. Threat

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2022/ha-noi/so.md#L426); dạng xuất hiện: **threat**.
- Độ phủ theo tập dạng đã chọn: **46/106 tệp**; các dạng có mặt: threat, threaten, threatened, threatening, threatens, threats.
```text
change, a threat that could have enormous consequences for the majority of populations on the
```

### 803. Tolerance

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2026/ha-tinh/so.md#L346); dạng xuất hiện: **tolerance**.
- Độ phủ theo tập dạng đã chọn: **19/106 tệp**; các dạng có mặt: intolerable, intolerant, tolerable, tolerance, tolerant, tolerate, tolerated.
```text
tolerance for delay and effort has been reduced. In other words, the issue is not only distrac…
```

### 804. Transition

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2022/ha-noi/so.md#L440); dạng xuất hiện: **transition**.
- Độ phủ theo tập dạng đã chọn: **9/106 tệp**; các dạng có mặt: transition, transitional, transitioned, transitions.
```text
renewables can be passed on to help to make transition to greater use of renewable sources
```

### 805. Treatment

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/thai-binh/so.md#L82); dạng xuất hiện: **treatment**.
- Độ phủ theo tập dạng đã chọn: **53/106 tệp**; các dạng có mặt: treat, treated, treating, treatment, treatments, treats, untreated.
```text
10. Advances in treatment and early detection have led to a 26% drop in cancer                since the 1990s,
```

### 806. Trend

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2024/da-nang/so.md#L125); dạng xuất hiện: **trend**.
- Độ phủ theo tập dạng đã chọn: **34/106 tệp**; các dạng có mặt: trend, trends, trendy.
```text
World Bank and a lead author on the study. “This is a concerning trend, especially as climate change
```

### 807. Deceive

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2024/ha-noi/so.md#L473); dạng xuất hiện: **deceived**.
- Độ phủ theo tập dạng đã chọn: **5/106 tệp**; các dạng có mặt: deceived, deceiving, deception, deceptive.
```text
73. The cigarette companies deceived the public about the health risks of cigarettes. (wool)
```

### 808. Underestimate

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2026/ha-tinh/so.md#L341); dạng xuất hiện: **underestimate**.
- Độ phủ theo tập dạng đã chọn: **5/106 tệp**; các dạng có mặt: underestimate, underestimated, underestimating.
```text
E. The academic consequences are easy to underestimate. Brain rot does not usually make students
```

### 809. Urbanization

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2024/da-nang/so.md#L129); dạng xuất hiện: **urbanization**.
- Độ phủ theo tập dạng đã chọn: **24/106 tệp**; các dạng có mặt: urban, urbanisation, urbanised, urbanization, urbanizes.
```text
They found over this period, urbanization happened much more rapidly in high-hazard flood zones
```

### 810. Variation

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/nam-dinh/so.md#L1014); dạng xuất hiện: **variation**.
- Độ phủ theo tập dạng đã chọn: **70/106 tệp**; các dạng có mặt: variable, variables, variation, variations, varied, varies, varieties, variety, vary, varying.
```text
levels of genetic diversity, the amount of genetic variation found within a species essential for their
```

### 811. Welfare

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/ninh-thuan/so.md#L64); dạng xuất hiện: **Welfare**.
- Độ phủ theo tập dạng đã chọn: **6/106 tệp**; các dạng có mặt: welfare.
```text
**7. **How many Welfare Officer positions are available this year?
```

### 812. Workforce

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2022/ha-noi/chuyen-su-pham.md#L312); dạng xuất hiện: **workforce**.
- Độ phủ theo tập dạng đã chọn: **8/106 tệp**; các dạng có mặt: workforce.
```text
 workforce for its technical skills and enthusiasm for change, office culture is becoming an ex…
```

### 813. Degrade

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2023/binh-thuan/so.md#L387); dạng xuất hiện: **degrade**.
- Độ phủ theo tập dạng đã chọn: **6/106 tệp**; các dạng có mặt: biodegradable, degradation, degrade, degraded.
```text
do not degrade with age. But how can we prevent a diminishing of our semantic and unaided prospecti…
```

### 814. Abandon

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2024/ha-noi/chuyen-su-pham.md#L62); dạng xuất hiện: **abandon**.
- Độ phủ theo tập dạng đã chọn: **13/106 tệp**; các dạng có mặt: abandon, abandoned, abandoning, abandonment.
```text
  A. to abandon both ideas                           B. to either abandon the idea
```

### 815. Absorb

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2024/ha-noi/chuyen-su-pham.md#L381); dạng xuất hiện: **absorb**.
- Độ phủ theo tập dạng đã chọn: **21/106 tệp**; các dạng có mặt: absorb, absorbed, absorbing, absorbs, absorption.
```text
…        of common building materials. The minute holes in bricks absorb and store heat during the
```

### 816. Acknowledge

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/quang-ninh/so.md#L108); dạng xuất hiện: **acknowledge**.
- Độ phủ theo tập dạng đã chọn: **17/106 tệp**; các dạng có mặt: acknowledge, acknowledged, acknowledges, acknowledging, acknowledgment.
```text
| **C.** are difficult to enforce | **D.** acknowledge that phones are valuable tools |
```

### 817. Adjust

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2023/tp-ho-chi-minh/so.md#L285); dạng xuất hiện: **adjust**.
- Độ phủ theo tập dạng đã chọn: **25/106 tệp**; các dạng có mặt: adjust, adjusted, adjusting, adjustment, adjustments, adjusts.
```text
   However, you should adjust your rate to your purpose and material. Reading is like driving a car. Your purpose …
```

### 818. Adopt

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2026/bac-ninh/so.md#L252); dạng xuất hiện: **adopt**.
- Độ phủ theo tập dạng đã chọn: **26/106 tệp**; các dạng có mặt: adopt, adopted, adopting, adoption, adoptive, adopts.
```text
… so far has not produced any answers to this problem, we need to adopt a different \_\_\_\_\_\_\_\_\_\_ to it.
```

### 819. Advancement

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2022/thai-nguyen/so.md#L425); dạng xuất hiện: **Advancement**.
- Độ phủ theo tập dạng đã chọn: **58/106 tệp**; các dạng có mặt: advance, advanced, advancement, advancements, advances, advancing.
```text
     The American Association for the Advancement of Science (AAAS) has just held its
```

### 820. Afford

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2023/ha-noi/chuyen-su-pham.md#L694); dạng xuất hiện: **afford**.
- Độ phủ theo tập dạng đã chọn: **32/106 tệp**; các dạng có mặt: afford, affordability, affordable, afforded, affords.
```text
78\. People are persuaded by adverts to spend more than they can afford.
```

### 821. Alter

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2023/ba-ria-vung-tau/so.md#L361); dạng xuất hiện: **alter**.
- Độ phủ theo tập dạng đã chọn: **30/106 tệp**; các dạng có mặt: alter, alterations, altered, altering, alters.
```text
   Further research found that listening to different sounds can alter your perceptions. Studying
```

### 822. Amateur

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2024/ha-noi/so.md#L258); dạng xuất hiện: **amateur**.
- Độ phủ theo tập dạng đã chọn: **9/106 tệp**; các dạng có mặt: amateur, amateurish.
```text
At a time when interest in astronomy is on the increase, amateur astronomers are finding it increasingly
```

### 823. Intimidate

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2022/hai-phong/so.md#L606); dạng xuất hiện: **intimidated**.
- Độ phủ theo tập dạng đã chọn: **5/106 tệp**; các dạng có mặt: intimidated, intimidating.
```text
…g to appear on air, while they frighten away others who may feel intimidated by a camera.
```

### 824. Appreciate

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2024/tp-ho-chi-minh/so.md#L160); dạng xuất hiện: **appreciate**.
- Độ phủ theo tập dạng đã chọn: **44/106 tệp**; các dạng có mặt: appreciably, appreciate, appreciated, appreciates, appreciating, appreciation, appreciative, appreciatively.
```text
…ting to master something we take for granted: using two legs. To appreciate the advantages that legs
```

### 825. Approve

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2026/lai-chau/so.md#L115); dạng xuất hiện: **approve**.
- Độ phủ theo tập dạng đã chọn: **28/106 tệp**; các dạng có mặt: approval, approvals, approve, approved, approves, approving, disapproval, disapprove, disapproved, disapproving.
```text
**21. **Older people rarely approve \_\_\_\_\_\_\_\_\_\_ habits of the younger generation.
```

### 826. Attain

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/ha-noi/so.md#L417); dạng xuất hiện: **attain**.
- Độ phủ theo tập dạng đã chọn: **13/106 tệp**; các dạng có mặt: attain, attainable, attained, attaining, attainment, unattainable.
```text
is expected to attain. There’s nothing inherently simple about multiple choice. We’ve become very
```

### 827. Authentic

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2024/ha-noi/so.md#L865); dạng xuất hiện: **Authentic**.
- Độ phủ theo tập dạng đã chọn: **9/106 tệp**; các dạng có mặt: authentic, authentication, authenticity.
```text
delay. Authentic Indian recipes require hours of cooking in individual pots, and there was no
```

### 828. Bargain

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2026/nghe-an/so.md#L1089); dạng xuất hiện: **bargain**.
- Độ phủ theo tập dạng đã chọn: **10/106 tệp**; các dạng có mặt: bargain, bargaining, bargains.
```text
…s always the remote but thrilling chance that you might find the bargain of a lifetime. I love the amateur entrepreneurship and good-natured haggling at thes…
```

### 829. Bias

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2024/ben-tre/so.md#L205); dạng xuất hiện: **bias**.
- Độ phủ theo tập dạng đã chọn: **14/106 tệp**; các dạng có mặt: bias, biased, biases, unbiased.
```text
…nd fasteners, and musical instruments. The result of this design bias can be more than
```

### 830. Boost

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2023/dak-nong/so.md#L131); dạng xuất hiện: **boost**.
- Độ phủ theo tập dạng đã chọn: **22/106 tệp**; các dạng có mặt: boost, boosted, booster, boosting.
```text
…There are a few tricks that can give you an immediate confidence boost in the short term such as picturing
```

### 831. Breakthrough

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/ba-ria-vung-tau/so.md#L125); dạng xuất hiện: **breakthrough**.
- Độ phủ theo tập dạng đã chọn: **9/106 tệp**; các dạng có mặt: breakthrough, breakthroughs.
```text
…ntelligent and \_\_\_\_\_\_\_\_\_\_ scientist that has made many breakthrough discoveries.
```

### 832. Captivity

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2026/lao-cai/so.md#L128); dạng xuất hiện: **captivity**.
- Độ phủ theo tập dạng đã chọn: **6/106 tệp**; các dạng có mặt: captive, captivity.
```text
…\_\_\_\_ critically endangered in the wild, and breeding them in captivity has proved difficult.
```

### 833. Catastrophic

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2022/tay-ninh/so.md#L279); dạng xuất hiện: **catastrophic**.
- Độ phủ theo tập dạng đã chọn: **8/106 tệp**; các dạng có mặt: catastrophe, catastrophic.
```text
       Invariably, though, it’s the catastrophic demise that we hear about, not just of child
```

### 834. Cease

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2023/dong-nai/so.md#L408); dạng xuất hiện: **ceased**.
- Độ phủ theo tập dạng đã chọn: **6/106 tệp**; các dạng có mặt: cease, ceased, ceases.
```text
81. They ceased to find his jokes amusing. (LONGER)
```

### 835. Collapse

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2026/bac-ninh/so.md#L507); dạng xuất hiện: **collapse**.
- Độ phủ theo tập dạng đã chọn: **12/106 tệp**; các dạng có mặt: collapse, collapsed, collapses.
```text
**2.** The company had huge debts and was about to collapse. (**BRINK**)
```

### 836. Compromise

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2024/ha-noi/so.md#L193); dạng xuất hiện: **compromise**.
- Độ phủ theo tập dạng đã chọn: **9/106 tệp**; các dạng có mặt: compromise, compromised, compromising.
```text
of engineers and forces them to compromise when proven techniques are challenged because of social and
```

### 837. Deduction

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2026/ha-tinh/so.md#L305); dạng xuất hiện: **deduction**.
- Độ phủ theo tập dạng đã chọn: **3/106 tệp**; các dạng có mặt: deduction, deductions, deductive.
```text
by deduction from the paychecks of working people, Social Security ensures that retired persons (…
```

### 838. Comprise

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2022/ninh-thuan/so.md#L255); dạng xuất hiện: **comprise**.
- Độ phủ theo tập dạng đã chọn: **8/106 tệp**; các dạng có mặt: comprise, comprised, comprises, comprising.
```text
comprise agreed practices  for  different kinds of farming, covering agrochemical use,  soil …
```

### 839. Conceal

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2026/tay-ninh/so.md#L165); dạng xuất hiện: **conceal**.
- Độ phủ theo tập dạng đã chọn: **8/106 tệp**; các dạng có mặt: conceal, concealed, concealing, conceals.
```text
21\. , she dropped the teacup onto the floor, unable to conceal her fear.
```

### 840. Confront

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2024/ha-noi/chuyen-su-pham.md#L54); dạng xuất hiện: **confront**.
- Độ phủ theo tập dạng đã chọn: **12/106 tệp**; các dạng có mặt: confront, confrontational, confrontations, confronted, confronts.
```text
4.  A. confront              B. venture              C. curtail               D. impinge
```

### 841. Congestion

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2026/khanh-hoa/so.md#L84); dạng xuất hiện: **congestion**.
- Độ phủ theo tập dạng đã chọn: **12/106 tệp**; các dạng có mặt: congested, congestion.
```text
…*The policy was introduced \_\_\_\_\_\_\_\_\_\_ reducing traffic congestion in urban areas.
```

### 842. Confidential

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2026/tay-ninh/so.md#L183); dạng xuất hiện: **confidential**.
- Độ phủ theo tập dạng đã chọn: **9/106 tệp**; các dạng có mặt: confide, confidential, confides, confiding.
```text
…any’s code of conduct at all times, especially when dealing with confidential information.
```

### 843. Contaminate

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2022/soc-trang/so.md#L82); dạng xuất hiện: **contaminated**.
- Độ phủ theo tập dạng đã chọn: **5/106 tệp**; các dạng có mặt: contaminants, contaminated, contaminating, contamination.
```text
5\. The virus is spread through contact with contaminated food and water.
```

### 844. Convert

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2022/an-giang/so.md#L288); dạng xuất hiện: **convert**.
- Độ phủ theo tập dạng đã chọn: **13/106 tệp**; các dạng có mặt: conversion, convert, converted, converting, converts.
```text
studying ways to convert the energy of ocean currents, tides, and waves to electricity. Experiments are
```

### 845. Convince

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2026/thanh-hoa/so.md#L145); dạng xuất hiện: **convince**.
- Độ phủ theo tập dạng đã chọn: **24/106 tệp**; các dạng có mặt: convince, convinced, convincing, convincingly, unconvinced, unconvincing.
```text
**27.** (**convince**) \_\_\_\_\_\_\_\_\_\_ of the advantages of studying overseas several times, the st…
```

### 846. Counterpart

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2026/da-nang/so.md#L344); dạng xuất hiện: **counterpart**.
- Độ phủ theo tập dạng đã chọn: **10/106 tệp**; các dạng có mặt: counterpart, counterparts.
```text
**8.** The man was envious of his counterpart’s success. (**GREEN**)
```

### 847. Whereas

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2026/quang-tri/so.md#L319); dạng xuất hiện: **whereas**.
- Độ phủ theo tập dạng đã chọn: **21/106 tệp**; các dạng có mặt: whereas.
```text
whereas in less stable homes and those with many children, if you don’t grab a marshmallow n…
```

### 848. Decline

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2023/tp-ho-chi-minh/ptnk.md#L128); dạng xuất hiện: **decline**.
- Độ phủ theo tập dạng đã chọn: **37/106 tệp**; các dạng có mặt: decline, declined, declines, declining.
```text
4\. What was the most important factor that initiated the decline of apprenticeships in the States?
```

### 849. Dedicate

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2026/bac-ninh/so.md#L280); dạng xuất hiện: **DEDICATE**.
- Độ phủ theo tập dạng đã chọn: **19/106 tệp**; các dạng có mặt: dedicate, dedicated, dedicating, dedication.
```text
…\_ to our administration and your help at a time when needed. (**DEDICATE**)
```

### 850. Defy

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2022/ca-mau/so.md#L314); dạng xuất hiện: **defy**.
- Độ phủ theo tập dạng đã chọn: **3/106 tệp**; các dạng có mặt: defiant, defies, defy.
```text
human experience. Cultural evolution has enabled us to defy our physical limitations and shortcut biological
```

### 851. Guarantee

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2026/dak-lak/so.md#L705); dạng xuất hiện: **guarantee**.
- Độ phủ theo tập dạng đã chọn: **16/106 tệp**; các dạng có mặt: guarantee, guaranteed, guarantees.
```text
**Receptionist:** We can’t guarantee the weather, Mr. Jones, although we do try to make your stay as comfortable as possi…
```

### 852. Discriminate

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2022/tp-ho-chi-minh/ptnk.md#L240); dạng xuất hiện: **discriminate**.
- Độ phủ theo tập dạng đã chọn: **5/106 tệp**; các dạng có mặt: discriminate, discriminating, discrimination.
```text
D. discriminate
```

### 853. Disrupt

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/dak-lak/so.md#L99); dạng xuất hiện: **disrupt**.
- Độ phủ theo tập dạng đã chọn: **13/106 tệp**; các dạng có mặt: disrupt, disrupted, disrupting, disruption, disrupts.
```text
… **(12)** \_\_\_\_\_\_\_\_\_\_ peptide that can form plaques and disrupt brain function are removed. It is also found that as the mice slept, their glymphati…
```

### 854. Distract

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2022/hoa-binh/so.md#L736); dạng xuất hiện: **distract**.
- Độ phủ theo tập dạng đã chọn: **16/106 tệp**; các dạng có mặt: distract, distracted, distracting, distraction, distractions, distracts.
```text
bound to distract. But music is not the only distractor. What is (70)
```

### 855. Drought

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/tien-giang/so.md#L223); dạng xuất hiện: **drought**.
- Độ phủ theo tập dạng đã chọn: **9/106 tệp**; các dạng có mặt: drought, droughts.
```text
…at monsoon seasons with low-index conditions are often marked by drought in
```

### 856. Durable

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/bac-giang/so.md#L237); dạng xuất hiện: **durable**.
- Độ phủ theo tập dạng đã chọn: **7/106 tệp**; các dạng có mặt: durability, durable.
```text
more durable, lasting at least six times longer. However, they do have some drawbacks. (7)
```

### 857. Emerge

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2023/tp-ho-chi-minh/so.md#L273); dạng xuất hiện: **emerge**.
- Độ phủ theo tập dạng đã chọn: **23/106 tệp**; các dạng có mặt: emerge, emerged, emergence, emerges, emerging.
```text
In a little more than a week, an adult ant will emerge, and the metamorphosis is (10) _______.
```

### 858. Sufficient

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/nam-dinh/so.md#L422); dạng xuất hiện: **sufficient**.
- Độ phủ theo tập dạng đã chọn: **35/106 tệp**; các dạng có mặt: insufficiency, insufficient, insufficiently, suffice, sufficiency, sufficient, sufficiently.
```text
trying to arrange sufficient mules for the next stage of the trek. His companions showed no interest in
```

### 859. Enforce

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/binh-phuoc/so.md#L260); dạng xuất hiện: **enforce**.
- Độ phủ theo tập dạng đã chọn: **8/106 tệp**; các dạng có mặt: enforce, enforced, enforcement, enforces, enforcing.
```text
**40. **- Rose: “Governments should enforce strict environmental regulations and promote sustainability.”
```

### 860. Enrich

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2023/dong-nai/so.md#L137); dạng xuất hiện: **enrich**.
- Độ phủ theo tập dạng đã chọn: **10/106 tệp**; các dạng có mặt: enrich, enriched, enriches, enriching, enrichment.
```text
39. Fertilizers are used primarily to enrich soil and increasing yield.
```

### 861. Erode

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2026/ha-tinh/so.md#L208); dạng xuất hiện: **eroded**.
- Độ phủ theo tập dạng đã chọn: **8/106 tệp**; các dạng có mặt: eroded, eroding, erosion.
```text
…estion the validity of everything around them. Globalisation has eroded their sense
```

### 862. Evolve

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2023/tp-ho-chi-minh/ptnk.md#L844); dạng xuất hiện: **EVOLVE**.
- Độ phủ theo tập dạng đã chọn: **32/106 tệp**; các dạng có mặt: evolution, evolutionary, evolve, evolved, evolves, evolving.
```text
(EVOLVE) of all life include electron microscopy, genetics, paleobiology (including palaeont…
```

### 863. Exaggerate

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/ha-noi/so.md#L812); dạng xuất hiện: **exaggerate**.
- Độ phủ theo tập dạng đã chọn: **12/106 tệp**; các dạng có mặt: exaggerate, exaggerated, exaggerates, exaggerating, exaggeration.
```text
again. That aside, they’ll check their facts and don’t exaggerate to make a piece sound exciting. Plus
```

### 864. Fierce

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/ba-ria-vung-tau/so.md#L168); dạng xuất hiện: **fierce**.
- Độ phủ theo tập dạng đã chọn: **5/106 tệp**; các dạng có mặt: fierce, fiercely.
```text
Lance Armstrong was the embodiment of ambition and fierce determination in the face of incredible odds. He fought and beat cancer, then went o…
```

### 865. Fertile

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2022/quang-ninh/so.md#L558); dạng xuất hiện: **fertile**.
- Độ phủ theo tập dạng đã chọn: **14/106 tệp**; các dạng có mặt: fertile, fertiliser, fertilisers, fertility, fertilize, fertilizer, fertilizers.
```text
provided there are fertile soil conditions and intensive husbandry. With pruning and careful cultivation, the t…
```

### 866. Flourish

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/thai-nguyen/so.md#L70); dạng xuất hiện: **flourish**.
- Độ phủ theo tập dạng đã chọn: **8/106 tệp**; các dạng có mặt: flourish, flourished.
```text
…nt and its own role within the Egyptian State. Cities could only flourish in the Nile Delta,
```

### 867. Fragile

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2026/tp-ho-chi-minh/ptnk.md#L139); dạng xuất hiện: **fragile**.
- Độ phủ theo tập dạng đã chọn: **10/106 tệp**; các dạng có mặt: fragile, fragility.
```text
**18.** \_\_\_\_\_\_\_\_\_\_ is comfortable with relocating the fragile fresco.
```

### 868. Frustrate

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2026/ha-tinh/so.md#L941); dạng xuất hiện: **frustrates**.
- Độ phủ theo tập dạng đã chọn: **16/106 tệp**; các dạng có mặt: frustrated, frustrates, frustrating, frustration.
```text
… fact that environmental problems are already affecting us. What frustrates me, though, is that some people still treat protecting the environment as if it were…
```

### 869. Harness

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/nghe-an/so.md#L430); dạng xuất hiện: **harness**.
- Độ phủ theo tập dạng đã chọn: **12/106 tệp**; các dạng có mặt: harness, harnessed, harnesses, harnessing.
```text
   Blakemore suggests we might harness the power of peer pressure by getting adolescents to run educational
```

### 870. Hazard

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/ha-noi/so.md#L876); dạng xuất hiện: **hazard**.
- Độ phủ theo tập dạng đã chọn: **14/106 tệp**; các dạng có mặt: hazard, hazardous, hazards.
```text
explained that fish gather there, so this is an accepted hazard of those with a job of catching them.
```

### 871. Refine

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/quang-ninh/so.md#L365); dạng xuất hiện: **refined**.
- Độ phủ theo tập dạng đã chọn: **5/106 tệp**; các dạng có mặt: refined, refinement, refinements.
```text
…e cleanly than coal and polluted less. Unlike coal, oil could be refined to manufacture liquid fuels for vehicles; a very important consideration in the earl…
```

### 872. Impose

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/phu-tho/so.md#L145); dạng xuất hiện: **impose**.
- Độ phủ theo tập dạng đã chọn: **13/106 tệp**; các dạng có mặt: impose, imposed, imposes, imposing.
```text
  A. impose             B. propose            C. expose            D. suppose
```

### 873. Incorporate

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2022/ha-noi/so.md#L386); dạng xuất hiện: **incorporate**.
- Độ phủ theo tập dạng đã chọn: **12/106 tệp**; các dạng có mặt: incorporate, incorporated, incorporates, incorporating, incorporation.
```text
Q32.5.  A. incorporate       B. comprise         C. include          D. unite
```

### 874. Indifferent

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/tp-ho-chi-minh/so.md#L361); dạng xuất hiện: **indifferent**.
- Độ phủ theo tập dạng đã chọn: **10/106 tệp**; các dạng có mặt: indifference, indifferent.
```text
5. The adults usually object to how indifferent the young are nowadays. (exception)
```

### 875. Inclusive

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2026/dak-lak/so.md#L416); dạng xuất hiện: **inclusive**.
- Độ phủ theo tập dạng đã chọn: **96/106 tệp**; các dạng có mặt: include, included, includes, including, inclusive, inclusively.
```text
…cinating how technology is making hiring both efficient and more inclusive.
```

### 876. Interpersonal

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/ha-noi/so.md#L480); dạng xuất hiện: **interpersonal**.
- Độ phủ theo tập dạng đã chọn: **6/106 tệp**; các dạng có mặt: interpersonal.
```text
77. Tom is far better than me in terms of resolving interpersonal conflicts.
```

### 877. Integrate

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2026/dak-lak/so.md#L562); dạng xuất hiện: **integrate**.
- Độ phủ theo tập dạng đã chọn: **15/106 tệp**; các dạng có mặt: integrate, integrated, integrates, integrating, integration.
```text
| **51. **integrate | **52. **with | **53. **operation | **54. **exchanged | **55. **irrespective/regard…
```

### 878. Interfere

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2022/thai-nguyen/so.md#L206); dạng xuất hiện: **interfere**.
- Độ phủ theo tập dạng đã chọn: **10/106 tệp**; các dạng có mặt: interfere, interfered, interference, interfering.
```text
… (56)_____, cause irritability, anxiety, and mental fatigue, and interfere with sleep,
```

### 879. Intervene

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/tp-ho-chi-minh/so.md#L369); dạng xuất hiện: **intervene**.
- Độ phủ theo tập dạng đã chọn: **10/106 tệp**; các dạng có mặt: intervene, intervened, intervention, interventions.
```text
9. I think that if you don’t intervene too much, the students work much harder. (devices)
```

### 880. Intelligible

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2026/ha-tinh/so.md#L145); dạng xuất hiện: **intelligible**.
- Độ phủ theo tập dạng đã chọn: **6/106 tệp**; các dạng có mặt: intelligible.
```text
  A. intelligible          B. intangible         C. intensive            D. indelible
```

### 881. Promote

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2026/quang-tri/so.md#L370); dạng xuất hiện: **promote**.
- Độ phủ theo tập dạng đã chọn: **47/106 tệp**; các dạng có mặt: promote, promoted, promoter, promoters, promotes, promoting, promotion, promotional, promotions.
```text
programs. Their attempt to promote this program to cancer doctors was a PR disaster. The AI promised
```

### 882. Legible

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/tuyen-quang/so.md#L219); dạng xuất hiện: **LEGIBLE**.
- Độ phủ theo tập dạng đã chọn: **13/106 tệp**; các dạng có mặt: illegible, legible.
```text
…y friend’s biology lecture notes because they were completely (**LEGIBLE**) \_\_\_\_\_\_\_\_\_\_.
```

### 883. Longevity

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2023/quang-binh/so.md#L215); dạng xuất hiện: **longevity**.
- Độ phủ theo tập dạng đã chọn: **6/106 tệp**; các dạng có mặt: longevity.
```text
changing. Maybe longevity just depends on genes or perhaps it's (65).......... down to good luck.
```

### 884. Manipulate

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/bac-giang/so.md#L1053); dạng xuất hiện: **manipulate**.
- Độ phủ theo tập dạng đã chọn: **8/106 tệp**; các dạng có mặt: manipulate, manipulated, manipulation.
```text
of the fact that smell is being used to manipulate them. I mean, when a powerful and irresistible scent
```

### 885. Misleading

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2026/quang-tri/so.md#L177); dạng xuất hiện: **misleading**.
- Độ phủ theo tập dạng đã chọn: **6/106 tệp**; các dạng có mặt: mislead, misleading, misled.
```text
misleading or false. Many companies (49) ______ using vague or undefined terms such as 'sustain…
```

### 886. Empathy

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/nghe-an/so.md#L438); dạng xuất hiện: **empathy**.
- Độ phủ theo tập dạng đã chọn: **3/106 tệp**; các dạng có mặt: empathy.
```text
  One thing that makes Blakemore’s empathy and affection for teenagers so striking is its rarity. ‘Yes, I’m a champion
```

### 887. Obscure

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/ha-noi/so.md#L308); dạng xuất hiện: **obscure**.
- Độ phủ theo tập dạng đã chọn: **10/106 tệp**; các dạng có mặt: obscure, obscured, obscures, obscuring, obscurity.
```text
… alive, it attracts very few people and is located in a somewhat obscure area of the park. Apart
```

### 888. Outbreak

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2023/hung-yen/so.md#L714); dạng xuất hiện: **outbreak**.
- Độ phủ theo tập dạng đã chọn: **7/106 tệp**; các dạng có mặt: outbreak, outbreaks.
```text
5\. Instead of calling off the football match as the outbreak of Covid-19, maybe we can just put it over
```

### 889. Overlook

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2022/ha-noi/chuyen-su-pham.md#L297); dạng xuất hiện: **overlook**.
- Độ phủ theo tập dạng đã chọn: **17/106 tệp**; các dạng có mặt: overlook, overlooked, overlooking, overlooks.
```text
…ved in a fatal accident. And while this issue is real, let’s not overlook the fact that not all risk-taking
```

### 890. Persist

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2022/hai-phong/so.md#L119); dạng xuất hiện: **PERSIST**.
- Độ phủ theo tập dạng đã chọn: **17/106 tệp**; các dạng có mặt: persist, persisted, persistence, persistent, persistently, persists.
```text
10. Jack got into a lot of trouble for (PERSIST) ____persistently___ breaking school rules.
```

### 891. Prestigious

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2023/tp-ho-chi-minh/ptnk.md#L984); dạng xuất hiện: **prestigious**.
- Độ phủ theo tập dạng đã chọn: **10/106 tệp**; các dạng có mặt: prestige, prestigious.
```text
The Olympic Games, one of the world's most prestigious athletic spectacle,
```

### 892. Prohibit

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2022/tay-ninh/so.md#L291); dạng xuất hiện: **prohibit**.
- Độ phủ theo tập dạng đã chọn: **11/106 tệp**; các dạng có mặt: prohibit, prohibited, prohibition, prohibitive, prohibitively.
```text
C. It will prohibit children from acting in films.
```

### 893. Prosperity

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2024/ha-noi/so.md#L853); dạng xuất hiện: **prosperity**.
- Độ phủ theo tập dạng đã chọn: **9/106 tệp**; các dạng có mặt: prosper, prosperity, prosperous.
```text
new-found, post-war prosperity. It was solved by bringing in immigrant labour from the West Indies
```

### 894. Resent

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/nghe-an/so.md#L442); dạng xuất hiện: **resent**.
- Độ phủ theo tập dạng đã chọn: **8/106 tệp**; các dạng có mặt: resent, resented, resentment.
```text
…dependence, and the older generations feel hurt about this. They resent
```

### 895. Recruit

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/bac-giang/so.md#L487); dạng xuất hiện: **recruit**.
- Độ phủ theo tập dạng đã chọn: **9/106 tệp**; các dạng có mặt: recruit, recruited, recruiter, recruiters, recruiting, recruitment, recruits.
```text
2. The respond to their appeal is so great that they have to recruit more volunteers.
```

### 896. Redundant

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2023/ha-noi/so.md#L224); dạng xuất hiện: **redundant**.
- Độ phủ theo tập dạng đã chọn: **6/106 tệp**; các dạng có mặt: redundancy, redundant.
```text
…eir fingers to the \_\_\_\_\_\_\_\_\_\_, all the staff were made redundant.
```

### 897. Emphasize

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2026/ha-tinh/so.md#L440); dạng xuất hiện: **emphasize**.
- Độ phủ theo tập dạng đã chọn: **24/106 tệp**; các dạng có mặt: emphasis, emphasise, emphasises, emphasising, emphasize, emphasized, emphasizes, emphasizing.
```text
adapt. Skilled riders often emphasize that working with a horse requires communication rather than
```

### 898. Eventually

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2026/thanh-hoa/so.md#L344); dạng xuất hiện: **eventually**.
- Độ phủ theo tập dạng đã chọn: **35/106 tệp**; các dạng có mặt: eventual, eventually.
```text
**C**. Endless scrolling eventually disrupts this balance, prompting the brain to compensate by producing less dopamine …
```

### 899. Restore

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2026/nghe-an/chuyen-dai-hoc-vinh.md#L157); dạng xuất hiện: **restore**.
- Độ phủ theo tập dạng đã chọn: **12/106 tệp**; các dạng có mặt: restoration, restorative, restore, restored, restores, restoring.
```text
Before deciding to restore the natural wood, the family first attempted **(19)** \_\_\_\_\_\_\_\_\_\_ the old c…
```

### 900. Rigorous

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2022/ha-noi/chuyen-su-pham.md#L163); dạng xuất hiện: **rigorous**.
- Độ phủ theo tập dạng đã chọn: **5/106 tệp**; các dạng có mặt: rigorous.
```text
…rapid shifts in focus, even if performed adeptly, result in less rigorous and more ‘automatic’ thinking.
```

### 901. Scarce

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/nghe-an/so.md#L963); dạng xuất hiện: **scarce**.
- Độ phủ theo tập dạng đã chọn: **17/106 tệp**; các dạng có mặt: scarce, scarcely, scarcity.
```text
          6. spending        7. low/limited/scarce      8. keep/stay/be      9. on              10. before
```

### 902. Skeptical

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2024/da-nang/so.md#L243); dạng xuất hiện: **skeptical**.
- Độ phủ theo tập dạng đã chọn: **9/106 tệp**; các dạng có mặt: sceptics, skeptical, skepticism, skeptics.
```text
__________, the European Commission remains skeptical, indicating that Meta’s efforts may not be
```

### 903. Simulate

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/ha-noi/so.md#L141); dạng xuất hiện: **simulate**.
- Độ phủ theo tập dạng đã chọn: **12/106 tệp**; các dạng có mặt: simulate, simulated, simulation, simulations, simulator, simulators.
```text
     occasion         complicate         revolve          simulate           intend
```

### 904. Strive

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2024/tp-ho-chi-minh/so.md#L179); dạng xuất hiện: **strive**.
- Độ phủ theo tập dạng đã chọn: **6/106 tệp**; các dạng có mặt: strive, striving.
```text
… journey to perfect bipedal locomotion continues, as researchers strive to enhance balance, agility and energy
```

### 905. Susceptible

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/bac-giang/so.md#L264); dạng xuất hiện: **susceptible**.
- Độ phủ theo tập dạng đã chọn: **8/106 tệp**; các dạng có mặt: susceptibility, susceptible.
```text
…t is dangerous. Enthusiastic sunbathers with very fair skins are susceptible to
```

### 906. Thrive

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2023/ha-noi/so.md#L410); dạng xuất hiện: **thrive**.
- Độ phủ theo tập dạng đã chọn: **16/106 tệp**; các dạng có mặt: thrive, thrived, thrives, thriving.
```text
76\. Many creatures still survive and thrive in the harsh conditions of the deserts.
```

### 907. Transparent

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/tien-giang/so.md#L134); dạng xuất hiện: **transparent**.
- Độ phủ theo tập dạng đã chọn: **8/106 tệp**; các dạng có mặt: transparency, transparent.
```text
…. The architects have made (IMAGINE) __________ use of glass and transparent plastic.
```

### 908. Renewable

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2024/ha-noi/chuyen-su-pham.md#L147); dạng xuất hiện: **renewable**.
- Độ phủ theo tập dạng đã chọn: **24/106 tệp**; các dạng có mặt: non-renewable, renew, renewable, renewal, renewed, renewing, renews.
```text
You are going to read a text about renewable energy. Mark A, B, C, or D on the answer sheet to answer the
```

### 909. Moreover

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2025/vinh-phuc/so.md#L334); dạng xuất hiện: **Moreover**.
- Độ phủ theo tập dạng đã chọn: **26/106 tệp**; các dạng có mặt: moreover.
```text
seep into the narrative. Moreover, research generally involves translations from one language to
```

### 910. Obligation

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2026/nghe-an/chuyen-dai-hoc-vinh.md#L669); dạng xuất hiện: **obligation**.
- Độ phủ theo tập dạng đã chọn: **18/106 tệp**; các dạng có mặt: obligation, obligations, obligatory, oblige, obliged.
```text
 You are \_**under no obligation/ not obliged/ not required to finish**\_ the presentation outline before Saturday.
```

### 911. Nevertheless

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2026/khanh-hoa/so.md#L263); dạng xuất hiện: **Nevertheless**.
- Độ phủ theo tập dạng đã chọn: **26/106 tệp**; các dạng có mặt: nevertheless.
```text
… including anti-inflammatory effects and cardiovascular support. Nevertheless, it is important to distinguish between preliminary findings and clinically substant…
```

### 912. Viable

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2022/ha-noi/so.md#L454); dạng xuất hiện: **viable**.
- Độ phủ theo tập dạng đã chọn: **9/106 tệp**; các dạng có mặt: viability, viable.
```text
D One island showing that renewable energy can be viable is the Spanish Canary Island of El
```

### 913. Virtually

- [Vị trí trong bản chép](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2023/vinh-phuc/so.md#L425); dạng xuất hiện: **virtually**.
- Độ phủ theo tập dạng đã chọn: **24/106 tệp**; các dạng có mặt: virtual, virtually.
```text
When I became a guide I had virtually no training at all, just a two-hour lecture about what not to
```


## Later app integration (2026-10-06)

The earlier statement that these 300 entries should not replace `data/vocabulary.json` records the decision at the time of this review. On 2026-10-06, the user requested a standalone app containing all 913 records, superseding that limit. IDs 614–913 are now represented in the structured Markdown table and app data. Their explicitly labeled word-family text is stored in `WORD_FAMILY`; the original comparison and source citation remain together in `NOTES`. No synonyms, antonyms, collocations, register, connotation, example sentences, difficulty scores, or creation dates were inferred where the source did not provide them.

For ID 448 (`Menial task`), the Markdown-list meaning was selected as canonical; the previous app wording is retained in `NOTES` so neither definition is discarded. The exam evidence and counts above remain unchanged.
