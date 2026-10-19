# Silk Icons Browser

A lightning-fast, keyboard-driven browser for all 1,010 [FamFamFam "Silk"](https://www.famfamfam.com/lab/icons/silk/) icons.

Instantaneous client-side search across categorized sets, flexible pixel-grid scaling (16px to 48px), and single-keystroke asset copying.  
Built for developers who want clean tools without bloat.

<div align="center">
  <img src="public/og.png" alt="Silk" width="640" />
</div>

[![Deploy to Cloudflare][badge-deploy]][deploy]

**Live:** <https://silk.bzbb.dev> · **Source:** <https://github.com/Be1zebub/silk-icons-browser>

## What is in here

- **Search** over names, synonyms and categories. Typo tolerant, prefix aware,
  highlights what matched. ~0.15 ms per query.
- **Categories** — 167 name prefixes mapped onto 16 semantic ones. The chips
  count the current query, so the bar is a facet filter.
- **A virtualised grid** — only the visible rows are in the DOM, so the
  scrollbar thumb stays the same size all the way down.
- **A related strip** — pick an icon, get its family, ranked by how specific
  the evidence is.
- **Copy name / Copy PNG.**
- **A global popularity counter** — per icon name, no identifier, no IP, no
  timestamp. It comes back as the **Popular** category.

## Deploying

[Deploy to Cloudflare][deploy] clones the repo, builds it and deploys the
Worker. The site and the counter are one Worker: the assets ride along, and
`/api/usage` is a Durable Object that needs no provisioning.

```bash
npm run deploy    # build + wrangler deploy
```

`VITE_SITE_URL` in `.env` is what makes the Open Graph image and the canonical
URL absolute. Change it if you deploy somewhere else.

The counter stores only icon names and counts. `POST /api/usage` adds a delta,
`GET /api/usage` returns the ranking. The client batches its copies, so a
visitor costs one write per batch instead of one per copy.

Anywhere else: `npm run build` and serve `dist/`. Asset paths are relative, so
a sub path works too.

## Commands

```
npm run dev         # dev server on :5178
npm run build       # production build into dist/
npm run deploy      # build + wrangler deploy
npm run dev:worker  # build + wrangler dev
npm run check       # svelte-check
npm test            # unit tests
npm run bench       # search latency
npm run probe -- q  # try a query from the terminal
npm run build:og    # re-render public/og.png
```

`build:og` needs a browser: `npx playwright install chromium`.

## How the search works

`scripts/build-catalog.mjs` compiles the catalog into an index at build time:
an inverted token → icon map, the synonym table, the category words and the
related-icon map. Nothing is tokenised at runtime except the query itself.

At query time each token is scored against the candidate icons in tiers — exact
name, whole-name alias, exact segment, name prefix, segment prefix, alias,
squashed name, subsequence, then a bounded edit distance as a last resort. The
final score is the sum of the token scores times the share of tokens that
matched, so a full match always outranks a partial one.

## Credits

Icon artwork by [Mark James](https://www.famfamfam.com/lab/icons/silk/),
CC BY 2.5. Everything else is MIT.

The visual language is inspired by [Toolcraft](https://github.com/pixel-point/toolcraft)
by Pixel Point.  
The interface icons are [Lucide](https://lucide.dev).

[deploy]: https://deploy.workers.cloudflare.com/?url=https://github.com/Be1zebub/silk-icons-browser
[badge-deploy]: https://img.shields.io/badge/deploy-cloudflare-F38020?logo=cloudflare&logoColor=white
