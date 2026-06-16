import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface SupplierRow { id: string; name: string; contact: string | null }

export async function listSuppliers(): Promise<SupplierRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("suppliers").select("*").order("name");
  if (error) throw error;
  return (data ?? []) as SupplierRow[];
}

export async function createSupplier(name: string, contact: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("suppliers").insert({ name, contact: contact || null });
  if (error) throw error;
}
