# Third-Party Notices & Content Provenance

## 1. Scope of the MIT Software License

The [MIT License](LICENSE) (`© 2026 coderunknow`) applies strictly to the **original software code, UI templates/styles, deterministic scheduler, build/validation/audit scripts, serverless telemetry handler, database schema migrations, test suites, and original project documentation** created in this repository.

The MIT License **does not** claim copyright ownership over, nor re-license, third-party educational reference documents, textbook excerpts, or provincial/university-affiliated high-school entrance examination papers stored or transcribed in this repository for offline study and linguistic analysis.

---

## 2. Exam Transcription Archive (`De-chuyen-Anh-vao-10/` & Embedded `exam-data`)

- **Inventory:** `106` Markdown exam transcriptions (`2022–2026`, specialised-English Grade 10 entrance papers across provincial Departments of Education & Training and specialised high schools), indexed in [`scripts/exams/selection.json`](scripts/exams/selection.json) and audited in [`docs/exam-provenance-audit.json`](docs/exam-provenance-audit.json), [`docs/EXAM_AUDIT_LEDGER.md`](docs/EXAM_AUDIT_LEDGER.md), and [`docs/RC8_EXAM_AUDIT.md`](docs/RC8_EXAM_AUDIT.md).
- **Provenance & Rights:** Original examination questions and passages remain subject to the rights and regulations of their respective issuing educational authorities, authors, and cited publishers. Each Markdown header and runtime detail card records the reposted public URL, conversion quality tier (`PDF-text`, `DOCX`, `HTML/OCR`), and SHA-256 digest of the converted source artifact.
- **Verification Disclaimer:** `0 / 106` papers and `0 / 6,804` extracted question keys in `v1.0.0-rc8` have been verified against sealed primary official PDFs/keys from issuing authorities (`official_verified = 0`). Application scores and provisional keys/rubrics are study aids only and are never official examination scores.

---

## 3. Repository Reference Files Not Bundled in `index.html` or Release ZIPs

The following workspace reference files reside in the Git working tree for local corpus/lexical study only. None of these files are embedded into `index.html` or packaged inside release archives (`chuyen-anh-<tag>.zip`, which contains solely `index.html`, `README.md`, and `LICENSE`):

| Path | Size | SHA-256 | Provenance & Licensing Note |
| --- | ---: | --- | --- |
| `Destination-B2.pdf` | 1.1 MB | `e5213891f8aaec30414a04f5bd2c67956b2e0bf1e9c9abc46aa42ac7032fd08f` | Third-party grammar & vocabulary reference (Malcolm Mann & Steve Taylore-Knowles, Macmillan). Retained untouched per workspace non-deletion policy; **not** covered by `LICENSE` and **not** distributed in release artifacts or Pages deployments. |
| `Tieng_Anh_9_Global_success_95621.pdf` | 4.6 MB | `3c41dec45d3cb49b93cf119ae59ab52a74255e939d53c3600060c93fc8339558` | Third-party Grade 9 curriculum reference PDF (Global Success / NXB Giáo dục Việt Nam). Retained untouched per workspace non-deletion policy; **not** covered by `LICENSE` and **not** distributed in release artifacts or Pages deployments. |
| `De-Tieng-Anh-vao-10-Ha-Noi-2026-2027-ma-de-001-co-dap-an-Word-PDF.zip` | 393 KB | `f46dfcb09f250632cb3bb49653eaada7d6730d5ac52f1df2d0715190e2e6a8af` | Public Hanoi Grade 10 general-English exam reference archive (`Word/PDF`). Retained untouched; **not** covered by `LICENSE` and **not** distributed in release artifacts or Pages deployments. |
| `Luyện đề Anh đại trà/Đáp án chính thức môn Tiếng Anh thi lớp 10 TPHCM 2026.pdf` | — | `44cb15c2dc69898cc5c945f90632ed1286283284793d764917335645b7d6611c` | Public Ho Chi Minh City Grade 10 general-English answer sheet PDF. Retained untouched; **not** covered by `LICENSE`. |
| `Luyện đề Anh đại trà/thi đề TP HCM lần 1 - 6,5-7.txt` | — | `f772e261faf94ef8c7c8c910db1f9d24e22e8cb5d032f07eb5031234dab8f789` | Local learner practice note. Retained untouched. |

---

## 4. Test-Only Open-Source Tooling (Not Bundled at Runtime)

Production (`index.html`) ships **zero** external runtime libraries, fonts, icons, or scripts. During CI and local testing only, the following open-source packages may be installed ephemerally without modifying `index.html`:

- `playwright-core` (`Apache-2.0`, Microsoft Corporation) — headless Chromium, Firefox, and WebKit browser automation in CI.
- `axe-core` (`MPL-2.0`, Deque Systems, Inc.) — automated WCAG accessibility assertions during browser tests.
- `@sparticuz/chromium` (`Apache-2.0`) — optional local Linux sandbox Chromium binary fallback.

---

## 5. Takedown / Attribution Contact

Rightsholders or educational institutions requesting attribution updates, provenance corrections, or removal of specific reference materials may open an issue at <https://github.com/coderunknow/Chuyen-Anh/issues> or contact the repository owner via GitHub.
