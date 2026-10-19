// Generates src/lib/data/catalog.json from the vendored sprite position map.
//
//   node scripts/build-catalog.mjs
//
// The icon list is derived from src/lib/styles/silk.css (one rule per icon),
// so the sprite and the catalog can never drift apart.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/** Ordered category metadata. Order drives the category bar. */
const CATEGORIES = [
  { id: 'actions', label: 'Actions' },
  { id: 'navigation', label: 'Navigation' },
  { id: 'interface', label: 'Interface' },
  { id: 'files', label: 'Files' },
  { id: 'data', label: 'Data' },
  { id: 'people', label: 'People' },
  { id: 'comms', label: 'Comms' },
  { id: 'media', label: 'Media' },
  { id: 'time', label: 'Time' },
  { id: 'commerce', label: 'Commerce' },
  { id: 'security', label: 'Security' },
  { id: 'system', label: 'System' },
  { id: 'transport', label: 'Transport' },
  { id: 'code', label: 'Web' },
  { id: 'status', label: 'Status' },
  { id: 'misc', label: 'Misc' },
];

/**
 * Every Silk icon name starts with one of these prefixes (plus a handful of
 * stand-alone names). Mapping all of them keeps every icon in a real category
 * instead of leaking into "misc".
 */
const PREFIX_CATEGORY = {
  // actions
  accept: 'actions', add: 'actions', anchor: 'actions', asterisk: 'actions',
  attach: 'actions', bin: 'actions', cancel: 'actions', circlecross: 'actions',
  collision: 'actions', cross: 'actions', cut: 'actions', delete: 'actions',
  find: 'actions', magifier: 'actions', magnifier: 'actions', new: 'actions',
  paste: 'actions', pencil: 'actions', scratchnumber: 'actions', stop: 'actions',
  sum: 'actions', thumb: 'actions', tick: 'actions', wand: 'actions',
  wrench: 'actions', zoom: 'actions',

  // navigation
  arrow: 'navigation', bullet: 'navigation', control: 'navigation',
  controller: 'navigation', cursor: 'navigation', door: 'navigation',
  layers: 'navigation', map: 'navigation', resultset: 'navigation',
  sitemap: 'navigation', world: 'navigation',

  // interface
  application: 'interface', color: 'interface', contrast: 'interface',
  font: 'interface', layout: 'interface', overlays: 'interface',
  palette: 'interface', pilcrow: 'interface', shading: 'interface',
  shape: 'interface', style: 'interface', tab: 'interface', text: 'interface',
  textfield: 'interface', vector: 'interface',

  // files
  book: 'files', box: 'files', brick: 'files', bricks: 'files',
  briefcase: 'files', cd: 'files', drive: 'files', dvd: 'files',
  folder: 'files', newspaper: 'files', note: 'files', page: 'files',
  report: 'files', script: 'files', tag: 'files',

  // data
  calculator: 'data', chart: 'data', database: 'data', server: 'data',
  table: 'data', timeline: 'data',

  // people
  emoticon: 'people', female: 'people', group: 'people', male: 'people',
  monkey: 'people', tux: 'people', user: 'people', vcard: 'people',

  // comms
  comment: 'comms', comments: 'comms', email: 'comms', feed: 'comms',
  phone: 'comms', rss: 'comms', telephone: 'comms', transmit: 'comms',

  // media
  camera: 'media', film: 'media', image: 'media', images: 'media',
  ipod: 'media', music: 'media', paintbrush: 'media', paintcan: 'media',
  photo: 'media', photos: 'media', picture: 'media', pictures: 'media',
  sound: 'media', television: 'media', webcam: 'media',

  // time
  calendar: 'time', clock: 'time', date: 'time', hourglass: 'time',
  time: 'time',

  // commerce
  basket: 'commerce', cake: 'commerce', cart: 'commerce', coins: 'commerce',
  creditcards: 'commerce', cup: 'commerce', drink: 'commerce', money: 'commerce',
  pill: 'commerce',

  // security
  bomb: 'security', gun: 'security', key: 'security', lock: 'security',
  shield: 'security',

  // system
  cog: 'system', compress: 'system', computer: 'system', connect: 'system',
  disconnect: 'system', flag: 'system', joystick: 'system', keyboard: 'system',
  monitor: 'system', mouse: 'system', plugin: 'system', printer: 'system',
  spellcheck: 'system',

  // transport
  building: 'transport', car: 'transport', lorry: 'transport',
  package: 'transport', water: 'transport', weather: 'transport',

  // web / file formats
  css: 'code', html: 'code', ruby: 'code', xhtml: 'code',

  // status
  award: 'status', bell: 'status', bug: 'status', error: 'status',
  exclamation: 'status', eye: 'status', fire: 'status', heart: 'status',
  help: 'status', information: 'status', lightbulb: 'status',
  lightning: 'status', medal: 'status', star: 'status', status: 'status',

  // stand-alone names
  link: 'comms',
  rainbow: 'misc',
  rosette: 'misc',
  sport: 'misc',
};

