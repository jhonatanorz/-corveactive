// src/lib/repos/catalog.ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ProductRow, VariantRow, ProductImageRow } from "@/lib/db-types";
import { pickProductImage } from "@/domain/product-image";

export interface CatalogProduct extends ProductRow {
  product_images: ProductImageRow[];
  product_lines: { slug: string };
}

export interface CatalogItem {
  id: string;
  name: string;
  price: number; // centavos
  lineSlug: string;
  categorySlug: string;
  categoryName: string;
  images: { url: string; color: string | null }[];
  colors: { color: string; color_hex: string }[];
}

const CATALOG_SELECT =
  "id,name,price,product_lines!inner(slug),product_categories!inner(slug,name),product_images(url,color),variants(color,color_hex)";

type CatalogRaw = {
  id: string;
  name: string;
  price: number;
  product_lines: { slug: string } | { slug: string }[];
  product_categories: { slug: string; name: string } | { slug: string; name: string }[];
  product_images: { url: string; color: string | null }[] | null;
  variants: { color: string; color_hex: string }[] | null;
};

const one = <T,>(v: T | T[]): T => (Array.isArray(v) ? v[0] : v);

function toItem(r: CatalogRaw): CatalogItem {
  const line = one(r.product_lines);
  const cat = one(r.product_categories);
  return {
    id: r.id,
    name: r.name,
    price: r.price,
    lineSlug: line.slug,
    categorySlug: cat.slug,
    categoryName: cat.name,
    images: r.product_images ?? [],
    colors: r.variants ?? [],
  };
}

/** All active products, shaped for client-side browse/filter. */
export async function listActiveCatalog(): Promise<CatalogItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(CATALOG_SELECT)
    .eq("status", "active")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as CatalogRaw[]).map(toItem);
}

/** Active products for one line (by line id). */
export async function listActiveCatalogByLine(lineId: string): Promise<CatalogItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(CATALOG_SELECT)
    .eq("status", "active")
    .is("deleted_at", null)
    .eq("line_id", lineId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as CatalogRaw[]).map(toItem);
}

export interface ProductDetail {
  product: CatalogProduct;
  variants: VariantRow[];
}

/** A single active product with images + line slug + variants. Null if not active/found. */
export async function getActiveProduct(id: string): Promise<ProductDetail | null> {
  const supabase = await createClient();
  const { data: product, error } = await supabase
    .from("products")
    .select("*, product_images(*), product_lines(slug)")
    .eq("id", id)
    .eq("status", "active")
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!product) return null;
  const { data: variants, error: vErr } = await supabase
    .from("variants").select("*").eq("product_id", id);
  if (vErr) throw vErr;
  const p = product as { product_lines: { slug: string } | { slug: string }[] } & Record<string, unknown>;
  const normalized = { ...p, product_lines: one(p.product_lines) } as unknown as CatalogProduct;
  return { product: normalized, variants: (variants ?? []) as VariantRow[] };
}

export interface SearchSuggestion {
  id: string;
  name: string;
  price: number;
  thumbnailUrl: string | null;
}

type SuggestRaw = {
  id: string;
  name: string;
  price: number;
  product_images: { url: string; color: string | null }[] | null;
};

/** Escape LIKE wildcards so user input is matched literally. */
function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/**
 * Active products whose name OR category name matches q. Two queries merged by id
 * (avoids a cross-table PostgREST `.or` string). `select` is a PostgREST column spec;
 * pass an optional limit for autocomplete.
 */
async function searchRows<T extends { id: string }>(
  select: string,
  q: string,
  limit?: number,
): Promise<T[]> {
  const term = q.trim();
  if (term === "") return [];
  const supabase = await createClient();
  const pat = likePattern(term);

  const { data: catRows, error: catErr } = await supabase
    .from("product_categories").select("id").ilike("name", pat);
  if (catErr) throw catErr;
  const catIds = (catRows ?? []).map((c) => (c as { id: string }).id);

  let nameQ = supabase
    .from("products").select(select)
    .eq("status", "active").is("deleted_at", null)
    .ilike("name", pat)
    .order("created_at", { ascending: false });
  if (limit) nameQ = nameQ.limit(limit);
  const { data: byName, error: nameErr } = await nameQ;
  if (nameErr) throw nameErr;

  let byCat: unknown[] = [];
  if (catIds.length > 0) {
    let catQ = supabase
      .from("products").select(select)
      .eq("status", "active").is("deleted_at", null)
      .in("category_id", catIds)
      .order("created_at", { ascending: false });
    if (limit) catQ = catQ.limit(limit);
    const { data: catData, error: cErr } = await catQ;
    if (cErr) throw cErr;
    byCat = catData ?? [];
  }

  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of [...((byName ?? []) as unknown as T[]), ...(byCat as unknown as T[])]) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return limit ? out.slice(0, limit) : out;
}

/** Slim autocomplete suggestions (≤8) for products matching name or category. */
export async function searchSuggestions(q: string): Promise<SearchSuggestion[]> {
  const rows = await searchRows<SuggestRaw>("id,name,price,product_images(url,color)", q, 8);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    price: r.price,
    thumbnailUrl: pickProductImage(r.product_images ?? [], null),
  }));
}

/** Full catalog items for products matching name or category (for the /buscar page). */
export async function searchCatalog(q: string): Promise<CatalogItem[]> {
  const rows = await searchRows<CatalogRaw>(CATALOG_SELECT, q);
  return rows.map(toItem);
}
