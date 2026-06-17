import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Line } from "@/domain/types";
import type { ProductRow, VariantRow, ProductImageRow } from "@/lib/db-types";

export interface CatalogProduct extends ProductRow {
  product_images: ProductImageRow[];
}

export interface CatalogListProduct extends CatalogProduct {
  variants: { color: string; color_hex: string }[];
}

/** Active products for a line, with images + variant colors (anon-readable via RLS). */
export async function listActiveByLine(line: Line): Promise<CatalogListProduct[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*, product_images(*), variants(color,color_hex)")
    .eq("status", "active")
    .eq("line", line)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CatalogListProduct[];
}

export interface ProductDetail {
  product: CatalogProduct;
  variants: VariantRow[];
}

/** A single active product with images + variants. Returns null if not active/found. */
export async function getActiveProduct(id: string): Promise<ProductDetail | null> {
  const supabase = await createClient();
  const { data: product, error } = await supabase
    .from("products").select("*, product_images(*)").eq("id", id).eq("status", "active").maybeSingle();
  if (error) throw error;
  if (!product) return null;
  const { data: variants, error: vErr } = await supabase
    .from("variants").select("*").eq("product_id", id);
  if (vErr) throw vErr;
  return { product: product as CatalogProduct, variants: (variants ?? []) as VariantRow[] };
}
