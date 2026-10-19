import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { describe, it } from 'node:test';

import { buildIndex } from '../src/lib/core/index-build.ts';
import { relatedIcons, searchIcons } from '../src/lib/core/search.ts';

const catalogPath = new URL('../src/lib/data/catalog.json', import.meta.url);
const raw = JSON.parse(readFileSync(catalogPath, 'utf8'));
const index = buildIndex(raw);

const search = (query, category = 'all') => searchIcons({ query, category, index });
const names = (query, category = 'all') => search(query, category).hits.map((hit) => hit.icon.name);

/**
 * 50 queries with the icon a good result set should surface first. Covers
 * exact names, prefixes, synonyms, typos, multi-token queries, abbreviations
 * and squashed names.
 */
const QUERIES = [
  // exact names
  ['accept', 'accept'],
  ['zoom', 'zoom'],
  ['cog', 'cog'],
  ['folder', 'folder'],
  ['printer', 'printer'],
  ['wrench', 'wrench'],
  ['magnifier', 'magnifier'],
  ['lock', 'lock'],
  ['user', 'user'],
  ['star', 'star'],
  ['bin', 'bin'],
  ['money', 'money'],
  ['calendar', 'calendar'],
  ['picture', 'picture'],
  ['clock', 'clock'],
  ['lightbulb', 'lightbulb'],
  ['heart', 'heart'],
  ['key', 'key'],
  ['link', 'link'],
  ['lock_open', 'lock_open'],

  // name prefixes
  ['applic', 'application'],
  ['magnif', 'magnifier'],
  ['printe', 'printer'],
  ['fold', 'folder'],
  ['calen', 'calendar'],
  ['chart', 'chart_bar'],
  ['ligh', 'lightbulb'],
  ['keyb', 'keyboard'],

  // synonyms
  ['search', 'magnifier'],
  ['lookup', 'magnifier'],
  ['gear', 'cog'],
  ['trash', 'bin'],
  ['avatar', 'user'],
  ['settings', 'cog'],
  ['directory', 'folder'],
  ['app', 'application'],
  ['print', 'printer'],
  ['mail', 'email'],
  ['edit', 'pencil'],
  ['home', 'house'],
  ['globe', 'world'],
  ['picture', 'picture'],

  // typos
  ['foder', 'folder'],
  ['magnifer', 'magnifier'],
  ['prnter', 'printer'],
  ['foder_add', 'folder_add'],
  ['zlom', 'zoom'],
  ['cogss', 'cog'],
  ['adn', 'add'],
  ['wernch', 'wrench'],
  ['calender', 'calendar'],
  ['usre', 'user'],
  ['monke', 'monkey'],
  ['baskit', 'basket'],

  // multi token
  ['arrow left', 'arrow_left'],
  ['star gold', 'award_star_gold_1'],
  ['user comment', 'user_comment'],
  ['page white', 'page_white'],
  ['table refresh', 'table_refresh'],
  ['folder magnify', 'folder_magnify'],
  ['application side', 'application_side_boxes'],
  ['zoom in', 'zoom_in'],
  ['pic edit', 'picture_edit'],
  ['user add', 'user_add'],
  ['book delete', 'book_delete'],

  // abbreviations and squashed names
  ['side', 'application_side_boxes'],
  ['view columns', 'application_view_columns'],
];

