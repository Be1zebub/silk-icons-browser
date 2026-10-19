# Silk — FamFamFam icon search

A fast, keyboard-driven browser for the 1,010 icons in the [FamFamFam "Silk" set](https://www.famfamfam.com/lab/icons/silk/).

Search by name, keyword or category, then click an icon to select it. The strip
at the bottom of the grid shows the related icons and a copy button.

Svelte 5 + Vite + TypeScript. No UI framework, no CSS framework.

## Run it

```bash
npm install
npm run dev
```

Vite on <http://localhost:5178>. A small Vite plugin (`silkAssets` in
`vite.config.ts`) regenerates the sprite and the search index before the server
or the build starts, so the assets can never go stale. The generators only
write when the output actually changed, which keeps the dev watcher from
looping on its own.

```bash
npm run build       # production build into dist/
npm run preview     # serve the production build
npm run build:data  # regenerate the sprite and the index only
npm run check       # svelte-check
npm test            # node:test unit tests, including the MRR suite
npm run bench       # search latency benchmark
npm run probe -- q  # try a query from the terminal
```

## Keyboard

| Key              | Action                                         |
| ---------------- | ---------------------------------------------- |
| `/` · `Ctrl/⌘ K` | focus search                                  |
| `↑ ↓ ← →`        | move through the grid                         |
| `Enter`          | copy the highlighted icon                     |
| `C`              | copy the selected icon name                   |
| `Esc`            | close the related strip, then clear the search |

Clicking an icon **selects** it, it does not copy it — with a related strip on
screen, "click" is not always "I want to copy this". Copying is an explicit
step: the copy button in the related strip, `Enter`, or `C`.

The related strip has two copy buttons: **Copy name** puts the icon name on
the clipboard, **Copy PNG** puts a 16×16 PNG of the icon itself on the
clipboard, cut straight out of the spritesheet.

Arrow keys move the DOM focus along with the selection, so `Enter` always
acts on the icon you are standing on — not the one you clicked last. The grid
uses a roving tabindex, so `Tab` never walks through 1,010 buttons.

The search state lives in the URL (`?q=&cat=&icon=`), so results are shareable
and the back button works.

## The search engine

### Compiled index

`scripts/build-catalog.mjs` turns the catalog into a query-ready structure at
build time. Nothing is tokenized, matched or normalized at runtime except the
query itself.

```jsonc
{
  "icons":    [{ "n": "accept", "c": 0, "p": [-1, -1] }],  // name, category, sprite position
  "vocab":    ["accept", "add", "anchor", ...],             // 388 distinct name tokens
  "exact":    [[0], [1], [2, 5], ...],                    // token -> icon ids
  "related":  [[1, 2, 3], [4, 5], ...],                   // icon -> related icon ids
  "synonyms": { "search": ["magnifier", "find", "zoom"] },
  "categoryWords": { "person": 5, "people": 5 }
}
```

`exact` is the inverted index: a token lookup is O(1) instead of a scan over
1,010 icons, and the fuzzy pass runs over the 388-token vocabulary rather than
over the icons.

**108 KB** uncompressed, against a 150 KB budget.

### Tiers

Each query token is resolved against every candidate independently, and the best
tier wins.

| Tier            | Score | Meaning                                            |
| --------------- | ----- | -------------------------------------------------- |
| `exactName`     | 1000  | the query *is* the icon name                       |
| `aliasName`     |  950  | the icon's whole name is a synonym of the query    |
| `tokenExact`    |  800  | the query is one of the name segments              |
| `namePrefix`    |  700  | the name starts with the query                     |
| `tokenPrefix`   |  600  | a segment starts with the query                    |
| `aliasExact`    |  500  | the query reaches a segment through a synonym      |
| `compact`       |  380  | the query is inside the squashed name              |
| `fuzzyNameNear` |  320  | one edit from the whole name                       |
| `fuzzyNear`     |  280  | one edit from a segment                            |
| `category`      |  260  | the query names a whole category                   |
| `fuzzyNameFar`  |  230  | two edits from the whole name                      |
| `subsequence`   |  220  | the query is a subsequence of a segment            |
| `fuzzyFar`      |  190  | two edits from a segment                           |

### Scoring

```
coverage = matchedTokens / queryTokens
score    = (Σ tokenScores) × coverage − aliasPenalty
```

A result that matches every token outranks one that matches a subset, but a
partial match is still returned — `folder magnify somethingelse` surfaces the
folder/magnify icons instead of nothing. An icon whose *whole name* equals the
query gets a hard floor so it always wins.

### Typo tolerance

Per token, never a global switch. A token that already matched well does not
also pay for a fuzzy pass; a token that matched nothing gets one.

* Distance is **optimal string alignment** (Levenshtein + transpositions), so
  `usre` is one edit from `user`, not two.
* The limit scales with the word: one edit for words of four characters or
  fewer, two otherwise. `side` and `save` are two edits apart and are different
  words, not a typo.
* Candidates are gated by a length filter before the distance pass, and the
  distance pass uses module level scratch buffers instead of allocating two
  arrays per call.

### Abbreviations

`isTightSubsequence` matches a query inside a name segment, anchored at the
first character and within a tight span, so `appl` finds `application` without
a three letter query matching half the catalog.

### Highlighting

Matches are resolved to name *segments*, not substrings, so the highlight
covers exactly what matched — the whole segment for an exact or alias match,
the matched prefix for a prefix match.

### Related strip

The strip at the bottom of the grid starts with the selected icon itself
(highlighted), then a divider, then the related icons. It is driven by a
precomputed `related` map, and it is **not** alphabetical — the order is
deliberate, by how specific the evidence is:

