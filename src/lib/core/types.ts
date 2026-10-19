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

export interface CatalogIcon {
  /** Icon name, e.g. `application_side_boxes`. */
  name: string;
  category: CategoryId;
  /** `[background-position-x, background-position-y]` in the vendored sprite. */
  position: readonly [x: number, y: number];
  /** Searchable keywords: name tokens + synonyms + category words. */
  keywords: readonly string[];
}

export interface IconEntry extends CatalogIcon {
  /** `name` without separators, lowercased. */
  compact: string;
  /** Space-joined keywords, used for a single-pass `includes`. */
  haystack: string;
}

/** Shape of the generated `catalog.json`. */
export interface RawCatalog {
  version: number;
  categories: readonly CategoryMeta[];
  icons: readonly { n: string; c: CategoryId; p: readonly [number, number]; k: readonly string[] }[];
  aliases: Readonly<Record<string, readonly string[]>>;
  counts: Readonly<Record<CategoryId, number>>;
}

export type Range = readonly [start: number, end: number];

export interface SearchHit {
  icon: IconEntry;
  score: number;
  /** Character ranges inside `icon.name` to highlight. */
  ranges: readonly Range[];
}

export interface SearchOutcome {
  hits: readonly SearchHit[];
  /** True when the strict pass found too little and fuzzy matching kicked in. */
  fuzzy: boolean;
  /** Milliseconds spent searching, surfaced in the status bar. */
  duration: number;
}