describe('catalog', () => {
  it('loads the full Silk set', () => {
    assert.equal(index.docs.length, 1010);
  });

  it('gives every icon a real category', () => {
    for (const doc of index.docs) {
      assert.ok(index.categoryCounts[doc.category] > 0, `${doc.name} -> ${doc.category}`);
    }
  });

  it('covers every icon with the sprite stylesheet', () => {
    const css = readFileSync(new URL('../src/lib/styles/silk.css', import.meta.url), 'utf8');
    const rules = new Set([...css.matchAll(/^\.silk\.([a-z0-9_]+)\{/gm)].map((match) => match[1]));
    assert.equal(rules.size, index.docs.length);
  });

  it('keeps the compiled index under 150 KB', () => {
    const bytes = statSync(catalogPath).size;
    assert.ok(bytes < 150 * 1024, `index is ${(bytes / 1024).toFixed(1)} KB`);
  });

  it('indexes every name token', () => {
    const total = index.exact.reduce((sum, ids) => sum + ids.length, 0);
    assert.ok(total >= 1000, `only ${total} token entries`);
  });
});

describe('ranking', () => {
  it('returns everything for an empty query', () => {
    assert.equal(search('').hits.length, index.docs.length);
  });

  it('ranks the exact name above a prefix match', () => {
    assert.equal(names('zoom')[0], 'zoom');
  });

  it('prefers a whole-name alias over a segment match', () => {
    // "gear" is a segment of database_gear, but cog is the icon it means.
    assert.equal(names('gear')[0], 'cog');
  });

  it('finds icons through synonyms', () => {
    assert.equal(names('search')[0], 'magnifier');
    assert.equal(names('trash')[0], 'bin');
    assert.equal(names('avatar')[0], 'user');
  });

  it('tolerates typos per token', () => {
    assert.equal(names('foder')[0], 'folder');
    assert.equal(names('calender')[0], 'calendar');
  });

  it('requires every query token to match at full coverage', () => {
    const result = search('folder table');
    for (const hit of result.hits) {
      if (hit.coverage === 1) {
        assert.ok(hit.icon.segments.includes('folder'));
        assert.ok(hit.icon.segments.includes('table'));
      }
    }
  });

  it('still returns partial matches for a long query', () => {
    const result = search('folder magnify somethingelse');
    assert.ok(result.hits.length > 0);
    assert.ok(result.hits[0].coverage >= 0.5);
  });

  it('scores a full match above a partial one', () => {
    const hits = search('arrow left').hits;
    const full = hits.find((hit) => hit.icon.name === 'arrow_left');
    const partial = hits.find((hit) => hit.coverage < 1);
    assert.ok(full && partial);
    assert.ok(full.score > partial.score);
  });

  it('boosts an exact whole-name match', () => {
    const hits = search('arrow left').hits;
    assert.equal(hits[0].icon.name, 'arrow_left');
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

  it('resolves a category word to the whole category', () => {
    const result = search('files');
    assert.ok(result.hits.length >= 200);
    // The category icons lead; the tail may contain fuzzy neighbours.
    for (const hit of result.hits.slice(0, 50)) {
      assert.equal(hit.icon.category, 'files');
    }
  });
});

describe('highlighting', () => {
  it('highlights the matched segment of the name', () => {
    const [hit] = search('folder').hits;
    assert.deepEqual(hit.ranges, [[0, 6]]);
  });

  it('highlights a prefix match partially', () => {
    const [hit] = search('applic').hits;
    assert.deepEqual(hit.ranges, [[0, 6]]);
  });

  it('highlights every matched segment of a multi token query', () => {
    const [hit] = search('folder magnify').hits;
    assert.deepEqual(hit.ranges, [
      [0, 6],
      [7, 14],
    ]);
  });

  it('highlights the synonym target', () => {
    const hit = search('gear').hits.find((entry) => entry.icon.name === 'database_gear');
    assert.ok(hit);
    assert.deepEqual(hit.ranges, [[9, 13]]);
  });
});

describe('relatedIcons', () => {
  const byName = new Map(index.docs.map((doc) => [doc.name, doc]));

  it('never returns an empty strip', () => {
    const empty = index.docs.filter((doc) => relatedIcons(doc, index).length === 0);
    assert.deepEqual(
      empty.map((doc) => doc.name),
      [],
    );
  });

  it('puts the explicit relations first', () => {
    const related = relatedIcons(byName.get('accept'), index).map((doc) => doc.name);
    assert.ok(related.includes('tick'));
    assert.ok(related.includes('cross'));
    assert.ok(related.includes('cancel'));
  });

  it('points a compound name at the icons its segments refer to', () => {
    const related = relatedIcons(byName.get('folder_add'), index).map((doc) => doc.name);
    assert.equal(related[0], 'folder');
    assert.ok(related.includes('add'));
  });

  it('keeps the family of a compound name', () => {
    const related = relatedIcons(byName.get('folder_table'), index).map((doc) => doc.name);
    assert.ok(related.includes('table'));
    assert.ok(related.includes('table_add'));
  });

  it('falls back to the leading segment for one-off names', () => {
    const related = relatedIcons(byName.get('application_view_columns'), index).map((doc) => doc.name);
    assert.ok(related.includes('application'));
  });

  it('never returns the icon itself', () => {
    for (const doc of index.docs) {
      const related = relatedIcons(doc, index).map((entry) => entry.name);
      assert.ok(!related.includes(doc.name), doc.name);
    }
  });
});

describe('quality', () => {
  it('surfaces the expected icon first', () => {
    const failures = [];

    for (const [query, expected] of QUERIES) {
      const hits = names(query);
      if (hits[0] !== expected) {
        failures.push(`"${query}" -> ${hits.slice(0, 3).join(', ')} (expected ${expected})`);
      }
    }

    assert.deepEqual(failures, []);
  });

  it('scores a mean reciprocal rank above 0.9', () => {
    let reciprocalSum = 0;

    for (const [query, expected] of QUERIES) {
      const hits = names(query);
      const rank = hits.indexOf(expected);
      if (rank !== -1) reciprocalSum += 1 / (rank + 1);
    }

    const mrr = reciprocalSum / QUERIES.length;
    assert.ok(mrr > 0.9, `MRR is ${mrr.toFixed(3)}`);
  });
});
