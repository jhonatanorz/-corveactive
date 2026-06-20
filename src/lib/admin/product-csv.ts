import { slugify } from "@/domain/slugify";
import { parsePesosInput } from "@/domain/money";

/**
 * RFC-4180 CSV tokenizer. Returns rows of raw (untrimmed) cell strings,
 * including the header row at index 0. Handles quoted fields (commas, quotes,
 * newlines), CRLF/LF, a leading BOM, and a trailing newline. Empty input -> [].
 */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  if (src.trim() === "") return [];

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  let i = 0;

  const pushCell = () => {
    row.push(cell);
    cell = "";
  };
  const pushRow = () => {
    pushCell();
    rows.push(row);
    row = [];
  };

  while (i < src.length) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 2;
        } else {
          inQuotes = false;
          i += 1;
        }
      } else {
        cell += ch;
        i += 1;
      }
    } else if (ch === '"') {
      inQuotes = true;
      i += 1;
    } else if (ch === ",") {
      pushCell();
      i += 1;
    } else if (ch === "\r") {
      // swallow; the following \n (or end) terminates the row
      i += 1;
    } else if (ch === "\n") {
      pushRow();
      i += 1;
    } else {
      cell += ch;
      i += 1;
    }
  }
  // flush the last cell/row unless the input ended exactly on a newline
  if (cell !== "" || row.length > 0) pushRow();
  return rows;
}

export type RowError = { row: number; field?: string; message: string };

export interface PlanVariant {
  color: string;
  color_hex: string;
  size: string;
  sku: string | null;
  stock: number;
}

export interface PlanProduct {
  name: string;
  line_id: string;
  category_id: string;
  price: number;
  description: string;
  status: "draft";
  variants: PlanVariant[];
}

export interface ImportPlan {
  products: PlanProduct[];
}

export interface ImportCounts {
  products: number;
  variants: number;
}

export interface LookupRow {
  id: string;
  slug: string;
  name: string;
}

export interface ImportLookups {
  lines: LookupRow[];
  categories: LookupRow[];
  /** Non-deleted catalog products, keyed by the same (name, line, category)
   *  identity used for rollup. A row is a create-only duplicate only when all
   *  three match an existing product. */
  existingProducts: { name: string; line_id: string; category_id: string }[];
}

export type ValidateResult =
  | { ok: true; plan: ImportPlan; counts: ImportCounts }
  | { ok: false; plan: ImportPlan; counts: ImportCounts; errors: RowError[] };

const REQUIRED = ["name", "line", "category", "price", "color", "size"] as const;

/** Map slugify(slug) and slugify(name) -> id, slug taking precedence. */
function buildLookupMap(rows: LookupRow[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const r of rows) {
    const s = slugify(r.slug);
    if (s && !m.has(s)) m.set(s, r.id);
  }
  for (const r of rows) {
    const n = slugify(r.name);
    if (n && !m.has(n)) m.set(n, r.id);
  }
  return m;
}

function counts(plan: ImportPlan): ImportCounts {
  return {
    products: plan.products.length,
    variants: plan.products.reduce((sum, p) => sum + p.variants.length, 0),
  };
}

interface Group {
  product: PlanProduct;
  variantKeys: Set<string>;
}

