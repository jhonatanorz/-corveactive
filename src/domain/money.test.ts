import { describe, it, expect } from "vitest";
import { formatMXN, pesos } from "@/domain/money";

describe("pesos", () => {
  it("converts whole pesos to centavos", () => {
    expect(pesos(690)).toBe(69000);
  });

  it("rounds away floating-point drift", () => {
    expect(pesos(6.9)).toBe(690); // 6.9 * 100 = 689.9999... without rounding
  });
});

describe("formatMXN", () => {
  it("formats centavos as MXN currency", () => {
    expect(formatMXN(69000)).toBe("$690.00");
  });

  it("formats zero", () => {
    expect(formatMXN(0)).toBe("$0.00");
  });

  it("formats thousands with a separator", () => {
    expect(formatMXN(104000)).toBe("$1,040.00");
  });

  it("formats sub-peso centavos", () => {
    expect(formatMXN(69050)).toBe("$690.50");
  });
});
