<script lang="ts" module>
  export type GlyphName =
    | 'search'
    | 'close'
    | 'copy'
    | 'check'
    | 'sun'
    | 'moon'
    | 'monitor'
    | 'grid'
    | 'panel'
    | 'chevron-right'
    | 'sparkle'
    | 'reset'
    | 'copy-all'
    | 'zoom'
    | 'alert';

  const PATHS: Record<GlyphName, string> = {
    search: 'M7.5 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM10.8 10.8 14 14',
    close: 'M4 4l8 8M12 4l-8 8',
    copy: 'M6 6V4.5A1.5 1.5 0 0 1 7.5 3h4A1.5 1.5 0 0 1 13 4.5v4A1.5 1.5 0 0 1 11.5 10h-4A1.5 1.5 0 0 1 6 8.5ZM3 8h4M10 8h.5A1.5 1.5 0 0 1 12 9.5v4a1.5 1.5 0 0 1-1.5 1.5h-4A1.5 1.5 0 0 1 5 13.5v-4A1.5 1.5 0 0 1 6.5 8Z',
    check: 'M3.5 8.5 6.5 11.5 12.5 4.5',
    sun: 'M8 2v1.5M8 12.5V14M2 8h1.5M12.5 8H14M3.75 3.75l1 1M11.25 11.25l1 1M12.25 3.75l-1 1M4.75 11.25l-1 1M8 5.5A2.5 2.5 0 1 0 8 10.5 2.5 2.5 0 0 0 8 5.5Z',
    moon: 'M13 9.5A5.5 5.5 0 0 1 6.5 3a5.5 5.5 0 1 0 6.5 6.5Z',
    monitor: 'M2.5 3.5h11v7h-11v-7ZM6 13.5h4M8 10.5v3',
    grid: 'M2.5 2.5h4.5v4.5H2.5v-4.5ZM9 2.5h4.5v4.5H9V2.5ZM2.5 9h4.5v4.5H2.5V9ZM9 9h4.5v4.5H9V9Z',
    panel: 'M2.5 3h11v10h-11V3ZM9.5 3v10',
    'chevron-right': 'M6.5 4 10.5 8l-4 4',
    sparkle: 'M8 2.5 9.2 6 12.5 7.2 9.2 8.4 8 11.9 6.8 8.4 3.5 7.2 6.8 6 8 2.5Z',
    reset: 'M3 8a5 5 0 1 0 1.6-3.7M3 3v3h3',
    'copy-all': 'M5.5 5.5V4A1.5 1.5 0 0 1 7 2.5h4A1.5 1.5 0 0 1 12.5 4v4A1.5 1.5 0 0 1 11 9.5H9.5M4 7.5A1.5 1.5 0 0 1 5.5 6h4A1.5 1.5 0 0 1 11 7.5v4A1.5 1.5 0 0 1 9.5 13h-4A1.5 1.5 0 0 1 4 11.5v-4Z',
    zoom: 'M7.5 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM10.8 10.8 14 14M7.5 5.5v4M5.5 7.5h4',
    alert: 'M8 5.5v3.5M8 11.5h.01M6.85 2.9 1.9 11.2A1.4 1.4 0 0 0 3.1 13.3h9.8a1.4 1.4 0 0 0 1.2-2.1L9.15 2.9a1.4 1.4 0 0 0-2.3 0Z',
  };
</script>

<script lang="ts">
  interface Props {
    name: GlyphName;
    size?: number;
    strokeWidth?: number;
    class?: string;
  }

  let { name, size = 14, strokeWidth = 1.5, class: className = '' }: Props = $props();
</script>

<svg
  class={className}
  width={size}
  height={size}
  viewBox="0 0 16 16"
  fill="none"
  stroke="currentColor"
  stroke-width={strokeWidth}
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
  focusable="false"
>
  <path d={PATHS[name]} />
</svg>