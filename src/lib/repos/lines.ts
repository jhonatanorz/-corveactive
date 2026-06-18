// src/lib/repos/lines.ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ProductLineRow } from "@/lib/db-types";
import type { LinePayload } from "@/lib/admin/line-input";

export async function listLines(): Promise<ProductLineRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("product_lines").select("*").order("sort_order");
  if (error) throw error;
  return data as ProductLineRow[];
}

export async function listActiveLines(): Promise<ProductLineRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_lines").select("*").eq("active", true).order("sort_order");
  if (error) throw error;
  return data as ProductLineRow[];
}

export async function getLine(id: string): Promise<ProductLineRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("product_lines").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as ProductLineRow) ?? null;
}

export async function getActiveLineBySlug(slug: string): Promise<ProductLineRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_lines").select("*").eq("slug", slug).eq("active", true).maybeSingle();
  if (error) throw error;
  return (data as ProductLineRow) ?? null;
}

export async function createLine(payload: LinePayload): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("product_lines").insert(payload).select("id").single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function updateLine(id: string, payload: LinePayload): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("product_lines").update(payload).eq("id", id);
  if (error) throw error;
}
