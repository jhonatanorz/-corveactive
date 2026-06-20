import { normalizeColorKey } from "@/domain/catalog-colors";

export interface ProductFilterItem {
  name: string;
  lineSlug: string;
  categorySlug: string;
  status: string;
}

export interface ProductFilters {
  query?: string;
  lineSlug?: string;
  categorySlug?: string;
  status?: string;
}

/** True when a product satisfies every active filter. Empty/undefined facet = no constraint. */
export function matchesProductFilters(item: ProductFilterItem, f: ProductFilters): boolean {
  const q = normalizeColorKey(f.query ?? ""); // reuse: trim + lowercase + accent-strip
  if (q !== "" && !normalizeColorKey(item.name).includes(q)) return false;
  if (f.lineSlug && item.lineSlug !== f.lineSlug) return false;
  if (f.categorySlug && item.categorySlug !== f.categorySlug) return false;
  if (f.status && item.status !== f.status) return false;
  return true;
}
