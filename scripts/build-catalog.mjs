// Generates src/lib/data/catalog.json: a compiled, query-ready search index.
//
//   node scripts/build-catalog.mjs
//
// The output is designed for the runtime in src/lib/core/search.ts:
//
//   icons    [{ n, c, p }]           name, category index, sprite position
//   vocab    ["accept", "add", ...]  distinct name tokens, sorted
//   exact    [[0], [1], [2, 5], ...]  parallel to vocab: icon ids per token
//   synonyms { "search": ["find", "magnifier", "zoom"] }
//   categoryWords { "person": 3, "people": 3 }
//   related  [[1, 2], [3], ...]      parallel to icons: related icon ids
//
// The inverted `exact` map is what makes a lookup O(1) instead of a scan over
// 1,010 icons, and keeping synonyms in one shared map (instead of baking the
// closure into every icon's keyword list) keeps the payload small.
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
 * Synonym groups for query expansion. Every member of a group can reach every
 * other member, so a query for any of them lands on the same icons.
 *
 * The first entry of a group is its canonical icon and gets a small ranking
 * bonus, so `cog` is the group lead for the settings family and `bin` leads
 * the trash family.
 *
 * Kept deliberately small: a group member that is a common word (`dir`,
 * `copy`, `page`) poisons every other icon whose keyword list contains it.
 */
const SYNONYMS = {
  accept: ['ok', 'yes', 'check', 'done', 'success', 'tick', 'approve', 'confirm'],
  add: ['plus', 'new', 'create', 'insert', 'append'],
  application: ['app', 'window', 'program', 'desktop'],
  arrow: ['direction', 'pointer'],
  attach: ['attachment', 'clip', 'paperclip'],
  award: ['medal', 'prize', 'winner', 'trophy'],
  basket: ['cart', 'shop', 'ecommerce'],
  bell: ['notification', 'alarm', 'reminder'],
  bin: ['trash', 'garbage', 'recycle', 'delete', 'remove', 'destroy', 'erase'],
  book: ['manual', 'docs', 'documentation', 'readme'],
  brick: ['wall', 'masonry'],
  bug: ['debug', 'issue', 'defect'],
  calculator: ['math', 'sum', 'calculate'],
  camera: ['photo', 'picture', 'snapshot'],
  cancel: ['close', 'cross', 'abort', 'discard'],
  car: ['auto', 'vehicle', 'drive'],
  cart: ['basket', 'shop', 'checkout'],
  chart: ['graph', 'analytics', 'plot', 'stats'],
  clock: ['time', 'watch', 'hour'],
  cog: ['gear', 'settings', 'preferences', 'options'],
  comment: ['message', 'chat', 'note', 'reply'],
  comments: ['message', 'chat', 'thread', 'discussion'],
  computer: ['desktop', 'pc', 'machine'],
  connect: ['link', 'chain', 'network', 'online'],
  control: ['player', 'playback'],
  creditcards: ['payment', 'card', 'visa'],
  coins: ['change', 'money'],
  cross: ['cancel', 'close'],
  cursor: ['pointer', 'mouse', 'click'],
  cup: ['coffee', 'mug', 'drink'],
  database: ['db', 'sql', 'data'],
  delete: ['remove', 'erase', 'destroy', 'trash'],
  disconnect: ['offline', 'unlink'],
  disk: ['save', 'floppy'],
  drink: ['coffee', 'beverage', 'cup'],
  drive: ['disk', 'storage', 'hdd'],
  email: ['mail', 'message', 'letter', 'envelope'],
  error: ['alert', 'danger', 'warning', 'problem', 'invalid'],
  exclamation: ['warning', 'alert', 'important', 'attention'],
  eye: ['view', 'preview', 'watch', 'visible'],
  feed: ['rss', 'news', 'subscribe'],
  film: ['movie', 'video', 'cinema'],
  fire: ['flame', 'burn', 'hot'],
  flag: ['country', 'nation'],
  folder: ['directory'],
  group: ['users', 'people', 'team', 'community'],
  gun: ['weapon', 'pistol', 'firearm', 'rifle', 'shoot', 'ammo', 'bullet'],
  bomb: ['explosive', 'mine', 'grenade'],
  heart: ['favorite', 'like', 'love'],
  help: ['question', 'info', 'support', 'faq'],
  house: ['home', 'main'],
  html: ['markup', 'web', 'page'],
  image: ['photo', 'picture'],
  information: ['info', 'details', 'about'],
  key: ['password', 'access', 'auth'],
  layout: ['grid', 'template', 'arrange'],
  lightning: ['bolt', 'power', 'energy'],
  lightbulb: ['idea', 'inspiration', 'tip'],
  link: ['url', 'chain', 'anchor', 'hyperlink'],
  lock: ['secure', 'security', 'password', 'private'],
  lorry: ['truck', 'freight', 'shipping'],
  magnifier: ['search', 'find', 'zoom', 'lookup'],
  medal: ['award', 'prize', 'silver', 'gold'],
  monitor: ['display', 'screen', 'panel'],
  money: ['cash', 'currency', 'payment', 'price'],
  mouse: ['cursor', 'pointer', 'click'],
  music: ['audio', 'sound', 'song', 'player'],
  note: ['memo', 'annotation'],
  package: ['box', 'parcel', 'delivery'],
  page: ['file', 'document', 'paper', 'blank'],
  pencil: ['edit', 'write', 'modify', 'rename'],
  phone: ['call', 'telephone'],
  picture: ['image', 'photo'],
  pill: ['medicine', 'drug', 'health'],
  plugin: ['extension', 'addon', 'module'],
  printer: ['print'],
  rainbow: ['colorful', 'gradient'],
  report: ['analytics', 'chart', 'stats'],
  resultset: ['first', 'last', 'next', 'previous', 'pager'],
  ruby: ['gem', 'lang', 'code'],
  script: ['code', 'javascript', 'program'],
  server: ['host', 'backend', 'cloud'],
  sound: ['audio', 'volume', 'speaker'],
  star: ['favorite', 'bookmark', 'rating'],
  status: ['online', 'offline', 'presence'],
  table: ['grid', 'spreadsheet', 'data', 'rows'],
  tag: ['label', 'mark'],
  telephone: ['call', 'phone'],
  text: ['font', 'typography'],
  textfield: ['input', 'field', 'form'],
  time: ['clock', 'hour', 'schedule'],
  timeline: ['history', 'progress'],
  transmit: ['send', 'upload', 'broadcast'],
  user: ['person', 'profile', 'account', 'avatar'],
  vector: ['svg', 'path', 'shape'],
  water: ['drop', 'liquid', 'ocean'],
  weather: ['forecast', 'rain', 'cloud', 'sun'],
  world: ['globe', 'internet', 'web', 'earth'],
  wrench: ['tools', 'repair', 'maintenance', 'settings'],
  xhtml: ['markup', 'web', 'page'],
};

