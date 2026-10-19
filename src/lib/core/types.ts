export type CategoryId =
  | 'actions'
  | 'navigation'
  | 'interface'
  | 'files'
  | 'data'
  | 'people'
  | 'comms'
  | 'media'
  | 'time'
  | 'commerce'
  | 'security'
  | 'system'
  | 'transport'
  | 'code'
  | 'status'
  | 'misc';

export interface CategoryMeta {
  id: CategoryId;
  label: string;
}

/** A single icon, with everything the runtime needs derived once at load. */
export interface IconDoc {
  id: number;
  name: string;
  category: CategoryId;
  /** `[background-position-x, background-position-y]` in the vendored sprite. */
  position: readonly [x: number, y: number];
  /** Lowercased name segments, e.g. `application_side_boxes` -> 3 segments. */
  segments: readonly string[];
  /** Character range of each segment inside `name`, for highlighting. */
  ranges: readonly (readonly [start: number, end: number])[];
  /** Segments joined without separators. */
  compact: string;
  /** Segments joined with spaces. */
  normalized: string;
}

/** Shape of the generated `catalog.json`. */
export interface RawCatalog {
  version: number;
  categories: readonly CategoryMeta[];
  /** Extra query words that resolve to a whole category. */
  categoryWords: Readonly<Record<string, number>>;
  /** Query term -> catalog terms it can reach. */
  synonyms: Readonly<Record<string, readonly string[]>>;
  icons: readonly { n: string; c: number; p: readonly [number, number] }[];
  /** Distinct name tokens, sorted. */
  vocab: readonly string[];
  /** Parallel to `vocab`: icon ids per token. */
  exact: readonly (readonly number[])[];
  /** Parallel to `icons`: related icon ids for the related strip. */
  related: readonly (readonly number[])[];
}

/** The compiled index the search engine runs against. */
export interface SearchIndex {
  docs: readonly IconDoc[];
  categories: readonly CategoryMeta[];
  vocab: readonly string[];
  vocabIndex: ReadonlyMap<string, number>;
  exact: readonly (readonly number[])[];
  synonyms: Readonly<Record<string, readonly string[]>>;
  categoryWords: Readonly<Record<string, number>>;
  categoryIcons: ReadonlyMap<CategoryId, readonly number[]>;
  categoryCounts: Readonly<Record<string, number>>;
  /** Precomputed related icon ids, parallel to `docs`. */
  related: readonly (readonly number[])[];
}

export type Range = readonly [start: number, end: number];

export interface SearchHit {
  icon: IconDoc;
  score: number;
  /** Character ranges inside `icon.name` to highlight. */
  ranges: readonly Range[];
  /** How many query tokens this icon matched. */
  matchedTokens: number;
  /** `matchedTokens / queryTokenCount`. */
  coverage: number;
}

export interface SearchOutcome {
  hits: readonly SearchHit[];
  /** True when a token fell back to fuzzy or subsequence matching. */
  fuzzy: boolean;
  /** Milliseconds spent searching. */
  duration: number;
}