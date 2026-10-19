import type { IconDoc, Range, SearchHit, SearchIndex, SearchOutcome } from './types';

/**
 * Match tiers. The order encodes how much evidence a match carries:
 *
 *   exactName   the query *is* the icon name            1000
 *   tokenExact  the query is one of the name segments    800
 *   namePrefix  the name starts with the query           700
 *   tokenPrefix a segment starts with the query          600
 *   aliasExact  the query reaches a segment via a synonym 500
 *   compact     the query is inside the squashed name    380
 *   subsequence the query is a subsequence of a segment   350
 *   fuzzyNear   one edit away from a segment             280
 *   category    the query names a whole category         260
 *   fuzzyFar    two edits away from a segment            190
 */
const TIER = {
  exactName: 1000,
  aliasName: 950,
  tokenExact: 800,
  namePrefix: 700,
  tokenPrefix: 600,
  aliasExact: 500,
  compact: 380,
  fuzzyNameNear: 320,
  fuzzyNear: 280,
  category: 260,
  fuzzyNameFar: 230,
  subsequence: 220,
  fuzzyFar: 190,
} as const;

/** The first synonym of a group is its canonical icon and ranks slightly higher. */
const ALIAS_FIRST_BONUS = 40;

/** Alias-only matches are demoted a little further. */
const ALIAS_PENALTY = 25;

/** Below this many strict hits a token also gets fuzzy and subsequence passes. */
const WEAK_THRESHOLD = 8;

/** Fuzzy matching never looks further than this many edits. */
const FUZZY_LIMIT = 2;

/** Shortest token that may be matched as a subsequence. */
const SUBSEQUENCE_MIN = 4;

/** How many extra characters a subsequence may span. */
const SUBSEQUENCE_SLACK = 3;

/** A result must cover at least this share of the query tokens. */
const MIN_COVERAGE = 0.5;

interface TokenMatch {
  score: number;
  /** Index into `doc.segments`, or -1 when the match is not segment aligned. */
  segment: number;
  /** Characters of that segment covered by the match. */
  length: number;
  /** True when the match came through a synonym expansion. */
  alias: boolean;
  /** True when the match came from the fuzzy or subsequence fallback. */
  fuzzy: boolean;
}

const tokenize = (query: string): string[] =>
  query
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean);

/* -------------------------------------------------------------------------- */
/* Distance                                                                   */
/* -------------------------------------------------------------------------- */

const MAX_WORD = 64;
const levenshteinTwoBack = new Int32Array(MAX_WORD);
const levenshteinPrevious = new Int32Array(MAX_WORD);
const levenshteinCurrent = new Int32Array(MAX_WORD);

/**
 * Optimal string alignment distance: Levenshtein plus transpositions, so
 * `usre` is one edit away from `user` instead of two.
 *
 * Bails out once every cell in a row exceeds `limit`, and uses module level
 * scratch buffers: the previous implementation allocated two arrays per call,
 * which dominated the fuzzy pass.
 */
function boundedLevenshtein(a: string, b: string, limit: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  if (a.length > MAX_WORD || b.length > MAX_WORD) return limit + 1;

  let twoBack = levenshteinTwoBack;
  let previous = levenshteinPrevious;
  let current = levenshteinCurrent;

  for (let column = 0; column <= b.length; column += 1) previous[column] = column;

  for (let row = 1; row <= a.length; row += 1) {
    current[0] = row;
    let rowMin = row;

    for (let column = 1; column <= b.length; column += 1) {
      const cost = a[row - 1] === b[column - 1] ? 0 : 1;
      let value = Math.min(previous[column] + 1, current[column - 1] + 1, previous[column - 1] + cost);

      if (row > 1 && column > 1 && a[row - 1] === b[column - 2] && a[row - 2] === b[column - 1]) {
        value = Math.min(value, twoBack[column - 2] + 1);
      }

      current[column] = value;
      if (value < rowMin) rowMin = value;
    }

    if (rowMin > limit) return limit + 1;

    const swap = twoBack;
    twoBack = previous;
    previous = current;
    current = swap;
  }

  return previous[b.length];
}

/**
 * True when `needle` appears inside `haystack` in order, anchored at the
 * start and within a tight span, so `appl` matches `application` but a random
 * three letter query does not match half the catalog.
 */
