export interface ImageChoice {
  url: string;
  color: string | null;
  sortOrder: number;
}

const byOrder = (xs: ImageChoice[]): ImageChoice[] =>
  [...xs].sort((a, b) => a.sortOrder - b.sortOrder);

/**
 * Ordered images to show for a selected color (the storefront gallery):
 *  - the color's own images, sorted by sortOrder ascending;
 *  - else the Default images (color === null), sorted ascending;
 *  - else [] (caller shows the gradient placeholder).
 * Pass null to get the Default group directly.
 */
export function imagesForColor(images: ImageChoice[], color: string | null): ImageChoice[] {
  if (color !== null) {
    const own = images.filter((i) => i.color === color);
    if (own.length > 0) return byOrder(own);
  }
  return byOrder(images.filter((i) => i.color === null));
}

/**
 * The primary image URL for a color = the first of imagesForColor(images, color):
 * the color's own primary, else the Default primary. If neither exists, fall back
 * to the first available image overall (by sortOrder) so a product with only
 * variant images — no default — still shows something; else null (caller shows the
 * placeholder). Pass null for the grid. Used by the grid tile, the cart line image,
 * and the detail hero default.
 */
export function pickProductImage(images: ImageChoice[], color: string | null): string | null {
  const list = imagesForColor(images, color);
  if (list.length > 0) return list[0].url;
  return byOrder(images)[0]?.url ?? null;
}
