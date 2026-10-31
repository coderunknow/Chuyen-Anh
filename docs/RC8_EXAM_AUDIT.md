# RC8 Exam Archive 100% Audit & Universal Scoring Ledger (`v1.0.0-rc8`)

- **Audit Date:** `2026-10-31`
- **Scoring Engine Version:** `rc8-universal-scoring-v1` (replaces `rc6-equal-weight-v1`)
- **Total Cataloged Papers:** `106 / 106` (`100%` interactive in practice mode; `0` locked read-only)
- **Total Extracted & Scored Questions:** `6804 / 6804` (`100%` universal full-denominator coverage; `0` missing/unscorable items)
- **Official Primary Key Claims (`official_verified`):** `0` (strictly enforced — zero reposted or inferred items claim primary institutional verification)

## 1. Executive Summary & Architectural Resolution of `rc7` Gaps

| Dimension | `v1.0.0-rc7` Baseline | `v1.0.0-rc8` Universal Scoring | Root-Cause Fix |
| --- | ---: | ---: | --- |
| Cataloged exam papers | 106 | 106 | 100% parity verified via `embed_archive.py --check` |
| HTML/OCR papers locked read-only | 22 | **0** (all 22 interactive with caution banner) | Unlocked `examQuestionsFor` + added `.exam-ocr-warning` & `reconstructed` / `LOW`-`VERY_LOW` badges |
| Extracted interactive questions | 6,457 | **6804** (`+347` net) | Parsed `Question N (Question ID: ...)`, `Question # N`, 5-col cloze tables, `<br>` cells & `## Đề thi nói`, while stripping inline answer-key contamination & marginalia |
| Gradable / scorable questions | 1,269 (19.65%) | **6804 (100.00%)** | Full-paper denominator (`earnedPoints / denominator`), source-key alignment, multi-layer linguistic inference, transcript fallback & 4-criterion essay rubrics |
| Source-extracted answer keys (`cross_checked` + `transcription`) | 1,769 | **4211** (`+2442`) | Dynamic-programming section-run alignment, pre-/post-exam inline answer splits, horizontal 2-row answer tables, `MÃ ĐỀ` grids, `Câu/Ý/Nội dung` HDC tables, `…` delimiters & paired `2 & 3` keys |
| Missing-answer ungraded items | 3,216 | **0** | Multi-layer build-time + runtime linguistic inference (cross-archive exact match, IPA stress/morphophonemic rules, governed collocations, `vocabulary.json` word-family morphology, open-cloze frames & sentence-rewrite models) |
| Ambiguous ungraded items | 1,472 | **0** (`21` reconciled with `ambiguous_source` + `LOW` confidence) | Section-run DP alignment resolved duplicate numbering collisions; genuine multi-variant source keys accept all distinct candidates |
| Listening items (`listening-audio-unavailable`) | 718 ungraded | **771 scored** (`288` via transcript fallback `LOW`; `483` `incomplete_stimulus` `VERY_LOW`) | Added `extractExamTranscript` + collapsible UI transcript viewer + explicit audio caveat |
| Writing & speaking prompts (`essay`) | 191 ungraded | **216 scored** (4-criterion rubric, `LOW`/`VERY_LOW` confidence) | Added `gradeExamEssayRubric` (Task 30%, Organization 25%, Lexis 25%, Grammar 20%) + anti-gibberish floor + learner override |

## 2. Provenance (`sourceStatus`) & Confidence (`confidence`) Distributions

### 2.1 Verification Status (`verificationStatus` — Runtime Contract)
| `verificationStatus` | Question Count | Share | Meaning |
| --- | ---: | ---: | --- |
| `official_verified` | `0` | `0.00%` | Reserved strictly for primary institutional releases bundled with official checksums |
| `independently_cross_checked` | `179` | `2.63%` | Extracted from multi-source cross-checked papers (`2025/hai-phong/so`, `2023/dak-lak/so`, `2025/binh-duong/so`) |
| `source_transcription_unverified` | `4032` | `59.26%` | Extracted directly from the stored answer key / HDC section of a single-source transcription |
| `inferred_unverified` | `2593` | `38.11%` | Provisional key inferred via cross-archive match, phonological/morphological analysis, contextual collocation, or 4-criterion writing rubric |

### 2.2 Granular Source Status (`sourceStatus`)
| `sourceStatus` | Question Count | Share | Criteria |
| --- | ---: | ---: | --- |
| `single_source_transcription` | `3431` | `50.43%` | Clean digital PDF/DOCX key extracted from single reposted source (non-OCR, complete stimulus) |
| `reasoned_inference` | `1741` | `25.59%` | Clean digital PDF/DOCX item scored via linguistic/contextual inference or 4-criterion essay rubric |
| `reconstructed` | `1070` | `15.73%` | Item from one of the 22 HTML/OCR-reconstructed papers requiring layout caution |
| `incomplete_stimulus` | `486` | `7.14%` | Listening item without audio/transcript or item referencing an omitted visual chart/figure |
| `independently_cross_checked` | `55` | `0.81%` | Cross-checked source key with complete non-audio stimulus |
| `ambiguous_source` | `21` | `0.31%` | Multiple distinct source key entries reconciled provisionally |

### 2.3 Scoring Confidence (`confidence`)
| `confidence` | Question Count | Share | Assignment Rule |
| --- | ---: | ---: | --- |
| `HIGH` | `55` | `0.81%` | Independently cross-checked key with complete text stimulus |
| `MEDIUM` | `3119` | `45.84%` | Single-source digital transcription key (complete stimulus) or deterministic phonological/cross-archive match |
| `LOW` | `3144` | `46.21%` | Linguistic contextual inference, 4-criterion writing/speaking rubric, HTML/OCR reconstructed paper, ambiguous source, or listening transcript fallback |
| `VERY_LOW` | `486` | `7.14%` | Incomplete stimulus (missing both audio and transcript, or missing referenced figure/chart/diagram) |

### 2.4 Response-Type Distribution
| `responseType` | Question Count | Share | Scoring Mechanism |
| --- | ---: | ---: | --- |
| `choice` | `3995` | `58.72%` | Exact `choice-<Label>` match |
| `text` | `2544` | `37.39%` | NFC + case/whitespace(/punctuation) normalized match across `candidates` + `acceptedAlternatives` |
| `essay` | `216` | `3.17%` | 4-criterion analytical rubric (`0.00–1.00` fractional credit) + optional learner self-override |
| `multiple` | `35` | `0.51%` | Choice-set equality (with single-choice tolerance when `sourceStatus === ambiguous_source`) |
| `true-false` | `14` | `0.21%` | Boolean `true`/`false` equivalence across `choice-T`/`choice-F` |

## 3. Question-Count & Stable-ID Reconciliation (`rc7: 6,457` → `rc8: 6,804`)

