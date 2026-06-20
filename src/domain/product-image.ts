export interface ImageChoice {
  url: string;
  color: string | null;
}

/**
 * Pick the image URL for a selected color: the color's own image, else the default
 * (color === null), else the first available image, else null (caller shows the
 * placeholder). Pass null for the grid. The first-image fallback ensures a product
 * with only variant images (no default) still shows something.
 */
export function pickProductImage(images: ImageChoice[], color: string | null): string | null {
  if (color !== null) {
    const match = images.find((i) => i.color === color);
    if (match) return match.url;
  }
  const def = images.find((i) => i.color === null);
  if (def) return def.url;
  return images[0]?.url ?? null;
}
