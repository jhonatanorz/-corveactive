import { describe, it, expect } from "vitest";
import { buildVariantGrid, type GridVariant } from "@/lib/admin/variant-grid";

const variants: GridVariant[] = [
  { color: "Negro", size: "M", stock: 6 },
  { color: "Negro", size: "S", stock: 8 },
  { color: "Arena", size: "M", stock: 0 },
  { color: "Negro", size: "XS", stock: 5 },
];

describe("buildVariantGrid", () => {
  it("orders sizes canonically (XS, S, M ...)", () => {
    expect(buildVariantGrid(variants).sizes).toEqual(["XS", "S", "M"]);
  });

  it("orders colors by first appearance", () => {
    expect(buildVariantGrid(variants).colors).toEqual(["Negro", "Arena"]);
  });

  it("maps stock per color+size, null where no variant exists", () => {
    const grid = buildVariantGrid(variants);
    expect(grid.cell("Negro", "S")).toBe(8);
    expect(grid.cell("Arena", "M")).toBe(0);
    expect(grid.cell("Arena", "S")).toBeNull();
  });

  it("appends unknown sizes after canonical ones", () => {
    const grid = buildVariantGrid([
      { color: "Negro", size: "Única", stock: 3 },
      { color: "Negro", size: "M", stock: 1 },
    ]);
    expect(grid.sizes).toEqual(["M", "Única"]);
  });

  it("handles an empty list", () => {
    const grid = buildVariantGrid([]);
    expect(grid.sizes).toEqual([]);
    expect(grid.colors).toEqual([]);
    expect(grid.cell("Negro", "M")).toBeNull();
  });
});