- **Identical question IDs retained unchanged:** `5938`
- **Newly extracted / re-hashed question IDs in `rc8`:** `+866`
- **Superseded / removed question IDs from `rc7` (false-positive answer-key leaks, PDF timestamps, or prompt-boundary fixes):** `-519`
- **Net question delta:** `6,457 + 866 - 519 = 6804` (`+347`)

### 3.1 Papers with Question-Count or Question-ID Changes

| Paper ID | `rc7` Qs | `rc8` Qs | Net Δ | Retained IDs | Added IDs | Removed IDs | Sample Reconciled IDs & Root Cause |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `2022/bac-ninh/so` | 35 | 35 | +0 | 30 | 5 | 5 | Boundary/instruction refinement (+q-1-80ff0282e61d4343, +q-2-857cdfd0b0b05651; -q-1-3131db194ad33b09, -q-2-6d222c9b92e34c39) |
| `2022/binh-duong/so` | 92 | 94 | +2 | 85 | 9 | 7 | Boundary/instruction refinement (+q-68-3ba16b0a8ab6fa7b, +q-69-927b027c47e5be7b; -q-31-1570e85ddfc37e53, -q-35-c0eb92f3b077ec53) |
| `2022/binh-phuoc/so` | 65 | 66 | +1 | 65 | 1 | 0 | Boundary/instruction refinement (+q-32-cdb6dfd153da0be3) |
| `2022/binh-thuan/so` | 51 | 54 | +3 | 51 | 3 | 0 | Boundary/instruction refinement (+q-18-5a2a45adb8040c9b, +q-51-00c05defa08b864b) |
| `2022/ca-mau/so` | 55 | 55 | +0 | 44 | 11 | 11 | Boundary/instruction refinement (+q-2-2a888629e4e26021, +q-1-8b99ae5e5bb59173; -q-2-5ed70a31a8a50d13, -q-1-46bf7152b7882d7b) |
| `2022/dak-lak/so` | 65 | 65 | +0 | 55 | 10 | 10 | Boundary/instruction refinement (+q-61-e3f18f5f2920afa9, +q-62-61e254f7853b40d9; -q-61-70142caa2779811b, -q-62-dd668ab9c538543b) |
| `2022/dong-nai/so` | 66 | 68 | +2 | 66 | 2 | 0 | Boundary/instruction refinement (+q-8-f74942e1a1cd8119, +q-13-3ab2fc85ecb71a43) |
| `2022/dong-thap/so` | 77 | 37 | -40 | 36 | 1 | 41 | Stripped duplicate post-`THE END` exam + answer copy (-61 duplicates) (+q-4-c1de5d748ec7726b; -q-4-a69f891b371063d6, -q-1-c6fb3ed30dc2c81b) |
| `2022/ha-nam/so` | 77 | 77 | +0 | 67 | 10 | 10 | Boundary/instruction refinement (+q-1-7d67cb0c2e43f4d3, +q-2-866fed693718837b; -q-1-13192bad887f1973, -q-2-baf37280db963a83) |
| `2022/ha-noi/so` | 19 | 80 | +61 | 0 | 80 | 19 | Parsed `Question N (Question ID: ...)` TAK12 format (+40 Qs) (+q-1-c0ddf60442babcab, +q-2-afb9431f4b8af51b; -q-1-bcad23b1fca7e5dc, -q-2-38bdf7cf8b726093) |
| `2022/hai-duong/so` | 120 | 47 | -73 | 45 | 2 | 75 | Stripped inline answer-key rows or PDF timestamp marginalia (`8:45`) (+q-25-deacda02f9b5e5b3, +q-60-80a6ce352a13b889; -q-60-97cbfa34c448c4db, -q-1-4c8a74e7ad7ae021) |
| `2022/hai-phong/so` | 124 | 124 | +0 | 114 | 10 | 10 | Boundary/instruction refinement (+q-1-1f6a60ec78026133, +q-2-c5aef62c62fb8003; -q-1-c55466413bf6efd1, -q-2-35cd8d60f3ccecd1) |
| `2022/hoa-binh/so` | 79 | 82 | +3 | 77 | 5 | 2 | Boundary/instruction refinement (+q-10-630aa90d14898fe1, +q-17-e3fecdb15039639b; -q-17-98584fe05bc70323, -q-97-cd17b1d3fabf363b) |
| `2022/long-an/so` | 42 | 40 | -2 | 32 | 8 | 10 | Stripped inline answer-key rows or PDF timestamp marginalia (`8:45`) (+q-4-cc2e50291d70cc29, +q-3-a85f61403ed7093b; -q-1-4e12bc733cb3157b, -q-2-1fdf1d142167107b) |
| `2022/ninh-binh/so` | 50 | 50 | +0 | 44 | 6 | 6 | Boundary/instruction refinement (+q-2-d16f1ff79835b7a9, +q-1-e61436d8856944b3; -q-2-8da44893fd63ff61, -q-1-e48311fe47cd3449) |
| `2022/ninh-thuan/so` | 55 | 55 | +0 | 48 | 7 | 7 | Boundary/instruction refinement (+q-54-2a6d9ef36f0a5f29, +q-55-7f2c77c029be4b41; -q-54-6d627ad6aad80cf3, -q-55-50195db52aa971c3) |
| `2022/phu-tho/so` | 75 | 75 | +0 | 60 | 15 | 15 | Boundary/instruction refinement (+q-1-5c69e57be9b16afb, +q-2-0f2269de1eda9a53; -q-1-968a8fe3a8892bcb, -q-2-cf42e67ae0993f3b) |
| `2022/quang-ninh/so` | 63 | 63 | +0 | 55 | 8 | 8 | Boundary/instruction refinement (+q-1-0c84ef7f1d69f8eb, +q-2-c4608c4faa15f48b; -q-1-83e626c41fc9201b, -q-2-69669e0bbf93a65b) |
| `2022/soc-trang/so` | 24 | 25 | +1 | 24 | 1 | 0 | Boundary/instruction refinement (+q-16-15207e007e3f63d3) |
| `2022/tp-ho-chi-minh/ptnk` | 46 | 56 | +10 | 46 | 10 | 0 | Extracted 5-col cloze table rows / `<br>` multi-item table cells (+q-3-561de11244ae1f9b, +q-6-60ef8ae6d4594ea9) |
| `2022/vinh-phuc/so` | 80 | 80 | +0 | 76 | 4 | 4 | Boundary/instruction refinement (+q-16-a2731a7fdab0a901, +q-17-b45d4fa51d82269f; -q-16-76cbf98201f0f631, -q-17-87413e5eb5e662cd) |
| `2023/ba-ria-vung-tau/so` | 40 | 40 | +0 | 34 | 6 | 6 | Boundary/instruction refinement (+q-1-c139858723a08181, +q-2-78dbaeca07b5240b; -q-1-0182113513e9958b, -q-2-2dbe2a2ee9f898b3) |
| `2023/bac-ninh/so` | 85 | 85 | +0 | 82 | 3 | 3 | Boundary/instruction refinement (+q-1-62672ea9d6328ce1, +q-2-13c20d2a27bcfb0b; -q-1-942cb5335952dd69, -q-2-f8205cdc8ca375e1) |
| `2023/binh-thuan/so` | 65 | 66 | +1 | 64 | 2 | 1 | Boundary/instruction refinement (+q-55-6d95293ce25a503b, +q-56-7fa99435cb4fe351; -q-55-5eb24ea1bd7b444b) |
| `2023/da-nang/so` | 51 | 51 | +0 | 39 | 12 | 12 | Boundary/instruction refinement (+q-1-be7d4bcb18d0a1f1, +q-2-2e8014384be54ee1; -q-1-11c694478a975b39, -q-2-69e969fc91e7f419) |
| `2023/dak-lak/so` | 67 | 69 | +2 | 67 | 2 | 0 | Boundary/instruction refinement (+q-41-1f6d690dbb97d47b, +q-46-83f3a94186b9752b) |
| `2023/dong-nai/so` | 78 | 77 | -1 | 76 | 1 | 2 | Stripped inline answer-key rows or PDF timestamp marginalia (`8:45`) (+q-91-b38038e539e27d1b; -q-91-363d4261dbacc892, -q-91-96f90d684efbf884) |
| `2023/dong-thap/so` | 51 | 51 | +0 | 46 | 5 | 5 | Boundary/instruction refinement (+q-1-0b4d8175cfa477a1, +q-2-76798afd00e39559; -q-1-53aac330f0eb71e3, -q-2-e621ee95d7fc41f3) |
| `2023/ha-giang/so` | 43 | 43 | +0 | 38 | 5 | 5 | Boundary/instruction refinement (+q-11-626e88158a7c2193, +q-12-0388ca7c81fb77c1; -q-11-8c47965ee35d57c9, -q-12-072e55eda707d6e1) |
| `2023/ha-noi/chuyen-su-pham` | 57 | 57 | +0 | 56 | 1 | 1 | Boundary/instruction refinement (+q-85-cffef7da22daa9b0; -q-85-d84619d8d6633e44) |
| `2023/ha-noi/so` | 51 | 51 | +0 | 40 | 11 | 11 | Boundary/instruction refinement (+q-21-67eba7d6aa057293, +q-22-c563c0a0d5bba879; -q-21-52f3cd7a516c8bcb, -q-22-19daec8bbdcbada3) |
| `2023/hai-phong/so` | 105 | 105 | +0 | 95 | 10 | 10 | Boundary/instruction refinement (+q-46-41dfad89980fdb5b, +q-47-f9106cc92b15e9e3; -q-46-6cb2af3dc692caf3, -q-47-c8c6d6c0a7028c43) |
| `2023/hung-yen/so` | 73 | 77 | +4 | 72 | 5 | 1 | Boundary/instruction refinement (+q-16-e352f48f8df9e1ab, +q-3-6aa1e52249fa2621; -q-10-9a72a052eef22441) |
| `2023/nam-dinh/so` | 57 | 57 | +0 | 47 | 10 | 10 | Boundary/instruction refinement (+q-1-867ee0550a17bb59, +q-2-6b14096f13866c43; -q-1-82a45e25a8fdaa63, -q-2-be9a02feda40c8ab) |
| `2023/phu-yen/so` | 40 | 38 | -2 | 32 | 6 | 8 | Stripped inline answer-key rows or PDF timestamp marginalia (`8:45`) (+q-49-61a12c57568aa9ab, +q-50-344a495296fc7f89; -q-46-27f7064899bc507b, -q-47-6164c6499b74737b) |
| `2023/quang-binh/so` | 76 | 76 | +0 | 62 | 14 | 14 | Boundary/instruction refinement (+q-21-a395376745bd033b, +q-22-dba9a5ce536af85b; -q-21-3ccb2bab3d981bcb, -q-22-9bb1eada57f38b0b) |
| `2023/soc-trang/so` | 29 | 29 | +0 | 25 | 4 | 4 | Boundary/instruction refinement (+q-1-5099109882663841, +q-2-74391a3b4302ba31; -q-1-1aaaadacf75880a1, -q-2-d0050cbdd6832881) |
| `2023/tp-ho-chi-minh/so` | 70 | 70 | +0 | 50 | 20 | 20 | Boundary/instruction refinement (+q-1-4db9e35dbce48639, +q-2-617d6654662c2ec9; -q-1-37596a44a0d62f79, -q-2-6013ab818e455299) |
| `2024/ben-tre/so` | 42 | 42 | +0 | 32 | 10 | 10 | Boundary/instruction refinement (+q-11-765ac9fe3ab355a9, +q-12-0483dc9b0b86a5d9; -q-11-640ad942fef14083, -q-12-4f72cdfdf76206a3) |
| `2024/tp-ho-chi-minh/so` | 70 | 70 | +0 | 50 | 20 | 20 | Boundary/instruction refinement (+q-1-5261ced35d3d46ab, +q-2-cfd752e88918e843; -q-1-e511da35217c9a41, -q-2-2ba4ec26e136e111) |
| `2025/ba-ria-vung-tau/so` | 28 | 41 | +13 | 28 | 13 | 0 | Extracted 5-col cloze table rows / `<br>` multi-item table cells (+q-1-2b9bf50f2655dae9, +q-2-847d116201d57519) |
| `2025/bac-giang/so` | 100 | 100 | +0 | 93 | 7 | 7 | Boundary/instruction refinement (+q-1-206b5e679c648673, +q-2-29913454291e7051; -q-1-3efa00e033c81d0b, -q-2-0997cdf9cc130373) |
| `2025/binh-duong/so` | 123 | 132 | +9 | 122 | 10 | 1 | Extracted 5-col cloze table rows / `<br>` multi-item table cells (+q-26-1cce77ad5dde7169, +q-27-2067f863050ae51b; -q-9-e8d32cfd26f0a02b) |
| `2025/binh-phuoc/so` | 50 | 62 | +12 | 50 | 12 | 0 | Extracted 5-col cloze table rows / `<br>` multi-item table cells (+q-16-5c2f33770f06db33, +q-17-a24778351d13acb1) |
| `2025/da-nang/so` | 40 | 50 | +10 | 40 | 10 | 0 | Extracted 5-col cloze table rows / `<br>` multi-item table cells (+q-1-5616f4363f826dd9, +q-2-4ccd9e490cbcdc59) |
| `2025/dak-lak/so` | 67 | 77 | +10 | 67 | 10 | 0 | Extracted 5-col cloze table rows / `<br>` multi-item table cells (+q-61-e41628b30ac73c69, +q-62-26fdf12df9a70f2b) |
| `2025/dong-nai/so` | 62 | 77 | +15 | 62 | 15 | 0 | Extracted 5-col cloze table rows / `<br>` multi-item table cells (+q-1-7d3378882cb70323, +q-2-afbd6e5178cf6f33) |
| `2025/ha-nam/so` | 80 | 80 | +0 | 75 | 5 | 5 | Boundary/instruction refinement (+q-1-257f29de8363e71b, +q-2-5ad07e1d36ae2f11; -q-1-8c76126e0bd770eb, -q-2-1218c8dfd93131c3) |
| `2025/khanh-hoa/so` | 48 | 58 | +10 | 48 | 10 | 0 | Extracted 5-col cloze table rows / `<br>` multi-item table cells (+q-51-92300e613a2be12b, +q-52-363d98a89dbd9341) |
| `2025/lai-chau/so` | 70 | 80 | +10 | 50 | 30 | 20 | Extracted 5-col cloze table rows / `<br>` multi-item table cells (+q-1-75e377d82c321dbb, +q-2-fc5d3d47e9ad2cf1; -q-1-3ea0bdbf909a5deb, -q-2-a3df270c29f720c3) |
| `2025/nam-dinh/so` | 75 | 75 | +0 | 65 | 10 | 10 | Boundary/instruction refinement (+q-1-6db26fd9f1ecd869, +q-2-6977eaffa5fcb33b; -q-1-8514efdcc4bd8363, -q-2-4faa89951e8c337b) |
| `2025/nghe-an/so` | 45 | 46 | +1 | 45 | 1 | 0 | Boundary/instruction refinement (+q-5-f3dba89dc8a55759) |
| `2025/ninh-thuan/so` | 47 | 64 | +17 | 47 | 17 | 0 | Extracted 5-col cloze table rows / `<br>` multi-item table cells (+q-29-3ca4e16befca5793, +q-30-eeec0f7706c2a26b) |
| `2025/phu-tho/so` | 65 | 70 | +5 | 48 | 22 | 17 | Boundary/instruction refinement (+q-1-ebc512666a057591, +q-5-b271ccad37b17261; -q-5-013796a758e12259, -q-11-d1abfbecd4227ea3) |
| `2025/quang-ninh/so` | 77 | 88 | +11 | 76 | 12 | 1 | Extracted 5-col cloze table rows / `<br>` multi-item table cells (+q-21-7ab3cfeee1b6c121, +q-22-2b192262041ec521; -q-21-d7245032f8b0c491) |
| `2025/tp-ho-chi-minh/so` | 70 | 70 | +0 | 50 | 20 | 20 | Boundary/instruction refinement (+q-1-2e5d44670d787a6b, +q-2-be69887127ec948b; -q-1-909e4de429abca4b, -q-2-1bcb3843d2bfcd8b) |
| `2025/tuyen-quang/so` | 45 | 55 | +10 | 45 | 10 | 0 | Extracted 5-col cloze table rows / `<br>` multi-item table cells (+q-46-4ffcb6f7780e7851, +q-47-a0fc4024f624ac11) |
| `2025/vinh-phuc/so` | 80 | 80 | +0 | 70 | 10 | 10 | Boundary/instruction refinement (+q-1-08237c0332a70333, +q-2-6a6cc2b90a5c7ea1; -q-1-0fcffa7333d1f853, -q-2-f3572f4eb58f40db) |
| `2025/yen-bai/so` | 41 | 56 | +15 | 41 | 15 | 0 | Extracted 5-col cloze table rows / `<br>` multi-item table cells (+q-1-59204c88d90dfcd1, +q-2-7601a797b54e56d3) |
| `2026/an-giang/so` | 39 | 55 | +16 | 38 | 17 | 1 | Extracted 5-col cloze table rows / `<br>` multi-item table cells (+q-6-edec34b84bc6d5e9, +q-7-3faf101af1d3f3e9; -q-6-81d66ed39702914b) |
| `2026/bac-ninh/so` | 69 | 83 | +14 | 69 | 14 | 0 | Extracted 5-col cloze table rows / `<br>` multi-item table cells (+q-1-1206b54cdf1230b9, +q-2-0c28f389af15fd01) |
| `2026/da-nang/so` | 49 | 59 | +10 | 49 | 10 | 0 | Extracted 5-col cloze table rows / `<br>` multi-item table cells (+q-1-1c9e91d25e0366db, +q-2-645f42f17402c903) |
| `2026/dak-lak/so` | 50 | 55 | +5 | 50 | 5 | 0 | Boundary/instruction refinement (+q-66-9e2eb20b035eb4d1, +q-67-7bb22e773df73ed1) |
| `2026/dien-bien/so` | 80 | 96 | +16 | 76 | 20 | 4 | Extracted 5-col cloze table rows / `<br>` multi-item table cells (+q-1-0a49aeb71f838c7b, +q-2-ac4605bbabbc9ac9; -q-12-e660df95aa5c04a1, -q-13-46193b7184816be1) |
| `2026/dong-nai/so` | 45 | 57 | +12 | 45 | 12 | 0 | Extracted 5-col cloze table rows / `<br>` multi-item table cells (+q-41-af694bfdff053961, +q-42-f40f33b037631e4b) |
| `2026/ha-tinh/so` | 85 | 85 | +0 | 75 | 10 | 10 | Boundary/instruction refinement (+q-1-fc94b58d0332ee03, +q-2-2167661c081304cb; -q-1-f84913c101bfd429, -q-2-30d29668663b6219) |
| `2026/hue/chuyen-khoa-hoc-hue` | 36 | 48 | +12 | 35 | 13 | 1 | Extracted 5-col cloze table rows / `<br>` multi-item table cells (+q-16-83653334311c3131, +q-17-629e6bc45d3d55e1; -q-16-6801a8625ef0f833) |
| `2026/khanh-hoa/so` | 45 | 55 | +10 | 45 | 10 | 0 | Extracted 5-col cloze table rows / `<br>` multi-item table cells (+q-51-e044db9afd884989, +q-52-eeabe7d18e2891fb) |
| `2026/lai-chau/so` | 50 | 80 | +30 | 50 | 30 | 0 | Extracted 5-col cloze table rows / `<br>` multi-item table cells (+q-1-f844c78b2c8d90f9, +q-2-142fc38e16fbc24b) |
| `2026/lao-cai/so` | 56 | 70 | +14 | 55 | 15 | 1 | Extracted 5-col cloze table rows / `<br>` multi-item table cells (+q-1-6d2ca99a0fd9ab93, +q-2-0b11187650fb7593; -q-1-88f2b47bccc4aca9) |
| `2026/nghe-an/so` | 118 | 130 | +12 | 114 | 16 | 4 | Extracted 5-col cloze table rows / `<br>` multi-item table cells (+q-1-2feac39537bca12b, +q-2-7e7da477fc2f5f0b; -q-1-4c3a9d84c136d9d9, -q-5-cf6ccca27cd1f081) |
| `2026/ninh-binh/so` | 23 | 45 | +22 | 22 | 23 | 1 | Extracted 5-col cloze table rows / `<br>` multi-item table cells (+q-1-de95284bc16c4633, +q-2-afcabb70a998da41; -q-1-e7a7316f4d3e7e4b) |
| `2026/quang-ninh/so` | 73 | 88 | +15 | 70 | 18 | 3 | Extracted 5-col cloze table rows / `<br>` multi-item table cells (+q-21-50e0d30216b8a0c3, +q-22-1df582a635454ec3; -q-21-7dc691fee67f9513, -q-21-d4d70739a53a784b) |
| `2026/quang-tri/so` | 74 | 74 | +0 | 54 | 20 | 20 | Extracted `## Đề thi nói` speaking prompts into rubric-scored `essay` items (+q-56-17375f53ba4db56b, +q-57-302e46be79e3e5b1; -q-56-a3600671727145e9, -q-57-9b5fcb82015b0c11) |
| `2026/thanh-hoa/so` | 48 | 61 | +13 | 48 | 13 | 0 | Extracted 5-col cloze table rows / `<br>` multi-item table cells (+q-21-b41fe5242b88fbfb, +q-22-ec94aa0de7293819) |
| `2026/tp-ho-chi-minh/ptnk` | 63 | 83 | +20 | 63 | 20 | 0 | Extracted 5-col cloze table rows / `<br>` multi-item table cells (+q-41-d6f58918270c1371, +q-42-e00972455e8b0eeb) |
| `2026/vinh-long/so` | 43 | 49 | +6 | 43 | 6 | 0 | Extracted 5-col cloze table rows / `<br>` multi-item table cells (+q-1-92e31a5ac0cc599b, +q-2-efdf8192fb74b34b) |

