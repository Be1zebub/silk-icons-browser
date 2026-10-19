<script lang="ts">
  import Button from './ui/Button.svelte';
  import Badge from './ui/Badge.svelte';
  import Segmented from './ui/Segmented.svelte';
  import Glyph from './Glyph.svelte';
  import { relatedIcons } from '../core/search';
  import type { CategoryMeta, IconEntry } from '../core/types';

  const ZOOMS = [1, 2, 4, 8] as const;
  type Zoom = (typeof ZOOMS)[number];

  const RENDER_MODES = ['auto', 'pixelated'] as const;

  interface Props {
    icon: IconEntry;
    entries: readonly IconEntry[];
    categories: readonly CategoryMeta[];
    pixelated: boolean;
    oncopy: (text: string, label: string) => void;
    ontogglepixelated: () => void;
    onselect: (name: string) => void;
    onclose: () => void;
  }

  let { icon, entries, categories, pixelated, oncopy, ontogglepixelated, onselect, onclose }: Props = $props();

  let zoom = $state<Zoom>(4);

  const categoryLabel = $derived(
    categories.find((category) => category.id === icon.category)?.label ?? icon.category,
  );
  const related = $derived(relatedIcons(icon, entries, 10));
  const className = $derived(`silk ${icon.name}`);
  const cssRule = $derived(
    `.${icon.name} { background-position: ${icon.position[0]}px ${icon.position[1]}px; }`,
  );
  const showGrid = $derived(zoom >= 4);

  const snippet = $derived(
    `<span class="${className}" style="--silk-size: ${zoom * 16}px"></span>`,
  );
</script>