/**
 * Synonyms folded into every matching icon's keyword set, and used to expand
 * user queries ("search" finds "magnifier" and vice versa).
 */
const SYNONYMS = {
  accept: ['ok', 'yes', 'check', 'done', 'success', 'tick', 'approve'],
  add: ['plus', 'new', 'create', 'insert', 'append'],
  anchor: ['link', 'url', 'anchor'],
  application: ['app', 'window', 'program', 'ui', 'desktop'],
  arrow: ['direction', 'navigation', 'back', 'next', 'move'],
  attach: ['attachment', 'clip', 'paperclip'],
  award: ['medal', 'prize', 'winner', 'trophy'],
  basket: ['cart', 'shop', 'ecommerce'],
  bell: ['notification', 'alarm', 'reminder'],
  book: ['manual', 'docs', 'documentation', 'readme'],
  brick: ['wall', 'masonry'],
  bug: ['debug', 'issue', 'defect'],
  cancel: ['close', 'cross', 'abort', 'discard'],
  car: ['auto', 'vehicle', 'drive'],
  cart: ['basket', 'shop', 'checkout'],
  chart: ['graph', 'analytics', 'report', 'plot', 'stats'],
  clock: ['time', 'watch', 'hour'],
  cog: ['gear', 'settings', 'preferences', 'options'],
  comment: ['message', 'chat', 'note', 'reply'],
  comments: ['message', 'chat', 'thread', 'discussion'],
  computer: ['desktop', 'pc', 'machine'],
  connect: ['link', 'chain', 'network', 'online'],
  control: ['player', 'playback', 'media'],
  css: ['style', 'stylesheet', 'web'],
  cursor: ['pointer', 'mouse', 'click'],
  delete: ['remove', 'trash', 'bin', 'destroy', 'erase'],
  disconnect: ['offline', 'unlink'],
  disk: ['save', 'floppy', 'drive'],
  drive: ['disk', 'storage', 'hdd'],
  email: ['mail', 'message', 'letter', 'envelope'],
  error: ['alert', 'danger', 'warning', 'problem', 'bug', 'invalid'],
  exclamation: ['warning', 'alert', 'important', 'attention'],
  eye: ['view', 'preview', 'watch', 'visible'],
  feed: ['rss', 'news', 'subscribe'],
  film: ['movie', 'video', 'cinema'],
  folder: ['directory', 'dir'],
  group: ['users', 'people', 'team', 'community'],
  heart: ['favorite', 'like', 'love'],
  help: ['question', 'info', 'support', 'faq'],
  house: ['home', 'main'],
  html: ['markup', 'web', 'page'],
  image: ['photo', 'picture', 'media'],
  information: ['info', 'details', 'about'],
  key: ['password', 'access', 'auth', 'apikey'],
  lightbulb: ['idea', 'inspiration', 'tip'],
  link: ['url', 'chain', 'anchor', 'hyperlink'],
  lock: ['secure', 'security', 'password', 'private'],
  magnifier: ['search', 'find', 'zoom', 'lookup'],
  media: ['play', 'music', 'video'],
  monitor: ['display', 'screen', 'desktop'],
  money: ['cash', 'currency', 'payment', 'price'],
  mouse: ['cursor', 'pointer', 'click'],
  music: ['audio', 'sound', 'song', 'player'],
  note: ['memo', 'annotation'],
  package: ['box', 'parcel', 'delivery'],
  page: ['file', 'document', 'paper', 'blank'],
  pencil: ['edit', 'write', 'modify', 'rename'],
  picture: ['image', 'photo', 'media'],
  plugin: ['extension', 'addon', 'module'],
  printer: ['print'],
  rainbow: ['colorful', 'gradient'],
  report: ['analytics', 'chart', 'stats'],
  ruby: ['gem', 'lang', 'code'],
  script: ['code', 'javascript', 'program'],
  server: ['host', 'backend', 'cloud'],
  sound: ['audio', 'volume', 'speaker'],
  star: ['favorite', 'bookmark', 'rating'],
  status: ['online', 'offline', 'presence'],
  table: ['grid', 'spreadsheet', 'data', 'rows'],
  tag: ['label', 'mark', 'category'],
  telescope: ['zoom', 'search', 'look'],
  text: ['font', 'typography', 'copy'],
  textfield: ['input', 'field', 'form'],
  time: ['clock', 'hour', 'schedule'],
  transmit: ['send', 'upload', 'broadcast'],
  user: ['person', 'profile', 'account', 'avatar'],
  vector: ['svg', 'path', 'shape'],
  weather: ['forecast', 'rain', 'cloud', 'sun'],
  world: ['globe', 'internet', 'web', 'earth'],
  wrench: ['tools', 'repair', 'maintenance', 'settings'],
  xhtml: ['markup', 'web', 'page'],
};

