import { describe, it, expect } from "vitest";
import { calcMargin } from "@/domain/margin";

describe("calcMargin", () => {
  it("returns amount and rounded percentage", () => {
    // price $690.00, cost $250.00 -> margin $440.00, 63.768% -> 64
    expect(calcMargin(69000, 25000)).toEqual({ amount: 44000, pct: 64 });
  });

  it("is 100% when cost is zero", () => {
    expect(calcMargin(50000, 0)).toEqual({ amount: 50000, pct: 100 });
  });

  it("returns 0% margin when price equals cost", () => {
    expect(calcMargin(30000, 30000)).toEqual({ amount: 0, pct: 0 });
  });

  it("handles cost above price (negative margin)", () => {
    expect(calcMargin(20000, 25000)).toEqual({ amount: -5000, pct: -25 });
  });

  it("returns 0 for both when price is zero", () => {
    expect(calcMargin(0, 0)).toEqual({ amount: 0, pct: 0 });
  });
});