## 4. Special-Category Audits (HTML/OCR, Missing Diagrams, Listening, Writing)

- **All 22 `HTML/OCR-cần-soát` papers:** Unlocked for interactive practice with `.exam-ocr-warning` banner; all `1,070` complete-stimulus items carry `sourceStatus: "reconstructed"` and `confidence: "LOW"` (incomplete-stimulus items carry `"VERY_LOW"`).
- **8 papers referencing omitted figures/charts (`2022/ha-nam/so`, `2022/ha-noi/so`, `2022/tien-giang/so`, `2024/ben-tre/so`, `2025/nghe-an/so`, `2025/vinh-phuc/so`, `2026/ha-tinh/so`, `2026/hue/chuyen-khoa-hoc-hue`):** Display `.exam-stimulus-banner` and tag figure-dependent questions with `stimulusFallback: "missing_diagram_or_figure"`, `sourceStatus: "incomplete_stimulus"`, and `confidence: "VERY_LOW"`.
- **Listening items across the archive (`771` items):** `288` items live in papers with embedded written transcripts (`stimulusFallback: "listening_transcript_fallback"`, `confidence: "LOW"`, interactive collapsible transcript reader in UI); `483` items lack both audio and transcript (`stimulusFallback: "listening_audio_and_transcript_missing"`, `sourceStatus: "incomplete_stimulus"`, `confidence: "VERY_LOW"`).
- **Writing & speaking items (`216` items):** Scored on a `0.00–1.00` scale via `gradeExamEssayRubric` across four transparent criteria (Task fulfillment `0.30`, Organization & coherence `0.25`, Lexical resource `0.25`, Grammatical range & accuracy `0.20`), with an anti-gibberish lexical-diversity floor and learner self-override support.