/**
 * Explicit icon-to-icon relations for the related strip.
 *
 * The synonym groups above are built for query expansion, where a term must
 * reach exactly one canonical icon. Here we want the whole neighbourhood of
 * an icon, so the relations are symmetric and may list several peers — this
 * is what gives single segment icons like `accept` or `gun` a useful strip
 * instead of an empty one.
 */
const RELATIONS = {
  accept: ['tick', 'cross', 'cancel', 'stop'],
  tick: ['accept', 'cross'],
  cross: ['cancel', 'accept', 'delete', 'tick'],
  cancel: ['cross', 'accept', 'stop'],
  stop: ['cancel', 'pause'],
  delete: ['bin', 'cross', 'cancel'],
  bin: ['delete', 'cross'],
  zoom: ['magnifier', 'find'],
  magnifier: ['zoom', 'find'],
  find: ['magnifier', 'zoom'],
  lock: ['key', 'shield', 'lock_open'],
  key: ['lock', 'shield'],
  shield: ['lock', 'key'],
  user: ['group', 'vcard', 'female', 'male', 'emoticon_smile'],
  group: ['user'],
  star: ['heart', 'thumb_up', 'award_star_add'],
  heart: ['star', 'thumb_up'],
  money: ['coins', 'creditcards'],
  coins: ['money'],
  creditcards: ['money'],
  clock: ['time', 'calendar', 'hourglass'],
  time: ['clock', 'hourglass'],
  calendar: ['date', 'clock', 'time'],
  hourglass: ['time', 'clock'],
  cog: ['wrench', 'control'],
  wrench: ['cog', 'paintbrush', 'plug'],
  error: ['exclamation', 'bug', 'status'],
  exclamation: ['error', 'bug'],
  bug: ['error', 'exclamation'],
  help: ['information', 'lightbulb'],
  information: ['help', 'lightbulb'],
  lightbulb: ['help', 'information'],
  gun: ['bomb', 'fire'],
  bomb: ['gun', 'fire'],
  fire: ['bomb', 'water'],
  water: ['fire', 'weather'],
  lightning: ['plug', 'asterisk_orange'],
  status: ['online', 'offline', 'busy', 'away'],
  monitor: ['computer', 'television'],
  television: ['monitor', 'film'],
  film: ['television', 'camera'],
  camera: ['photo', 'picture'],
  picture: ['image', 'photo', 'camera'],
  image: ['picture', 'photo'],
  photo: ['picture', 'image', 'camera'],
  email: ['mail', 'comment'],
  comment: ['comments', 'email'],
  comments: ['comment', 'email'],
  feed: ['rss', 'email'],
  rss: ['feed', 'email'],
  page: ['note', 'book', 'report'],
  book: ['page', 'note', 'newspaper'],
  note: ['page', 'book'],
  report: ['chart', 'table'],
  chart: ['report', 'table'],
  table: ['chart', 'report'],
  database: ['server', 'drive'],
  server: ['database', 'computer'],
  drive: ['disk', 'database'],
  disk: ['drive'],
  folder: ['drive', 'page'],
  application: ['layout'],
  layout: ['application', 'table'],
  textfield: ['comment', 'table'],
  text: ['font', 'textfield'],
  font: ['text', 'textfield'],
  tag: ['star', 'heart'],
  cart: ['basket', 'coins'],
  basket: ['cart', 'money'],
  world: ['map', 'globe'],
  map: ['world', 'globe'],
  weather: ['water', 'fire'],
  building: ['house', 'office'],
  house: ['building'],
  lorry: ['car', 'package'],
  car: ['lorry', 'package'],
  package: ['box', 'lorry'],
  pill: ['medicine'],
};