/** Category words are searchable, so "people" finds every person icon. */
const CATEGORY_WORDS = {
  actions: ['action', 'edit', 'operation'],
  navigation: ['navigation', 'navigate', 'direction'],
  interface: ['ui', 'interface', 'widget', 'layout'],
  files: ['file', 'document', 'doc'],
  data: ['data', 'database', 'analytics'],
  people: ['person', 'user', 'team'],
  comms: ['communication', 'message', 'contact'],
  media: ['media', 'image', 'video', 'audio'],
  time: ['time', 'date', 'schedule'],
  commerce: ['commerce', 'shop', 'payment', 'money'],
  security: ['security', 'auth', 'permission'],
  system: ['system', 'device', 'hardware', 'software'],
  transport: ['transport', 'vehicle', 'place'],
  code: ['code', 'web', 'developer', 'markup'],
  status: ['status', 'state', 'signal'],
  misc: ['misc', 'other'],
};

const STOPWORDS = new Set(['a', 'an', 'and', 'the', 'of', 'to', 'in', 'on', 'for', 'with', 'at', 'by']);

const tokenize = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean);

const compact = (value) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Two indexes on purpose:
 * - `direct`   is used to expand a user query. One hop only, so searching
 *              "chart" does not drag in every "document" icon through the
 *              transitive report -> document edge.
 * - `closed`   is folded into each icon's keyword list, where the transitive
 *              closure is exactly what makes keyword search work.
 */
function buildAliasIndexes() {
  const direct = new Map();
  const closed = new Map();

  const link = (index, term, others) => {
    const key = compact(term);
    if (!key) return;
    const bucket = index.get(key) ?? new Set();
    for (const value of others) {
      const normalized = compact(value);
      if (normalized && normalized !== key) bucket.add(normalized);
    }
    index.set(key, bucket);
  };

  for (const [term, values] of Object.entries(SYNONYMS)) {
    link(direct, term, values);
    link(closed, term, values);

    for (const value of values) {
      const siblings = [term, ...values.filter((item) => item !== value)];
      link(direct, value, [term]);
      link(closed, value, siblings);
    }
  }

  return { direct, closed };
}

const ALIASES = buildAliasIndexes();

function readSprite() {
  const css = readFileSync(path.resolve('src/lib/styles/silk.css'), 'utf8');
  const entries = new Map();

  const RULE = /^\.silk\.([a-z0-9_]+)\{background-position:calc\((-?\d+) \* var\(--silk-scale\)\) calc\((-?\d+) \* var\(--silk-scale\)\)\}$/gm;

  for (const match of css.matchAll(RULE)) {
    entries.set(match[1], [Number(match[2]), Number(match[3])]);
  }

  if (entries.size === 0) throw new Error('no .silk.<name> rules found in src/lib/styles/silk.css');
  return entries;
}

function categoryFor(name) {
  const prefix = name.split('_')[0];
  return PREFIX_CATEGORY[prefix] ?? PREFIX_CATEGORY[name] ?? 'misc';
}

function keywordsFor(name, category) {
  const nameTokens = tokenize(name);
  const keys = new Set(nameTokens);

  for (const token of nameTokens) {
    for (const alias of ALIASES.closed.get(compact(token)) ?? []) keys.add(alias);
  }

  const [first] = name.split('_');
  for (const alias of ALIASES.closed.get(compact(first)) ?? []) keys.add(alias);

  keys.add(category);
  for (const word of CATEGORY_WORDS[category] ?? []) keys.add(word);

  keys.delete(STOPWORDS.has(name) ? name : '');
  return [...keys].sort();
}

function buildCatalog() {
  const sprite = readSprite();
  const names = [...sprite.keys()].sort((a, b) => a.localeCompare(b, 'en'));
  const counts = new Map();

  const icons = names.map((name) => {
    const category = categoryFor(name);
    counts.set(category, (counts.get(category) ?? 0) + 1);
    return { n: name, c: category, p: sprite.get(name), k: keywordsFor(name, category) };
  });

  const unknownPrefixes = [...new Set(names.map((name) => name.split('_')[0]))].filter(
    (prefix) => !(prefix in PREFIX_CATEGORY) && !(prefix in SYNONYMS),
  );
  if (unknownPrefixes.length > 0) {
    console.warn('unmapped prefixes:', unknownPrefixes.join(', '));
  }

  const aliases = {};
  for (const [term, values] of [...ALIASES.direct].sort(([a], [b]) => a.localeCompare(b))) {
    aliases[term] = [...values].sort();
  }

  return {
    version: 1,
    categories: CATEGORIES,
    icons,
    aliases,
    counts: Object.fromEntries(CATEGORIES.map(({ id }) => [id, counts.get(id) ?? 0])),
  };
}

const catalog = buildCatalog();
const target = path.resolve('src/lib/data/catalog.json');
writeFileSync(target, `${JSON.stringify(catalog)}\n`);

const total = catalog.icons.length;
console.log(`wrote ${total} icons to ${target} (${(JSON.stringify(catalog).length / 1024).toFixed(0)} KB)`);
for (const { id, label } of CATEGORIES) {
  console.log(`  ${label.padEnd(12)} ${String(catalog.counts[id]).padStart(4)}`);
}