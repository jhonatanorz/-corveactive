import { describe, it, expect } from "vitest";
import { matchesProductFilters, type ProductFilterItem } from "@/domain/product-filter";

const item: ProductFilterItem = {
  name: "Legging Aurora",
  lineSlug: "MOVE",
  categorySlug: "leggings",
  status: "active",
};

describe("matchesProductFilters", () => {
  it("passes when no filters are set", () => {
    expect(matchesProductFilters(item, {})).toBe(true);
  });

  it("matches query against name (case/accent-insensitive)", () => {
    expect(matchesProductFilters(item, { query: "aurora" })).toBe(true);
    expect(matchesProductFilters(item, { query: "AURORA" })).toBe(true);
    expect(matchesProductFilters(item, { query: "léggíng" })).toBe(true);
    expect(matchesProductFilters(item, { query: "short" })).toBe(false);
  });

  it("filters by line (exact, single-select)", () => {
    expect(matchesProductFilters(item, { lineSlug: "MOVE" })).toBe(true);
    expect(matchesProductFilters(item, { lineSlug: "HIM" })).toBe(false);
  });

  it("filters by category", () => {
    expect(matchesProductFilters(item, { categorySlug: "leggings" })).toBe(true);
    expect(matchesProductFilters(item, { categorySlug: "shorts" })).toBe(false);
  });

  it("filters by status", () => {
    expect(matchesProductFilters(item, { status: "active" })).toBe(true);
    expect(matchesProductFilters(item, { status: "draft" })).toBe(false);
  });

  it("combines facets with AND", () => {
    expect(matchesProductFilters(item, { lineSlug: "MOVE", status: "active" })).toBe(true);
    expect(matchesProductFilters(item, { lineSlug: "MOVE", status: "draft" })).toBe(false);
  });

  it("treats empty strings as no constraint", () => {
    expect(matchesProductFilters(item, { query: "", lineSlug: "", categorySlug: "", status: "" })).toBe(true);
  });
});
