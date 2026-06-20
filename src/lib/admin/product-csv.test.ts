import { describe, it, expect } from "vitest";
import { parseCsv, validateImport, type ImportLookups } from "@/lib/admin/product-csv";

describe("parseCsv", () => {
  it("parses a simple header + rows", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles quoted fields with embedded commas", () => {
    expect(parseCsv('name,desc\nLegging,"Te abraza, sin apretar"')).toEqual([
      ["name", "desc"],
      ["Legging", "Te abraza, sin apretar"],
    ]);
  });

  it("handles escaped quotes inside quoted fields", () => {
    expect(parseCsv('a\n"say ""hi"""')).toEqual([["a"], ['say "hi"']]);
  });

  it("handles embedded newlines inside quoted fields", () => {
    expect(parseCsv('a\n"line1\nline2"')).toEqual([["a"], ["line1\nline2"]]);
  });

  it("handles CRLF line endings", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("strips a leading UTF-8 BOM", () => {
    expect(parseCsv("﻿a,b\n1,2")).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("ignores a trailing newline (no empty final row)", () => {
    expect(parseCsv("a,b\n1,2\n")).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("returns [] for empty or whitespace-only input", () => {
    expect(parseCsv("")).toEqual([]);
    expect(parseCsv("   ")).toEqual([]);
  });
});

const lookups: ImportLookups = {
  lines: [
    { id: "line-move", slug: "MOVE", name: "CORVE MOVE" },
    { id: "line-him", slug: "HIM", name: "CORVE HIM" },
  ],
  categories: [
    { id: "cat-leg", slug: "leggings", name: "Leggings" },
    { id: "cat-top", slug: "tops", name: "Tops" },
  ],
  existingProducts: [{ name: "Producto Existente", line_id: "line-move", category_id: "cat-leg" }],
};

const header = "name,line,category,price,color,size,description";

describe("validateImport", () => {
  it("rolls 3 variant rows into 1 product", () => {
    const csv = [
      header,
      "Legging Aurora,MOVE,leggings,499.00,Negro,M,Suave",
      "Legging Aurora,MOVE,leggings,499.00,Negro,L,Suave",
      "Legging Aurora,MOVE,leggings,499.00,Azul,M,Suave",
    ].join("\n");
    const r = validateImport(csv, lookups);
    expect(r.ok).toBe(true);
    expect(r.counts).toEqual({ products: 1, variants: 3 });
    if (r.ok) {
      const p = r.plan.products[0];
      expect(p).toMatchObject({
        name: "Legging Aurora",
        line_id: "line-move",
        category_id: "cat-leg",
        price: 49900,
        description: "Suave",
        status: "draft",
      });
      expect(p.variants).toHaveLength(3);
      expect(p.variants[0]).toEqual({
        color: "Negro",
        color_hex: "#000000",
        size: "M",
        sku: null,
        stock: 0,
      });
    }
  });

  it("matches line/category case-insensitively and by name", () => {
    const csv = [header, "X,move,Leggings,10,Negro,M,"].join("\n");
    const r = validateImport(csv, lookups);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.plan.products[0].line_id).toBe("line-move");
      expect(r.plan.products[0].category_id).toBe("cat-leg");
    }
  });

  it("defaults description to empty when column is blank", () => {
    const csv = [header, "X,MOVE,leggings,10,Negro,M,"].join("\n");
    const r = validateImport(csv, lookups);
    if (r.ok) expect(r.plan.products[0].description).toBe("");
  });

  it("errors on a missing required column (header row 1)", () => {
    const csv = ["name,line,category,price,color", "X,MOVE,leggings,10,Negro"].join("\n");
    const r = validateImport(csv, lookups);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0].row).toBe(1);
      expect(r.errors[0].message).toMatch(/size/);
    }
  });

  it("errors on an empty file", () => {
    const r = validateImport("", lookups);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0].message).toMatch(/vac/i);
  });

  it("errors on a ragged row with the file row number", () => {
    const csv = [header, "X,MOVE,leggings,10,Negro"].join("\n"); // 6 cells vs 7
    const r = validateImport(csv, lookups);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0].row).toBe(2);
  });

  it("errors on blank required field", () => {
    const csv = [header, ",MOVE,leggings,10,Negro,M,"].join("\n");
    const r = validateImport(csv, lookups);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.field === "name")).toBe(true);
  });

  it("errors on an invalid price", () => {
    const csv = [header, "X,MOVE,leggings,abc,Negro,M,"].join("\n");
    const r = validateImport(csv, lookups);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.field === "price")).toBe(true);
  });

  it("errors on an unknown line", () => {
    const csv = [header, "X,NOPE,leggings,10,Negro,M,"].join("\n");
    const r = validateImport(csv, lookups);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.field === "line")).toBe(true);
  });

  it("errors on an unknown category", () => {
    const csv = [header, "X,MOVE,nope,10,Negro,M,"].join("\n");
    const r = validateImport(csv, lookups);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.field === "category")).toBe(true);
  });

  it("errors when name+line+category already exists (create-only, case-insensitive)", () => {
    const csv = [header, "producto existente,MOVE,leggings,10,Negro,M,"].join("\n");
    const r = validateImport(csv, lookups);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.field === "name")).toBe(true);
  });

  it("allows an existing name under a different line/category", () => {
    // "Producto Existente" exists as MOVE/leggings; HIM/tops is a new product.
    const csv = [header, "Producto Existente,HIM,tops,10,Negro,M,"].join("\n");
    const r = validateImport(csv, lookups);
    expect(r.ok).toBe(true);
    expect(r.counts).toEqual({ products: 1, variants: 1 });
  });

  it("errors when same name+line+category rows disagree on price/description", () => {
    const csv = [
      header,
      "X,MOVE,leggings,10,Negro,M,",
      "X,MOVE,leggings,20,Azul,M,", // same identity, price differs
    ].join("\n");
    const r = validateImport(csv, lookups);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0].row).toBe(3);
  });

  it("treats the same name under a different line as a separate product", () => {
    const csv = [
      header,
      "Camiseta,MOVE,leggings,10,Negro,M,",
      "Camiseta,HIM,leggings,10,Negro,M,", // same name+category, different line
    ].join("\n");
    const r = validateImport(csv, lookups);
    expect(r.ok).toBe(true);
    expect(r.counts).toEqual({ products: 2, variants: 2 });
  });

  it("treats the same name+line under a different category as a separate product", () => {
    const csv = [
      header,
      "Camiseta,MOVE,leggings,10,Negro,M,",
      "Camiseta,MOVE,tops,10,Negro,M,", // same name+line, different category
    ].join("\n");
    const r = validateImport(csv, lookups);
    expect(r.ok).toBe(true);
    expect(r.counts).toEqual({ products: 2, variants: 2 });
  });

  it("errors on a duplicate (name,color,size) within the file", () => {
    const csv = [
      header,
      "X,MOVE,leggings,10,Negro,M,",
      "X,MOVE,leggings,10,negro,m,", // same variant, different case
    ].join("\n");
    const r = validateImport(csv, lookups);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0].row).toBe(3);
  });

  it("reports every error at once (not fail-fast)", () => {
    const csv = [
      header,
      "X,NOPE,leggings,10,Negro,M,", // bad line
      "Y,MOVE,nope,10,Negro,M,",     // bad category
    ].join("\n");
    const r = validateImport(csv, lookups);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.length).toBe(2);
  });
});
