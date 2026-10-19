<script lang="ts" module>
  export interface SegmentedOption {
    value: string;
    label: string;
    title?: string;
  }
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    options: readonly SegmentedOption[];
    value: string;
    label: string;
    size?: 'sm' | 'default';
    onchange: (value: string) => void;
    children?: Snippet<[string]>;
  }

  let { options, value, label, size = 'default', onchange, children }: Props = $props();
</script>

<div class="segmented glass" role="group" aria-label={label} data-size={size}>
  {#each options as option (option.value)}
    {@const active = option.value === value}
    <button
      type="button"
      class="segment"
      data-active={active}
      aria-pressed={active}
      title={option.title ?? option.label}
      onclick={() => onchange(option.value)}
    >
      {#if children}{@render children(option.value)}{:else}{option.label}{/if}
    </button>
  {/each}
</div>

<style>
  .segmented {
    display: inline-flex;
    align-items: center;
    gap: 1px;
    padding: 2px;
    border: 1px solid color-mix(in oklab, var(--border) 12%, transparent);
    border-radius: var(--radius-lg);
    background-color: color-mix(in oklab, var(--card) 52%, transparent);
  }

  .segment {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: calc(var(--radius-lg) - 2px);
    background-color: transparent;
    color: color-mix(in oklab, var(--foreground) 55%, transparent);
    font-weight: 500;
    transition:
      background-color var(--duration) var(--ease),
      color var(--duration) var(--ease);
  }

  .segmented[data-size='default'] .segment {
    height: 1.5rem;
    min-width: 1.75rem;
    padding: 0 0.5rem;
    font-size: var(--text-xs);
    line-height: var(--text-xs-lh);
  }

  .segmented[data-size='sm'] .segment {
    height: 1.25rem;
    min-width: 1.375rem;
    padding: 0 0.375rem;
    font-size: var(--text-2xs);
    line-height: var(--text-2xs-lh);
  }

  .segment:hover {
    color: var(--foreground);
    background-color: color-mix(in oklab, var(--input) 12%, transparent);
  }

  .segment[data-active='true'] {
    background-color: color-mix(in oklab, var(--foreground) 10%, transparent);
    color: var(--foreground);
    box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--border) 14%, transparent);
  }
</style>