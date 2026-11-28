# Chuyên Anh — official brand assets

The emblem was selected from three generated concepts on 2026-11-28 (card-flip
monogram, "Â" glyph, exam-bank roundel — the roundel won). Vector work and all
text are rendered programmatically (hand-authored SVG + DejaVu Sans), so the
Vietnamese diacritics are exact. Note: NO favicon or meta wiring exists in
`index.html` yet — the self-contained-single-file contract (static-app forbids
`<link>`) defers it; see the deferred-wiring note below.

| File | Purpose |
| --- | --- |
| `logo-exam-bank-emblem.png` | Master emblem (1536², generated art) |
| `logo-roundel.png` | 810² square crop of the emblem (center `810x810+363+363`); circular clip is applied by consumers |
| `favicon.svg` | Hand-authored simplified single-card mark — the emblem redrawn for 16–32 px legibility (fanned cards blur into a blob at favicon sizes) |
| `favicon.ico` | 16/32/48 multi-size ICO |
| `favicon-16.png` / `favicon-32.png` | PNG favicons |
| `apple-touch-icon.png` | 180² on the app background `#F5F7FB` |
| `logo-lockup.png` / `logo-lockup-dark.png` | Horizontal lockup, light/dark text (transparent) |
| `social-preview.png` | 1280×640 GitHub social card — a CANDIDATE for `og:image`; not referenced by any tracked HTML (wiring is deferred with the favicons) |

Palette (sampled from the master): violet `#41307A`, deep violet `#37276D`
(dark variant text `#C9BCF2`), arc `#6C5AA6` (dark `#C9BCF2`), emerald
`#1C6F5B` (dark subtitle `#7FD8BD`), mint `#9AD6C4`, card white `#FDFEFD`,
app background `#F5F7FB`.

Deferred wiring: adopting the favicons needs either an inline data-URI in
`index.html` or a deliberate relaxation of the self-contained-single-file test
invariant; until that owner decision, the app ships without tab icons and
without `og:`/`twitter:` meta tags (upload `social-preview.png` via repo
Settings → Social preview for link unfurls in the meantime).

Regeneration: raster sizes come from `favicon.svg` via `resvg-py`
(`svg_to_bytes`) and ImageMagick; the lockups/social card are composed with
ImageMagick using DejaVu Sans (`/usr/share/fonts/truetype/dejavu/`) for exact
diacritics. `logo-exam-bank-emblem.png` is the AI-generated master — keep it
byte-stable; every other asset derives from it or from `favicon.svg`.
