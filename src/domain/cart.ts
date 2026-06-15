import type { Centavos } from "@/domain/money";

export interface CartLine {
  variantId: string;
  unitPrice: Centavos;
  qty: number;
}

/** Total price of all lines, in centavos. */
export function cartSubtotal(lines: CartLine[]): Centavos {
  return lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0);
}

/** Total number of items across all lines. */
export function cartCount(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.qty, 0);
}
