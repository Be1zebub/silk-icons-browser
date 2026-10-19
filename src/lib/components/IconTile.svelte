<script lang="ts">
  import HighlightName from './HighlightName.svelte';
  import type { Range } from '../core/types';

  interface Props {
    name: string;
    ranges?: readonly Range[];
    size: number;
    selected?: boolean;
    copied?: boolean;
    compact?: boolean;
    title?: string;
    /** Roving tabindex: only the active tile stays in the tab order. */
    tabbable?: boolean;
    onclick?: (event: MouseEvent) => void;
  }

  let {
    name,
    ranges = [],
    size,
    selected = false,
    copied = false,
    compact = false,
    title,
    tabbable = false,
    onclick,
  }: Props = $props();
</script>

<button
  type="button"
  class="tile"
  data-compact={compact}
  data-selected={selected}
  data-copied={copied}
  style="--silk-size: {size}px"
  aria-pressed={selected}
  tabindex={tabbable ? 0 : -1}
  title={title ?? name}
  {onclick}
>
  <span class="glyph">
    <i class="silk {name}"></i>
    {#if copied}<span class="check" aria-hidden="true"></span>{/if}
  </span>
  <span class="name"><HighlightName text={name} {ranges} /></span>
</button>

<style>
  .tile {
    display: flex;
    min-width: 0;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    gap: 0.5rem;
    padding: 0.75rem 0.375rem 0.625rem;
    border: 1px solid transparent;
    border-radius: var(--radius-lg);
    background-color: transparent;
    color: inherit;
    text-align: center;
    transition:
      background-color var(--duration) var(--ease),
      border-color var(--duration) var(--ease),
      transform var(--duration) var(--ease);
  }

  .tile:hover {
    border-color: color-mix(in oklab, var(--border) 14%, transparent);
    background-color: color-mix(in oklab, var(--input) 10%, transparent);
  }

  .tile:active {
    transform: scale(0.975);
  }

  .tile[data-selected='true'] {
    border-color: color-mix(in oklab, var(--primary) 45%, transparent);
    background-color: color-mix(in oklab, var(--primary) 12%, transparent);
  }

  .glyph {
    position: relative;
    display: inline-flex;
    width: 100%;
    height: calc(var(--silk-size) + 1.5rem);
    align-items: center;
    justify-content: center;
  }

  .tile[data-compact='true'] .glyph {
    height: calc(var(--silk-size) + 0.75rem);
  }

  .glyph :global(.silk) {
    image-rendering: pixelated;
  }

  .check {
    position: absolute;
    right: 0;
    bottom: 0;
    width: 0.875rem;
    height: 0.875rem;
    border-radius: 999px;
    background-color: var(--success);
    box-shadow: 0 0 0 2px var(--background);
    animation: silk-pop 180ms var(--ease);
  }

  .check::after {
    content: '';
    position: absolute;
    inset: 0;
    background: no-repeat center/0.5625rem
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%23000' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3.5 8.5 6.5 11.5 12.5 4.5'/%3E%3C/svg%3E");
  }

  .name {
    display: -webkit-box;
    width: 100%;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    font-family: var(--font-mono);
    font-size: var(--text-2xs);
    line-height: 0.9375rem;
    color: color-mix(in oklab, var(--foreground) 58%, transparent);
    overflow-wrap: normal;
    word-break: normal;
    transition: color var(--duration) var(--ease);
  }

  .tile[data-compact='true'] .name {
    -webkit-line-clamp: 1;
    line-clamp: 1;
    white-space: nowrap;
  }

  .tile:hover .name,
  .tile[data-selected='true'] .name {
    color: color-mix(in oklab, var(--foreground) 88%, transparent);
  }
</style>