import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ProductRow, VariantRow } from "@/lib/db-types";
import type { ProductImageRow } from "@/lib/db-types";
import type { ProductPayload } from "@/lib/admin/product-input";
import type { ImageChoice } from "@/domain/product-image";
import type { ImportPlan } from "@/lib/admin/product-csv";

export interface ProductWithVariants {
  product: ProductRow;
  variants: VariantRow[];
}

export interface ProductListRow extends ProductRow {
  lineSlug: string;
}

export async function listProducts(): Promise<ProductListRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*, product_lines(slug)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  type Raw = ProductRow & { product_lines: { slug: string } | { slug: string }[] | null };
  return (data as Raw[]).map((r) => {
    const l = Array.isArray(r.product_lines) ? r.product_lines[0] : r.product_lines;
    return { ...r, lineSlug: l?.slug ?? "" };
  });
}

export async function getProduct(id: string): Promise<ProductWithVariants | null> {
  const supabase = await createClient();
  const { data: product, error } = await supabase
    .from("products").select("*").eq("id", id).is("deleted_at", null).maybeSingle();
  if (error) throw error;
  if (!product) return null;
  const { data: variants, error: vErr } = await supabase
    .from("variants").select("*").eq("product_id", id);
  if (vErr) throw vErr;
  return { product: product as ProductRow, variants: (variants ?? []) as VariantRow[] };
}

export async function createProduct(payload: ProductPayload): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products").insert(payload).select("id").single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function updateProduct(id: string, payload: ProductPayload): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("products").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

/** Replace the variant set for a product: upsert provided variants by (product, color, size). */
export async function saveVariants(
  productId: string,
  variants: { color: string; color_hex: string; size: string; stock: number }[],
): Promise<void> {
  const supabase = await createClient();
  const rows = variants.map((v) => ({ ...v, product_id: productId }));
  const { error } = await supabase
    .from("variants")
    .upsert(rows, { onConflict: "product_id,color,size" });
  if (error) throw error;
}

/** Soft-delete a product: mark deleted_at so it drops out of the catalog/admin
 *  lists while keeping the row (and its variants/orders/history) intact. */
export async function softDeleteProduct(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("products").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

/** Update a single variant's color / hex / size by id. */
export async function updateVariant(
  variantId: string,
  fields: { color: string; color_hex: string; size: string },
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("variants").update(fields).eq("id", variantId);
  if (error) throw error;
}

/** Images grouped by product id, for a set of products (for thumbnails). */
export async function imagesByProducts(productIds: string[]): Promise<Record<string, ImageChoice[]>> {
  const ids = [...new Set(productIds.filter(Boolean))];
  if (ids.length === 0) return {};
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_images").select("product_id,url,color").in("product_id", ids);
  if (error) throw error;
  const out: Record<string, ImageChoice[]> = {};
  for (const r of (data ?? []) as { product_id: string; url: string; color: string | null }[]) {
    (out[r.product_id] ??= []).push({ url: r.url, color: r.color });
  }
  return out;
}

export async function listImages(productId: string): Promise<ProductImageRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_images").select("*").eq("product_id", productId).order("sort_order");
  if (error) throw error;
  return data as ProductImageRow[];
}

/** Upload a product image, optionally tagged with a color (null = default). One image
 *  per (product, color): any existing image for that color is removed first. */
export async function addProductImage(productId: string, file: File, color: string | null = null): Promise<void> {
  const supabase = await createClient();

  // remove existing image(s) for this (product, color), incl. best-effort storage cleanup
  const base = supabase.from("product_images").select("id,url").eq("product_id", productId);
  const { data: existing } = await (color === null ? base.is("color", null) : base.eq("color", color));
  for (const row of (existing ?? []) as { id: string; url: string }[]) {
    const path = row.url.split("/product-images/")[1];
    if (path) await supabase.storage.from("product-images").remove([decodeURIComponent(path)]);
    await supabase.from("product_images").delete().eq("id", row.id);
  }

  const path = `products/${productId}/${Date.now()}-${file.name}`;
  const { error: upErr } = await supabase.storage.from("product-images").upload(path, file);
  if (upErr) throw upErr;
  const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
  const { error } = await supabase.from("product_images")
    .insert({ product_id: productId, url: pub.publicUrl, sort_order: 0, color });
  if (error) throw error;
}

/** Delete a product image (DB row + best-effort storage object). */
export async function deleteProductImage(imageId: string): Promise<void> {
  const supabase = await createClient();
  const { data: row } = await supabase.from("product_images").select("url").eq("id", imageId).maybeSingle();
  if (row) {
    const path = (row as { url: string }).url.split("/product-images/")[1];
    if (path) await supabase.storage.from("product-images").remove([decodeURIComponent(path)]);
  }
  const { error } = await supabase.from("product_images").delete().eq("id", imageId);
  if (error) throw error;
}

/** Atomically create products + variants from a validated import plan. Returns
 *  the number of products created. */
export async function importProducts(plan: ImportPlan): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("import_products", { p_products: plan.products });
  if (error) throw error;
  return (data as number) ?? 0;
}
