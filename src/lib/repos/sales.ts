import "server-only";
import { createClient } from "@/lib/supabase/server";
import { summarizeSales, type SaleOrder, type SalesFilter, type SalesSummary } from "@/domain/sales";
import { SALE_STATUSES } from "@/domain/types";

/** Aggregate realized sales (paid or beyond) using the tested summarizeSales domain function. */
export async function getSalesSummary(filter: SalesFilter): Promise<SalesSummary> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("status, created_at, order_items(line, unit_price, cost, qty)")
    .in("status", SALE_STATUSES as unknown as string[]);
  if (error) throw error;

  const orders: SaleOrder[] = (data ?? [] as unknown as Array<{ status: string; created_at: string; order_items: { line: string; unit_price: number; cost: number; qty: number }[] }>).map((o) => ({
    status: o.status as SaleOrder["status"],
    createdAt: o.created_at,
    items: (o.order_items ?? []).map((i) => ({
      line: i.line as SaleOrder["items"][number]["line"],
      unitPrice: i.unit_price, cost: i.cost, qty: i.qty,
    })),
  }));
  return summarizeSales(orders, filter);
}
