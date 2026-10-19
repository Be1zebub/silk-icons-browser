import spriteUrl from '../../assets/famfamfam/sprite.png';

/** Copies text and reports whether it actually made it to the clipboard. */
export async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the legacy path below.
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '-1000px';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();

  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  } finally {
    textarea.remove();
  }

  return copied;
}

/** The vendored spritesheet, decoded once. */
let sprite: HTMLImageElement | null = null;

async function loadSprite(): Promise<HTMLImageElement> {
  if (sprite) return sprite;

  const image = new Image();
  image.src = spriteUrl;
  await image.decode();
  sprite = image;

  return image;
}

/**
 * Copies a single icon out of the spritesheet as a PNG.
 *
 * `position` is the icon's `background-position` in the sheet, so the cell
 * origin is simply its absolute value.
 */
export async function copyIconPng(position: readonly [number, number], size = 16): Promise<boolean> {
  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) return false;

  try {
    const image = await loadSprite();

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;

    const context = canvas.getContext('2d');
    if (!context) return false;

    context.imageSmoothingEnabled = false;
    context.drawImage(image, -position[0], -position[1], size, size, 0, 0, size, size);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return false;

    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return true;
  } catch {
    return false;
  }
}