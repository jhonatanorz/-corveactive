import { describe, it, expect } from "vitest";
import { normalizeColorKey, aggregateColors } from "@/domain/catalog-colors";

describe("normalizeColorKey", () => {
  it("lowercases, trims, strips accents", () => {
    expect(normalizeColorKey("  Café ")).toBe("cafe");
    expect(normalizeColorKey("Negro")).toBe("negro");
  });
});

describe("aggregateColors", () => {
  it("dedupes case/accent-insensitively, first-seen label + hex win", () => {
    const r = aggregateColors([
      { color: "Negro", color_hex: "#111" },
      { color: "negro", color_hex: "#000" },
      { color: "Café", color_hex: "#a50" },
    ]);
    expect(r).toEqual([
      { key: "negro", label: "Negro", hex: "#111" },
      { key: "cafe", label: "Café", hex: "#a50" },
    ]);
  });
  it("returns [] for no variants", () => {
    expect(aggregateColors([])).toEqual([]);
  });
});
