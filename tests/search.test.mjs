import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { buildCatalog, relatedIcons, searchIcons } from '../src/lib/core/search.ts';

const raw = JSON.parse(readFileSync(new URL('../src/lib/data/catalog.json', import.meta.url), 'utf8'));

const icons = raw.icons.map(({ n, c, p, k }) => ({ name: n, category: c, position: p, keywords: k }));
const { entries } = buildCatalog(icons);

const search = (query, category = 'all') =>
  searchIcons({ query, category, aliases: raw.aliases, entries });

const names = (query, category = 'all') => search(query, category).hits.map((hit) => hit.icon.name);

describe('catalog', () => {
  it('loads the full Silk set', () => {
    assert.equal(entries.length, 1010);
  });

  it('gives every icon a real category', () => {
    const known = new Set(raw.categories.map((category) => category.id));
    for (const icon of icons) {
      assert.ok(known.has(icon.category), `${icon.name} -> ${icon.category}`);
    }
  });

  it('covers every icon with the sprite stylesheet', () => {
    const css = readFileSync(new URL('../src/lib/styles/silk.css', import.meta.url), 'utf8');
    const rules = new Set([...css.matchAll(/^\.silk\.([a-z0-9_]+)\{/gm)].map((match) => match[1]));
    assert.equal(rules.size, entries.length);
  });
});

describe('search', () => {
  it('returns everything for an empty query', () => {
    assert.equal(search('').hits.length, entries.length);
  });

  it('ranks exact names above prefix matches', () => {
    const [first] = names('zoom');
    assert.equal(first, 'zoom');
  });

  it('finds icons through synonyms', () => {
    assert.ok(names('search').includes('magnifier'));
    assert.ok(names('trash').includes('bin'));
    assert.ok(names('gear').includes('cog'));
    assert.ok(names('avatar').includes('user'));
  });

  it('does not let short synonyms match as substrings', () => {
    // "folder" expands to "dir"; without the literal-only substring rule every
    // icon whose keywords contain "direction" would show up.
    assert.deepEqual(names('folder'), names('folder').filter((name) => name.startsWith('folder')));
  });

  it('keeps query expansion to a single hop', () => {
    // "chart" -> report -> document would otherwise pull in the whole Files
    // category, which has nothing to do with charts.
    assert.ok(!names('chart').includes('book'));
  });

  it('requires every query token to match', () => {
    const result = names('folder table');
    assert.ok(result.length > 0);
    for (const name of result) {
      assert.ok(name.includes('folder') && name.includes('table'));
    }
  });

  it('tolerates typos through the fuzzy fallback', () => {
    assert.ok(names('foder').includes('folder'));
  });

  it('flags when the fuzzy fallback ran', () => {
    assert.equal(search('foder').fuzzy, true);
    assert.equal(search('folder').fuzzy, false);
  });

  it('highlights the matched span of the name', () => {
    const [hit] = search('folder').hits;
    assert.deepEqual(hit.ranges, [[0, 6]]);
  });

  it('filters by category', () => {
    const result = search('', 'security');
    assert.ok(result.hits.length > 0);
    for (const hit of result.hits) {
      assert.equal(hit.icon.category, 'security');
    }
  });

  it('combines a category filter with a query', () => {
    const result = names('user', 'people');
    assert.ok(result.includes('user'));
    assert.ok(!result.includes('folder_user'));
  });
});

describe('relatedIcons', () => {
  const byName = new Map(entries.map((entry) => [entry.name, entry]));

  it('prefers the trailing name segment', () => {
    const related = relatedIcons(byName.get('folder_table'), entries).map((entry) => entry.name);
    assert.ok(related.includes('table'));
    assert.ok(related.includes('table_add'));
    assert.ok(!related.includes('folder_add'));
  });

  it('falls back to the leading segment for one-off names', () => {
    const related = relatedIcons(byName.get('application_view_columns'), entries).map((entry) => entry.name);
    assert.ok(related.includes('application'));
  });

  it('never returns the icon itself', () => {
    const related = relatedIcons(byName.get('folder'), entries).map((entry) => entry.name);
    assert.ok(!related.includes('folder'));
  });
});