export function validateImport(text: string, lookups: ImportLookups): ValidateResult {
  const rows = parseCsv(text);
  const empty: ImportPlan = { products: [] };

  if (rows.length === 0) {
    return {
      ok: false,
      plan: empty,
      counts: counts(empty),
      errors: [{ row: 1, message: "El archivo está vacío." }],
    };
  }

  const header = rows[0].map((h) => slugify(h));
  const col: Record<string, number> = {};
  for (const key of [...REQUIRED, "description"]) col[key] = header.indexOf(key);

  const missing = REQUIRED.filter((k) => col[k] === -1);
  if (missing.length > 0) {
    return {
      ok: false,
      plan: empty,
      counts: counts(empty),
      errors: [{ row: 1, message: `Faltan columnas requeridas: ${missing.join(", ")}` }],
    };
  }

  const lineMap = buildLookupMap(lookups.lines);
  const catMap = buildLookupMap(lookups.categories);
  const existing = new Set(
    lookups.existingProducts.map(
      (p) => `${p.name.trim().toLowerCase()}|${p.line_id}|${p.category_id}`,
    ),
  );

  const groups = new Map<string, Group>();
  const errors: RowError[] = [];

  for (let i = 1; i < rows.length; i++) {
    const fileRow = i + 1;
    const cells = rows[i];
    // skip a fully-empty line (e.g. blank line in the middle/end)
    if (cells.length === 1 && cells[0].trim() === "") continue;
    if (cells.length !== rows[0].length) {
      errors.push({ row: fileRow, message: "Número de columnas incorrecto." });
      continue;
    }

    const at = (key: string) => (col[key] === -1 ? "" : (cells[col[key]] ?? "").trim());
    const name = at("name");
    const color = at("color");
    const size = at("size");
    const description = at("description");

    const rowErrs: RowError[] = [];
    if (name === "") rowErrs.push({ row: fileRow, field: "name", message: "El nombre es obligatorio." });
    if (color === "") rowErrs.push({ row: fileRow, field: "color", message: "El color es obligatorio." });
    if (size === "") rowErrs.push({ row: fileRow, field: "size", message: "La talla es obligatoria." });

    const price = parsePesosInput(at("price"));
    if (price === null) rowErrs.push({ row: fileRow, field: "price", message: "Precio inválido." });

    const line_id = lineMap.get(slugify(at("line")));
    if (line_id === undefined) rowErrs.push({ row: fileRow, field: "line", message: "Línea desconocida." });

    const category_id = catMap.get(slugify(at("category")));
    if (category_id === undefined) rowErrs.push({ row: fileRow, field: "category", message: "Categoría desconocida." });

    if (rowErrs.length > 0) {
      errors.push(...rowErrs);
      continue;
    }

    if (existing.has(`${name.toLowerCase()}|${line_id}|${category_id}`)) {
      errors.push({
        row: fileRow,
        field: "name",
        message: "Ya existe un producto con ese nombre en esa línea y categoría.",
      });
      continue;
    }

    // Product identity is (name, line, category): rows only roll up into the same
    // product when all three match. A repeated name under a different line or
    // category is a separate product, not a conflict.
    const key = `${name.toLowerCase()}|${line_id}|${category_id}`;
    const existingGroup = groups.get(key);
    if (existingGroup) {
      const p = existingGroup.product;
      // line/category are part of the key (always equal here); price/description
      // are still product-level and must be consistent across the product's rows.
      if (p.price !== price || p.description !== description) {
        errors.push({
          row: fileRow,
          message: "Datos del producto inconsistentes con una fila anterior del mismo producto.",
        });
        continue;
      }
    }

    const group =
      existingGroup ??
      (() => {
        const g: Group = {
          product: {
            name,
            line_id: line_id as string,
            category_id: category_id as string,
            price: price as number,
            description,
            status: "draft",
            variants: [],
          },
          variantKeys: new Set<string>(),
        };
        groups.set(key, g);
        return g;
      })();

    const vKey = `${color.toLowerCase()}|${size.toLowerCase()}`;
    if (group.variantKeys.has(vKey)) {
      errors.push({ row: fileRow, message: "Variante (color/talla) duplicada." });
      continue;
    }
    group.variantKeys.add(vKey);
    group.product.variants.push({ color, color_hex: "#000000", size, sku: null, stock: 0 });
  }

  const plan: ImportPlan = { products: [...groups.values()].map((g) => g.product) };
  if (errors.length > 0) {
    return { ok: false, plan, counts: counts(plan), errors };
  }
  return { ok: true, plan, counts: counts(plan) };
}
