<script lang="ts">
  import type { CategoryId, CategoryMeta } from '../core/types';

  interface Props {
    categories: readonly CategoryMeta[];
    counts: Readonly<Record<CategoryId, number>>;
    total: number;
    value: CategoryId | 'all';
    onchange: (value: CategoryId | 'all') => void;
  }

  let { categories, counts, total, value, onchange }: Props = $props();

  let scroller = $state<HTMLElement | null>(null);

  let scrollable = $state(false);
  let atStart = $state(true);
  let atEnd = $state(false);

  function measure(): void {
    if (!scroller) return;
    const max = scroller.scrollWidth - scroller.clientWidth;
    scrollable = max > 4;
    atStart = scroller.scrollLeft <= 2;
    atEnd = scroller.scrollLeft >= max - 2;
  }

  function onScroll(): void {
    measure();
  }

  $effect(() => {
    if (!scroller) return;

    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    measure();

    return () => observer.disconnect();
  });

  function onWheel(event: WheelEvent): void {
    if (!scroller || !scrollable) return;

    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (delta === 0) return;

    scroller.scrollLeft += delta;
    event.preventDefault();
  }
</script>

<div class="bar" data-at-start={atStart}>
  <div
    class="track"
    bind:this={scroller}
    onwheel={onWheel}
    onscroll={onScroll}
    role="group"
    aria-label="Filter by category"
  >
    <button
      type="button"
      class="chip"
      data-active={value === 'all'}
      aria-pressed={value === 'all'}
      onclick={() => onchange('all')}
    >
      All
      <span class="count">{total}</span>
    </button>

    {#each categories as category (category.id)}
      <button
        type="button"
        class="chip"
        data-active={value === category.id}
        aria-pressed={value === category.id}
        onclick={() => onchange(category.id)}
      >
        {category.label}
        <span class="count">{counts[category.id] ?? 0}</span>
      </button>
    {/each}
  </div>

  {#if scrollable && !atEnd}
    <span class="fade" aria-hidden="true"></span>
  {/if}
</div>

<style>
  .bar {
    position: relative;
    min-width: 0;
  }

  .fade {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 1px;
    width: 2.5rem;
    background: linear-gradient(to right, transparent, var(--background) 70%);
    pointer-events: none;
  }

  .track {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    padding-bottom: 1px;
    scrollbar-width: none;
  }

  .track::-webkit-scrollbar {
    display: none;
  }

  .chip {
    display: inline-flex;
    flex: none;
    height: 1.625rem;
    align-items: center;
    gap: 0.375rem;
    padding: 0 0.5rem 0 0.625rem;
    border: 1px solid transparent;
    border-radius: 999px;
    background-color: transparent;
    color: color-mix(in oklab, var(--foreground) 60%, transparent);
    font-size: var(--text-xs);
    line-height: 1;
    font-weight: 500;
    white-space: nowrap;
    transition:
      background-color var(--duration) var(--ease),
      border-color var(--duration) var(--ease),
      color var(--duration) var(--ease);
  }

  .chip:hover {
    background-color: color-mix(in oklab, var(--input) 12%, transparent);
    color: var(--foreground);
  }

  .chip[data-active='true'] {
    border-color: color-mix(in oklab, var(--border) 14%, transparent);
    background-color: color-mix(in oklab, var(--foreground) 9%, transparent);
    color: var(--foreground);
  }

  .count {
    display: inline-flex;
    min-width: 1.125rem;
    height: 1rem;
    align-items: center;
    justify-content: center;
    padding: 0 0.25rem;
    border-radius: 999px;
    background-color: color-mix(in oklab, var(--foreground) 8%, transparent);
    font-size: 0.625rem;
    font-variant-numeric: tabular-nums;
    color: var(--muted-foreground);
  }

  .chip[data-active='true'] .count {
    background-color: color-mix(in oklab, var(--primary) 30%, transparent);
    color: color-mix(in oklab, var(--primary) 85%, var(--foreground));
  }
</style>