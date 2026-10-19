// Builds the runtime sprite assets from the pristine vendor files in /vendor.
//
//   node scripts/build-sprite.mjs
//
// Two things happen here:
//  1. The upstream sheet uses an 18px pitch (16px icon + 2px gutter) inside a
//     576x576 canvas. Icons are re-packed on a 16px pitch, which drops ~21% of
//     the pixels that ship to the browser.
//  2. The result is re-encoded with per-scanline filter selection and maximum
//     deflate. Strictly lossless: the pixel data is copied verbatim.
import { deflateSync, inflateSync } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const VENDOR_PNG = 'vendor/famfamfam-silk.png';
const VENDOR_CSS = 'vendor/famfamfam-silk.css';
const OUT_PNG = 'src/assets/famfamfam/sprite.png';
const OUT_CSS = 'src/lib/styles/silk.css';

const ICON = 16;
/**
 * The upstream sheet uses an 18px pitch and the published `background-position`
 * already points at the first pixel of the icon (`accept` is `-1px -1px`, so
 * its pixels start at 1, not 0). The icon is therefore read from exactly
 * `|position|`, with no extra offset.
 */
const COLUMNS = 32;

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = -1;
  for (let i = 0; i < buffer.length; i += 1) c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);

  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));

  return Buffer.concat([length, body, crc]);
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

function decodePng(buffer) {
  if (buffer.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');

  let width = 0;
  let height = 0;
  const idat = [];

  for (let offset = 8; offset < buffer.length; ) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('latin1', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8 || data[9] !== 6) throw new Error('expected an 8-bit RGBA PNG');
      if (data[12] !== 0) throw new Error('interlaced PNGs are not supported');
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }

    offset += 12 + length;
  }

  const stride = width * 4;
  const raw = inflateSync(Buffer.concat(idat));
  const pixels = Buffer.alloc(stride * height);

  for (let row = 0; row < height; row += 1) {
    const filter = raw[row * (stride + 1)];
    const source = raw.subarray(row * (stride + 1) + 1, row * (stride + 1) + 1 + stride);
    const target = pixels.subarray(row * stride, (row + 1) * stride);
    const previous = row > 0 ? pixels.subarray((row - 1) * stride, row * stride) : null;

    for (let i = 0; i < stride; i += 1) {
      const left = i >= 4 ? target[i - 4] : 0;
      const up = previous ? previous[i] : 0;
      const upLeft = previous && i >= 4 ? previous[i - 4] : 0;

      switch (filter) {
        case 0: target[i] = source[i]; break;
        case 1: target[i] = (source[i] + left) & 0xff; break;
        case 2: target[i] = (source[i] + up) & 0xff; break;
        case 3: target[i] = (source[i] + ((left + up) >> 1)) & 0xff; break;
        case 4: target[i] = (source[i] + paeth(left, up, upLeft)) & 0xff; break;
        default: throw new Error(`unsupported filter ${filter} on row ${row}`);
      }
    }
  }

  return { width, height, pixels };
}

