<script lang="ts">
  interface Props {
    tone?: 'default' | 'primary' | 'outline' | 'muted' | 'success';
    class?: string;
    children: import('svelte').Snippet;
  }

  let { tone = 'default', class: className = '', children }: Props = $props();
</script>

<span class="badge {className}" data-tone={tone}>{@render children()}</span>

<style>
  .badge {
    display: inline-flex;
    height: 1.125rem;
    align-items: center;
    gap: 0.25rem;
    padding: 0 0.5rem;
    border: 1px solid transparent;
    border-radius: 999px;
    font-size: var(--text-2xs);
    line-height: 1;
    font-weight: 500;
    white-space: nowrap;
  }

  .badge[data-tone='default'] {
    background-color: color-mix(in oklab, var(--foreground) 10%, transparent);
    color: color-mix(in oklab, var(--foreground) 80%, transparent);
  }

  .badge[data-tone='muted'] {
    background-color: transparent;
    border-color: color-mix(in oklab, var(--border) 12%, transparent);
    color: var(--muted-foreground);
  }

  .badge[data-tone='primary'] {
    background-color: var(--primary);
    color: var(--primary-foreground);
  }

  .badge[data-tone='outline'] {
    background-color: transparent;
    border-color: color-mix(in oklab, var(--border) 22%, transparent);
    color: color-mix(in oklab, var(--foreground) 75%, transparent);
  }

  .badge[data-tone='success'] {
    background-color: color-mix(in oklab, var(--success) 18%, transparent);
    color: var(--success);
  }
</style>