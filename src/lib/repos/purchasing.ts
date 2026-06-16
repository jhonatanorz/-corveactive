import "server-only";
import { createClient } from "@/lib/supabase/server";
import { poTotalCost } from "@/domain/po-total";
import type { POStatus } from "@/domain/purchase";

export interface PORow {
  id: string; supplier_id: string | null; status: POStatus;
  expected_at: string | null; notes: string | null; total_cost: number; created_at: string;
}
export interface POItemRow {
  id: string; variant_id: string; qty_ordered: number; qty_received: number; unit_cost: number;
}
export interface VariantOption { id: string; label: string }

export async function createDraftPO(): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("purchase_orders").insert({ status: "borrador" }).select("id").single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function listPOs(): Promise<(PORow & { suppliers: { name: string } | null })[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("purchase_orders").select("*, suppliers(name)").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as (PORow & { suppliers: { name: string } | null })[];
}

export async function getPO(id: string): Promise<{ po: PORow; items: (POItemRow & { variants: { color: string; size: string; products: { name: string } } })[] } | null> {
  const supabase = await createClient();
  const { data: po, error } = await supabase.from("purchase_orders").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!po) return null;
  const { data: items, error: iErr } = await supabase
    .from("purchase_order_items")
    .select("*, variants(color,size,products(name))").eq("po_id", id);
  if (iErr) throw iErr;
  return { po: po as PORow, items: (items ?? []) as never };
}

export async function setPOSupplier(id: string, supplierId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("purchase_orders")
    .update({ supplier_id: supplierId || null, status: "pedida" }).eq("id", id);
  if (error) throw error;
}

/** Add a line and recompute total_cost. */
export async function addPOLine(poId: string, variantId: string, qtyOrdered: number, unitCost: number): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("purchase_order_items")
    .insert({ po_id: poId, variant_id: variantId, qty_ordered: qtyOrdered, unit_cost: unitCost });
  if (error) throw error;
  const { data: items } = await supabase.from("purchase_order_items").select("qty_ordered,unit_cost").eq("po_id", poId);
  const total = poTotalCost((items ?? []).map((i) => ({ qtyOrdered: i.qty_ordered, unitCost: i.unit_cost })));
  await supabase.from("purchase_orders").update({ total_cost: total }).eq("id", poId);
}

/** Receive a batch via the atomic RPC. */
export async function receivePO(poId: string, receipts: { variant_id: string; qty: number }[]): Promise<{ ok: boolean; reason?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("receive_purchase_order", { p_po_id: poId, p_receipts: receipts });
  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}

/** All variants as options for the line picker. */
export async function listVariantOptions(): Promise<VariantOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("variants").select("id,color,size,products(name)").order("color");
  if (error) throw error;
  type VariantRow = { id: string; color: string; size: string; products: { name: string } | null };
  return ((data ?? []) as unknown as VariantRow[]).map((v) =>
    ({ id: v.id, label: `${v.products?.name ?? "—"} · ${v.color} · ${v.size}` }));
}