function encodePng({ width, height, pixels }) {
  const stride = width * 4;
  const scanlines = Buffer.alloc((stride + 1) * height);
  const candidate = Buffer.alloc(stride);

  for (let row = 0; row < height; row += 1) {
    const line = pixels.subarray(row * stride, (row + 1) * stride);
    const previous = row > 0 ? pixels.subarray((row - 1) * stride, row * stride) : null;

    let bestFilter = 0;
    let bestScore = Infinity;
    let bestLine = null;

    for (let filter = 0; filter <= 4; filter += 1) {
      let score = 0;

      for (let i = 0; i < stride; i += 1) {
        const left = i >= 4 ? line[i - 4] : 0;
        const up = previous ? previous[i] : 0;
        const upLeft = previous && i >= 4 ? previous[i - 4] : 0;

        let value;
        switch (filter) {
          case 0: value = line[i]; break;
          case 1: value = line[i] - left; break;
          case 2: value = line[i] - up; break;
          case 3: value = line[i] - ((left + up) >> 1); break;
          default: value = line[i] - paeth(left, up, upLeft); break;
        }

        value &= 0xff;
        candidate[i] = value;
        score += value < 128 ? value : 256 - value;
      }

      if (score < bestScore) {
        bestScore = score;
        bestFilter = filter;
        bestLine = Buffer.from(candidate);
      }
    }

    scanlines[row * (stride + 1)] = bestFilter;
    bestLine.copy(scanlines, row * (stride + 1) + 1);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(scanlines, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function readVendorPositions() {
  const css = readFileSync(VENDOR_CSS, 'utf8');
  const positions = new Map();

  for (const match of css.matchAll(
    /\.icon\.([a-z0-9_]+)\s*\{\s*background-position:\s*(-?\d+)px\s+(-?\d+)px;?\s*\}/g,
  )) {
    positions.set(match[1], [Number(match[2]), Number(match[3])]);
  }

  if (positions.size === 0) throw new Error(`no sprite rules found in ${VENDOR_CSS}`);
  return [...positions.keys()].sort((a, b) => a.localeCompare(b, 'en')).map((name) => ({
    name,
    position: positions.get(name),
  }));
}

const entries = readVendorPositions();
const source = decodePng(readFileSync(VENDOR_PNG));

const rows = Math.ceil(entries.length / COLUMNS);
const width = COLUMNS * ICON;
const height = rows * ICON;
const packed = Buffer.alloc(width * height * 4);

entries.forEach((entry, index) => {
  const [x, y] = entry.position;
  const fromX = -x;
  const fromY = -y;
  const toX = index % COLUMNS;
  const toY = Math.floor(index / COLUMNS);

  for (let row = 0; row < ICON; row += 1) {
    const from = ((fromY + row) * source.width + fromX) * 4;
    const to = ((toY * ICON + row) * width + toX * ICON) * 4;
    source.pixels.copy(packed, to, from, from + ICON * 4);
  }
});

const png = encodePng({ width, height, pixels: packed });

mkdirSync(path.dirname(OUT_PNG), { recursive: true });
mkdirSync(path.dirname(OUT_CSS), { recursive: true });

const stylesheet = [
  '/*',
  ' * Generated by scripts/build-sprite.mjs - do not edit.',
  ' * FamFamFam "Silk" icon pack by Mark James (famfamfam.com), CC BY 2.5.',
  ' * https://creativecommons.org/licenses/by/2.5/',
  ' *',
  ' * Positions are expressed in cells (--silk-scale) so the sheet scales with',
  ` * --silk-size: a ${ICON}px icon is drawn from a ${width}x${height} sheet, and scaling the`,
  ` * background position with the background size keeps each icon inside its own`,
  ' * cell at any preview size.',
  ' */',
  '',
  '.silk {',
  `  --silk-scale: calc(var(--silk-size, ${ICON}px) / ${ICON});`,
  '  display: inline-block;',
  '  flex: none;',
  '  width: var(--silk-size, 16px);',
  '  height: var(--silk-size, 16px);',
  '  background-image: url("../../assets/famfamfam/sprite.png");',
  '  background-repeat: no-repeat;',
  `  background-size: calc(${width} * var(--silk-scale)) calc(${height} * var(--silk-scale));`,
  '  vertical-align: middle;',
  '}',
  '',
  '',
].join('\n');

const rules = entries.map((entry, index) => {
  const x = -(index % COLUMNS) * ICON;
  const y = -Math.floor(index / COLUMNS) * ICON;
  return `.silk.${entry.name}{background-position:calc(${x} * var(--silk-scale)) calc(${y} * var(--silk-scale))}`;
});

const before = readFileSync(VENDOR_PNG).length;

// Only write when the content changed, so a dev server watcher never loops.
function writeIfChanged(file, content) {
  let previous = '';
  try {
    previous = readFileSync(file, 'utf8');
  } catch {
    previous = '';
  }

  if (previous === content) return false;
  writeFileSync(file, content);
  return true;
}

const pngChanged = writeIfChanged(OUT_PNG, png);
const cssChanged = writeIfChanged(OUT_CSS, `${stylesheet}${rules.join('\n')}\n`);

console.log(`packed ${entries.length} icons into ${width}x${height}`);
console.log(
  `sprite: ${(before / 1024).toFixed(1)} KB -> ${(png.length / 1024).toFixed(1)} KB (${((1 - png.length / before) * 100).toFixed(0)}% smaller, lossless)`,
);
console.log(`${pngChanged ? 'wrote' : 'unchanged'} ${OUT_PNG}`);
console.log(`${cssChanged ? 'wrote' : 'unchanged'} ${OUT_CSS}`);