import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { describe, it } from 'node:test';

const repoRoot = new URL('../', import.meta.url);

describe('sprite', () => {
  it('slices every icon pixel for pixel out of the upstream sheet', () => {
    const output = execFileSync(process.execPath, ['scripts/verify-sprite.mjs'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });

    assert.match(output, /mismatching pixels: 0/);
  });

  it('packs the icons on a 16px pitch', () => {
    const css = readFileSync(new URL('src/lib/styles/silk.css', repoRoot), 'utf8');
    const positions = [...css.matchAll(/background-position:calc\((-?\d+) \* var\(--silk-scale\)\)/g)].map(
      (match) => Number(match[1]),
    );

    assert.ok(positions.length > 1000);
    for (const position of positions) {
      assert.equal(Math.abs(position) % 16, 0, `${position} is not on a 16px pitch`);
    }
  });

  it('stays smaller than the upstream sheet', () => {
    const upstream = statSync(new URL('vendor/famfamfam-silk.png', repoRoot)).size;
    const packed = statSync(new URL('src/assets/famfamfam/sprite.png', repoRoot)).size;

    assert.ok(packed < upstream, `${packed} is not smaller than ${upstream}`);
  });
});
