import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { MemoryUsageStorage, UsageCounter } from '../src/lib/core/usage.ts';

describe('usage counter', () => {
  it('counts copies per icon', () => {
    const counter = new UsageCounter(new MemoryUsageStorage());

    counter.record('accept');
    counter.record('accept');
    counter.record('zoom');

    assert.equal(counter.countOf('accept'), 2);
    assert.equal(counter.countOf('zoom'), 1);
    assert.equal(counter.countOf('unknown'), 0);
    assert.equal(counter.total, 3);
  });

  it('ranks the most copied icons first', () => {
    const counter = new UsageCounter(new MemoryUsageStorage());

    counter.record('zoom');
    counter.record('accept');
    counter.record('accept');
    counter.record('tick');
    counter.record('accept');

    assert.deepEqual(counter.popular(), ['accept', 'tick', 'zoom']);
  });

  it('breaks a tie alphabetically', () => {
    const counter = new UsageCounter(new MemoryUsageStorage());

    counter.record('zoom');
    counter.record('accept');

    assert.deepEqual(counter.popular(), ['accept', 'zoom']);
  });

  it('survives a reload', () => {
    const storage = new MemoryUsageStorage();

    new UsageCounter(storage).record('accept');
    const reloaded = new UsageCounter(storage);

    assert.equal(reloaded.countOf('accept'), 1);
  });

  it('caps the number of tracked icons', () => {
    const counter = new UsageCounter(new MemoryUsageStorage());

    for (let index = 0; index < 700; index += 1) counter.record(`icon_${index}`);

    assert.equal(counter.popular(1000).length, 512);
  });

  it('resets', () => {
    const counter = new UsageCounter(new MemoryUsageStorage());

    counter.record('accept');
    counter.reset();

    assert.equal(counter.total, 0);
    assert.deepEqual(counter.popular(), []);
  });
});