/** Extra words that resolve to a whole category. */
const CATEGORY_WORDS = {
  actions: ['action', 'edit', 'operation'],
  navigation: ['navigate', 'direction'],
  interface: ['ui', 'widget', 'layout'],
  files: ['file', 'document', 'doc'],
  data: ['database', 'analytics'],
  people: ['person', 'user', 'team'],
  comms: ['communication', 'message', 'contact'],
  media: ['image', 'video', 'audio'],
  time: ['date', 'schedule'],
  commerce: ['shop', 'payment', 'money'],
  security: ['auth', 'permission'],
  system: ['device', 'hardware', 'software'],
  transport: ['vehicle', 'place'],
  code: ['code', 'web', 'developer', 'markup'],
  status: ['state', 'signal'],
  misc: ['other'],
};

/** How many related icons are stored per icon. */
const RELATED_SIZE = 12;

const tokenize = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean);

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

/**
 * Maps every query term to the catalog terms it can reach.
 *
 * A group has one *lead* — the icon the group is really about (`cog` for
 * gear, `bin` for trash, `page` for file). The lead describes the group by
 * itself, and every other member reaches the lead first, so the lead can
 * carry a small ranking bonus.
 *
 * A term that is itself a lead keeps its own group: `chart` describes the
 * chart family, so it must not be dragged towards `report` by the fact that
 * `report` also lists `chart` as a synonym.
 */
function buildSynonyms(vocab) {
  const inVocab = new Set(vocab);
  const leads = new Set(Object.keys(SYNONYMS));
  const synonyms = {};

  for (const [lead, values] of Object.entries(SYNONYMS)) {
    const others = values.filter((value) => inVocab.has(value));

    if (others.length > 0) synonyms[lead] = others;

    for (const member of values) {
      if (leads.has(member)) continue;

      const reachable = inVocab.has(lead)
        ? [lead, ...others.filter((value) => value !== member)]
        : others.filter((value) => value !== member);
      if (reachable.length === 0) continue;

      // A member can sit in several groups (`trash` is in both the bin group
      // and the delete group). Merge the lists, each group's lead first.
      const existing = synonyms[member] ?? [];
      synonyms[member] = [...existing, ...reachable.filter((value) => !existing.includes(value))];
    }
  }

  return synonyms;
}

function buildCategoryWords() {
  const words = {};

  CATEGORIES.forEach((category, index) => {
    words[category.id] = index;
    words[category.label.toLowerCase()] = index;
    for (const word of CATEGORY_WORDS[category.id] ?? []) words[word] = index;
  });

  return words;
}

