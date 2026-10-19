import type { CatalogIcon, CategoryId, IconEntry, Range, SearchHit, SearchOutcome } from './types';

/** Score tiers. Kept far apart so the sort order stays readable. */
const SCORE = {
  exactName: 1000,
  namePrefix: 760,
  tokenPrefix: 640,
  keywordExact: 560,
  keywordPrefix: 480,
  nameContains: 380,
  keywordContains: 260,
  fuzzy: 120,
} as const;

/** Strict matches below this count are retried with fuzzy token matching. */
const FUZZY_TRIGGER = 24;
/** Fuzzy is only considered for tokens at least this long. */
const FUZZY_MIN_TOKEN = 3;
/** Short queries tolerate more edit distance than long ones. */
const FUZZY_TOLERANCE = (length: number) => (length <= 4 ? 1 : length <= 7 ? 2 : 3);

export function buildCatalog(icons: readonly CatalogIcon[]): { entries: readonly IconEntry[] } {
  return {
    entries: icons.map((icon) => ({
      ...icon,
      compact: icon.name.toLowerCase().replace(/[^a-z0-9]/g, ''),
      haystack: icon.keywords.join(' '),
    })),
  };
}

const tokenize = (query: string): string[] =>
  query
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean);

const compactToken = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * A parsed query token: the literal term plus its synonym variants.
 *
 * Only the literal term may match as a substring. Synonyms match exactly (or
 * as a name prefix), otherwise a two-letter alias such as `dir` would light up
 * every icon whose keyword list contains `direction`.
 */
interface QueryToken {
  literal: string;
  variants: readonly string[];
}

function expandToken(token: string, aliases: Readonly<Record<string, readonly string[]>>): QueryToken {
  const literal = compactToken(token);
  const extra = aliases[literal];
  return { literal, variants: extra ? [literal, ...extra] : [literal] };
}

function scoreToken(icon: IconEntry, { literal, variants }: QueryToken, allowFuzzy: boolean): number {
  let strict = 0;

  for (const variant of variants) {
    if (!variant) continue;

    const isLiteral = variant === literal;
    let value = 0;

    if (isLiteral && icon.compact === variant) {
      // Only the term the user typed can earn an exact-name score, otherwise
      // searching "zoom" would rank "magnifier" above the icon named "zoom".
      value = SCORE.exactName;
    } else if (isLiteral && icon.compact.startsWith(variant)) {
      value = SCORE.namePrefix - Math.min(60, variant.length);
    } else if (isLiteral && icon.name.startsWith(variant)) {
      value = SCORE.tokenPrefix - Math.min(60, variant.length);
    } else if (icon.keywords.includes(variant)) {
      value = SCORE.keywordExact - (isLiteral ? 0 : 40);
    } else if (isLiteral) {
      const keywordPrefix = icon.keywords.some((keyword) => keyword.startsWith(variant));
      if (keywordPrefix) {
        value = SCORE.keywordPrefix - Math.min(60, variant.length);
      } else if (icon.compact.includes(variant)) {
        value = SCORE.nameContains - Math.min(40, variant.length);
      } else if (icon.haystack.includes(variant)) {
        value = SCORE.keywordContains;
      }
    }

    if (value > strict) strict = value;
  }

  if (strict > 0 || !allowFuzzy || literal.length < FUZZY_MIN_TOKEN) return strict;

  const similarity = bestSimilarity(literal, icon);
  return similarity > 0 ? Math.round(SCORE.fuzzy + similarity * 60) : 0;
}

/** Cheap length gate before the quadratic edit-distance pass. */
function bestSimilarity(token: string, icon: IconEntry): number {
  const tolerance = FUZZY_TOLERANCE(token.length);
  let best = 0;

  for (const candidate of [icon.compact, ...icon.keywords]) {
    if (Math.abs(candidate.length - token.length) > tolerance) continue;

    const distance = boundedLevenshtein(token, candidate, tolerance);
    if (distance > tolerance) continue;

    const score = 1 - distance / Math.max(token.length, candidate.length, 1);
    if (score > best) best = score;
    if (best > 0.85) break;
  }

  return best;
}

