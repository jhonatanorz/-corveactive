# CSV Product Upload — Design

**Date:** 2026-06-19
**Status:** Approved (design phase)

## Summary

Add an admin feature to bulk-create products and their variants from a CSV
file. Each row is a variant; rows sharing a product **name** roll up into one
product. The flow is **preview → confirm**: the server validates the entire
file (a DB-free dry run) and shows a summary plus a per-row error list before
anything is written. The import is **create-only** (purely additive): a row
whose product name already exists in the catalog is reported as an error, never
updated or duplicated. The actual write is a single atomic Postgres RPC, mirroring
the existing `place_order` / `receive_po` patterns.

## Scope

**In scope**
- One CSV → many products, each with one or more variants.
- Server-side validation with a full error report (every error shown at once).
- Two-step preview/confirm UI under `/admin/products/import`.
- Atomic bulk insert (all-or-nothing).

**Out of scope (YAGNI)**
- Updating or upserting existing products (create-only).
- Auto-creating lines/categories (unknown values are errors).
- Initial stock / inventory movements (variants start at `stock = 0`, set later
  via the existing inventory correction flow).
- Variant images (uploaded separately, as today).
- `cost` (not on the product form today; left at its `0` default).

## Data model (existing, unchanged)

- **products**: `name`, `line_id` (FK → `product_lines`), `category_id`
  (FK → `product_categories`), `description`, `price` (centavos), `cost`,
  `status`.
- **variants**: `product_id`, `color`, `color_hex`, `size`, `stock`, `sku` —
  unique on `(product_id, color, size)`.
- **product_lines** / **product_categories**: admin-managed, unique `slug`.

## CSV format

Header row required. Column **order is flexible** (matched by header name).
Header matching is case-insensitive and trims whitespace.

**Required columns:** `name`, `line`, `category`, `price`, `color`, `size`
**Optional column:** `description`

```csv
name,line,category,price,color,size,description
CORVE Move Legging,MOVE,leggings,499.00,Negro,M,Tejido compresivo
CORVE Move Legging,MOVE,leggings,499.00,Negro,L,Tejido compresivo
CORVE Move Legging,MOVE,leggings,499.00,Azul,M,Tejido compresivo
```

The three rows above produce **1 product, 3 variants** (Negro/M, Negro/L, Azul/M).

### Field rules & defaults

| Field | Rule | Default |
|---|---|---|
| `name` | Required, non-blank. Also the **product grouping key**. | — |
| `line` | Matched against `product_lines.slug` (case-insensitive), then `name` as fallback. Unknown → row error. | — |
| `category` | Matched against `product_categories.slug` (case-insensitive), then `name` as fallback. Unknown → row error. | — |
| `price` | Pesos string, parsed by existing `parsePesosInput` → centavos. Invalid → row error. | — |
| `color` | Required, non-blank. | — |
| `size` | Required, non-blank. | — |
| `description` | Optional free text (may contain commas; must be RFC-4180 quoted). | `""` |
| `color_hex` | Not a CSV column. | `#000000` |
| `sku` | Not a CSV column. | `null` |
| `stock` | Not a CSV column. | `0` |
| `status` | Not a CSV column. | `draft` |

## Architecture & components

All parsing/validation is **pure and DB-free** (fully unit-testable). The server
actions are the only place that touches Supabase, and the only **write** path is
the single atomic RPC.

