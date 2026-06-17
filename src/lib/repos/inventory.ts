import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Lot } from "@/domain/inventory";
import type { StockMovementRow } from "@/lib/db-types";

/** Adjust a variant's stock to an absolute target via the atomic adjust_inventory RPC.
 *  For an increase, `unitCost` (centavos) sets the new lot's cost (else the RPC defaults
 *  to the variant's current weighted cost). For a decrease it consumes lots FIFO. */
export async function adjustStockToTarget(
  variantId: string,
  target: number,
  reason: string,
  unitCost?: number | null,
): Promise<void> {
  const supabase = await createClient();
  const { data: variant, error } = await supabase
    .from("variants").select("stock").eq("id", variantId).single();
  if (error) throw error;
  const delta = target - (variant as { stock: number }).stock;
  if (delta === 0) return;
  const { error: rpcErr } = await supabase.rpc("adjust_inventory", {
    p_variant_id: variantId,
    p_delta: delta,
    p_reason: reason,
    p_unit_cost: delta > 0 ? (unitCost ?? null) : null,
  });
  if (rpcErr) throw rpcErr;
}

/** Lots (for current-cost display) grouped by variant, for a product's variants. */
export async function listVariantLots(productId: string): Promise<Record<string, Lot[]>> {
  const supabase = await createClient();
  const { data: variants, error: vErr } = await supabase
    .from("variants").select("id").eq("product_id", productId);
  if (vErr) throw vErr;
  const ids = (variants ?? []).map((v) => (v as { id: string }).id);
  const out: Record<string, Lot[]> = {};
  if (ids.length === 0) return out;
  const { data: lots, error } = await supabase
    .from("inventory_lots").select("variant_id,qty_remaining,unit_cost").in("variant_id", ids);
  if (error) throw error;
  for (const id of ids) out[id] = [];
  for (const l of (lots ?? []) as { variant_id: string; qty_remaining: number; unit_cost: number }[]) {
    (out[l.variant_id] ??= []).push({ qty_remaining: l.qty_remaining, unit_cost: l.unit_cost });
  }
  return out;
}

export async function listMovements(limit = 100): Promise<StockMovementRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_movements").select("*").order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return data as StockMovementRow[];
}