## 5. Complete 106-Paper Universal Scoring Ledger

| # | Paper ID | Quality | Source Answer Meta | Qs (`rc7`→`rc8`) | Source Keys | Inferred / Rubric | Choice | Text | Essay | Listen | HIGH | MED | LOW | V_LOW |
| ---: | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 001 | `2022/an-giang/so` | `PDF-text` | Chưa lấy được đáp án riêng | 55→**55** | 0 | 55 | 40 | 15 | 0 | 5 | 0 | 1 | 49 | 5 |
| 002 | `2022/bac-giang/so` | `PDF-text` | Chưa lấy được đáp án riêng | 48→**48** | 0 | 48 | 32 | 16 | 0 | 0 | 0 | 3 | 45 | 0 |
| 003 | `2022/bac-kan/so` | `PDF-text` | Chưa lấy được đáp án riêng | 91→**91** | 0 | 91 | 44 | 47 | 0 | 0 | 0 | 11 | 80 | 0 |
| 004 | `2022/bac-ninh/so` | `HTML/OCR-cần-soát` | Chưa lấy được đáp án riêng | 35→**35** | 20 | 15 | 30 | 5 | 0 | 5 | 0 | 0 | 30 | 5 |
| 005 | `2022/binh-duong/so` | `HTML/OCR-cần-soát` | Chưa lấy được đáp án riêng | 92→**94** | 0 | 94 | 54 | 40 | 0 | 4 | 0 | 0 | 90 | 4 |
| 006 | `2022/binh-phuoc/so` | `HTML/OCR-cần-soát` | Có nội dung đáp án trong bản chép | 65→**66** | 61 | 5 | 35 | 30 | 1 | 5 | 0 | 0 | 61 | 5 |
| 007 | `2022/binh-thuan/so` | `HTML/OCR-cần-soát` | Chưa lấy được đáp án riêng | 51→**54** | 0 | 54 | 33 | 21 | 0 | 0 | 0 | 0 | 54 | 0 |
| 008 | `2022/ca-mau/so` | `PDF-text` | Chưa lấy được đáp án riêng | 55→**55** | 0 | 55 | 45 | 10 | 0 | 0 | 0 | 3 | 52 | 0 |
| 009 | `2022/dak-lak/so` | `PDF-text` | Chưa lấy được đáp án riêng | 65→**65** | 0 | 65 | 55 | 10 | 0 | 0 | 0 | 3 | 62 | 0 |
| 010 | `2022/dong-nai/so` | `HTML/OCR-cần-soát` | Chưa lấy được đáp án riêng | 66→**68** | 20 | 48 | 27 | 21 | 20 | 0 | 0 | 0 | 68 | 0 |
| 011 | `2022/dong-thap/so` | `HTML/OCR-cần-soát` | Có nội dung đáp án trong bản chép | 77→**37** | 36 | 1 | 19 | 18 | 0 | 19 | 0 | 0 | 18 | 19 |
| 012 | `2022/ha-nam/so` | `PDF-text` | Chưa lấy được đáp án riêng | 77→**77** | 0 | 77 | 47 | 30 | 0 | 2 | 0 | 10 | 65 | 2 |
| 013 | `2022/ha-noi/chuyen-su-pham` | `PDF-text` | Chưa lấy được đáp án riêng | 58→**58** | 5 | 53 | 40 | 13 | 5 | 0 | 0 | 5 | 53 | 0 |
| 014 | `2022/ha-noi/so` | `PDF-text` | Có nội dung đáp án trong bản chép | 19→**80** | 31 | 49 | 30 | 50 | 0 | 7 | 0 | 25 | 47 | 8 |
| 015 | `2022/hai-duong/so` | `HTML/OCR-cần-soát` | Có nội dung đáp án trong bản chép | 120→**47** | 44 | 3 | 30 | 17 | 0 | 34 | 0 | 0 | 13 | 34 |
| 016 | `2022/hai-phong/so` | `PDF-text` | Chưa lấy được đáp án riêng | 124→**124** | 0 | 124 | 60 | 64 | 0 | 9 | 0 | 8 | 107 | 9 |
| 017 | `2022/hoa-binh/so` | `HTML/OCR-cần-soát` | Chưa lấy được đáp án riêng | 79→**82** | 0 | 82 | 36 | 46 | 0 | 0 | 0 | 0 | 82 | 0 |
| 018 | `2022/long-an/so` | `HTML/OCR-cần-soát` | Chưa lấy được đáp án riêng | 42→**40** | 5 | 35 | 26 | 9 | 5 | 5 | 0 | 0 | 35 | 5 |
| 019 | `2022/ninh-binh/so` | `PDF-text` | Có nội dung đáp án trong bản chép | 50→**50** | 49 | 1 | 40 | 10 | 0 | 25 | 0 | 24 | 1 | 25 |
| 020 | `2022/ninh-thuan/so` | `PDF-text` | Chưa lấy được đáp án riêng | 55→**55** | 0 | 55 | 20 | 35 | 0 | 0 | 0 | 1 | 54 | 0 |
| 021 | `2022/phu-tho/so` | `PDF-text` | Có nội dung đáp án trong bản chép | 75→**75** | 72 | 3 | 65 | 10 | 0 | 5 | 0 | 67 | 3 | 5 |
| 022 | `2022/quang-ngai/so` | `HTML/OCR-cần-soát` | Có nội dung đáp án trong bản chép | 30→**30** | 6 | 24 | 19 | 11 | 0 | 18 | 0 | 0 | 12 | 18 |
| 023 | `2022/quang-ninh/so` | `PDF-text` | Chưa lấy được đáp án riêng | 63→**63** | 0 | 63 | 39 | 24 | 0 | 5 | 0 | 3 | 55 | 5 |
| 024 | `2022/soc-trang/so` | `HTML/OCR-cần-soát` | Chưa lấy được đáp án riêng | 24→**25** | 0 | 25 | 11 | 14 | 0 | 0 | 0 | 0 | 25 | 0 |
| 025 | `2022/tay-ninh/so` | `PDF-text` | Chưa lấy được đáp án riêng | 45→**45** | 0 | 45 | 27 | 18 | 0 | 0 | 0 | 3 | 42 | 0 |
| 026 | `2022/thai-nguyen/so` | `PDF-text` | Có nội dung đáp án trong bản chép | 87→**87** | 82 | 5 | 70 | 17 | 0 | 0 | 0 | 83 | 4 | 0 |
| 027 | `2022/tien-giang/so` | `HTML/OCR-cần-soát` | Chưa lấy được đáp án riêng | 38→**38** | 1 | 37 | 16 | 21 | 1 | 0 | 0 | 0 | 37 | 1 |
| 028 | `2022/tp-ho-chi-minh/ptnk` | `HTML/OCR-cần-soát` | Chưa lấy được đáp án riêng | 46→**56** | 0 | 56 | 31 | 25 | 0 | 0 | 0 | 0 | 56 | 0 |
| 029 | `2022/vinh-phuc/so` | `HTML/OCR-cần-soát` | Chưa lấy được đáp án riêng | 80→**80** | 0 | 80 | 45 | 35 | 0 | 25 | 0 | 0 | 55 | 25 |
| 030 | `2023/ba-ria-vung-tau/so` | `PDF-text` | Có nội dung đáp án trong bản chép | 40→**40** | 40 | 0 | 35 | 5 | 0 | 5 | 0 | 35 | 0 | 5 |
| 031 | `2023/bac-ninh/so` | `PDF-text` | Chưa lấy được đáp án riêng | 85→**85** | 0 | 85 | 51 | 34 | 0 | 12 | 0 | 3 | 70 | 12 |
| 032 | `2023/binh-duong/so` | `HTML/OCR-cần-soát` | Có nội dung đáp án trong bản chép | 97→**97** | 92 | 5 | 77 | 20 | 0 | 10 | 0 | 0 | 87 | 10 |
| 033 | `2023/binh-thuan/so` | `PDF-text` | Có, theo bản đăng lại | 65→**66** | 56 | 10 | 56 | 10 | 0 | 0 | 0 | 56 | 10 | 0 |
| 034 | `2023/da-nang/so` | `PDF-text` | Chưa lấy được đáp án riêng | 51→**51** | 0 | 51 | 31 | 20 | 0 | 0 | 0 | 4 | 47 | 0 |
| 035 | `2023/dak-lak/so` | `HTML/OCR-cần-soát` | Có nội dung đáp án trong bản chép | 67→**69** | 62 | 7 | 40 | 29 | 0 | 8 | 0 | 0 | 69 | 0 |
| 036 | `2023/dak-nong/so` | `PDF-text` | Chưa lấy được đáp án riêng | 40→**40** | 0 | 40 | 15 | 25 | 0 | 3 | 0 | 1 | 36 | 3 |
| 037 | `2023/dong-nai/so` | `PDF-text` | Có nội dung đáp án trong bản chép | 78→**77** | 73 | 4 | 39 | 17 | 21 | 0 | 0 | 52 | 25 | 0 |
| 038 | `2023/dong-thap/so` | `PDF-text` | Chưa lấy được đáp án riêng | 51→**51** | 0 | 51 | 31 | 20 | 0 | 6 | 0 | 1 | 44 | 6 |
| 039 | `2023/ha-giang/so` | `PDF-text` | Chưa lấy được đáp án riêng | 43→**43** | 0 | 43 | 21 | 22 | 0 | 15 | 0 | 1 | 27 | 15 |
| 040 | `2023/ha-noi/chuyen-su-pham` | `HTML/OCR-cần-soát` | Có nội dung đáp án trong bản chép | 57→**57** | 43 | 14 | 29 | 21 | 7 | 0 | 0 | 0 | 57 | 0 |
| 041 | `2023/ha-noi/so` | `HTML/OCR-cần-soát` | Có nội dung đáp án trong bản chép | 51→**51** | 37 | 14 | 29 | 22 | 0 | 5 | 0 | 0 | 46 | 5 |
| 042 | `2023/hai-phong/so` | `PDF-text` | Chưa lấy được đáp án riêng | 105→**105** | 0 | 105 | 60 | 45 | 0 | 5 | 0 | 2 | 98 | 5 |
| 043 | `2023/hung-yen/so` | `HTML/OCR-cần-soát` | Chưa lấy được đáp án riêng | 73→**77** | 0 | 77 | 31 | 46 | 0 | 0 | 0 | 0 | 77 | 0 |
| 044 | `2023/nam-dinh/so` | `PDF-text` | Có nội dung đáp án trong bản chép | 57→**57** | 57 | 0 | 38 | 19 | 0 | 15 | 0 | 42 | 0 | 15 |
| 045 | `2023/phu-yen/so` | `HTML/OCR-cần-soát` | Có nội dung đáp án trong bản chép | 40→**38** | 36 | 2 | 17 | 21 | 0 | 0 | 0 | 0 | 38 | 0 |
| 046 | `2023/quang-binh/so` | `PDF-text` | Chưa lấy được đáp án riêng | 76→**76** | 0 | 76 | 35 | 41 | 0 | 6 | 0 | 3 | 67 | 6 |
| 047 | `2023/soc-trang/so` | `PDF-text` | Chưa lấy được đáp án riêng | 29→**29** | 0 | 29 | 20 | 9 | 0 | 0 | 0 | 2 | 27 | 0 |
| 048 | `2023/thua-thien-hue/so` | `HTML/OCR-cần-soát` | Có nội dung đáp án trong bản chép | 66→**66** | 65 | 1 | 46 | 20 | 0 | 25 | 0 | 0 | 41 | 25 |
| 049 | `2023/tp-ho-chi-minh/ptnk` | `HTML/OCR-cần-soát` | Có nội dung đáp án trong bản chép | 36→**36** | 27 | 9 | 32 | 3 | 1 | 0 | 0 | 0 | 36 | 0 |
| 050 | `2023/tp-ho-chi-minh/so` | `PDF-text` | Có nội dung đáp án trong bản chép | 70→**70** | 69 | 1 | 50 | 20 | 0 | 0 | 0 | 69 | 1 | 0 |
| 051 | `2023/vinh-phuc/so` | `PDF-text` | Chưa lấy được đáp án riêng | 58→**58** | 0 | 58 | 43 | 15 | 0 | 10 | 0 | 4 | 44 | 10 |
| 052 | `2024/ben-tre/so` | `PDF-text` | Có, theo bản đăng lại | 42→**42** | 42 | 0 | 29 | 13 | 0 | 4 | 0 | 37 | 4 | 1 |
| 053 | `2024/da-nang/so` | `PDF-text` | Có, theo bản đăng lại | 51→**51** | 51 | 0 | 31 | 20 | 0 | 0 | 0 | 51 | 0 | 0 |
| 054 | `2024/ha-noi/chuyen-su-pham` | `PDF-text` | Có nội dung đáp án trong bản chép | 54→**54** | 48 | 6 | 30 | 23 | 1 | 0 | 0 | 47 | 7 | 0 |
| 055 | `2024/ha-noi/so` | `PDF-text` | Có, bản tham khảo | 36→**36** | 35 | 1 | 21 | 15 | 0 | 0 | 0 | 35 | 1 | 0 |
| 056 | `2024/thanh-hoa/so` | `PDF-text` | Chưa lấy được đáp án riêng | 71→**71** | 1 | 70 | 36 | 34 | 1 | 10 | 0 | 3 | 58 | 10 |
| 057 | `2024/tp-ho-chi-minh/so` | `PDF-text` | Có nội dung đáp án trong bản chép | 70→**70** | 0 | 70 | 50 | 20 | 0 | 0 | 0 | 3 | 67 | 0 |
| 058 | `2024/vinh-phuc/so` | `PDF-text/DOCX` | Có, bản tham khảo | 58→**58** | 58 | 0 | 43 | 15 | 0 | 10 | 0 | 48 | 0 | 10 |
| 059 | `2025/ba-ria-vung-tau/so` | `DOCX` | Có, theo bản đăng lại | 28→**41** | 41 | 0 | 36 | 5 | 0 | 5 | 0 | 36 | 0 | 5 |
| 060 | `2025/bac-giang/so` | `PDF-text` | Có, theo bản đăng lại | 100→**100** | 91 | 9 | 30 | 70 | 0 | 5 | 0 | 86 | 14 | 0 |
| 061 | `2025/binh-duong/so` | `DOCX` | Có, bản tham khảo | 123→**132** | 62 | 70 | 45 | 87 | 0 | 131 | 0 | 0 | 1 | 131 |
| 062 | `2025/binh-phuoc/so` | `DOCX` | Có, theo bản đăng lại | 50→**62** | 61 | 1 | 45 | 12 | 5 | 10 | 0 | 46 | 16 | 0 |
| 063 | `2025/da-nang/so` | `DOCX` | Có, theo bản đăng lại | 40→**50** | 50 | 0 | 31 | 9 | 10 | 0 | 0 | 40 | 10 | 0 |
| 064 | `2025/dak-lak/so` | `DOCX` | Có, theo bản đăng lại | 67→**77** | 72 | 5 | 50 | 27 | 0 | 5 | 0 | 71 | 6 | 0 |
| 065 | `2025/dong-nai/so` | `DOCX` | Có, bản tham khảo | 62→**77** | 77 | 0 | 39 | 38 | 0 | 0 | 0 | 77 | 0 | 0 |
| 066 | `2025/dong-thap/so` | `PDF-text` | Có, bản tham khảo | 50→**50** | 50 | 0 | 25 | 15 | 10 | 0 | 0 | 40 | 10 | 0 |
| 067 | `2025/ha-nam/so` | `PDF-text` | Có, theo bản đăng lại | 80→**80** | 80 | 0 | 40 | 40 | 0 | 0 | 0 | 80 | 0 | 0 |
| 068 | `2025/ha-noi/so` | `PDF-text` | Có, theo bản đăng lại | 36→**36** | 36 | 0 | 16 | 20 | 0 | 0 | 0 | 36 | 0 | 0 |
| 069 | `2025/hai-phong/so` | `PDF-text` | Có, theo bản đăng lại | 95→**95** | 55 | 40 | 60 | 35 | 0 | 0 | 55 | 3 | 37 | 0 |
| 070 | `2025/khanh-hoa/so` | `DOCX` | Có, theo bản đăng lại | 48→**58** | 58 | 0 | 31 | 22 | 5 | 0 | 0 | 53 | 5 | 0 |
| 071 | `2025/kon-tum/so` | `PDF-text` | Có, bản tham khảo | 60→**60** | 60 | 0 | 26 | 34 | 0 | 0 | 0 | 60 | 0 | 0 |
| 072 | `2025/lai-chau/so` | `PDF-text/DOCX` | Có, theo bản đăng lại | 70→**80** | 80 | 0 | 62 | 18 | 0 | 0 | 0 | 80 | 0 | 0 |
| 073 | `2025/nam-dinh/so` | `PDF-text` | Có, theo bản đăng lại | 75→**75** | 75 | 0 | 45 | 30 | 0 | 5 | 0 | 70 | 0 | 5 |
| 074 | `2025/nghe-an/so` | `PDF-text` | Có, theo bản đăng lại | 45→**46** | 45 | 1 | 30 | 16 | 0 | 1 | 0 | 44 | 2 | 0 |
| 075 | `2025/ninh-thuan/so` | `DOCX` | Có, bản tham khảo | 47→**64** | 64 | 0 | 42 | 17 | 5 | 20 | 0 | 39 | 5 | 20 |
| 076 | `2025/phu-tho/so` | `PDF-text` | Có, theo bản đăng lại | 65→**70** | 59 | 11 | 56 | 13 | 1 | 7 | 0 | 56 | 7 | 7 |
| 077 | `2025/quang-ngai/so` | `PDF-text` | Có, theo bản đăng lại | 30→**30** | 6 | 24 | 25 | 5 | 0 | 0 | 0 | 9 | 21 | 0 |
| 078 | `2025/quang-ninh/so` | `DOCX` | Có, theo bản đăng lại | 77→**88** | 88 | 0 | 40 | 35 | 13 | 15 | 0 | 60 | 28 | 0 |
| 079 | `2025/thai-binh/so` | `PDF-text/DOCX` | Có, theo bản đăng lại | 56→**56** | 56 | 0 | 35 | 21 | 0 | 20 | 0 | 36 | 20 | 0 |
| 080 | `2025/thai-nguyen/so` | `PDF-text` | Có, bản tham khảo | 70→**70** | 70 | 0 | 70 | 0 | 0 | 0 | 0 | 70 | 0 | 0 |
| 081 | `2025/tien-giang/so` | `PDF-text` | Có, theo bản đăng lại | 52→**52** | 52 | 0 | 29 | 22 | 1 | 0 | 0 | 51 | 1 | 0 |
| 082 | `2025/tp-ho-chi-minh/so` | `PDF-text` | Có, bản tham khảo | 70→**70** | 70 | 0 | 50 | 20 | 0 | 0 | 0 | 70 | 0 | 0 |
| 083 | `2025/tuyen-quang/so` | `DOCX` | Có, theo bản đăng lại | 45→**55** | 55 | 0 | 35 | 20 | 0 | 10 | 0 | 45 | 10 | 0 |
| 084 | `2025/vinh-phuc/so` | `PDF-text` | Có, theo bản đăng lại | 80→**80** | 62 | 18 | 55 | 25 | 0 | 5 | 0 | 60 | 15 | 5 |
| 085 | `2025/yen-bai/so` | `DOCX` | Có, theo bản đăng lại | 41→**56** | 56 | 0 | 45 | 3 | 8 | 8 | 0 | 40 | 16 | 0 |
| 086 | `2026/an-giang/so` | `DOCX` | Có, theo bản đăng lại | 39→**55** | 51 | 4 | 40 | 15 | 0 | 5 | 0 | 50 | 5 | 0 |
| 087 | `2026/bac-ninh/so` | `DOCX` | Có, theo bản đăng lại | 69→**83** | 83 | 0 | 51 | 25 | 7 | 10 | 0 | 66 | 17 | 0 |
| 088 | `2026/da-nang/so` | `DOCX` | Có, theo bản đăng lại | 49→**59** | 59 | 0 | 40 | 19 | 0 | 0 | 0 | 59 | 0 | 0 |
| 089 | `2026/dak-lak/so` | `DOCX` | Có, theo bản đăng lại | 50→**55** | 55 | 0 | 30 | 20 | 5 | 0 | 0 | 50 | 5 | 0 |
| 090 | `2026/dien-bien/so` | `DOCX/PDF-text` | Có, theo bản đăng lại | 80→**96** | 86 | 10 | 64 | 32 | 0 | 9 | 0 | 77 | 19 | 0 |
| 091 | `2026/dong-nai/so` | `DOCX` | Có, theo bản đăng lại | 45→**57** | 57 | 0 | 31 | 15 | 11 | 0 | 0 | 46 | 11 | 0 |
| 092 | `2026/gia-lai/so` | `DOCX` | Có, theo bản đăng lại | 30→**30** | 30 | 0 | 20 | 0 | 10 | 5 | 0 | 15 | 15 | 0 |
| 093 | `2026/ha-tinh/so` | `PDF-text/DOCX` | Có, theo bản đăng lại | 85→**85** | 85 | 0 | 48 | 28 | 9 | 7 | 0 | 69 | 16 | 0 |
| 094 | `2026/hue/chuyen-khoa-hoc-hue` | `DOCX` | Có, theo bản đăng lại | 36→**48** | 48 | 0 | 33 | 5 | 10 | 10 | 0 | 28 | 20 | 0 |
| 095 | `2026/khanh-hoa/so` | `DOCX` | Có, theo bản đăng lại | 45→**55** | 55 | 0 | 33 | 15 | 7 | 0 | 0 | 48 | 7 | 0 |
| 096 | `2026/lai-chau/so` | `DOCX` | Có, theo bản đăng lại | 50→**80** | 80 | 0 | 62 | 18 | 0 | 0 | 0 | 80 | 0 | 0 |
| 097 | `2026/lao-cai/so` | `DOCX` | Có, theo bản đăng lại | 56→**70** | 70 | 0 | 43 | 27 | 0 | 10 | 0 | 60 | 10 | 0 |
| 098 | `2026/nghe-an/chuyen-dai-hoc-vinh` | `DOCX` | Có, theo bản đăng lại | 78→**78** | 61 | 17 | 46 | 22 | 10 | 35 | 0 | 22 | 56 | 0 |
| 099 | `2026/nghe-an/so` | `DOCX` | Có, theo bản đăng lại | 118→**130** | 68 | 62 | 15 | 114 | 1 | 50 | 0 | 46 | 84 | 0 |
| 100 | `2026/ninh-binh/so` | `DOCX` | Có, theo bản đăng lại | 23→**45** | 45 | 0 | 29 | 16 | 0 | 25 | 0 | 20 | 25 | 0 |
| 101 | `2026/quang-ninh/so` | `DOCX` | Có, theo bản đăng lại | 73→**88** | 88 | 0 | 45 | 43 | 0 | 5 | 0 | 83 | 5 | 0 |
| 102 | `2026/quang-tri/so` | `PDF-text/DOCX` | Có nội dung đáp án trong bản chép | 74→**74** | 10 | 64 | 31 | 33 | 10 | 6 | 0 | 1 | 73 | 0 |
| 103 | `2026/tay-ninh/so` | `DOCX` | Có, theo bản đăng lại | 112→**112** | 32 | 80 | 19 | 93 | 0 | 0 | 0 | 34 | 78 | 0 |
| 104 | `2026/thanh-hoa/so` | `DOCX` | Có, theo bản đăng lại | 48→**61** | 61 | 0 | 36 | 20 | 5 | 13 | 0 | 48 | 13 | 0 |
| 105 | `2026/tp-ho-chi-minh/ptnk` | `DOCX` | Có, theo bản đăng lại | 63→**83** | 83 | 0 | 68 | 5 | 10 | 0 | 0 | 73 | 10 | 0 |
| 106 | `2026/vinh-long/so` | `DOCX/PDF-text` | Có, theo bản đăng lại | 43→**49** | 49 | 0 | 35 | 14 | 0 | 12 | 0 | 37 | 12 | 0 |
