import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ProductRow, VariantRow } from "@/lib/db-types";
import type { ProductImageRow } from "@/lib/db-types";
import type { ProductPayload } from "@/lib/admin/product-input";

export interface ProductWithVariants {
  product: ProductRow;
  variants: VariantRow[];
}

export async function listProducts(): Promise<ProductRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as ProductRow[];
}

export async function getProduct(id: string): Promise<ProductWithVariants | null> {
  const supabase = await createClient();
  const { data: product, error } = await supabase
    .from("products").select("*").eq("id", id).maybeSingle();
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

export async function listImages(productId: string): Promise<ProductImageRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_images").select("*").eq("product_id", productId).order("sort_order");
  if (error) throw error;
  return data as ProductImageRow[];
}

/** Upload a file to the public product-images bucket and record it. */
export async function addProductImage(productId: string, file: File): Promise<void> {
  const supabase = await createClient();
  const path = `products/${productId}/${Date.now()}-${file.name}`;
  const { error: upErr } = await supabase.storage.from("product-images").upload(path, file);
  if (upErr) throw upErr;
  const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
  const { count } = await supabase
    .from("product_images").select("id", { count: "exact", head: true }).eq("product_id", productId);
  const { error } = await supabase.from("product_images")
    .insert({ product_id: productId, url: pub.publicUrl, sort_order: count ?? 0 });
  if (error) throw error;
}