| Piece | Path | Responsibility |
|---|---|---|
| CSV parser (new, pure) | `src/lib/admin/product-csv.ts` | RFC-4180 parse text → rows; group rows into products by name; structural validation. No DB. |
| Import validator (new, pure) | `src/lib/admin/product-csv.ts` (same module) | Given parsed groups + lookup maps (line slug→id, category slug→id, existing product names), produce a typed `ImportPlan` + row errors. No DB. |
| Import repo fn (new) | `src/lib/repos/products.ts` | `importProducts(plan)` → calls the `import_products` RPC. |
| Migration (new) | `supabase/migrations/0012_import_products.sql` | `import_products(jsonb)` security-definer RPC: inserts products + variants in one transaction. |
| Server actions (new) | `src/app/admin/products/import/actions.ts` | `previewImport` (parse+validate, return summary) and `commitImport` (re-parse+re-validate, call repo). Fetches the lookup maps. |
| Import page (new) | `src/app/admin/products/import/page.tsx` | Server component shell. |
| Import UI (new, client) | `src/app/admin/products/import/ImportClient.tsx` | File picker → preview summary/errors → Confirm. Holds the `File` across steps via `useActionState`. |
| Entry point (edit) | `src/app/admin/products/page.tsx` | "Importar CSV" button linking to `/admin/products/import`. |

## Data flow

### Preview
1. Admin uploads a file on `/admin/products/import`.
2. `previewImport` reads the file text, calls the pure parser → product groups +
   structural errors.
3. The action fetches lookup maps (lines, categories, existing product names) and
   runs the pure validator → `ImportPlan` + row errors.
4. Returns a summary — "N products / M variants will be created" — plus the
   per-row error list. **Nothing is written.**

### Commit
5. Admin clicks **Confirm**; the same `File` is re-submitted (held client-side via
   `useActionState`).
6. `commitImport` re-runs steps 2–3 on the trusted server. If clean, it calls
   `importProducts(plan)` → the `import_products` RPC inserts everything in one
   transaction.
7. On success: flash "N productos importados", `revalidatePath('/admin/products')`
   and `'/'`, redirect to the product list.

### State between steps (Approach A)
The client keeps the uploaded `File` in the form between preview and commit; the
server re-parses and re-validates it on commit. No intermediate persistence, no
tokens, no new dependency. The file is parsed twice — trivial at catalog scale.

## Error handling

The pure validator returns a structured result; it never throws for **data**
problems.

```ts
type RowError = { row: number; field?: string; message: string };

type ImportPlan = {
  products: {
    name: string;
    line_id: string;
    category_id: string;
    price: number;      // centavos
    description: string;
    status: "draft";
    variants: { color: string; color_hex: string; size: string;
                sku: string | null; stock: number }[];
  }[];
};

type ValidateResult =
  | { ok: true;  plan: ImportPlan; counts: { products: number; variants: number } }
  | { ok: false; plan: ImportPlan; counts: { products: number; variants: number };
      errors: RowError[] };
```

Row numbers are **1-based and match the file** (header = row 1, first data row =
row 2), so the admin can find them in their spreadsheet.

**Error categories**
- **Structural:** missing required column, unparseable/empty file, ragged row
  (wrong column count).
- **Field:** blank required value, invalid `price`, unknown `line`/`category` slug.
- **Cross-row:** conflicting product-level fields (line/category/price/description)
  for the same product name; duplicate `(name, color, size)` within the file.
- **Catalog conflict:** product `name` already exists → create-only rejection.

**Guarantees**
- Preview shows **every** error at once (not fail-fast) so the admin fixes the
  whole file in one pass.
- The **Confirm button is disabled while any error exists** — commit is only
  possible on a fully clean file. A partial import is therefore impossible.
- **Infrastructure errors** (RPC/network) on commit surface as a flash error via
  the existing `withFlash` pattern; the transaction guarantees all-or-nothing, so
  a failed commit writes nothing.

## Testing

Vitest, matching the repo's existing test style. The pure functions need no mocks.

- **Parser unit tests:** quoted fields with embedded commas, CRLF vs LF, trailing
  newline, ragged rows, header-only file, BOM handling, flexible column order.
- **Validator unit tests:** happy-path rollup (3 rows → 1 product / 3 variants);
  each error category above; slug case-insensitivity; name-fallback matching;
  pesos→centavos conversion; defaults applied (status/color_hex/sku/stock).
- **RPC test (optional, if a DB-integration harness exists):** atomicity — a
  mid-batch failure rolls back the entire import.

## Open questions

None.
