# Silk — FamFamFam icon search

A fast, keyboard-driven browser for the 1,010 icons in the [FamFamFam "Silk" set](https://www.famfamfam.com/lab/icons/silk/).

Search by name, keyword or category, inspect a single icon at 1×–8× with a pixel
grid, and copy the name, the CSS class or the raw CSS rule.

Svelte 5 + Vite + TypeScript. No UI framework, no CSS framework.

## Run it

```bash
npm install
npm run dev
```

`npm run dev` regenerates the sprite assets and the catalog first, then starts
Vite on <http://localhost:5178>.

```bash
npm run build       # production build into dist/
npm run preview   # serve the production build
npm run check     # svelte-check
npm test          # node:test unit tests for the search core
```

## Keyboard

| Key          | Action                                        |
| ------------ | --------------------------------------------- |
| `/` · `Ctrl/⌘ K` | focus search                             |
| `Enter`      | copy the top result                          |
| `↑ ↓ ← →`    | move through the grid                        |
| `C`          | copy the selected icon name                  |
| `Esc`        | clear the search, then deselect              |

The search state lives in the URL (`?q=&cat=&icon=`), so results are shareable
and the back button works.

## How search works

`src/lib/core/search.ts` ranks every query token against every icon in a single
pass over the catalog. Per token, in descending order of confidence:

1. exact icon name
2. icon name prefix
3. exact keyword hit
4. keyword prefix
5. name substring
6. keyword substring

Two rules keep the results honest:

- **Only the literal term may match as a substring.** Synonyms match exactly.
  Without this, searching `folder` (which expands to `dir`) lights up every icon
  whose keyword list contains `direction`.
- **Query expansion is one hop.** Icon keyword lists use the full transitive
  synonym closure, but a user query expands exactly once. Otherwise
  `chart → report → document` drags in the entire Files category.

When strict matching returns fewer than 24 hits the search retries with a
bounded Levenshtein pass, and the result badge shows a dot so you know the
matches are approximate. Matched substrings are highlighted in each result.

Measured cost over the full 1,010-icon catalog in a dev build: **2–9 ms** per
query.

## Categories

Every icon name starts with one of 167 prefixes. `scripts/build-catalog.mjs`
maps all of them onto 16 semantic categories (Actions, Navigation, Interface,
Files, Data, People, Comms, Media, Time, Commerce, Security, System,
Transport, Web, Status, Misc), so nothing leaks into a catch-all bucket.

## Scaling

The grid preview size (16 / 24 / 32 / 48 px) and the inspector zoom (1× / 2× /
4× / 8×) both scale the spritesheet proportionally — `--silk-size` drives
`background-size` and `background-position` together, so an icon never bleeds
into a neighbouring cell. At 4× and above the inspector draws a pixel grid so
you can judge a 16×16 icon at real detail, and the scaling mode toggles between
bilinear (`Smooth`) and nearest-neighbour (`Crisp`) resampling.

## Layout

```
vendor/
├─ famfamfam-silk.png          pristine upstream spritesheet (CC BY 2.5)
└─ famfamfam-silk.css          pristine upstream position map
scripts/
├─ build-sprite.mjs            repacks + re-encodes the sheet, writes silk.css
└─ build-catalog.mjs           catalog.json generator (categories + synonyms)
src/
├─ App.svelte                  shell: header, category bar, results, inspector
├─ app.css                     design tokens + base styles
├─ assets/famfamfam/sprite.png generated spritesheet
└─ lib/
   ├─ core/       search ranking, clipboard
   ├─ state/      prefs, catalog, toasts, URL sync (Svelte 5 runes)
   ├─ components/ feature components + a small `ui/` primitive set
   ├─ data/       generated catalog.json
   └─ styles/     generated sprite position map
tests/search.test.mjs
```

Both generated files are checked in so a clean clone builds without running the
scripts; `npm run build:data` refreshes them.

## Sprite

`scripts/build-sprite.mjs` copies each icon out of the upstream sheet and packs
it on a 16px pitch (upstream uses an 18px pitch — a 2px gutter per axis), then
re-encodes with per-scanline filter selection and maximum deflate. Pixel data is
copied verbatim, so the result is byte-for-byte lossless:

```
576x576 RGBA  445.8 KB  ->  512x512 RGBA  273.8 KB   (-39%)
```

Indexed-palette encoding would be smaller still, but the artwork contains ~40,000
distinct RGBA values from anti-aliasing, so any palette reduction would be lossy.

The catalog is intentionally kept outside Svelte's reactive graph. Wrapping
1,010 objects in `$state` proxies every keyword array and made each keystroke
~20× slower (175 ms → 9 ms once moved out).

## Design

The visual language follows [Toolcraft](https://github.com/pixel-point/toolcraft)
(Pixel Point): dark-first oklch tokens, hairline borders mixed with `color-mix`
transparency, 11–13 px control text, 4 px scrollbars, tight radii, Inter.

## License

MIT for the code. The Silk icon artwork is CC BY 2.5 — see [LICENSE](./LICENSE).