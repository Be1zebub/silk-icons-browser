<script lang="ts">
  import IconTile from './IconTile.svelte';
  import type { SearchHit } from '../core/types';

  const PAGE = 120;
  const FIRST_PAGE = 160;

  interface Props {
    hits: readonly SearchHit[];
    tileSize: number;
    pixelated: boolean;
    selected: string | null;
    copied: string | null;
    /** Minimum tile width derived from the current preview size. */
    tileMin: number;
    onselect: (name: string) => void;
    onactivate: (name: string) => void;
  }

  let { hits, tileSize, pixelated, selected, copied, tileMin, onselect, onactivate }: Props = $props();

  let grid = $state<HTMLDivElement | null>(null);
  let sentinel = $state<HTMLDivElement | null>(null);
  let visible = $state(FIRST_PAGE);
  let columns = $state(1);

  const shown = $derived(hits.slice(0, visible));
  const hasMore = $derived(visible < hits.length);

  // A new result set restarts paging from the top.
  $effect(() => {
    void hits;
    visible = FIRST_PAGE;
  });

  $effect(() => {
    const element = grid;
    if (!element) return;

    const observer = new ResizeObserver(() => {
      const template = getComputedStyle(element).gridTemplateColumns;
      columns = Math.max(1, template.split(' ').filter(Boolean).length);
    });

    observer.observe(element);
    return () => observer.disconnect();
  });

  $effect(() => {
    const element = sentinel;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          visible = Math.min(visible + PAGE, hits.length);
        }
      },
      { rootMargin: '600px 0px' },
    );

    observer.observe(element);
    return () => observer.disconnect();
  });

  export function move(direction: 'left' | 'right' | 'up' | 'down'): void {
    if (hits.length === 0) return;

    const step = direction === 'left' ? -1 : direction === 'right' ? 1 : direction === 'up' ? -columns : columns;
    const current = selected ? hits.findIndex((hit) => hit.icon.name === selected) : -1;
    const next = current === -1 ? 0 : Math.min(hits.length - 1, Math.max(0, current + step));

    if (next === current) return;

    if (next >= visible) visible = Math.min(hits.length, next + PAGE);
    onselect(hits[next].icon.name);
    scrollIntoView(hits[next].icon.name);
  }

  function scrollIntoView(name: string): void {
    requestAnimationFrame(() => {
      grid?.querySelector(`[data-name="${CSS.escape(name)}"]`)?.scrollIntoView({ block: 'nearest' });
    });
  }
</script>

<div class="viewport">
  <div
    class="grid"
    bind:this={grid}
    role="listbox"
    aria-label="Icon results"
    tabindex="-1"
    style="--tile-min: {tileMin}px"
  >
    {#each shown as hit (hit.icon.name)}
      <div class="cell" data-name={hit.icon.name} role="presentation">
        <IconTile
          name={hit.icon.name}
          ranges={hit.ranges}
          size={tileSize}
          {pixelated}
          selected={selected === hit.icon.name}
          copied={copied === hit.icon.name}
          title="Copy {hit.icon.name}"
          onclick={() => {
            onselect(hit.icon.name);
            onactivate(hit.icon.name);
          }}
        />
      </div>
    {/each}
  </div>

  <div class="sentinel" bind:this={sentinel}>
    {#if hasMore}
      <span>{hits.length - visible} more</span>
    {/if}
  </div>
</div>

<style>
  .viewport {
    min-height: 0;
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem 1rem 1.5rem;
    scroll-padding-block: 1rem;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(var(--tile-min), 1fr));
    gap: 0.125rem;
    outline: none;
  }

  .cell {
    display: flex;
    min-width: 0;
  }

  .cell :global(.tile) {
    width: 100%;
  }

  .sentinel {
    display: flex;
    min-height: 1.25rem;
    align-items: center;
    justify-content: center;
    padding-top: 1rem;
    font-size: var(--text-2xs);
    line-height: var(--text-2xs-lh);
    color: color-mix(in oklab, var(--muted-foreground) 70%, transparent);
  }
</style>