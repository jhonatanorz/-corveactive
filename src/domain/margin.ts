import type { Centavos } from "@/domain/money";

export interface Margin {
  amount: Centavos; // price - cost
  pct: number; // rounded integer percentage of price
}

/** Margin of a sale price over its cost. Percentage is rounded to the nearest integer. */
export function calcMargin(price: Centavos, cost: Centavos): Margin {
  const amount = price - cost;
  const pct = price === 0 ? 0 : Math.round((amount / price) * 100);
  return { amount, pct };
}
