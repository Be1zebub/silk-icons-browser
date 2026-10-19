import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
	fetchGlobalCounts,
	MemoryUsageStorage,
	postCounts,
	rankCounts,
	UsageCounter,
} from '../src/lib/core/usage.ts';
import { Counters } from '../src/worker/counters.ts';

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

describe('usage transport', () => {
  it('ranks counts', () => {
    assert.deepEqual(rankCounts({ b: 2, a: 5, c: 1 }), ['a', 'b', 'c']);
  });

  it('reads the global counts', async () => {
    const fetchImpl = async () =>
      new Response(JSON.stringify({ counts: { accept: 3, zoom: 1 } }), { status: 200 });

    assert.deepEqual(await fetchGlobalCounts('/api/usage', fetchImpl), { accept: 3, zoom: 1 });
  });

  it('survives a broken endpoint', async () => {
    const fetchImpl = async () => {
      throw new Error('offline');
    };

    assert.deepEqual(await fetchGlobalCounts('/api/usage', fetchImpl), {});
  });

  it('posts the delta', async () => {
    let sent = null;

    const fetchImpl = async (_url, options) => {
      sent = options.body;
      return new Response(null, { status: 204 });
    };

    assert.equal(await postCounts('/api/usage', { accept: 2 }, fetchImpl), true);
    assert.equal(sent, JSON.stringify({ counts: { accept: 2 } }));
  });
});

describe('durable object', () => {
  /** A Durable Object state backed by a Map. */
  function memoryState() {
    const store = new Map();

    return {
      store,
      storage: {
        async get(key) {
          return store.get(key)
        },
        async put(key, value) {
          store.set(key, value)
        },
      },
    };
  }

  const post = (body) =>
    new Request('https://silk.bzbb.dev/api/usage', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  it('stores the counts', async () => {
    const state = memoryState();
    const counters = new Counters(state);

    const response = await counters.fetch(post({ counts: { accept: 2, zoom: 1 } }));

    assert.equal(response.status, 204);
    assert.deepEqual(state.store.get('counts'), { accept: 2, zoom: 1 });
  });

  it('adds to the stored counts', async () => {
    const state = memoryState();
    const counters = new Counters(state);

    await counters.fetch(post({ counts: { accept: 2 } }));
    await counters.fetch(post({ counts: { accept: 3 } }));

    assert.equal(state.store.get('counts').accept, 5);
  });

  it('ignores junk', async () => {
    const state = memoryState();
    const counters = new Counters(state);

    await counters.fetch(post({ counts: { accept: 2 } }));
    await counters.fetch(post({ counts: { '<script>': 5, ok: -1, nan: 'x' } }));

    assert.deepEqual(state.store.get('counts'), { accept: 2 });
  });

  it('rejects a body without counts', async () => {
    const counters = new Counters(memoryState());
    const response = await counters.fetch(post({}));

    assert.equal(response.status, 400);
  });

  it('answers the ranking, most copied first', async () => {
    const state = memoryState();
    const counters = new Counters(state);

    await counters.fetch(post({ counts: { accept: 2, zoom: 7 } }));

    const response = await counters.fetch(new Request('https://silk.bzbb.dev/api/usage'));
    const body = await response.json();

    assert.deepEqual(body.counts, { zoom: 7, accept: 2 });
  });
});
