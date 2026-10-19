// Verifies that the repacked spritesheet holds the same pixels as upstream.
//
//   node scripts/verify-sprite.mjs
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

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

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

function decodePng(buffer) {
  let width = 0;
  let height = 0;
  let colourType = 6;
  let ihdr = null;
  const idat = [];
  const chunks = [];

  for (let offset = 8; offset < buffer.length; ) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('latin1', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colourType = data[9];
      ihdr = Buffer.from(data);
    } else if (type === 'IDAT') {
      idat.push(Buffer.from(data));
    } else if (type === 'PLTE' || type === 'tRNS') {
      chunks.push([type, Buffer.from(data)]);
    } else if (type === 'IEND') {
      break;
    }

    offset += 12 + length;
  }

  if (colourType === 6) return { width, height, pixels: decodeRgba(buffer, idat, width, height) };
  if (colourType === 3) return { width, height, pixels: decodePalette(buffer, idat, width, height, chunks) };

  throw new Error(`unsupported colour type ${colourType}`);
}

function decodeRgba(buffer, idat, width, height) {
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

      let value;
      switch (filter) {
        case 0: value = source[i]; break;
        case 1: value = source[i] + left; break;
        case 2: value = source[i] + up; break;
        case 3: value = source[i] + ((left + up) >> 1); break;
        default: value = source[i] + paeth(left, up, upLeft); break;
      }
      target[i] = value & 0xff;
    }
  }

  return pixels;
}

function decodePalette(buffer, idat, width, height, chunks) {
  const palette = chunks.find(([type]) => type === 'PLTE')?.[1];
  const alpha = chunks.find(([type]) => type === 'tRNS')?.[1];

  if (!palette) throw new Error('indexed PNG without PLTE');

  const stride = width;
  const raw = inflateSync(Buffer.concat(idat));
  const indices = Buffer.alloc(stride * height);

  for (let row = 0; row < height; row += 1) {
    const filter = raw[row * (stride + 1)];
    const source = raw.subarray(row * (stride + 1) + 1, row * (stride + 1) + 1 + stride);
    const target = indices.subarray(row * stride, (row + 1) * stride);
    const previous = row > 0 ? indices.subarray((row - 1) * stride, row * stride) : null;

    for (let i = 0; i < stride; i += 1) {
      const left = i >= 1 ? target[i - 1] : 0;
      const up = previous ? previous[i] : 0;
      const upLeft = previous && i >= 1 ? previous[i - 1] : 0;

      let value;
      switch (filter) {
        case 0: value = source[i]; break;
        case 1: value = source[i] + left; break;
        case 2: value = source[i] + up; break;
        case 3: value = source[i] + ((left + up) >> 1); break;
        default: value = source[i] + paeth(left, up, upLeft); break;
      }
      target[i] = value & 0xff;
    }
  }

  const pixels = Buffer.alloc(width * height * 4);
  for (let i = 0; i < indices.length; i += 1) {
    const index = indices[i];
    pixels[i * 4] = palette[index * 3];
    pixels[i * 4 + 1] = palette[index * 3 + 1];
    pixels[i * 4 + 2] = palette[index * 3 + 2];
    pixels[i * 4 + 3] = alpha && index < alpha.length ? alpha[index] : 255;
  }

  return pixels;
}

const upstream = decodePng(readFileSync('vendor/famfamfam-silk.png'));
const packed = decodePng(readFileSync('src/assets/famfamfam/sprite.png'));

// Upstream positions: the published 18px pitch map.
const upstreamCss = readFileSync('vendor/famfamfam-silk.css', 'utf8');
const upstreamPositions = new Map();
for (const match of upstreamCss.matchAll(/\.icon\.([a-z0-9_]+)\s*\{\s*background-position:\s*(-?\d+)px\s+(-?\d+)px/g)) {
  upstreamPositions.set(match[1], [Number(match[2]), Number(match[3])]);
}

// Packed positions: the generated 16px pitch map.
const css = readFileSync('src/lib/styles/silk.css', 'utf8');
const positions = new Map();
for (const match of css.matchAll(/^\.silk\.([a-z0-9_]+)\{background-position:calc\((-?\d+) \* var\(--silk-scale\)\) calc\((-?\d+) \* var\(--silk-scale\)\)\}$/gm)) {
  positions.set(match[1], [Number(match[2]), Number(match[3])]);
}

console.log(`upstream ${upstream.width}x${upstream.height}, packed ${packed.width}x${packed.height}`);

// Bounding box of the non transparent pixels of a cell in the upstream sheet.
function bounds(image, x, y, size) {
  let minX = size;
  let minY = size;
  let maxX = -1;
  let maxY = -1;

  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      const alpha = image.pixels[((y + row) * image.width + (x + column)) * 4 + 3];
      if (alpha === 0) continue;
      if (column < minX) minX = column;
      if (column > maxX) maxX = column;
      if (row < minY) minY = row;
      if (row > maxY) maxY = row;
    }
  }

  return maxX < 0 ? null : { minX, minY, maxX, maxY };
}

const sample = ['accept', 'add', 'heart_add', 'application', 'zoom'];
for (const name of sample) {
  const [x, y] = upstreamPositions.get(name);
  const originX = -x;
  const originY = -y;

  // Where the icon actually lives inside the upstream cell.
  const cell = bounds(upstream, originX - 2, originY - 2, 20);
  console.log(`${name.padEnd(14)} upstream origin=(${originX},${originY}) cell bounds=${JSON.stringify(cell)}`);
}

// Compare the packed pixels against the upstream region for every icon.
let mismatched = 0;
let worst = null;

const names = [...positions.keys()];

for (const [name, [x, y]] of positions) {
  const packedIndex = names.indexOf(name);
  const column = packedIndex % 32;
  const row = Math.floor(packedIndex / 32);
  const targetX = column * 16;
  const targetY = row * 16;

  const [upstreamX, upstreamY] = upstreamPositions.get(name);

  for (let rowOffset = 0; rowOffset < 16; rowOffset += 1) {
    for (let columnOffset = 0; columnOffset < 16; columnOffset += 1) {
      const from = ((-upstreamY + rowOffset) * upstream.width + (-upstreamX + columnOffset)) * 4;
      const to = ((targetY + rowOffset) * packed.width + (targetX + columnOffset)) * 4;

      for (let channel = 0; channel < 4; channel += 1) {
        if (upstream.pixels[from + channel] !== packed.pixels[to + channel]) {
          mismatched += 1;
          if (!worst) worst = { name, from: [-upstreamX + columnOffset, -upstreamY + rowOffset] };
          break;
        }
      }
    }
  }
}

console.log(`\nmismatching pixels: ${mismatched}${worst ? ` (first at ${worst.name} ${JSON.stringify(worst.from)})` : ''}`);
