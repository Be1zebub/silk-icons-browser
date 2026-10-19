<script lang="ts">
  import Glyph from './Glyph.svelte';
  import { relatedIcons } from '../core/search';
  import { searchIndex } from '../core/index-store';
  import type { IconDoc } from '../core/types';

  interface Props {
    icon: IconDoc;
    onselect: (name: string) => void;
    oncopy: (name: string) => void;
    onclose: () => void;
  }

  let { icon, onselect, oncopy, onclose }: Props = $props();

  const related = $derived(relatedIcons(icon, searchIndex));
</script>

<div class="related-bar" role="group" aria-label="Related icons">
  <div class="strip">
    <button
      type="button"
      class="item self"
      title={icon.name}
      aria-label={icon.name}
      aria-current="true"
      onclick={() => onselect(icon.name)}
    >
      <i class="silk {icon.name}"></i>
    </button>

    <span class="divider" aria-hidden="true"></span>

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

  <div class="actions">
    <button
      type="button"
      class="action"
      title={`Copy ${icon.name}`}
      aria-label={`Copy ${icon.name}`}
      onclick={() => oncopy(icon.name)}
    >
      <Glyph name="copy" size={13} />
    </button>

    <button
      type="button"
      class="action"
      title="Hide related icons"
      aria-label="Hide related icons"
      onclick={onclose}
    >
      <Glyph name="close" size={13} />
    </button>
  </div>
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

  .divider {
    flex: none;
    width: 1px;
    height: 1.25rem;
    margin: 0 0.375rem;
    background-color: color-mix(in oklab, var(--border) 40%, transparent);
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

  .item.self {
    border-color: color-mix(in oklab, var(--primary) 40%, transparent);
    background-color: color-mix(in oklab, var(--primary) 14%, transparent);
  }

  .actions {
    display: flex;
    flex: none;
    align-items: center;
    gap: 0.25rem;
  }

  .action {
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

  .action:hover {
    background-color: color-mix(in oklab, var(--input) 14%, transparent);
    color: var(--foreground);
  }
</style>