<aside class="inspector" aria-label="Icon details">
  <div class="stage" data-grid={showGrid} style="--cell: {(zoom * 16) / 16}px">
    <span class="preview" style="--silk-size: {zoom * 16}px">
      <i class="silk {icon.name}" style="image-rendering: {pixelated ? 'pixelated' : 'auto'}"></i>
    </span>
  </div>

  <div class="stage-bar">
    <span class="label-2xs">Zoom</span>
    <Segmented
      options={ZOOMS.map((value) => ({ value: String(value), label: `${value}×`, title: `${value * 16}px` }))}
      value={String(zoom)}
      label="Preview zoom"
      size="sm"
      onchange={(value) => (zoom = Number(value) as Zoom)}
    />
  </div>

  <div class="stage-bar">
    <span class="label-2xs">Scaling</span>
    <Segmented
      options={RENDER_MODES.map((mode) => ({ value: mode, label: mode === 'auto' ? 'Smooth' : 'Crisp' }))}
      value={pixelated ? 'pixelated' : 'auto'}
      label="Scaling mode"
      size="sm"
      onchange={(value) => {
        if ((value === 'pixelated') !== pixelated) ontogglepixelated();
      }}
    />
  </div>

  <div class="head">
    <div class="head-main">
      <h2 class="mono name">{icon.name}</h2>
      <Badge tone="muted">{categoryLabel}</Badge>
    </div>
    <Button variant="ghost-muted" size="icon-sm" label="Close details" hideLabel onclick={onclose}>
      <Glyph name="close" size={14} />
    </Button>
  </div>

  <div class="actions">
    <Button variant="default" size="sm" label="Copy icon name" onclick={() => oncopy(icon.name, 'Name')}>
      <Glyph name="copy" size={12} />
      Name
    </Button>
    <Button
      variant="outline"
      size="sm"
      label="Copy CSS class"
      onclick={() => oncopy(className, 'Class')}
    >
      <Glyph name="copy" size={12} />
      Class
    </Button>
    <Button
      variant="outline"
      size="sm"
      label="Copy CSS rule"
      onclick={() => oncopy(cssRule, 'CSS rule')}
    >
      <Glyph name="copy" size={12} />
      Rule
    </Button>
  </div>

  <dl class="facts">
    <dt>Size</dt>
    <dd class="mono">16 × 16 px</dd>
    <dt>Sprite</dt>
    <dd class="mono">{icon.position[0]}px {icon.position[1]}px</dd>
  </dl>

  <div class="snippet">
    <span class="label-2xs">Markup</span>
    <pre class="mono"><code>{snippet}</code></pre>
  </div>

  {#if related.length > 0}
    <div class="related">
      <span class="label-2xs">Related</span>
      <ul>
        {#each related as item (item.name)}
          <li>
            <button type="button" class="related-item" title={item.name} onclick={() => onselect(item.name)}>
              <i class="silk {item.name}" style="--silk-size: 16px"></i>
              <span>{item.name}</span>
            </button>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</aside>

<style>
  .inspector {
    display: flex;
    min-height: 0;
    flex-direction: column;
    gap: 0.875rem;
    padding: 1rem;
    border-left: 1px solid color-mix(in oklab, var(--border) 45%, transparent);
    background-color: color-mix(in oklab, var(--card) 45%, transparent);
    animation: silk-fade-in 180ms var(--ease);
  }

  .stage {
    position: relative;
    display: grid;
    place-items: center;
    min-height: 9rem;
    padding: 1rem;
    border: 1px solid color-mix(in oklab, var(--border) 45%, transparent);
    border-radius: var(--radius-lg);
    background-color:
      linear-gradient(45deg, color-mix(in oklab, var(--foreground) 4%, transparent) 25%, transparent 25%),
      linear-gradient(-45deg, color-mix(in oklab, var(--foreground) 4%, transparent) 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, color-mix(in oklab, var(--foreground) 4%, transparent) 75%),
      linear-gradient(-45deg, transparent 75%, color-mix(in oklab, var(--foreground) 4%, transparent) 75%);
    background-size: 12px 12px;
    background-position:
      0 0,
      0 6px,
      6px -6px,
      -6px 0;
  }

  .stage[data-grid='true']::after {
    content: '';
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(to right, color-mix(in oklab, var(--foreground) 9%, transparent) 1px, transparent 1px),
      linear-gradient(to bottom, color-mix(in oklab, var(--foreground) 9%, transparent) 1px, transparent 1px);
    background-size: var(--cell) var(--cell);
    pointer-events: none;
  }

  .preview {
    display: inline-flex;
    position: relative;
    z-index: 1;
  }

  .stage-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    margin-top: -0.375rem;
  }

  .head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .head-main {
    display: flex;
    min-width: 0;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.375rem;
  }

  .name {
    margin: 0;
    font-size: var(--text-base);
    line-height: var(--text-base-lh);
    font-weight: 600;
    word-break: break-all;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  .facts {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.25rem 0.75rem;
    margin: 0;
    padding-top: 0.75rem;
    border-top: 1px solid color-mix(in oklab, var(--border) 45%, transparent);
    font-size: var(--text-xs);
  }

  .facts dt {
    color: var(--muted-foreground);
  }

  .facts dd {
    margin: 0;
    text-align: right;
  }

  .snippet {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  pre {
    margin: 0;
    padding: 0.5rem 0.625rem;
    overflow-x: auto;
    border: 1px solid color-mix(in oklab, var(--border) 45%, transparent);
    border-radius: var(--radius-md);
    background-color: color-mix(in oklab, var(--background) 55%, transparent);
    font-size: var(--text-2xs);
    line-height: 1.25rem;
    color: color-mix(in oklab, var(--foreground) 70%, transparent);
    white-space: pre-wrap;
    word-break: break-all;
  }

  .related {
    display: flex;
    min-height: 0;
    flex-direction: column;
    gap: 0.375rem;
  }

  .related ul {
    display: flex;
    flex-direction: column;
    gap: 1px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .related-item {
    display: flex;
    width: 100%;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0.375rem;
    border: 0;
    border-radius: var(--radius-md);
    background-color: transparent;
    text-align: left;
    transition: background-color var(--duration) var(--ease);
  }

  .related-item:hover {
    background-color: color-mix(in oklab, var(--input) 12%, transparent);
  }

  .related-item span {
    overflow: hidden;
    font-family: var(--font-mono);
    font-size: var(--text-2xs);
    color: color-mix(in oklab, var(--foreground) 65%, transparent);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>