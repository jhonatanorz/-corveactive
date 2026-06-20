# CSV Product Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin bulk-create products and their variants from a CSV file via a preview→confirm flow.

**Architecture:** A pure, DB-free parse+validate module (`src/lib/admin/product-csv.ts`) turns CSV text + lookup maps into a typed `ImportPlan` plus a per-row error list. Two server actions wrap it: `previewImport` (dry run) and `commitImport` (re-validate, then write). The only write path is a single atomic Postgres RPC `import_products(jsonb)`, mirroring the existing `place_order` / `receive_purchase_order` pattern. A client component holds the selected `File` across both steps.

**Tech Stack:** Next.js 16 (App Router, Server Actions), React 19, Supabase (Postgres + RPC), Vitest, TypeScript, Tailwind v4.

## Global Constraints

- Money is stored as **centavos** (integers). CSV `price` is a pesos string parsed via `parsePesosInput` from `@/domain/money` (verbatim reuse — do not re-implement).
- Slug matching uses `slugify` from `@/domain/slugify` (verbatim reuse) on **both** sides of every comparison (the value and the DB slug/name), because `product_lines.slug` values are uppercase (`MOVE`, `HIM`).
- Variants always start at `stock = 0`, `color_hex = '#000000'`, `sku = null`. Products always import with `status = 'draft'`. These are not CSV columns.
- Import is **create-only**: a row whose product name already exists (case-insensitive, trimmed) in the non-deleted catalog is a row error.
- Pure parse/validate code touches **no** Supabase. Only the server actions and repo touch the DB. The only write is the `import_products` RPC.
- All user-facing strings are Spanish (es-MX), matching the existing admin UI.
- UI imports components from the `@/components/ui` barrel.

---

### Task 1: CSV tokenizer (`parseCsv`)

A pure RFC-4180 tokenizer: CSV text → array of rows, each an array of string cells. Handles quoted fields (embedded commas, quotes, and newlines), CRLF and LF line endings, a leading UTF-8 BOM, and a trailing newline. Empty input → `[]`.

**Files:**
- Create: `src/lib/admin/product-csv.ts`
- Test: `src/lib/admin/product-csv.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `export function parseCsv(text: string): string[][]` — outer array is rows (including the header row as `[0]`); inner array is the raw cell strings of that row, untrimmed. Returns `[]` for empty/whitespace-only input.

- [ ] **Step 1: Write the failing test**

Create `src/lib/admin/product-csv.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseCsv } from "@/lib/admin/product-csv";

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/admin/product-csv.test.ts`
Expected: FAIL — `parseCsv is not a function` / module has no such export.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/admin/product-csv.ts` with the tokenizer:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/admin/product-csv.test.ts`
Expected: PASS (8 passing).

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/product-csv.ts src/lib/admin/product-csv.test.ts
git commit -m "feat(import): add RFC-4180 CSV tokenizer"
```

---

### Task 2: Import validator (`validateImport`)

The pure heart of the feature: map headers, validate each row, resolve line/category via lookups, group rows into products by name, detect cross-row conflicts and catalog collisions, and emit a typed `ImportPlan` + row errors. No DB access.

**Files:**
- Modify: `src/lib/admin/product-csv.ts` (append types + `validateImport`)
- Modify: `src/lib/admin/product-csv.test.ts` (append `validateImport` tests)

**Interfaces:**
- Consumes: `parseCsv` (Task 1); `slugify` from `@/domain/slugify`; `parsePesosInput` from `@/domain/money`.
- Produces:

```ts
export type RowError = { row: number; field?: string; message: string };

export interface PlanVariant {
  color: string;
  color_hex: string;   // always "#000000"
  size: string;
  sku: string | null;  // always null
  stock: number;       // always 0
}

export interface PlanProduct {
  name: string;
  line_id: string;
  category_id: string;
  price: number;        // centavos
  description: string;
  status: "draft";      // always "draft"
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
  existingNames: string[]; // non-deleted product names
}

export type ValidateResult =
  | { ok: true; plan: ImportPlan; counts: ImportCounts }
  | { ok: false; plan: ImportPlan; counts: ImportCounts; errors: RowError[] };

export function validateImport(text: string, lookups: ImportLookups): ValidateResult;
```

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/admin/product-csv.test.ts`:

```ts
import { validateImport, type ImportLookups } from "@/lib/admin/product-csv";

