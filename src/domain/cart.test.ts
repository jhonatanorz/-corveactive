import { describe, it, expect } from "vitest";
import { cartSubtotal, cartCount, type CartLine } from "@/domain/cart";

const lines: CartLine[] = [
  { variantId: "v1", unitPrice: 69000, qty: 1 },
  { variantId: "v2", unitPrice: 35000, qty: 2 },
];

describe("cartSubtotal", () => {
  it("sums unitPrice * qty across lines", () => {
    expect(cartSubtotal(lines)).toBe(139000); // 690 + 350*2 = 1390.00
  });

  it("is 0 for an empty cart", () => {
    expect(cartSubtotal([])).toBe(0);
  });
});

describe("cartCount", () => {
  it("sums quantities", () => {
    expect(cartCount(lines)).toBe(3);
  });

  it("is 0 for an empty cart", () => {
    expect(cartCount([])).toBe(0);
  });
});
