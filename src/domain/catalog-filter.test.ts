import { describe, it, expect } from "vitest";
import { matchesFilters, type FilterableItem } from "@/domain/catalog-filter";

const item: FilterableItem = {
  name: "Legging Aurora",
  lineSlug: "MOVE",
  categorySlug: "leggings",
  categoryName: "Leggings",
  colors: [{ color: "Negro" }, { color: "Café" }],
};

describe("matchesFilters", () => {
  it("passes when no facets are set", () => {
    expect(matchesFilters(item, {})).toBe(true);
  });
  it("matches query against name (accent/case-insensitive)", () => {
    expect(matchesFilters(item, { query: "aurora" })).toBe(true);
    expect(matchesFilters(item, { query: "AURORA" })).toBe(true);
    expect(matchesFilters(item, { query: "short" })).toBe(false);
  });
  it("matches query against category name", () => {
    expect(matchesFilters(item, { query: "legg" })).toBe(true);
  });
  it("line facet is OR within, AND across", () => {
    expect(matchesFilters(item, { lineSlugs: ["HIM"] })).toBe(false);
    expect(matchesFilters(item, { lineSlugs: ["HIM", "MOVE"] })).toBe(true);
  });
  it("category facet is OR within", () => {
    expect(matchesFilters(item, { categorySlugs: ["shorts"] })).toBe(false);
    expect(matchesFilters(item, { categorySlugs: ["shorts", "leggings"] })).toBe(true);
  });
  it("color facet matches any variant color by normalized key", () => {
    expect(matchesFilters(item, { colorKeys: ["negro"] })).toBe(true);
    expect(matchesFilters(item, { colorKeys: ["cafe"] })).toBe(true);
    expect(matchesFilters(item, { colorKeys: ["blanco"] })).toBe(false);
  });
  it("combines line + color with AND", () => {
    expect(matchesFilters(item, { lineSlugs: ["MOVE"], colorKeys: ["negro"] })).toBe(true);
    expect(matchesFilters(item, { lineSlugs: ["MOVE"], colorKeys: ["blanco"] })).toBe(false);
    expect(matchesFilters(item, { lineSlugs: ["HIM"], colorKeys: ["negro"] })).toBe(false);
  });
});
