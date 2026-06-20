// src/lib/repos/categories.ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ProductCategoryRow } from "@/lib/db-types";
import type { CategoryPayload } from "@/lib/admin/category-input";
import { tallyByCategory } from "@/domain/category-usage";

export async function listCategories(): Promise<ProductCategoryRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_categories").select("*").order("sort_order").order("name");
  if (error) throw error;
  return data as ProductCategoryRow[];
}

export async function getCategory(id: string): Promise<ProductCategoryRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("product_categories").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as ProductCategoryRow) ?? null;
}

export async function createCategory(payload: CategoryPayload): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("product_categories").insert(payload).select("id").single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function updateCategory(id: string, payload: CategoryPayload): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("product_categories").update(payload).eq("id", id);
  if (error) throw error;
}

/** categoryId → number of live (non-archived) products, for the list page guard. */
export async function countLiveProductsByCategory(): Promise<Record<string, number>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products").select("category_id").is("deleted_at", null);
  if (error) throw error;
  return tallyByCategory((data ?? []) as { category_id: string }[]);
}

/** Number of live (non-archived) products in one category, for the editor guard. */
export async function countLiveProductsInCategory(id: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("category_id", id)
    .is("deleted_at", null);
  if (error) throw error;
  return count ?? 0;
}

/** Hard-delete a category. Throws (Postgres 23503) if any product still references it. */
export async function deleteCategory(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("product_categories").delete().eq("id", id);
  if (error) throw error;
}
