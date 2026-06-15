import { describe, it, expect } from "vitest";
import { formatMXN, pesos, parsePesosInput } from "@/domain/money";

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

describe("parsePesosInput", () => {
  it("parses whole pesos", () => {
    expect(parsePesosInput("690")).toBe(69000);
  });
  it("parses pesos with two decimals", () => {
    expect(parsePesosInput("690.50")).toBe(69050);
  });
  it("trims surrounding whitespace and a leading $", () => {
    expect(parsePesosInput(" $1,040.00 ")).toBe(104000);
  });
  it("returns null for empty input", () => {
    expect(parsePesosInput("")).toBeNull();
  });
  it("returns null for non-numeric input", () => {
    expect(parsePesosInput("abc")).toBeNull();
  });
  it("returns null for negative input", () => {
    expect(parsePesosInput("-5")).toBeNull();
  });
  it("rounds more than two decimals to the nearest centavo", () => {
    expect(parsePesosInput("10.005")).toBe(1001);
  });
  it("rounds the third decimal up reliably (no float drift)", () => {
    expect(parsePesosInput("1.005")).toBe(101);
  });
});
