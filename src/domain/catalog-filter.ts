import { normalizeColorKey } from "@/domain/catalog-colors";

export interface FilterableItem {
  name: string;
  categorySlug: string;
  categoryName: string;
  colors: { color: string }[];
}

export interface CatalogFilters {
  query: string;
  categorySlugs: string[];
  colorKeys: string[];
}

/** True when an item satisfies every active facet. Empty facet = no constraint. */
export function matchesFilters(item: FilterableItem, f: CatalogFilters): boolean {
  const q = normalizeColorKey(f.query); // reuse: trim + lowercase + accent-strip
  if (q !== "") {
    const hay = normalizeColorKey(`${item.name} ${item.categoryName}`);
    if (!hay.includes(q)) return false;
  }
  if (f.categorySlugs.length > 0 && !f.categorySlugs.includes(item.categorySlug)) return false;
  if (f.colorKeys.length > 0) {
    const keys = new Set(item.colors.map((c) => normalizeColorKey(c.color)));
    if (!f.colorKeys.some((k) => keys.has(k))) return false;
  }
  return true;
}
