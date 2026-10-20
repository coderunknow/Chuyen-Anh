# Vocabulary audit — v1.0.0-dev5

Generated: 2026-10-20T13:25:26Z · Schema: 2.0.0

**Scope note:** all 913 canonical source rows were read in ascending ID order before dictionary research. This is not a claim that all 913 entries were dictionary-verified.

## Evidence counts

- Canonical source rows read: **913 / 913**; unreviewed source rows: **0**.
- Automated structural checks: **913 / 913** (not dictionary verification).
- Dictionary-evidence ledger: **145 verified** = 127 dev4 records carried forward without a fresh dev5 lookup + 18 directly checked in dev5.
- Exact-headword dictionary verification still pending: **768 / 913**.
- Of those pending: **765** were not targeted for dictionary research in this pass; **3** targeted rows have only component/grammar or no exact-phrase evidence (IDs 448, 456, 579).
- Source corrections: **16**, each with direct dictionary, grammar, or component evidence; **14** have exact-headword dictionary evidence and **2** use grammar/component evidence only.

The 127 carried-forward rows retain their stored dev4 evidence, but were not individually re-fetched in this dev5 pass. The current pass directly rechecked five legacy dictionary entries, repaired five paraphrased/annotated excerpts, downgraded ID 448 to pending, and verified 13 additional exact headwords. No 913/913 dictionary-completion claim is made.

## Source-level parity

Before source edits, the 913-row Markdown source, app JSON, and dev4 audit were compared with zero field differences after normalizing omitted empty `register`/`connotation` values. The dev5 generator checks all current source-managed fields against app JSON and emits all 913 audit records from the canonical Markdown. `scripts/embed_vocabulary.py --check` validates the standalone HTML payload separately.

## Targeted review dispositions (16 suspected source rows)

| ID | Headword | Dictionary status | Disposition |
| ---: | --- | --- | --- |
| 153 | Esoteric | verified | Corrected the gloss to the limited-audience/specialized-knowledge sense; exact Cambridge headword directly checked. |
| 232 | Belie | verified | Separated showing something false from concealing something such as an emotion; exact Cambridge headword directly checked. |
| 256 | Complaisant | verified | Replaced with willing-to-satisfy-others wording and added Cambridge's formal register; exact headword directly checked. |
| 271 | Corpulent | verified | Used the concise 'fat' sense and added formal register; exact Cambridge headword directly checked. |
| 274 | Cosmopolitan | verified | Separated the adjective and person-noun experience senses and recorded the approving connotation; exact headword directly checked. |
| 341 | Intransigent | verified | Removed the misleading positive gloss; corrected meaning/register/connotation using a direct Cambridge recheck. |
| 357 | Pedantic | verified | Removed the conflated word and retained the formal-rules/small-details sense plus disapproving connotation; exact headword directly checked. |
| 456 | Subjunctive structure | pending-manual | Scoped the pattern to proposals/requests and documented the should option; Cambridge grammar and examples support the correction, but this grammar row is not dictionary-verified. |
| 459 | Check out | verified | Corrected the headword to 'check out'; Cambridge's exact sense and example show 'with' as a complement, not part of the headword. |
| 460 | Discursive | verified | Added the general discussion sense and qualified the formal digressive sense; exact headword directly checked. |
| 565 | AI slop | verified | Aligned with Cambridge's low-quality AI digital-content definition and recorded informal/disapproving labels; exact phrase directly checked. |
| 579 | Burning social conscience | pending-manual | Revised to a compositional meaning with component evidence; no fixed-idiom or exact-phrase dictionary claim is made. |
| 582 | Strident | verified | Reworded both senses to the Cambridge sound and forceful-language definitions; exact headword directly checked. |
| 584 | Streaky bacon | verified | Defined the streaked meat/fat feature and typical preparation; Cambridge treats smoked bacon as an optional choice. |
| 591 | Public purse | verified | Changed to government/public funds and added Cambridge's mainly UK label; exact phrase directly checked. |
| 617 | Anticipate | verified | Separated the expect and take-action-in-preparation senses; exact Cambridge entry directly checked. |

### Source corrections

