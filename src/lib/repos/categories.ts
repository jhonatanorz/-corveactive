// src/lib/repos/categories.ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ProductCategoryRow } from "@/lib/db-types";
import type { CategoryPayload } from "@/lib/admin/category-input";

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