1. an explicit relation (`accept` → `tick`, `cross`, `cancel`, `stop`)
2. the icons a name segment points at on its own (`folder_add` → the `folder`
   icon and the `add` icon)
3. the family a segment points at, rarest family first (`folder_table` →
   `table_add`, `table_delete`, …)
4. a synonym peer that is an icon name
5. the rest of the category, so the strip is never empty

Steps 1 and 2 exist because a name like `accept` or `gun` has no family of its
own — without them the strip was blank. Within one step the icons are
alphabetical, so the order is stable.

### The grid is virtualised

The result list is windowed: only the rows around the scroll position are in
the DOM (~120 tiles instead of 1,010), and a spacer of the full height keeps
the scrollbar honest. The row pitch is measured from the layout, so the
scrollbar thumb stays the same size the whole way down — the previous
infinite-scroll version grew the content as you moved, which made the thumb
shrink while you scrolled.

To keep the rows uniform (and therefore virtualisable) the name block always
reserves two lines, even for short names.

## Performance

`npm run bench`, 5,000 iterations over a mix of exact, prefix, synonym, typo,
multi-token and empty queries:

```
index        108.0 KB uncompressed, 388 tokens, 1010 icons
cold call    14.0 ms
mean         0.14 ms
p50          0.15 ms
p95          0.25 ms
p99          0.39 ms
```

The cold call is the JIT warming up; `src/lib/core/index-store.ts` runs three
throwaway searches at load so the first keystroke never pays for it.

Before the rewrite the same queries took 2–9 ms.

## Quality

`tests/search.test.mjs` holds 50 queries with the icon a good result set
should surface first — exact names, prefixes, synonyms, typos, multi-token
queries, abbreviations. The suite asserts the exact top-1 hit for every query
and that the **MRR is above 0.9**.

## Deviations from the original design

Four places where the implementation departs from the plan, with the reason:

1. **No trigram index.** The vocabulary is 388 tokens. A trigram filter would
   replace a 388-entry scan (≈5 µs) with a map lookup, but the index itself
   costs ~15 KB and a build step. The inverted index plus a length prefilter
   already reduces the fuzzy pass to ~130 distance computations, so the
   trigrams would buy nothing measurable.
2. **Two extra tiers.** The original ladder had no "exact segment" tier, which
   ranked a prefix match (`layout_content`) above an exact segment match
   (`arrow_left`) for the query `left`. `tokenExact` fixes that. `aliasName`
   exists so `gear` surfaces `cog` rather than `database_gear`.
3. **Subsequence ranks below fuzzy.** A one-edit typo is a better reading of
   the query than a loose subsequence match, so `foder` resolves to `folder`
   through the distance pass rather than the subsequence pass.
4. **Transpositions count as one edit.** Plain Levenshtein scores `usre` → `user`
   as two edits, which is at the edge of the tolerance and loses the ranking to
   `fire`.

## Categories

Every icon name starts with one of 167 prefixes. `scripts/build-catalog.mjs`
maps all of them onto 16 semantic categories (Actions, Navigation, Interface,
Files, Data, People, Comms, Media, Time, Commerce, Security, System,
Transport, Web, Status, Misc), so nothing leaks into a catch-all bucket.

## Scaling

The grid preview size (16 / 24 / 32 / 48 px) scales the spritesheet
proportionally — `--silk-size` drives `background-size` and
`background-position` together, so an icon never bleeds into a neighbouring
cell. Rendering is always `pixelated`: these are 16×16 pixel assets, and
nearest-neighbour keeps the pixels square instead of smearing them.

## Layout

```
vendor/
├─ famfamfam-silk.png          pristine upstream spritesheet (CC BY 2.5)
└─ famfamfam-silk.css          pristine upstream position map
scripts/
├─ build-sprite.mjs            repacks + re-encodes the sheet, writes silk.css
├─ build-catalog.mjs           compiles the search index and the related map
├─ verify-sprite.mjs           pixel compares the sheet against upstream
├─ bench.mjs                   latency benchmark
└─ probe.mjs                   run a query from the terminal
src/
├─ App.svelte                  shell: header, category bar, results, related strip
├─ app.css                     design tokens + base styles
├─ assets/famfamfam/sprite.png generated spritesheet
└─ lib/
   ├─ core/       index-build, index-store, search, clipboard
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
576x576 RGBA  445.8 KB  ->  512x512 RGBA  282.9 KB   (-37%)
```

The upstream `background-position` already points at the first pixel of the
icon (`accept` is `-1px -1px`, so its pixels start at 1, not 0), so the cell is
read from exactly `|position|`. Getting that wrong shifts every icon by a
pixel and clips it — `scripts/verify-sprite.mjs` compares the repacked sheet
against the upstream pixel by pixel, and `tests/sprite.test.mjs` asserts the
result stays at zero mismatches.

Indexed-palette encoding would be smaller still, but the artwork contains ~40,000
distinct RGBA values from anti-aliasing, so any palette reduction would be lossy.

The catalog is intentionally kept outside Svelte's reactive graph. Wrapping
1,010 objects in `$state` proxies every keyword array and made each keystroke
~20× slower (175 ms → 9 ms once moved out).

## Design

The visual language follows [Toolcraft](https://github.com/pixel-point/toolcraft)
(Pixel Point): dark-first oklch tokens, hairline borders mixed with `color-mix`
transparency, 11–13 px control text, 4 px scrollbars, tight radii, Inter. The
interface icons are [Lucide](https://lucide.dev) (`@lucide/svelte`).

## License

MIT for the code. The Silk icon artwork is CC BY 2.5 — see [LICENSE](./LICENSE).