| ID | Field changes | Evidence basis |
| ---: | --- | --- |
| 153 | `meaning`: thâm sâu, chỉ dành cho người có chuyên môn → chuyên biệt, ít người biết hoặc hiểu; chỉ dành cho số ít người có kiến thức chuyên môn | corrected-and-exact-headword-verified |
| 232 | `meaning`: che giấu, phủ nhận hoặc trái với vẻ bề ngoài → cho thấy điều gì đó là sai hoặc trái với thực tế; che giấu (nhất là cảm xúc) | corrected-and-exact-headword-verified |
| 256 | `meaning`: chiều lòng người khác, quá dễ làm vừa lòng → sẵn lòng làm vừa lòng người khác bằng cách cư xử lịch sự và hòa theo kế hoạch của họ; `register`:  → formal | corrected-and-exact-headword-verified |
| 271 | `meaning`: béo phì, đẫy đà → béo; có thân hình to béo; `register`:  → formal | corrected-and-exact-headword-verified |
| 274 | `meaning`: mang tính quốc tế, cởi mở / người có tầm nhìn quốc tế → có tính quốc tế, đa văn hóa; (người) có trải nghiệm và hiểu biết về nhiều nơi trên thế giới; `connotation`:  → usually approving | corrected-and-exact-headword-verified |
| 341 | `meaning`: bất khuất, không chịu thỏa hiệp → không chịu thay đổi quan điểm hoặc hành vi; không chịu thỏa hiệp; `register`:  → formal; `connotation`:  → disapproving | revalidated-and-source-corrected |
| 357 | `meaning`: mọt sách, quá chú trọng tiểu tiết hoặc quy tắc học thuật → quá chú trọng các quy tắc hình thức hoặc những chi tiết nhỏ, không quan trọng; câu nệ tiểu tiết; `connotation`:  → disapproving | corrected-and-exact-headword-verified |
| 456 | `meaning`: cấu trúc giả định: S + suggest/demand/insist/It is essential... + that + S + V-bare (không chia) → Khi suggest mang nghĩa đề nghị một hành động, mệnh đề that có thể dùng động từ nguyên mẫu (I suggest (that) you leave); nếu suggest ở quá khứ, tiếng Anh-Anh cũng có thể dùng should + động từ nguyên mẫu. Với insist, phân biệt nghĩa khẳng định (Greg still insists (that) he did nothing wrong) với nghĩa yêu cầu (They insisted that all swear words be deleted). Không áp dụng máy móc một công thức bare-verb cho mọi cách dùng suggest hoặc insist.; `notes`:  → Cambridge Grammar Today: “When we suggest an action to someone, we can use a that-clause”; example “I suggest (that) you leave here around four o’clock.” It says “When suggest is in the past, we can use should in the that-clause.” Cambridge Dictionary contrasts “Greg still insists (that) he did nothing wrong” with “They insisted that all swear words be deleted from the article.” Sources: https://dictionary.cambridge.org/grammar/british-grammar/suggest ; https://dictionary.cambridge.org/dictionary/english/insist | corrected-with-grammar-evidence-not-dictionary-verified |
| 459 | `word`: Check out with → Check out; `meaning`: khớp với, ăn khớp với (thông tin, lời khai, dữ liệu) → được xác nhận là đúng khi kiểm tra; khớp với thông tin khác khi đối chiếu; `notes`:  → Headword là phrasal verb check out; with + danh từ có thể nêu nguồn/thông tin để đối chiếu, nhưng with không thuộc headword. Cambridge có ví dụ về lời khai check out with các báo cáo của nhân chứng. Nguồn: https://dictionary.cambridge.org/dictionary/english/check-out | corrected-and-exact-headword-verified |
| 460 | `meaning`: lan man, tản mạn, nhảy từ ý này sang ý khác → liên quan đến thảo luận; (formal, nói hoặc viết) bàn sang các chủ đề chỉ liên quan lỏng lẻo với chủ đề chính lâu hơn mức cần thiết; `register`:  → formal (sense 2) | corrected-and-exact-headword-verified |
| 565 | `meaning`: nội dung do AI tạo hàng loạt, chất lượng thấp, vô giá trị → nội dung số chất lượng thấp do trí tuệ nhân tạo tạo ra; `register`:  → informal; `connotation`:  → disapproving | corrected-and-exact-headword-verified |
| 579 | `meaning`: ý thức trách nhiệm xã hội mãnh liệt, luôn day dứt thôi thúc → ý thức xã hội mãnh liệt: sự quan tâm sâu sắc đến người nghèo, người bệnh, người cao tuổi và mong muốn giúp đỡ họ; `notes`:  → Diễn giải theo nghĩa kết hợp của các thành phần; không khẳng định đây là thành ngữ cố định. Burning dùng cho mong muốn rất mạnh; social conscience nói về sự quan tâm đến các nhóm yếu thế và cố gắng giúp họ. Nguồn: https://dictionary.cambridge.org/us/dictionary/learner-english/burning ; https://dictionary.cambridge.org/dictionary/english/social-conscience | corrected-with-component-evidence-not-exact-phrase-verified |
| 582 | `meaning`: chói tai, gay gắt; (quan điểm) quyết liệt, hùng hổ đến khó chịu → chói tai, to, thô ráp và khó chịu; (lời nói hoặc quan điểm) được diễn đạt mạnh mẽ, không tránh việc làm người khác khó chịu | corrected-and-exact-headword-verified |
| 584 | `meaning`: thịt ba chỉ xông khói (nạc mỡ xen kẽ) → thịt lợn kiểu bacon có các dải mỡ xen kẽ các dải thịt; thường được ăn chiên thành lát mỏng; `notes`:  → Streaky mô tả các dải mỡ và thịt; không mặc định bacon phải được xông khói. Cambridge ghi smoked streaky bacon như một lựa chọn. Nguồn: https://dictionary.cambridge.org/dictionary/english/streaky-bacon | corrected-and-exact-headword-verified |
| 591 | `meaning`: ngân sách nhà nước, tiền thuế của dân → ngân quỹ công, tiền của chính phủ; `register`:  → mainly UK | corrected-and-exact-headword-verified |
| 617 | `meaning`: dự đoán và chuẩn bị đón trước; mong đợi. → dự đoán, mong đợi; (nghĩa riêng) hành động trước để chuẩn bị cho điều mình nghĩ sẽ xảy ra; `notes`: **Phân biệt:** Anticipate thường bao hàm chuẩn bị trước; expect chỉ tin rằng điều gì sẽ xảy ra. **Nguồn:** [2024/tp-ho-chi-minh/so.md:107](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2024/tp-ho-chi-minh/so.md#L107) (dạng trong nguồn: anticipate). → **Phân biệt:** anticipate có nghĩa “dự đoán/mong đợi” và một nghĩa riêng là “hành động để chuẩn bị”; nghĩa thứ nhất không mặc định bao hàm chuẩn bị. **Nguồn:** [2024/tp-ho-chi-minh/so.md:107](https://github.com/coderunknow/Chuyen-Anh/blob/424de9c23bc0398ca58ef627e2aa4dd5129495e8/De-chuyen-Anh-vao-10/2024/tp-ho-chi-minh/so.md#L107) (dạng trong nguồn: anticipate). | corrected-and-exact-headword-verified |

## Direct Cambridge evidence rechecked in dev5

| ID | Headword | Exact excerpt(s) | URL |
| ---: | --- | --- | --- |
| 1 | adversity | “a difficult or unlucky situation or event” | [https://dictionary.cambridge.org/dictionary/english/adversity](https://dictionary.cambridge.org/dictionary/english/adversity) |
| 153 | esoteric | “very unusual and understood or liked by only a small number of people, especially those with special knowledge” | [https://dictionary.cambridge.org/dictionary/english/esoteric](https://dictionary.cambridge.org/dictionary/english/esoteric) |
| 232 | belie | “to show something to be false, or to hide something such as an emotion” | [https://dictionary.cambridge.org/dictionary/english/belie](https://dictionary.cambridge.org/dictionary/english/belie) |
| 256 | complaisant | “willing to satisfy others by being polite and fitting in with their plans” | [https://dictionary.cambridge.org/dictionary/english/complaisant](https://dictionary.cambridge.org/dictionary/english/complaisant) |
| 271 | corpulent | “fat”<br>“Example: a corpulent gentleman” | [https://dictionary.cambridge.org/dictionary/english/corpulent](https://dictionary.cambridge.org/dictionary/english/corpulent) |
| 274 | cosmopolitan | “containing or having experience of people and things from many different parts of the world”<br>“someone who has experience of many different parts of the world” | [https://dictionary.cambridge.org/dictionary/english/cosmopolitan](https://dictionary.cambridge.org/dictionary/english/cosmopolitan) |
| 281 | credence | “the belief that something is true” | [https://dictionary.cambridge.org/dictionary/english/credence](https://dictionary.cambridge.org/dictionary/english/credence) |
| 283 | culminate | “If an event or series of events culminates in something, it ends with it, having developed until it reaches this point” | [https://dictionary.cambridge.org/dictionary/english/culminate](https://dictionary.cambridge.org/dictionary/english/culminate) |
| 341 | intransigent | “refusing to change your opinions or behaviour” | [https://dictionary.cambridge.org/dictionary/english/intransigent](https://dictionary.cambridge.org/dictionary/english/intransigent) |
| 357 | pedantic | “giving too much attention to formal rules or small details” | [https://dictionary.cambridge.org/dictionary/english/pedantic](https://dictionary.cambridge.org/dictionary/english/pedantic) |
| 459 | check out | “(of information) to seem to be true because it agrees with other information, or to discover whether information agrees with other information and is therefore likely to be true”<br>“Example: Her statement checks out with most of the eyewitness reports.” | [https://dictionary.cambridge.org/dictionary/english/check-out](https://dictionary.cambridge.org/dictionary/english/check-out) |
| 460 | discursive | “involving discussion”<br>“talking about or dealing with subjects that are only slightly connected with the main subject for longer than necessary” | [https://dictionary.cambridge.org/dictionary/english/discursive](https://dictionary.cambridge.org/dictionary/english/discursive) |
| 565 | AI slop | “digital content (= images, video, etc.) of low quality created by artificial intelligence” | [https://dictionary.cambridge.org/us/dictionary/english/ai-slop](https://dictionary.cambridge.org/us/dictionary/english/ai-slop) |
| 582 | strident | “A strident sound is loud, unpleasant, and rough”<br>“expressing or expressed in forceful language that does not try to avoid upsetting other people” | [https://dictionary.cambridge.org/dictionary/english/strident](https://dictionary.cambridge.org/dictionary/english/strident) |
| 584 | streaky bacon | “meat from the back or sides of a pig that consists of stripes of fat and stripes of meat, often eaten fried in thin slices” | [https://dictionary.cambridge.org/dictionary/english/streaky-bacon](https://dictionary.cambridge.org/dictionary/english/streaky-bacon) |
| 591 | public purse | “money from the government” | [https://dictionary.cambridge.org/dictionary/english/public-purse](https://dictionary.cambridge.org/dictionary/english/public-purse) |
| 617 | anticipate | “to imagine or expect that something will happen”<br>“to take action in preparation for something that you think will happen” | [https://dictionary.cambridge.org/dictionary/english/anticipate](https://dictionary.cambridge.org/dictionary/english/anticipate) |
| 913 | virtually | “almost”<br>“using computer technology over the internet, and not involving people physically going somewhere” | [https://dictionary.cambridge.org/dictionary/english/virtually](https://dictionary.cambridge.org/dictionary/english/virtually) |

**Verbatim excerpt note:** excerpts above are copied as separate source fragments. For ID 271, Cambridge's one-word definition `fat` is retained as-is, with its example recorded separately.

## Legacy evidence repair

Five legacy excerpt issues (IDs 1, 281, 283, 341, 913) were corrected after direct Cambridge inspection. ID 448 was reclassified from verified to pending: Cambridge's exact `/menial-task` URL returned a generic dictionary landing page; `/menial` supports the component and contains “menial tasks” as an example, but not a standalone phrase lemma. It is therefore not counted as an exact-headword entry.

## Non-dictionary evidence for pending rows

- **ID 456 — Subjunctive structure (still pending dictionary verification):** Cambridge Grammar Today [suggest](https://dictionary.cambridge.org/grammar/british-grammar/suggest) states “When we suggest an action to someone, we can use a that-clause” and “When suggest is in the past, we can use should in the that-clause”; its example begins “I suggest (that) you leave here around four o’clock.” Cambridge Dictionary [insist](https://dictionary.cambridge.org/dictionary/english/insist) contrasts “Greg still insists (that) he did nothing wrong” with “They insisted that all swear words be deleted from the article.” These are grammar/component examples, not an exact dictionary headword for the grammar pattern.
- **ID 579 — Burning social conscience (still pending exact-phrase verification):** Cambridge Learner’s Dictionary [burning](https://dictionary.cambridge.org/us/dictionary/learner-english/burning) gives “burning ambition/desire, etc” and “a very strong need to do something”; Cambridge Dictionary [social conscience](https://dictionary.cambridge.org/dictionary/english/social-conscience) says “If you have a social conscience, you worry about people who are poor, ill, old, etc. and try to help them.” These support a compositional gloss only; no fixed-idiom or standalone `burning social conscience` headword claim is made.
- **ID 448 — Menial task (still pending exact-phrase verification):** the attempted exact URL [`menial-task`](https://dictionary.cambridge.org/dictionary/english/menial-task) returned a generic dictionary landing page. The component entry [menial](https://dictionary.cambridge.org/dictionary/english/menial) says “Menial work is boring, makes you feel tired, and is given a low social value” and gives the example “New recruits tend to end up with the most menial tasks.” This supports a compositional/example reading, not a standalone phrase headword.

## Method and limitations

- The verified count combines stored dev4 evidence with direct dev5 lookups; carried-forward evidence is labeled rather than presented as newly rechecked.
- Current exact-headword dictionary verification is **145/913**; **768** remain pending. The broader word-family editorial review does not substitute for dictionary verification.
- All 16 target concerns received a disposition, but this does not resolve the 768 dictionary-pending rows.
- Test and pipeline commands: `python scripts/build_vocabulary.py --check`; `python scripts/validate_vocab.py`; `python scripts/embed_vocabulary.py --check`; `python -m unittest discover -s tests -p 'test_*.py'`; `node --test tests/static-app.test.js`.
- Machine-readable entry-level evidence, corrections, dispositions, source parity accounting, and limitations: [`vocabulary-audit-dev5.json`](vocabulary-audit-dev5.json).
