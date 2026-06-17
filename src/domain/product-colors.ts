import { pickProductImage, type ImageChoice } from "./product-image";

export interface ColorOption {
  color: string;
  hex: string;
  url: string | null;
}

/**
 * Distinct colors for a product in first-seen variant order, each with its hex
 * (from the first occurrence) and its image (the color's own, else the default, else null).
 */
export function productColors(
  variants: { color: string; color_hex: string }[],
  images: ImageChoice[],
): ColorOption[] {
  const seen = new Set<string>();
  const out: ColorOption[] = [];
  for (const v of variants) {
    if (seen.has(v.color)) continue;
    seen.add(v.color);
    out.push({ color: v.color, hex: v.color_hex, url: pickProductImage(images, v.color) });
  }
  return out;
}
