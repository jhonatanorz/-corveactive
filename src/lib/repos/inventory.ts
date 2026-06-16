import "server-only";
import { createClient } from "@/lib/supabase/server";
import { computeCorrection } from "@/lib/admin/correction";
import type { StockMovementRow } from "@/lib/db-types";

/** Set a variant's stock to an absolute count, logging a `correccion` movement. */
export async function correctStock(
  variantId: string,
  target: number,
  reason: string,
): Promise<void> {
  const supabase = await createClient();
  const { data: variant, error } = await supabase
    .from("variants").select("stock").eq("id", variantId).single();
  if (error) throw error;

  const result = computeCorrection((variant as { stock: number }).stock, target);
  if (!result.ok) {
    if (result.reason === "no_change") return;
    throw new Error(`Invalid correction: ${result.reason}`);
  }

  const { error: upErr } = await supabase
    .from("variants").update({ stock: result.newStock }).eq("id", variantId);
  if (upErr) throw upErr;

  const { error: mvErr } = await supabase.from("stock_movements").insert({
    variant_id: variantId,
    delta: result.delta,
    type: "correccion",
    reason,
  });
  if (mvErr) throw mvErr;
}

export async function listMovements(limit = 100): Promise<StockMovementRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_movements").select("*").order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return data as StockMovementRow[];
}
