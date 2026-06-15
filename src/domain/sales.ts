import type { Centavos } from "@/domain/money";
import { type Line, type OrderStatus, SALE_STATUSES } from "@/domain/types";

export interface SaleItem {
  line: Line;
  unitPrice: Centavos;
  cost: Centavos;
  qty: number;
}

export interface SaleOrder {
  status: OrderStatus;
  createdAt: string; // ISO timestamp
  items: SaleItem[];
}

export interface SalesFilter {
  line?: Line;
  from?: string; // inclusive YYYY-MM-DD
  to?: string; // inclusive YYYY-MM-DD
}

export interface SalesSummary {
  revenue: Centavos;
  units: number;
  profit: Centavos;
}

function inRange(createdAt: string, from?: string, to?: string): boolean {
  const day = createdAt.slice(0, 10); // YYYY-MM-DD; assumes UTC (Z-suffixed) ISO timestamps
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

/** Aggregate realized sales (paid or beyond) into revenue, units, and profit. */
export function summarizeSales(orders: SaleOrder[], filter: SalesFilter): SalesSummary {
  const summary: SalesSummary = { revenue: 0, units: 0, profit: 0 };

  for (const order of orders) {
    if (!SALE_STATUSES.includes(order.status)) continue;
    if (!inRange(order.createdAt, filter.from, filter.to)) continue;

    for (const item of order.items) {
      if (filter.line && item.line !== filter.line) continue;
      summary.revenue += item.unitPrice * item.qty;
      summary.units += item.qty;
      summary.profit += (item.unitPrice - item.cost) * item.qty;
    }
  }

  return summary;
}
