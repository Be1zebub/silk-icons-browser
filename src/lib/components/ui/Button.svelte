<script lang="ts" module>
  export type ButtonVariant = 'default' | 'outline' | 'ghost' | 'ghost-muted';
  export type ButtonSize = 'xs' | 'sm' | 'default' | 'icon-sm';
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    variant?: ButtonVariant;
    size?: ButtonSize;
    /** Native tooltip and accessible name. */
    label?: string;
    /** Visually hidden label, used when the button shows an icon plus text. */
    hideLabel?: boolean;
    class?: string;
    disabled?: boolean;
    onclick?: (event: MouseEvent) => void;
    children: Snippet;
  }

  let {
    variant = 'outline',
    size = 'default',
    label,
    hideLabel = false,
    class: className = '',
    disabled = false,
    onclick,
    children,
  }: Props = $props();
</script>

<button
  type="button"
  class="btn {className}"
  data-variant={variant}
  data-size={size}
  title={label}
  aria-label={hideLabel ? label : undefined}
  {disabled}
  {onclick}
>
  {@render children()}
  {#if hideLabel && label}<span class="sr-only">{label}</span>{/if}
</button>

<style>
  .btn {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    border: 1px solid transparent;
    border-radius: var(--radius-lg);
    font-weight: 500;
    white-space: nowrap;
    user-select: none;
    transition:
      background-color var(--duration) var(--ease),
      border-color var(--duration) var(--ease),
      color var(--duration) var(--ease),
      opacity var(--duration) var(--ease);
  }

  .btn:disabled {
    pointer-events: none;
    opacity: 0.45;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .btn :global(svg) {
    flex: none;
  }

  /* Sizes mirror the Toolcraft control scale. */
  .btn[data-size='xs'] {
    height: 1.375rem;
    padding: 0 0.375rem;
    font-size: var(--text-2xs);
    line-height: var(--text-2xs-lh);
  }

  .btn[data-size='sm'] {
    height: 1.5rem;
    padding: 0 0.5rem;
    font-size: var(--text-xs);
    line-height: var(--text-xs-lh);
  }

  .btn[data-size='default'] {
    height: 1.75rem;
    padding: 0 0.625rem;
    font-size: var(--text-sm);
    line-height: var(--text-sm-lh);
  }

  .btn[data-size='icon-sm'] {
    width: 1.75rem;
    height: 1.75rem;
    padding: 0;
    font-size: var(--text-xs);
  }

  .btn[data-variant='default'] {
    background-color: var(--primary);
    color: var(--primary-foreground);
  }
  .btn[data-variant='default']:hover {
    background-color: color-mix(in oklab, var(--primary) 88%, black);
  }
  .btn[data-variant='default']:active {
    background-color: color-mix(in oklab, var(--primary) 82%, black);
  }

  .btn[data-variant='outline'] {
    border-color: color-mix(in oklab, var(--border) 12%, transparent);
    background-color: color-mix(in oklab, var(--input) 10%, transparent);
  }
  .btn[data-variant='outline']:hover {
    border-color: color-mix(in oklab, var(--border) 22%, transparent);
    background-color: color-mix(in oklab, var(--input) 16%, transparent);
  }
  .btn[data-variant='outline']:active {
    background-color: color-mix(in oklab, var(--input) 20%, transparent);
  }

  .btn[data-variant='ghost'],
  .btn[data-variant='ghost-muted'] {
    background-color: transparent;
  }
  .btn[data-variant='ghost'] {
    color: var(--foreground);
  }
  .btn[data-variant='ghost-muted'] {
    color: color-mix(in oklab, var(--foreground) 55%, transparent);
  }
  .btn[data-variant='ghost']:hover,
  .btn[data-variant='ghost-muted']:hover {
    background-color: color-mix(in oklab, var(--input) 12%, transparent);
    color: var(--foreground);
  }
  .btn[data-variant='ghost']:active,
  .btn[data-variant='ghost-muted']:active {
    background-color: color-mix(in oklab, var(--input) 18%, transparent);
  }
</style>