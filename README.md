<div align="center">
  <img src="public/og.png" alt="Silk" width="640" />
</div>

# Silk

A browser for the 1,010 [FamFamFam "Silk"](https://www.famfamfam.com/lab/icons/silk/) icons.
Search them, look at them at 8×, copy the name, the CSS class, the CSS rule or the
PNG itself. Everything runs in the browser — there is no server and no network
traffic.

```
npm install
npm run dev
```

## Keys

| Key | |
| --- | --- |
| `/` or `Ctrl/⌘ K` | focus the search |
| `↑ ↓ ← →` | move through the grid |
| `Enter` | copy the highlighted icon |
| `C` | copy the selected icon |
| `Esc` | close the related strip, then clear the search |

Clicking an icon selects it and opens the related strip at the bottom. Copying
is a separate, explicit step.

## What is in here

- **Search** over the icon names, plus a synonym and category vocabulary.
  Typo tolerant, prefix aware, and it highlights what matched.
- **Categories** — all 167 name prefixes mapped onto 16 semantic ones. The
  chips count the results of the current query, so the bar is a facet filter.
- **A virtualised grid.** Only the rows on screen are in the DOM, so the
  scrollbar thumb stays the same size all the way down.
- **A related strip.** Pick an icon and the strip shows its family, ranked by
  how specific the evidence is.
- **Copy name / Copy class / Copy rule / Copy PNG.**
- **A usage counter.** Every copy is counted per icon name — nothing else, no
  identifier, no IP, no timestamp. The counts stay in `localStorage` and are
  the hook for a future "Popular" category. Set `VITE_USAGE_ENDPOINT` to also
  post them somewhere (fire and forget, no cookies).

## Deploying

The build output is a plain static site in `dist/`.

**Cloudflare Pages** — connect the repository and set:

- build command `npm run build`
- output directory `dist`

`public/_headers` already carries the cache rules: hashed assets are immutable
for a year, the HTML entry point is never cached.

Set `VITE_SITE_URL` (for example `https://silk.example.com`) in the Pages
environment to make the Open Graph image absolute. Without it the tag stays
relative, which most crawlers resolve fine.

**Anywhere else** — `npm run build` and serve `dist/`. Asset paths are
relative, so a sub path works too.

## Commands

```
npm run dev         # dev server on :5178
npm run build       # production build into dist/
npm run check       # svelte-check
npm test            # unit tests
npm run bench       # search latency
npm run probe -- q  # try a query from the terminal
```

## How the search works

`scripts/build-catalog.mjs` compiles the catalog into an index at build time:
an inverted token → icon map, the synonym table, the category words and the
related-icon map. Nothing is tokenised at runtime except the query itself.

At query time each token is scored against the candidate icons in tiers — exact
name, whole-name alias, exact segment, name prefix, segment prefix, alias,
squashed name, subsequence, then a bounded edit distance as a last resort. The
final score is the sum of the token scores times the share of tokens that
matched, so a full match always outranks a partial one.

Roughly 0.15 ms per query over the full set of 1,010 icons.

The icon artwork is repacked onto a 16px grid and re-encoded losslessly, which
takes the spritesheet from 446 KB to 290 KB. `scripts/verify-sprite.mjs`
compares it against the upstream sheet pixel by pixel.

## Credits

Icon artwork by [Mark James](https://www.famfamfam.com/lab/icons/silk/),
CC BY 2.5. Everything else is MIT.

The visual language is inspired by [Toolcraft](https://github.com/pixel-point/toolcraft)
by Pixel Point; the interface icons are [Lucide](https://lucide.dev).
