import { readFileSync } from 'node:fs';

const raw = JSON.parse(readFileSync(new URL('../src/lib/data/catalog.json', import.meta.url), 'utf8'));

const docs = raw.icons.map((icon, id) => {
  const parts = icon.n.split('_');
  const segments = parts.map((part) => part.toLowerCase());
  const ranges = [];
  let cursor = 0;
  for (const part of parts) {
    ranges.push([cursor, cursor + part.length]);
    cursor += part.length + 1;
  }
  return {
    id,
    name: icon.n,
    category: raw.categories[icon.c].id,
    position: icon.p,
    segments,
    ranges,
    compact: segments.join(''),
    normalized: segments.join(' '),
  };
});

const index = {
  docs,
  categories: raw.categories,
  vocab: raw.vocab,
  vocabIndex: new Map(raw.vocab.map((term, position) => [term, position])),
  exact: raw.exact,
  synonyms: raw.synonyms,
  categoryWords: raw.categoryWords,
  categoryIcons: docs.reduce((map, doc) => {
    const bucket = map.get(doc.category) ?? [];
    bucket.push(doc.id);
    map.set(doc.category, bucket);
    return map;
  }, new Map()),
  categoryCounts: {},
};

const { searchIcons } = await import('../src/lib/core/search.ts');

const queries = process.argv.slice(2);
for (const query of queries) {
  const outcome = searchIcons({ query, category: 'all', index });
  const top = outcome.hits.slice(0, 8).map((hit) => `${hit.icon.name}:${Math.round(hit.score)}`);
  console.log(`${query.padEnd(24)} ${String(outcome.hits.length).padStart(4)} hits  ${outcome.duration.toFixed(2)}ms  ${top.join(' ')}`);
}
