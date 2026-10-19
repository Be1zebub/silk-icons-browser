<script lang="ts">
  import Glyph from './Glyph.svelte';
  import { relatedIcons } from '../core/search';
  import type { IconDoc } from '../core/types';

  interface Props {
    icon: IconDoc;
    entries: readonly IconDoc[];
    onselect: (name: string) => void;
    onclose: () => void;
  }

  let { icon, entries, onselect, onclose }: Props = $props();

  const related = $derived(relatedIcons(icon, entries, 32));
</script>

<div class="related-bar" role="group" aria-label="Related icons">
  <div class="strip">
    {#each related as item (item.name)}
      <button
        type="button"
        class="item"
        title={item.name}
        aria-label={item.name}
        onclick={() => onselect(item.name)}
      >
        <i class="silk {item.name}"></i>
      </button>
    {/each}
  </div>

  <button
    type="button"
    class="close"
    title="Hide related icons"
    aria-label="Hide related icons"
    onclick={onclose}
  >
    <Glyph name="close" size={13} />
  </button>
</div>

<style>
  .related-bar {
    display: flex;
    flex: none;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border-top: 1px solid color-mix(in oklab, var(--border) 45%, transparent);
    background-color: color-mix(in oklab, var(--card) 55%, transparent);
    backdrop-filter: blur(12px);
    animation: silk-fade-in 160ms var(--ease);
  }

  .strip {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 0.125rem;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .strip::-webkit-scrollbar {
    display: none;
  }

  .item {
    display: inline-flex;
    flex: none;
    width: 1.5rem;
    height: 1.5rem;
    align-items: center;
    justify-content: center;
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    background-color: transparent;
    transition:
      background-color var(--duration) var(--ease),
      border-color var(--duration) var(--ease);
  }

  .item :global(.silk) {
    --silk-size: 16px;
    image-rendering: pixelated;
  }

  .item:hover {
    border-color: color-mix(in oklab, var(--border) 16%, transparent);
    background-color: color-mix(in oklab, var(--input) 14%, transparent);
  }

  .close {
    display: inline-flex;
    flex: none;
    width: 1.5rem;
    height: 1.5rem;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: var(--radius-md);
    background-color: transparent;
    color: var(--muted-foreground);
    transition:
      background-color var(--duration) var(--ease),
      color var(--duration) var(--ease);
  }

  .close:hover {
    background-color: color-mix(in oklab, var(--input) 14%, transparent);
    color: var(--foreground);
  }
</style>