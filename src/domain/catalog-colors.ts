export interface ColorSwatch {
  key: string;   // normalized grouping key
  label: string; // first-seen display label
  hex: string;   // first-seen hex
}

/** Normalize a free-text color into a grouping key: trimmed, lowercased, accent-stripped. */
export function normalizeColorKey(color: string): string {
  return color
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

/** Distinct color swatches across variants, in first-seen order. */
export function aggregateColors(variants: { color: string; color_hex: string }[]): ColorSwatch[] {
  const seen = new Set<string>();
  const out: ColorSwatch[] = [];
  for (const v of variants) {
    const key = normalizeColorKey(v.color);
    if (key === "" || seen.has(key)) continue;
    seen.add(key);
    out.push({ key, label: v.color, hex: v.color_hex });
  }
  return out;
}