const lookups: ImportLookups = {
  lines: [
    { id: "line-move", slug: "MOVE", name: "CORVE MOVE" },
    { id: "line-him", slug: "HIM", name: "CORVE HIM" },
  ],
  categories: [
    { id: "cat-leg", slug: "leggings", name: "Leggings" },
    { id: "cat-top", slug: "tops", name: "Tops" },
  ],
  existingNames: ["Producto Existente"],
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

  it("errors when a product name already exists (create-only, case-insensitive)", () => {
    const csv = [header, "producto existente,MOVE,leggings,10,Negro,M,"].join("\n");
    const r = validateImport(csv, lookups);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.field === "name")).toBe(true);
  });

  it("errors when same-name rows disagree on a product-level field", () => {
    const csv = [
      header,
      "X,MOVE,leggings,10,Negro,M,",
      "X,MOVE,leggings,20,Azul,M,", // price differs
    ].join("\n");
    const r = validateImport(csv, lookups);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0].row).toBe(3);
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/admin/product-csv.test.ts`
Expected: FAIL — `validateImport is not a function`.

- [ ] **Step 3: Write minimal implementation**

Append to `src/lib/admin/product-csv.ts`:

```ts
import { slugify } from "@/domain/slugify";
import { parsePesosInput } from "@/domain/money";

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
  existingNames: string[];
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
  const existing = new Set(lookups.existingNames.map((n) => n.trim().toLowerCase()));

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

    if (existing.has(name.toLowerCase())) {
      errors.push({ row: fileRow, field: "name", message: "Ya existe un producto con ese nombre." });
      continue;
    }

    const key = name.toLowerCase();
    const existingGroup = groups.get(key);
    if (existingGroup) {
      const p = existingGroup.product;
      if (
        p.line_id !== line_id ||
        p.category_id !== category_id ||
        p.price !== price ||
        p.description !== description
      ) {
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/admin/product-csv.test.ts`
Expected: PASS (all parser + validator tests green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/product-csv.ts src/lib/admin/product-csv.test.ts
git commit -m "feat(import): add CSV import validator with row grouping and errors"
```

---

### Task 3: `import_products` RPC + migration

An atomic, security-definer Postgres function that inserts the planned products and their variants in one transaction. Rolls back entirely on any error. Mirrors `receive_purchase_order` / `place_order`.

**Files:**
- Create: `supabase/migrations/0012_import_products.sql`

**Interfaces:**
- Consumes: nothing (SQL).
- Produces: SQL function `import_products(p_products jsonb) returns integer` — inserts each product + its `variants` array; returns the number of products created. Granted to `authenticated`. Expects each element shaped like a `PlanProduct` (Task 2): `{ name, line_id, category_id, price, description, status, variants: [{ color, color_hex, size, sku, stock }] }`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0012_import_products.sql`:

```sql
-- supabase/migrations/0012_import_products.sql
-- Atomic bulk product import. Inserts each product and its variants in one
-- transaction; returns the count of products created. Rolls back on any error.
-- Mirrors the place_order / receive_purchase_order RPC pattern.
create or replace function import_products(p_products jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  p jsonb;
  v jsonb;
  v_product_id uuid;
  v_count int := 0;
begin
  for p in select * from jsonb_array_elements(coalesce(p_products, '[]'::jsonb))
  loop
    insert into products (name, line_id, category_id, description, price, status)
    values (
      btrim(p->>'name'),
      (p->>'line_id')::uuid,
      (p->>'category_id')::uuid,
      coalesce(p->>'description', ''),
      (p->>'price')::int,
      coalesce(nullif(p->>'status', ''), 'draft')::product_status
    )
    returning id into v_product_id;

    for v in select * from jsonb_array_elements(coalesce(p->'variants', '[]'::jsonb))
    loop
      insert into variants (product_id, color, color_hex, size, sku, stock)
      values (
        v_product_id,
        v->>'color',
        coalesce(nullif(v->>'color_hex', ''), '#000000'),
        v->>'size',
        nullif(v->>'sku', ''),
        coalesce((v->>'stock')::int, 0)
      );
    end loop;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function import_products(jsonb) to authenticated;
```

- [ ] **Step 2: Apply the migration locally**

Run: `npx supabase db reset` (Docker must be running — re-applies all migrations + seed).
Expected: completes without error; output lists `0012_import_products.sql` applied.

- [ ] **Step 3: Smoke-test the RPC in the DB**

Run (psql via the Supabase CLI):

```bash
npx supabase db execute --query "select import_products('[{\"name\":\"PLAN TEST\",\"line_id\":(select id from product_lines limit 1)::text,\"category_id\":(select id from product_categories limit 1)::text,\"price\":1000,\"description\":\"x\",\"status\":\"draft\",\"variants\":[{\"color\":\"Negro\",\"color_hex\":\"#000000\",\"size\":\"M\",\"sku\":null,\"stock\":0}]}]'::jsonb);"
```

If `db execute` is unavailable in this CLI version, instead open Supabase Studio (http://localhost:54323) → SQL editor and run a hardcoded-UUID version of the call.
Expected: returns `1`; a `PLAN TEST` product with one variant now exists. (Optional cleanup: `delete from products where name = 'PLAN TEST';`)

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0012_import_products.sql
git commit -m "feat(import): add atomic import_products RPC"
```

---

### Task 4: `importProducts` repo function

Thin wrapper that calls the RPC.

**Files:**
- Modify: `src/lib/repos/products.ts` (add export at end of file)

**Interfaces:**
- Consumes: `ImportPlan` (Task 2); `createClient` from `@/lib/supabase/server`.
- Produces: `export async function importProducts(plan: ImportPlan): Promise<number>` — returns the number of products created; throws on RPC error.

- [ ] **Step 1: Add the import for the type**

At the top of `src/lib/repos/products.ts`, add to the existing import block:

```ts
import type { ImportPlan } from "@/lib/admin/product-csv";
```

- [ ] **Step 2: Add the function**

Append to the end of `src/lib/repos/products.ts`:

```ts
/** Atomically create products + variants from a validated import plan. Returns
 *  the number of products created. */
export async function importProducts(plan: ImportPlan): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("import_products", { p_products: plan.products });
  if (error) throw error;
  return (data as number) ?? 0;
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/repos/products.ts
git commit -m "feat(import): add importProducts repo wrapper for the RPC"
```

---

### Task 5: Server actions (`previewImport`, `commitImport`)

Wrap the validator with the DB lookups and the commit path. Lookups (lines, categories, existing names) are fetched here — the only place that reads the catalog.

**Files:**
- Create: `src/app/admin/products/import/actions.ts`

**Interfaces:**
- Consumes: `validateImport`, `ValidateResult`, `ImportLookups` (Task 2); `importProducts` (Task 4); `createClient`; `setFlash`, `friendlyError` from `@/lib/flash`.
- Produces:
  - `export type PreviewState = ValidateResult | { fileError: string } | undefined`
  - `export async function previewImport(_prev: unknown, formData: FormData): Promise<PreviewState>`
  - `export async function commitImport(_prev: unknown, formData: FormData): Promise<PreviewState>`

- [ ] **Step 1: Write the actions**

Create `src/app/admin/products/import/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { validateImport, type ValidateResult, type ImportLookups } from "@/lib/admin/product-csv";
import { importProducts } from "@/lib/repos/products";
import { setFlash, friendlyError } from "@/lib/flash";

export type PreviewState = ValidateResult | { fileError: string } | undefined;

async function loadLookups(): Promise<ImportLookups> {
  const supabase = await createClient();
  const [lines, categories, products] = await Promise.all([
    supabase.from("product_lines").select("id,slug,name"),
    supabase.from("product_categories").select("id,slug,name"),
    supabase.from("products").select("name").is("deleted_at", null),
  ]);
  return {
    lines: (lines.data ?? []) as ImportLookups["lines"],
    categories: (categories.data ?? []) as ImportLookups["categories"],
    existingNames: ((products.data ?? []) as { name: string }[]).map((p) => p.name),
  };
}

async function readCsv(formData: FormData): Promise<{ text: string } | { fileError: string }> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { fileError: "Selecciona un archivo CSV." };
  }
  return { text: await file.text() };
}

/** Dry run: validate the file and return a summary + errors. Writes nothing. */
export async function previewImport(_prev: unknown, formData: FormData): Promise<PreviewState> {
  const read = await readCsv(formData);
  if ("fileError" in read) return read;
  const lookups = await loadLookups();
  return validateImport(read.text, lookups);
}

/** Re-validate the same file on the server, then commit via the atomic RPC. */
export async function commitImport(_prev: unknown, formData: FormData): Promise<PreviewState> {
  const read = await readCsv(formData);
  if ("fileError" in read) return read;
  const lookups = await loadLookups();
  const result = validateImport(read.text, lookups);
  if (!result.ok) return result; // still has errors — refuse to write

  try {
    const n = await importProducts(result.plan);
    await setFlash(`${n} productos importados`);
  } catch (e) {
    await setFlash(friendlyError(e), "error");
    return result;
  }

  revalidatePath("/admin/products");
  revalidatePath("/");
  redirect("/admin/products");
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/products/import/actions.ts
git commit -m "feat(import): add preview/commit server actions"
```

---

### Task 6: Import UI (page + client component) and entry button

The admin-facing screen: pick a CSV, preview the summary + errors, confirm. The client component holds the selected `File` in state and calls the actions directly so the same file is reused across preview and commit (Approach A). Also adds the entry button on the products list.

**Files:**
- Create: `src/app/admin/products/import/page.tsx`
- Create: `src/app/admin/products/import/ImportClient.tsx`
- Modify: `src/app/admin/products/page.tsx` (add "Importar CSV" link in the header)

**Interfaces:**
- Consumes: `previewImport`, `commitImport`, `PreviewState` (Task 5); `Button`, `buttonClass`, `PageHeader` from `@/components/ui`.
- Produces: route `/admin/products/import`.

- [ ] **Step 1: Create the page shell**

Create `src/app/admin/products/import/page.tsx`:

```tsx
import Link from "next/link";
import { buttonClass, PageHeader } from "@/components/ui";
import ImportClient from "./ImportClient";

export default function ImportProductsPage() {
  return (
    <div className="p-6 space-y-4">
      <PageHeader title="Importar productos (CSV)">
        <Link href="/admin/products" className={buttonClass("ghost", "sm")}>
          ← Productos
        </Link>
      </PageHeader>
      <p className="text-sm text-ink-2">
        Sube un archivo CSV con columnas: <code>name, line, category, price, color, size, description</code>.
        Cada fila es una variante; las filas con el mismo <code>name</code> se agrupan en un producto.
      </p>
      <ImportClient />
    </div>
  );
}
```

(`ButtonVariant` is `"primary" | "accent" | "ghost" | "soft"` — `"ghost"` is the bordered/secondary style.)

- [ ] **Step 2: Create the client component**

Create `src/app/admin/products/import/ImportClient.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { previewImport, commitImport, type PreviewState } from "./actions";

export default function ImportClient() {
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<PreviewState>(undefined);
  const [pending, startTransition] = useTransition();

  function run(action: typeof previewImport) {
    if (!file) {
      setState({ fileError: "Selecciona un archivo CSV." });
      return;
    }
    const fd = new FormData();
    fd.set("file", file);
    startTransition(async () => {
      const next = await action(undefined, fd);
      if (next) setState(next); // commit success redirects and never returns
    });
  }

  const fileError = state && "fileError" in state ? state.fileError : null;
  const result = state && "ok" in state ? state : null;

  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-center gap-3">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setState(undefined);
          }}
          className="text-ink-2"
        />
        <Button type="button" variant="ghost" size="md" disabled={pending || !file}
          onClick={() => run(previewImport)}>
          {pending ? "Validando…" : "Previsualizar"}
        </Button>
      </div>

      {fileError && <p className="text-red-600">{fileError}</p>}

      {result && (
        <div className="space-y-3">
          <p className="text-ink">
            {result.counts.products} producto(s) y {result.counts.variants} variante(s) se crearán.
          </p>

          {!result.ok && (
            <div className="rounded border border-red-200 bg-red-50 p-3">
              <p className="font-medium text-red-700">
                {result.errors.length} error(es) — corrige el archivo y vuelve a subirlo:
              </p>
              <ul className="mt-2 space-y-1">
                {result.errors.map((e, i) => (
                  <li key={i} className="text-red-700">
                    Fila {e.row}
                    {e.field ? ` · ${e.field}` : ""}: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.ok && (
            <Button type="button" variant="primary" size="md" disabled={pending}
              onClick={() => run(commitImport)}>
              {pending ? "Importando…" : "Confirmar importación"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Add the entry button on the products list**

In `src/app/admin/products/page.tsx`, change the `PageHeader` block to add an "Importar CSV" link beside the existing "+ Nuevo producto" link:

```tsx
      <PageHeader title="Productos">
        <Link href="/admin/products/import" className={buttonClass("soft", "sm")}>
          Importar CSV
        </Link>
        <Link href="/admin/products/new" className={buttonClass("primary", "sm")}>
          + Nuevo producto
        </Link>
      </PageHeader>
```

(`"soft"` is the periwinkle non-primary variant defined in `src/components/ui/Button.tsx`.)

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint src/app/admin/products/import`
Expected: no errors.

- [ ] **Step 5: Manual verification in the browser**

With `npm run dev` running and Docker/Supabase up, sign in to the admin (see the `local-dev-environment` memory for creds), then:

1. Go to `/admin/products` → confirm the **Importar CSV** button appears → click it.
2. Save this as `test-import.csv` and upload it:

```csv
name,line,category,price,color,size,description
Legging Aurora,MOVE,leggings,499.00,Negro,M,Suave
Legging Aurora,MOVE,leggings,499.00,Negro,L,Suave
Legging Aurora,MOVE,leggings,499.00,Azul,M,Suave
```

3. Click **Previsualizar** → expect "1 producto(s) y 3 variante(s) se crearán." and a **Confirmar importación** button (no errors).
4. Upload a broken file (unknown line `NOPE`, blank name) → expect the error list with correct **Fila N** numbers and **no** Confirm button.
5. Back on the good file → click **Confirmar importación** → expect redirect to `/admin/products`, a "1 productos importados" toast, and `Legging Aurora` in the list with 3 variants on its detail page.
6. Re-upload the same good file → preview now reports a create-only **name already exists** error (proves create-only).

Expected: all six checks pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/products/import/page.tsx src/app/admin/products/import/ImportClient.tsx src/app/admin/products/page.tsx
git commit -m "feat(import): add CSV import admin page and entry button"
```

---

## Self-Review Notes

- **Spec coverage:** CSV format/columns/defaults → Task 2 + Task 6 copy; slug matching + unknown→error → Task 2; pesos→centavos → Task 2 (`parsePesosInput`); rollup by name → Task 2; create-only → Task 2; preview→confirm with confirm-disabled-on-errors → Task 5 + Task 6 (Confirm renders only when `result.ok`); atomic insert → Task 3; row-numbered full error report → Task 2; testing (parser + validator) → Tasks 1–2; manual RPC + UI checks → Tasks 3, 6. All spec sections map to a task.
- **No placeholders:** every code step contains complete code. The two "if variant not valid, use the other variant name" notes (Button variant) are conditional fallbacks with an explicit file to check, not TBDs.
- **Type consistency:** `ImportPlan`/`PlanProduct`/`ValidateResult`/`ImportLookups` are defined once in Task 2 and consumed unchanged in Tasks 4–6; `importProducts(plan) -> Promise<number>` matches between Task 4 and Task 5; RPC arg name `p_products` matches between Task 3 and Task 4.
```