/**
 * Builds the related strip for every icon.
 *
 * Evidence is ranked by how specific it is:
 *   1. an explicit relation (`accept` -> `tick`, `cross`, `cancel`)
 *   2. the icons a name segment points at on its own (`folder_add` -> the
 *      `folder` icon and the `add` icon)
 *   3. the family that shares the first segment (`folder_*`)
 *   4. a synonym peer that is an icon name
 *   5. the rest of the category, so the strip is never empty
 */
function buildRelated(icons, vocabIndex, exact, synonyms, categoryIcons) {
  const byName = new Map(icons.map((icon, index) => [icon.n, index]));

  return icons.map((icon, id) => {
    const peers = [];
    const seen = new Set([id]);

    const push = (candidate) => {
      if (candidate === undefined || seen.has(candidate)) return;
      seen.add(candidate);
      peers.push(candidate);
    };

    const segments = tokenize(icon.n);

    // 1. explicit relations
    for (const name of RELATIONS[icon.n] ?? []) push(byName.get(name));

    // 2. the icons a segment points at on its own
    for (const segment of segments) push(byName.get(segment));

    // 3. the families a segment points at, rarest family first
    const families = segments
      .map((segment) => ({ ids: exact[vocabIndex.get(segment) ?? -1] ?? [] }))
      .filter((family) => family.ids.length > 0)
      .sort((left, right) => left.ids.length - right.ids.length);

    for (const family of families) {
      for (const peer of family.ids) push(peer);
    }

    // 4. synonym peers
    for (const segment of segments) {
      for (const synonym of synonyms[segment] ?? []) {
        const position = vocabIndex.get(synonym);
        if (position === undefined) continue;
        for (const peer of exact[position]) push(peer);
      }
    }

    // 5. the rest of the category
    for (const peer of categoryIcons.get(icon.c) ?? []) push(peer);

    return peers.slice(0, RELATED_SIZE);
  });
}

const sprite = readSprite();
const names = [...sprite.keys()].sort((a, b) => a.localeCompare(b, 'en'));

const categoryIndex = new Map(CATEGORIES.map((category, index) => [category.id, index]));

const icons = names.map((name) => {
  const category = categoryFor(name);
  return { n: name, c: categoryIndex.get(category) ?? categoryIndex.get('misc'), p: sprite.get(name) };
});

// Vocabulary: every distinct name token.
const vocabSet = new Set();
for (const icon of icons) {
  for (const token of tokenize(icon.n)) vocabSet.add(token);
}
const vocab = [...vocabSet].sort();
const vocabIndex = new Map(vocab.map((term, index) => [term, index]));

// Inverted index: token -> icon ids.
const exact = vocab.map(() => []);
icons.forEach((icon, id) => {
  for (const token of new Set(tokenize(icon.n))) {
    exact[vocabIndex.get(token)].push(id);
  }
});

const synonyms = buildSynonyms(vocab);
const categoryWords = buildCategoryWords();

const categoryIcons = new Map();
icons.forEach((icon, id) => {
  const bucket = categoryIcons.get(icon.c) ?? [];
  bucket.push(id);
  categoryIcons.set(icon.c, bucket);
});

const related = buildRelated(icons, vocabIndex, exact, synonyms, categoryIcons);

const catalog = {
  version: 2,
  categories: CATEGORIES,
  categoryWords,
  synonyms,
  icons,
  vocab,
  exact,
  related,
};

const target = path.resolve('src/lib/data/catalog.json');
const json = `${JSON.stringify(catalog)}\n`;

// Only write when the content changed, so a dev server watcher never loops.
let previous = '';
try {
  previous = readFileSync(target, 'utf8');
} catch {
  previous = '';
}

if (previous !== json) {
  writeFileSync(target, json);
  console.log(`wrote ${icons.length} icons to ${target}`);
} else {
  console.log(`${target} is up to date`);
}

const counts = new Map();
for (const icon of icons) counts.set(icon.c, (counts.get(icon.c) ?? 0) + 1);

console.log(`  payload ${(json.length / 1024).toFixed(1)} KB uncompressed`);
console.log(`  ${CATEGORIES.map(({ id }) => `${id}=${counts.get(categoryIndex.get(id)) ?? 0}`).join(' ')}`);
