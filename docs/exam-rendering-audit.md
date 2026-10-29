# Exam rendering audit

All 106 stored transcription bodies rendered through the shipped Markdown renderer; not a comparison with official originals.

| Metric | Count |
| --- | ---: |
| records | 106 |
| rendered | 106 |
| questions | 6457 |
| headings | 959 |
| tables | 1151 |
| codeBlocks | 558 |
| escapedMarkdown | 101251 |
| rawUnsafeHtml | 1 |
| unsafeLinks | 0 |
| imagePlaceholders | 0 |
| unclosedFences | 0 |
| malformedTables | 0 |
| controlCharacters | 0 |
| duplicateHeadingLabels | 93 |
| renderingErrors | 0 |
| renderedScriptTags | 0 |
| renderedEventHandlers | 0 |

## Records with flags

| Paper | Questions | Unclosed fence | Raw unsafe HTML | Unsafe links | Malformed table | Renderer error |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| 2022/hai-phong/so | 124 | 0 | 1 | 0 | 0 | 0 |

The audit keeps source anomalies visible instead of rewriting the transcription. All rendered output is escaped except the explicitly supported `<u>` and `<br>` forms.