/** Levenshtein distance that bails out once every cell exceeds `limit`. */
function boundedLevenshtein(a: string, b: string, limit: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  if (a.length === 0) return b.length;

  let previous = new Array<number>(b.length + 1);
  let current = new Array<number>(b.length + 1);

  for (let column = 0; column <= b.length; column += 1) previous[column] = column;

  for (let row = 1; row <= a.length; row += 1) {
    current[0] = row;
    let rowMin = current[0];

    for (let column = 1; column <= b.length; column += 1) {
      const cost = a[row - 1] === b[column - 1] ? 0 : 1;
      current[column] = Math.min(
        previous[column] + 1,
        current[column - 1] + 1,
        previous[column - 1] + cost,
      );
      if (current[column] < rowMin) rowMin = current[column];
    }

    if (rowMin > limit) return limit + 1;

    const swap = previous;
    previous = current;
    current = swap;
  }

  return previous[b.length];
}

/** Character ranges of `name` that match a query term, for highlighting. */
function highlightRanges(name: string, literals: readonly string[]): Range[] {
  const lowerName = name.toLowerCase();
  const ranges: Range[] = [];

  for (const literal of literals) {
    if (literal.length < 2) continue;

    let from = 0;
    for (;;) {
      const index = lowerName.indexOf(literal, from);
      if (index === -1) break;

      const end = index + literal.length;
      const before = index === 0 ? ' ' : lowerName[index - 1];
      const after = end === lowerName.length ? ' ' : lowerName[end];

      if (!/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after)) ranges.push([index, end]);

      from = index + 1;
    }
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

export interface SearchOptions {
  query: string;
  category: CategoryId | 'all';
  aliases: Readonly<Record<string, readonly string[]>>;
  entries: readonly IconEntry[];
}

export function searchIcons({ query, category, aliases, entries }: SearchOptions): SearchOutcome {
  const startedAt = performance.now();
  const rawTokens = tokenize(query);
  const pool = category === 'all' ? entries : entries.filter((icon) => icon.category === category);

  if (rawTokens.length === 0) {
    return {
      hits: pool.map((icon) => ({ icon, score: 0, ranges: [] })),
      fuzzy: false,
      duration: performance.now() - startedAt,
    };
  }

  const groups = rawTokens.map((token) => expandToken(token, aliases));
  const literals = groups.map((group) => group.literal);
  const strict = collect(pool, groups, literals, false);

  const fuzzy = strict.length < FUZZY_TRIGGER;
  const hits = fuzzy ? collect(pool, groups, literals, true) : strict;

  hits.sort((left, right) => right.score - left.score || left.icon.name.localeCompare(right.icon.name, 'en'));

  return { hits, fuzzy, duration: performance.now() - startedAt };
}

function collect(
  pool: readonly IconEntry[],
  groups: readonly QueryToken[],
  literals: readonly string[],
  allowFuzzy: boolean,
): SearchHit[] {
  const hits: SearchHit[] = [];

  for (const icon of pool) {
    let total = 0;
    let matched = true;

    for (const group of groups) {
      const score = scoreToken(icon, group, allowFuzzy);
      if (score <= 0) {
        matched = false;
        break;
      }
      total += score;
    }

    if (matched) hits.push({ icon, score: total, ranges: highlightRanges(icon.name, literals) });
  }

  return hits;
}

/**
 * Icons that belong to the same family, for the inspector's related list.
 * The last name segment wins (`folder_table` -> the `table*` family) and we
 * fall back to the first segment when that family is too small to be useful.
 */
export function relatedIcons(icon: IconEntry, entries: readonly IconEntry[], limit = 12): IconEntry[] {
  const segments = icon.name.split('_');
  const families = [...new Set([segments.at(-1), segments[0]].filter(Boolean))] as string[];

  const collect = (family: string) =>
    entries.filter(
      (candidate) =>
        candidate.name !== icon.name &&
        (candidate.name === family || candidate.name.startsWith(`${family}_`)),
    );

  for (const family of families) {
    const matches = collect(family);
    if (matches.length >= 3) return matches.slice(0, limit);
  }

  // Nothing is big enough to be a family; show the richest candidate anyway.
  const best = families.map(collect).reduce((a, b) => (b.length > a.length ? b : a), []);
  return best.slice(0, limit);
}