function isTightSubsequence(needle: string, haystack: string): boolean {
  if (needle.length < SUBSEQUENCE_MIN) return false;
  if (haystack.length < needle.length) return false;
  if (haystack[0] !== needle[0]) return false;

  let cursor = 0;
  let first = -1;
  let last = -1;

  for (let index = 0; index < haystack.length && cursor < needle.length; index += 1) {
    if (haystack[index] !== needle[cursor]) continue;
    if (first === -1) first = index;
    last = index;
    cursor += 1;
  }

  if (cursor < needle.length) return false;
  return last - first + 1 <= needle.length + SUBSEQUENCE_SLACK;
}

/* -------------------------------------------------------------------------- */
/* Token resolution                                                           */
/* -------------------------------------------------------------------------- */

interface ResolveContext {
  index: SearchIndex;
  /** Restricts the result set to one category, or `undefined` for all. */
  category?: string;
}

function resolveToken({ index, category }: ResolveContext, token: string): Map<number, TokenMatch> {
  const matches = new Map<number, TokenMatch>();

  const keep = (
    id: number,
    score: number,
    segment: number,
    length: number,
    alias: boolean,
    fuzzy = false,
  ): void => {
    const current = matches.get(id);
    if (current && current.score >= score) return;
    matches.set(id, { score, segment, length, alias, fuzzy });
  };

  const accepts = (doc: IconDoc): boolean => category === undefined || doc.category === category;

  // 1. The query is a name segment of the icon.
  const exactPosition = index.vocabIndex.get(token);
  if (exactPosition !== undefined) {
    for (const id of index.exact[exactPosition]) {
      const doc = index.docs[id];
      if (!accepts(doc)) continue;

      const segment = doc.segments.indexOf(token);
      keep(id, doc.segments.length === 1 ? TIER.exactName : TIER.tokenExact, segment, token.length, false);
    }
  }

  let strictHits = matches.size;

  // 2. The query is a prefix of a name segment.
  for (let position = 0; position < index.vocab.length; position += 1) {
    const term = index.vocab[position];
    if (term === token || !term.startsWith(token)) continue;

    for (const id of index.exact[position]) {
      const doc = index.docs[id];
      if (!accepts(doc)) continue;

      const segment = doc.segments.indexOf(term);
      keep(id, segment === 0 ? TIER.namePrefix : TIER.tokenPrefix, segment, token.length, false);
    }
  }

  strictHits = matches.size;

  // 3. The query reaches a name segment through a synonym.
  const synonyms = index.synonyms[token] ?? [];
  synonyms.forEach((synonym, order) => {
    const position = index.vocabIndex.get(synonym);
    if (position === undefined) return;

    for (const id of index.exact[position]) {
      const doc = index.docs[id];
      if (!accepts(doc)) continue;

      const segment = doc.segments.indexOf(synonym);
      // The icon whose *whole name* is the synonym is the canonical answer:
      // searching "gear" should surface `cog`, not `database_gear`.
      const wholeName = doc.segments.length === 1 && doc.segments[0] === synonym;
      const score = (wholeName ? TIER.aliasName : TIER.aliasExact) + (order === 0 ? ALIAS_FIRST_BONUS : 0);

      keep(id, score, segment, synonym.length, true);
    }
  });

  // 4. The query names a whole category.
  const categoryPosition = index.categoryWords[token];
  if (categoryPosition !== undefined) {
    const bucket = index.categoryIcons.get(index.categories[categoryPosition].id) ?? [];
    for (const id of bucket) keep(id, TIER.category, -1, 0, false);
  }

  const weak = strictHits < WEAK_THRESHOLD;

  // 5. Typo tolerance, per token — never a global switch.
  if (weak) {
    // Short words tolerate one edit; two edits on a four letter word is a
    // different word, not a typo.
    const limit = token.length <= 4 ? 1 : FUZZY_LIMIT;

    for (let position = 0; position < index.vocab.length; position += 1) {
      const term = index.vocab[position];
      if (term === token) continue;
      if (Math.abs(term.length - token.length) > limit) continue;

      const distance = boundedLevenshtein(token, term, limit);
      if (distance > limit) continue;

      for (const id of index.exact[position]) {
        const doc = index.docs[id];
        if (!accepts(doc)) continue;

        const segment = doc.segments.indexOf(term);
        // A typo in the whole name beats a typo in one segment of a longer
        // name: `usre` should land on `user`, not on `drive_user`.
        const wholeName = doc.segments.length === 1 && doc.segments[0] === term;
        const score = wholeName
          ? distance === 1
            ? TIER.fuzzyNameNear
            : TIER.fuzzyNameFar
          : distance === 1
            ? TIER.fuzzyNear
            : TIER.fuzzyFar;

        keep(id, score, segment, term.length, false, true);
      }
    }
  }

  // 6. Abbreviations and squashed names, e.g. `usrset` -> `user settings`.
  if (weak && token.length >= SUBSEQUENCE_MIN) {
    for (const doc of index.docs) {
      if (!accepts(doc)) continue;

      if (doc.compact.includes(token)) keep(doc.id, TIER.compact, -1, 0, false, true);

      for (let segment = 0; segment < doc.segments.length; segment += 1) {
        if (isTightSubsequence(token, doc.segments[segment])) {
          keep(doc.id, TIER.subsequence, segment, doc.segments[segment].length, false, true);
        }
      }
    }
  }

  return matches;
}

