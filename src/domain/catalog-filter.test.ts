import { describe, it, expect } from "vitest";
import { matchesFilters, type FilterableItem } from "@/domain/catalog-filter";

const item: FilterableItem = {
  name: "Legging Aurora",
  categorySlug: "leggings",
  categoryName: "Leggings",
  colors: [{ color: "Negro" }, { color: "Café" }],
};
const none = { query: "", categorySlugs: [], colorKeys: [] };

describe("matchesFilters", () => {
  it("passes everything when no filters set", () => {
    expect(matchesFilters(item, none)).toBe(true);
  });
  it("matches query against name (accent/case-insensitive)", () => {
    expect(matchesFilters(item, { ...none, query: "aurora" })).toBe(true);
    expect(matchesFilters(item, { ...none, query: "AURORA" })).toBe(true);
    expect(matchesFilters(item, { ...none, query: "short" })).toBe(false);
  });
  it("matches query against category name", () => {
    expect(matchesFilters(item, { ...none, query: "legg" })).toBe(true);
  });
  it("category facet is OR within, AND across facets", () => {
    expect(matchesFilters(item, { ...none, categorySlugs: ["shorts"] })).toBe(false);
    expect(matchesFilters(item, { ...none, categorySlugs: ["shorts", "leggings"] })).toBe(true);
  });
  it("color facet matches any variant color by normalized key", () => {
    expect(matchesFilters(item, { ...none, colorKeys: ["negro"] })).toBe(true);
    expect(matchesFilters(item, { ...none, colorKeys: ["cafe"] })).toBe(true);
    expect(matchesFilters(item, { ...none, colorKeys: ["blanco"] })).toBe(false);
  });
  it("combines facets with AND", () => {
    expect(matchesFilters(item, { query: "aurora", categorySlugs: ["leggings"], colorKeys: ["negro"] })).toBe(true);
    expect(matchesFilters(item, { query: "aurora", categorySlugs: ["leggings"], colorKeys: ["blanco"] })).toBe(false);
  });
});