/* -------------------------------------------------------------------------- */
/* Highlighting                                                               */
/* -------------------------------------------------------------------------- */

function computeRanges(doc: IconDoc, matches: readonly TokenMatch[]): Range[] {
  const ranges: Range[] = [];

  for (const match of matches) {
    if (match.segment < 0) continue;
    const start = doc.ranges[match.segment][0];
    ranges.push([start, start + Math.max(1, match.length)]);
  }

  if (ranges.length === 0) return ranges;

  ranges.sort((left, right) => left[0] - right[0]);

  const merged: Range[] = [];
  let [start, end] = ranges[0];

  for (const [rangeStart, rangeEnd] of ranges.slice(1)) {
    if (rangeStart <= end) {
      end = Math.max(end, rangeEnd);
      continue;
    }
    merged.push([start, end]);
    start = rangeStart;
    end = rangeEnd;
  }
  merged.push([start, end]);

  return merged;
}

/* -------------------------------------------------------------------------- */
/* Engine                                                                     */
/* -------------------------------------------------------------------------- */

export interface SearchOptions {
  query: string;
  category: string;
  index: SearchIndex;
}

export function searchIcons({ query, category, index }: SearchOptions): SearchOutcome {
  const startedAt = performance.now();
  const tokens = tokenize(query);
  const all = category === 'all';

  if (tokens.length === 0) {
    const hits: SearchHit[] = [];
    for (const doc of index.docs) {
      if (!all && doc.category !== category) continue;
      hits.push({ icon: doc, score: 0, ranges: [], matchedTokens: 0, coverage: 1 });
    }
    return { hits, fuzzy: false, duration: performance.now() - startedAt };
  }

  const context: ResolveContext = { index, category: all ? undefined : category };
  const perToken = tokens.map((token) => resolveToken(context, token));

  const candidates = new Set<number>();
  for (const tokenMatches of perToken) {
    for (const id of tokenMatches.keys()) candidates.add(id);
  }

  const queryNormalized = tokens.join(' ');
  const hits: SearchHit[] = [];
  let fuzzy = false;

  for (const id of candidates) {
    const doc = index.docs[id];
    if (!all && doc.category !== category) continue;

    let matched = 0;
    let sum = 0;
    let penalty = 0;
    const segmentMatches: TokenMatch[] = [];

    for (const tokenMatches of perToken) {
      const match = tokenMatches.get(id);
      if (!match) continue;

      matched += 1;
      sum += match.score;
      if (match.alias) penalty += ALIAS_PENALTY;
      if (match.segment >= 0) segmentMatches.push(match);
      if (match.fuzzy) fuzzy = true;
    }

    if (matched === 0) continue;

    const coverage = matched / tokens.length;
    if (coverage < MIN_COVERAGE) continue;

    let score = sum * coverage - penalty;
    if (doc.normalized === queryNormalized) {
      score = Math.max(score, TIER.exactName * tokens.length);
    }

    hits.push({
      icon: doc,
      score,
      ranges: computeRanges(doc, segmentMatches),
      matchedTokens: matched,
      coverage,
    });
  }

  hits.sort((left, right) => right.score - left.score || left.icon.name.localeCompare(right.icon.name, 'en'));

  return { hits, fuzzy, duration: performance.now() - startedAt };
}

/** Icons belonging to the same family, for the related strip. */
export function relatedIcons(icon: IconDoc, docs: readonly IconDoc[], limit = 32): IconDoc[] {
  const segments = icon.segments;
  const families = [...new Set([segments.at(-1), segments[0]].filter(Boolean))] as string[];

  const collect = (family: string) =>
    docs.filter((candidate) => candidate.id !== icon.id && candidate.segments[0] === family);

  for (const family of families) {
    const matches = collect(family);
    if (matches.length >= 3) return matches.slice(0, limit);
  }

  const best = families.map(collect).reduce((a, b) => (b.length > a.length ? b : a), []);
  return best.slice(0, limit);
}
