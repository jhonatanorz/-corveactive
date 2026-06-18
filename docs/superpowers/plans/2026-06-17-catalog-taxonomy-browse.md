# Catalog Taxonomy & Browse UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded line enum + free-text product type with admin-managed `product_lines` and `product_categories` tables, and add a storefront browse experience (side menu, search, category + color filters, per-line pages).

**Architecture:** Lines and categories become DB tables with admin CRUD; products reference them by FK. The storefront loads active products once per page and filters them client-side (URL-synced) via pure domain helpers. A shared `CatalogBrowser` client component drives the side menu, filter bar, and product grid on both the home page and per-line pages.

**Tech Stack:** Next.js 16 (App Router, RSC + server actions), React 19, Supabase (Postgres + RLS), TypeScript, Tailwind v4, Vitest.

## Global Constraints

- **Language:** All user-facing copy in Spanish (e.g. "Categoría", "Línea", "Buscar…", "Limpiar", "Sin resultados.").
- **Money:** prices are integer centavos; never use floats. Format with `formatMXN`.
- **Server-only repos:** every file in `src/lib/repos/` starts with `import "server-only";` and gets its client from `@/lib/supabase/server`.
- **Naming:** the new category axis is `category` / `categoría` everywhere (table `product_categories`, column `category_id`, route `/categoria` is NOT used — categories filter in place). The line axis stays `line` / `línea`.
- **Migrations:** one new file `supabase/migrations/0010_catalog_taxonomy.sql`; never edit existing migrations. Local apply via `npx supabase db reset` (Docker must be running).
- **Slugs:** generated with the shared `slugify` helper; lowercase, accent-stripped, hyphenated.
- **Tests:** pure logic only, Vitest, colocated `*.test.ts`. Run with `npm test`.
- **Verification:** `npm run build` type-checks + lints the whole app; treat any error as a failure.

---

### Task 1: `slugify` domain helper

**Files:**
- Create: `src/domain/slugify.ts`
- Test: `src/domain/slugify.test.ts`

**Interfaces:**
- Produces: `slugify(input: string): string`

- [ ] **Step 1: Write the failing test**

```ts
// src/domain/slugify.test.ts
import { describe, it, expect } from "vitest";
import { slugify } from "@/domain/slugify";

describe("slugify", () => {
  it("lowercases and hyphenates words", () => {
    expect(slugify("Faldas Cortas")).toBe("faldas-cortas");
  });
  it("strips accents", () => {
    expect(slugify("Niños y Café")).toBe("ninos-y-cafe");
  });
  it("trims surrounding whitespace and hyphens", () => {
    expect(slugify("  Tank-Top  ")).toBe("tank-top");
    expect(slugify("//Shorts//")).toBe("shorts");
  });
  it("collapses runs of non-alphanumerics into a single hyphen", () => {
    expect(slugify("a   b__c")).toBe("a-b-c");
  });
  it("returns empty string for empty / symbol-only input", () => {
    expect(slugify("   ")).toBe("");
    expect(slugify("///")).toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- slugify`
Expected: FAIL — cannot find module `@/domain/slugify`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/domain/slugify.ts
/** Lowercase, accent-stripped, hyphenated slug. Empty string if nothing usable remains. */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- slugify`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/slugify.ts src/domain/slugify.test.ts
git commit -m "feat: slugify helper"
```

---

### Task 2: `catalog-colors` domain helper

**Files:**
- Create: `src/domain/catalog-colors.ts`
- Test: `src/domain/catalog-colors.test.ts`

**Interfaces:**
- Produces:
  - `normalizeColorKey(color: string): string`
  - `interface ColorSwatch { key: string; label: string; hex: string }`
  - `aggregateColors(variants: { color: string; color_hex: string }[]): ColorSwatch[]`

- [ ] **Step 1: Write the failing test**

```ts
// src/domain/catalog-colors.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- catalog-colors`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/domain/catalog-colors.ts
export interface ColorSwatch {
  key: string;   // normalized grouping key
  label: string; // first-seen display label
  hex: string;   // first-seen hex
}

/** Normalize a free-text color into a grouping key: trimmed, lowercased, accent-stripped. */
export function normalizeColorKey(color: string): string {
  return color
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

/** Distinct color swatches across variants, in first-seen order. */
export function aggregateColors(variants: { color: string; color_hex: string }[]): ColorSwatch[] {
  const seen = new Set<string>();
  const out: ColorSwatch[] = [];
  for (const v of variants) {
    const key = normalizeColorKey(v.color);
    if (key === "" || seen.has(key)) continue;
    seen.add(key);
    out.push({ key, label: v.color, hex: v.color_hex });
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- catalog-colors`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/catalog-colors.ts src/domain/catalog-colors.test.ts
git commit -m "feat: catalog color aggregation helper"
```

---

### Task 3: `catalog-filter` domain helper

**Files:**
- Create: `src/domain/catalog-filter.ts`
- Test: `src/domain/catalog-filter.test.ts`

**Interfaces:**
- Consumes: `normalizeColorKey` from `@/domain/catalog-colors`.
- Produces:
  - `interface FilterableItem { name: string; categorySlug: string; categoryName: string; colors: { color: string }[] }`
  - `interface CatalogFilters { query: string; categorySlugs: string[]; colorKeys: string[] }`
  - `matchesFilters(item: FilterableItem, f: CatalogFilters): boolean`

- [ ] **Step 1: Write the failing test**

```ts
// src/domain/catalog-filter.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- catalog-filter`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/domain/catalog-filter.ts
import { normalizeColorKey } from "@/domain/catalog-colors";

export interface FilterableItem {
  name: string;
  categorySlug: string;
  categoryName: string;
  colors: { color: string }[];
}

export interface CatalogFilters {
  query: string;
  categorySlugs: string[];
  colorKeys: string[];
}

/** True when an item satisfies every active facet. Empty facet = no constraint. */
export function matchesFilters(item: FilterableItem, f: CatalogFilters): boolean {
  const q = normalizeColorKey(f.query); // reuse: trim + lowercase + accent-strip
  if (q !== "") {
    const hay = normalizeColorKey(`${item.name} ${item.categoryName}`);
    if (!hay.includes(q)) return false;
  }
  if (f.categorySlugs.length > 0 && !f.categorySlugs.includes(item.categorySlug)) return false;
  if (f.colorKeys.length > 0) {
    const keys = new Set(item.colors.map((c) => normalizeColorKey(c.color)));
    if (!f.colorKeys.some((k) => keys.has(k))) return false;
  }
  return true;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- catalog-filter`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/catalog-filter.ts src/domain/catalog-filter.test.ts
git commit -m "feat: catalog filter predicate"
```

---

### Task 4: Database migration `0010_catalog_taxonomy.sql`

**Files:**
- Create: `supabase/migrations/0010_catalog_taxonomy.sql`

**Interfaces:**
- Produces tables `product_lines`, `product_categories`; `products.line_id`, `products.category_id`; `order_items.line` as `text`; updated `place_order` RPC. Drops `products.line`, `products.type`, and the `product_line` enum.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0010_catalog_taxonomy.sql
-- Catalog taxonomy: lines + categories become admin-managed tables; products
-- reference them by FK. order_items.line becomes a text slug snapshot.

-- 1. New tables ------------------------------------------------------------
create table product_lines (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  name         text not null,
  hero_title   text not null default '',
  hero_message text not null default '',
  sort_order   integer not null default 0,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create table product_categories (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name       text not null,
  parent_id  uuid references product_categories(id) on delete set null, -- reserved (hierarchy), unused
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- 2. RLS + grants (mirror 0002/0003: anon reads, admin writes) -------------
alter table product_lines      enable row level security;
alter table product_categories enable row level security;

grant select, insert, update, delete on product_lines, product_categories to authenticated;
grant select on product_lines, product_categories to anon;

create policy admin_all   on product_lines      for all    to authenticated using (true) with check (true);
create policy admin_all   on product_categories for all    to authenticated using (true) with check (true);
create policy public_read on product_lines      for select to anon using (true);
create policy public_read on product_categories for select to anon using (true);

-- 3. Seed lines from the previously hardcoded copy --------------------------
insert into product_lines (slug, name, hero_title, hero_message, sort_order, active) values
  ('MOVE', 'CORVE MOVE', 'Muévete desde el amor',            'Confianza en cada movimiento', 0, true),
  ('HIM',  'CORVE HIM',  'Una rutina que respeta tu ritmo',  'Confianza en cada movimiento', 1, true);

-- 4. Seed categories from existing distinct product types -------------------
--    Same slug expression is used for backfill below, so accented names map
--    consistently on both sides even without the unaccent extension.
insert into product_categories (slug, name, sort_order)
select slug, min(name), 0
from (
  select btrim(regexp_replace(lower(type), '[^a-z0-9]+', '-', 'g'), '-') as slug, type as name
  from products
  where coalesce(btrim(type), '') <> ''
) s
group by slug
on conflict (slug) do nothing;

-- 5. Add FK columns (nullable for backfill) --------------------------------
alter table products add column line_id     uuid references product_lines(id);
alter table products add column category_id uuid references product_categories(id);

-- 6. Backfill --------------------------------------------------------------
update products p set line_id = l.id
  from product_lines l where l.slug = p.line::text;

update products p set category_id = c.id
  from product_categories c
  where c.slug = btrim(regexp_replace(lower(p.type), '[^a-z0-9]+', '-', 'g'), '-');

-- 7. Enforce + index -------------------------------------------------------
alter table products alter column line_id     set not null;
alter table products alter column category_id set not null;
create index on products (line_id);
create index on products (category_id);

-- 8. order_items.line: enum -> text snapshot (keeps historical reporting) ---
alter table order_items alter column line type text using line::text;

-- 9. place_order RPC: snapshot the line slug via line_id -------------------
create or replace function place_order(
  p_customer_name text,
  p_customer_whatsapp text,
  p_delivery_note text,
  p_items jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_item jsonb;
  v_qty int;
  v_variant variants%rowtype;
  v_product products%rowtype;
  v_total int := 0;
begin
  if p_customer_name is null or btrim(p_customer_name) = '' then
    raise exception 'name_required';
  end if;
  if p_customer_whatsapp is null or btrim(p_customer_whatsapp) = '' then
    raise exception 'whatsapp_required';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'empty_cart';
  end if;

  insert into orders (customer_name, customer_whatsapp, delivery_note, status, total)
  values (btrim(p_customer_name), btrim(p_customer_whatsapp), nullif(btrim(coalesce(p_delivery_note,'')), ''), 'nuevo', 0)
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'qty')::int;
    if v_qty is null or v_qty <= 0 then raise exception 'invalid_qty'; end if;

    select * into v_variant from variants where id = (v_item->>'variant_id')::uuid for update;
    if not found then raise exception 'variant_not_found'; end if;
    if v_variant.stock < v_qty then
      raise exception 'insufficient_stock:%', v_variant.id;
    end if;

    select * into v_product from products where id = v_variant.product_id;
    if v_product.status <> 'active' then raise exception 'product_unavailable'; end if;

    update variants set stock = stock - v_qty where id = v_variant.id;

    insert into order_items (order_id, variant_id, product_name, line, color, size, unit_price, cost, qty)
    values (v_order_id, v_variant.id, v_product.name,
            (select slug from product_lines where id = v_product.line_id),
            v_variant.color, v_variant.size, v_product.price, v_product.cost, v_qty);

    insert into stock_movements (variant_id, delta, type, reference)
    values (v_variant.id, -v_qty, 'pedido', '#' || left(v_order_id::text, 8));

    v_total := v_total + v_product.price * v_qty;
  end loop;

  update orders set total = v_total where id = v_order_id;
  return v_order_id;
end;
$$;

grant execute on function place_order(text, text, text, jsonb) to anon, authenticated;

-- 10. Drop the old columns + enum (now unreferenced) -----------------------
alter table products drop column line;
alter table products drop column type;
drop type product_line;
```

- [ ] **Step 2: Apply the migration locally**

Run: `npx supabase db reset`
Expected: completes without error; output lists `0010_catalog_taxonomy.sql` applied. (Docker must be running — see the local-dev memory.)

- [ ] **Step 3: Sanity-check the schema**

Run: `npx supabase db reset` already reseeds; confirm no error. Optionally verify columns:
Run: `npx supabase db diff --schema public` → Expected: no unexpected diff (migration is the source of truth).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0010_catalog_taxonomy.sql
git commit -m "feat(db): line + category taxonomy tables, slug snapshot, place_order update"
```

---

### Task 5: Domain types + db-types + sales line type

**Files:**
- Modify: `src/domain/types.ts` (remove `Line`)
- Modify: `src/lib/db-types.ts` (ProductRow FKs + new row types)
- Modify: `src/domain/sales.ts` (`Line` → `string`)

**Interfaces:**
- Produces:
  - `ProductRow` with `line_id: string; category_id: string` (no `line`/`type`).
  - `interface ProductLineRow { id; slug; name; hero_title; hero_message; sort_order; active; created_at }`
  - `interface ProductCategoryRow { id; slug; name; parent_id; sort_order; created_at }`
  - `SaleItem.line: string`, `SalesFilter.line?: string`.

- [ ] **Step 1: Remove the `Line` union**

In `src/domain/types.ts`, delete line 1 (`export type Line = "MOVE" | "HIM";`). Leave the rest of the file unchanged.

- [ ] **Step 2: Update `db-types.ts`**

Replace the top import and `ProductRow`, and add two row types:

```ts
// src/lib/db-types.ts  (top of file)
import type { ProductStatus, MovementType } from "@/domain/types";

export interface ProductRow {
  id: string;
  name: string;
  line_id: string;
  category_id: string;
  description: string;
  price: number; // centavos
  status: ProductStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ProductLineRow {
  id: string;
  slug: string;
  name: string;
  hero_title: string;
  hero_message: string;
  sort_order: number;
  active: boolean;
  created_at: string;
}

export interface ProductCategoryRow {
  id: string;
  slug: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
  created_at: string;
}
```

(Leave `VariantRow`, `ProductImageRow`, etc. unchanged.)

- [ ] **Step 3: Update `sales.ts`**

```ts
// src/domain/sales.ts  (lines 1-2 and the two `line` fields)
import type { Centavos } from "@/domain/money";
import { type OrderStatus, SALE_STATUSES } from "@/domain/types";
```

Change `SaleItem.line` from `Line` to `string` (line 5) and `SalesFilter.line?` from `Line` to `string` (line 18). The rest of the file is unchanged.

- [ ] **Step 4: Verify sales tests still pass**

Run: `npm test -- sales`
Expected: PASS (existing sales tests unaffected — slugs `"MOVE"`/`"HIM"` are still strings).

- [ ] **Step 5: Commit**

```bash
git add src/domain/types.ts src/lib/db-types.ts src/domain/sales.ts
git commit -m "refactor: products reference line_id/category_id; line snapshot is text"
```

---

### Task 6: Line + category repos and input validators

**Files:**
- Create: `src/lib/admin/line-input.ts`
- Create: `src/lib/admin/category-input.ts`
- Create: `src/lib/repos/lines.ts`
- Create: `src/lib/repos/categories.ts`

**Interfaces:**
- Consumes: `slugify`, `ProductLineRow`, `ProductCategoryRow`.
- Produces:
  - `interface LinePayload { slug; name; hero_title; hero_message; sort_order: number; active: boolean }` + `validateLineInput(raw): { ok:true; value:LinePayload } | { ok:false; errors }`
  - `interface CategoryPayload { slug; name; sort_order: number }` + `validateCategoryInput(raw): { ok:true; value:CategoryPayload } | { ok:false; errors }`
  - lines repo: `listLines()`, `listActiveLines()`, `getLine(id)`, `getActiveLineBySlug(slug)`, `createLine(payload)`, `updateLine(id, payload)`
  - categories repo: `listCategories()`, `getCategory(id)`, `createCategory(payload)`, `updateCategory(id, payload)`

- [ ] **Step 1: Write `line-input.ts`**

```ts
// src/lib/admin/line-input.ts
import { slugify } from "@/domain/slugify";

export interface LinePayload {
  slug: string;
  name: string;
  hero_title: string;
  hero_message: string;
  sort_order: number;
  active: boolean;
}

export type LineValidation =
  | { ok: true; value: LinePayload }
  | { ok: false; errors: Record<string, string> };

export function validateLineInput(raw: Record<string, string>): LineValidation {
  const errors: Record<string, string> = {};
  const name = (raw.name ?? "").trim();
  if (name === "") errors.name = "El nombre es obligatorio";

  const slug = slugify((raw.slug ?? "").trim() || name);
  if (slug === "") errors.slug = "El slug es obligatorio";

  const sort_order = Number.parseInt(raw.sort_order ?? "0", 10);
  if (Number.isNaN(sort_order)) errors.sort_order = "Orden inválido";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      slug,
      name,
      hero_title: (raw.hero_title ?? "").trim(),
      hero_message: (raw.hero_message ?? "").trim(),
      sort_order,
      active: raw.active === "on" || raw.active === "true",
    },
  };
}
```

- [ ] **Step 2: Write `category-input.ts`**

```ts
// src/lib/admin/category-input.ts
import { slugify } from "@/domain/slugify";

export interface CategoryPayload {
  slug: string;
  name: string;
  sort_order: number;
}

export type CategoryValidation =
  | { ok: true; value: CategoryPayload }
  | { ok: false; errors: Record<string, string> };

export function validateCategoryInput(raw: Record<string, string>): CategoryValidation {
  const errors: Record<string, string> = {};
  const name = (raw.name ?? "").trim();
  if (name === "") errors.name = "El nombre es obligatorio";

  const slug = slugify((raw.slug ?? "").trim() || name);
  if (slug === "") errors.slug = "El slug es obligatorio";

  const sort_order = Number.parseInt(raw.sort_order ?? "0", 10);
  if (Number.isNaN(sort_order)) errors.sort_order = "Orden inválido";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { slug, name, sort_order } };
}
```

- [ ] **Step 3: Write `lines.ts` repo**

```ts
// src/lib/repos/lines.ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ProductLineRow } from "@/lib/db-types";
import type { LinePayload } from "@/lib/admin/line-input";

export async function listLines(): Promise<ProductLineRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("product_lines").select("*").order("sort_order");
  if (error) throw error;
  return data as ProductLineRow[];
}

export async function listActiveLines(): Promise<ProductLineRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_lines").select("*").eq("active", true).order("sort_order");
  if (error) throw error;
  return data as ProductLineRow[];
}

export async function getLine(id: string): Promise<ProductLineRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("product_lines").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as ProductLineRow) ?? null;
}

export async function getActiveLineBySlug(slug: string): Promise<ProductLineRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_lines").select("*").eq("slug", slug).eq("active", true).maybeSingle();
  if (error) throw error;
  return (data as ProductLineRow) ?? null;
}

export async function createLine(payload: LinePayload): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("product_lines").insert(payload).select("id").single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function updateLine(id: string, payload: LinePayload): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("product_lines").update(payload).eq("id", id);
  if (error) throw error;
}
```

- [ ] **Step 4: Write `categories.ts` repo**

```ts
// src/lib/repos/categories.ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ProductCategoryRow } from "@/lib/db-types";
import type { CategoryPayload } from "@/lib/admin/category-input";

export async function listCategories(): Promise<ProductCategoryRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_categories").select("*").order("sort_order").order("name");
  if (error) throw error;
  return data as ProductCategoryRow[];
}

export async function getCategory(id: string): Promise<ProductCategoryRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("product_categories").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as ProductCategoryRow) ?? null;
}

export async function createCategory(payload: CategoryPayload): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("product_categories").insert(payload).select("id").single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function updateCategory(id: string, payload: CategoryPayload): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("product_categories").update(payload).eq("id", id);
  if (error) throw error;
}
```

- [ ] **Step 5: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors from these four files. (Other files still referencing the old product shape are fixed in later tasks — if pre-existing errors appear there, they are addressed in Tasks 7–13; this step only needs the four new files to be individually well-typed. If `tsc` reports errors solely in `catalog.ts`/`product-input.ts`/`page.tsx`/`ventas`, proceed.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/admin/line-input.ts src/lib/admin/category-input.ts src/lib/repos/lines.ts src/lib/repos/categories.ts
git commit -m "feat: line + category repos and validators"
```

---

### Task 7: Admin — Categorías CRUD

**Files:**
- Create: `src/app/admin/categories/page.tsx`
- Create: `src/app/admin/categories/[id]/page.tsx`
- Create: `src/app/admin/categories/[id]/actions.ts`
- Create: `src/app/admin/categories/CategoryForm.tsx`

**Interfaces:**
- Consumes: `listCategories`, `getCategory`, `createCategory`, `updateCategory`, `validateCategoryInput`, `setFlash`, `withFlash`.

- [ ] **Step 1: Write the list page**

```tsx
// src/app/admin/categories/page.tsx
import Link from "next/link";
import { listCategories } from "@/lib/repos/categories";
import { buttonClass, PageHeader, Table, THead, Th, Td, Tr, LinkRow, ChevronCell } from "@/components/ui";

export default async function CategoriesPage() {
  const categories = await listCategories();
  return (
    <div className="p-6">
      <PageHeader title="Categorías">
        <Link href="/admin/categories/new" className={buttonClass("primary", "sm")}>+ Nueva categoría</Link>
      </PageHeader>
      <Table>
        <THead>
          <Th>Nombre</Th>
          <Th>Slug</Th>
          <Th>Orden</Th>
          <Th className="w-8" />
        </THead>
        <tbody>
          {categories.map((c) => (
            <LinkRow key={c.id} href={`/admin/categories/${c.id}`}>
              <Td className="font-medium">{c.name}</Td>
              <Td className="text-ink-2">{c.slug}</Td>
              <Td className="text-ink-2">{c.sort_order}</Td>
              <ChevronCell />
            </LinkRow>
          ))}
          {categories.length === 0 && (
            <Tr><Td colSpan={4} className="py-8 text-center text-ink-3">Aún no hay categorías.</Td></Tr>
          )}
        </tbody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 2: Write the form (client)**

```tsx
// src/app/admin/categories/CategoryForm.tsx
"use client";

import { useActionState } from "react";
import type { ProductCategoryRow } from "@/lib/db-types";
import { Button, inputClass } from "@/components/ui";

type Props = {
  category: Pick<ProductCategoryRow, "name" | "slug" | "sort_order"> | null;
  action: (prev: unknown, formData: FormData) => Promise<{ errors: Record<string, string> } | void>;
};

export default function CategoryForm({ category, action }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const e = state?.errors ?? {};
  return (
    <form action={formAction} className="max-w-md space-y-4 text-sm">
      <h1 className="text-lg font-bold text-ink">{category ? "Editar categoría" : "Nueva categoría"}</h1>

      <label className="block text-ink-2">Nombre
        <input name="name" defaultValue={category?.name ?? ""} className={inputClass} />
        {e.name && <span className="text-xs text-red-600">{e.name}</span>}
      </label>

      <label className="block text-ink-2">Slug (opcional, se genera del nombre)
        <input name="slug" defaultValue={category?.slug ?? ""} className={inputClass} placeholder="leggings" />
        {e.slug && <span className="text-xs text-red-600">{e.slug}</span>}
      </label>

      <label className="block text-ink-2">Orden
        <input name="sort_order" type="number" defaultValue={category?.sort_order ?? 0} className={inputClass} />
        {e.sort_order && <span className="text-xs text-red-600">{e.sort_order}</span>}
      </label>

      <Button type="submit" disabled={pending} variant="primary" size="md">
        {pending ? "Guardando…" : "Guardar"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 3: Write the actions**

```ts
// src/app/admin/categories/[id]/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { validateCategoryInput } from "@/lib/admin/category-input";
import { createCategory, updateCategory } from "@/lib/repos/categories";
import { setFlash, withFlash } from "@/lib/flash";

export async function saveCategory(
  id: string,
  _prev: unknown,
  formData: FormData,
): Promise<{ errors: Record<string, string> } | void> {
  const raw = Object.fromEntries(
    ["name", "slug", "sort_order"].map((k) => [k, String(formData.get(k) ?? "")]),
  );
  const result = validateCategoryInput(raw);
  if (!result.ok) return { errors: result.errors };

  if (id === "new") {
    await createCategory(result.value);
    await setFlash("Categoría creada");
    redirect("/admin/categories");
  } else {
    await withFlash("Categoría guardada", () => updateCategory(id, result.value));
    revalidatePath("/admin/categories");
    redirect("/admin/categories");
  }
}
```

- [ ] **Step 4: Write the editor page**

```tsx
// src/app/admin/categories/[id]/page.tsx
import { notFound } from "next/navigation";
import { getCategory } from "@/lib/repos/categories";
import { saveCategory } from "./actions";
import CategoryForm from "../CategoryForm";

export default async function CategoryEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = id === "new" ? null : await getCategory(id);
  if (id !== "new" && !existing) notFound();
  return (
    <div className="p-6">
      <CategoryForm category={existing} action={saveCategory.bind(null, id)} />
    </div>
  );
}
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: compiles (the new admin route builds). Pre-existing errors in not-yet-migrated files (catalog/home) may still appear — they are fixed in later tasks. If the only errors are in `src/app/(shop)/page.tsx`, `src/lib/repos/catalog.ts`, `src/lib/admin/product-input.ts`, or `src/app/admin/ventas/page.tsx`, proceed; otherwise fix here.

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/categories
git commit -m "feat(admin): categorias CRUD"
```

---

### Task 8: Admin — Líneas CRUD

**Files:**
- Create: `src/app/admin/lines/page.tsx`
- Create: `src/app/admin/lines/[id]/page.tsx`
- Create: `src/app/admin/lines/[id]/actions.ts`
- Create: `src/app/admin/lines/LineForm.tsx`

**Interfaces:**
- Consumes: `listLines`, `getLine`, `createLine`, `updateLine`, `validateLineInput`, `setFlash`, `withFlash`, `Pill`.

- [ ] **Step 1: Write the list page**

```tsx
// src/app/admin/lines/page.tsx
import Link from "next/link";
import { listLines } from "@/lib/repos/lines";
import { buttonClass, PageHeader, Table, THead, Th, Td, Tr, LinkRow, ChevronCell, Pill } from "@/components/ui";

export default async function LinesPage() {
  const lines = await listLines();
  return (
    <div className="p-6">
      <PageHeader title="Líneas">
        <Link href="/admin/lines/new" className={buttonClass("primary", "sm")}>+ Nueva línea</Link>
      </PageHeader>
      <Table>
        <THead>
          <Th>Nombre</Th>
          <Th>Slug</Th>
          <Th>Orden</Th>
          <Th>Estado</Th>
          <Th className="w-8" />
        </THead>
        <tbody>
          {lines.map((l) => (
            <LinkRow key={l.id} href={`/admin/lines/${l.id}`}>
              <Td className="font-medium">{l.name}</Td>
              <Td className="text-ink-2">{l.slug}</Td>
              <Td className="text-ink-2">{l.sort_order}</Td>
              <Td><Pill tone={l.active ? "success" : "muted"}>{l.active ? "Activa" : "Oculta"}</Pill></Td>
              <ChevronCell />
            </LinkRow>
          ))}
          {lines.length === 0 && (
            <Tr><Td colSpan={5} className="py-8 text-center text-ink-3">Aún no hay líneas.</Td></Tr>
          )}
        </tbody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 2: Write the form (client)**

```tsx
// src/app/admin/lines/LineForm.tsx
"use client";

import { useActionState } from "react";
import type { ProductLineRow } from "@/lib/db-types";
import { Button, inputClass } from "@/components/ui";

type Props = {
  line: Pick<ProductLineRow, "name" | "slug" | "hero_title" | "hero_message" | "sort_order" | "active"> | null;
  action: (prev: unknown, formData: FormData) => Promise<{ errors: Record<string, string> } | void>;
};

export default function LineForm({ line, action }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const e = state?.errors ?? {};
  return (
    <form action={formAction} className="max-w-md space-y-4 text-sm">
      <h1 className="text-lg font-bold text-ink">{line ? "Editar línea" : "Nueva línea"}</h1>

      <label className="block text-ink-2">Nombre
        <input name="name" defaultValue={line?.name ?? ""} className={inputClass} placeholder="CORVE FLOW" />
        {e.name && <span className="text-xs text-red-600">{e.name}</span>}
      </label>

      <label className="block text-ink-2">Slug (opcional, se genera del nombre)
        <input name="slug" defaultValue={line?.slug ?? ""} className={inputClass} placeholder="flow" />
        {e.slug && <span className="text-xs text-red-600">{e.slug}</span>}
      </label>

      <label className="block text-ink-2">Título del hero
        <input name="hero_title" defaultValue={line?.hero_title ?? ""} className={inputClass} />
      </label>

      <label className="block text-ink-2">Mensaje del hero
        <input name="hero_message" defaultValue={line?.hero_message ?? ""} className={inputClass} />
      </label>

      <label className="block text-ink-2">Orden
        <input name="sort_order" type="number" defaultValue={line?.sort_order ?? 0} className={inputClass} />
        {e.sort_order && <span className="text-xs text-red-600">{e.sort_order}</span>}
      </label>

      <label className="flex items-center gap-2 text-ink-2">
        <input name="active" type="checkbox" defaultChecked={line?.active ?? true} />
        Activa (visible en la tienda)
      </label>

      <Button type="submit" disabled={pending} variant="primary" size="md">
        {pending ? "Guardando…" : "Guardar"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 3: Write the actions**

```ts
// src/app/admin/lines/[id]/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { validateLineInput } from "@/lib/admin/line-input";
import { createLine, updateLine } from "@/lib/repos/lines";
import { setFlash, withFlash } from "@/lib/flash";

export async function saveLine(
  id: string,
  _prev: unknown,
  formData: FormData,
): Promise<{ errors: Record<string, string> } | void> {
  const raw = Object.fromEntries(
    ["name", "slug", "hero_title", "hero_message", "sort_order", "active"].map((k) => [
      k, String(formData.get(k) ?? ""),
    ]),
  );
  const result = validateLineInput(raw);
  if (!result.ok) return { errors: result.errors };

  if (id === "new") {
    await createLine(result.value);
    await setFlash("Línea creada");
    redirect("/admin/lines");
  } else {
    await withFlash("Línea guardada", () => updateLine(id, result.value));
    revalidatePath("/admin/lines");
    revalidatePath("/");
    redirect("/admin/lines");
  }
}
```

- [ ] **Step 4: Write the editor page**

```tsx
// src/app/admin/lines/[id]/page.tsx
import { notFound } from "next/navigation";
import { getLine } from "@/lib/repos/lines";
import { saveLine } from "./actions";
import LineForm from "../LineForm";

export default async function LineEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = id === "new" ? null : await getLine(id);
  if (id !== "new" && !existing) notFound();
  return (
    <div className="p-6">
      <LineForm line={existing} action={saveLine.bind(null, id)} />
    </div>
  );
}
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: the new `/admin/lines` route builds. Same caveat as Task 7 Step 5 about not-yet-migrated files.

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/lines
git commit -m "feat(admin): lineas CRUD"
```

---

### Task 9: AdminNav links + dynamic Ventas line filter

**Files:**
- Modify: `src/app/admin/AdminNav.tsx` (add two links + icons)
- Modify: `src/app/admin/ventas/page.tsx` (dynamic line buttons; drop `Line` import)

**Interfaces:**
- Consumes: `listLines` (lines repo).

- [ ] **Step 1: Add icons + links to AdminNav**

In `src/app/admin/AdminNav.tsx`, add two icons to the `I` object (after `users`):

```tsx
  layers: (
    <><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></>
  ),
  grid: (
    <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>
  ),
```

Then add two entries to `LINKS` (after the `products` entry):

```tsx
  { href: "/admin/lines", label: "Líneas", icon: I.layers },
  { href: "/admin/categories", label: "Categorías", icon: I.grid },
```

- [ ] **Step 2: Make Ventas line buttons dynamic**

Replace `src/app/admin/ventas/page.tsx` lines 1–14 region so it loads lines and drops the `Line` type. New top of file:

```tsx
import Link from "next/link";
import { getSalesSummary } from "@/lib/repos/sales";
import { listLines } from "@/lib/repos/lines";
import { formatMXN } from "@/domain/money";
import { Button, KpiCard, PageHeader, buttonClass } from "@/components/ui";

const dateInput = "block rounded-sm border border-line bg-white p-2 text-sm text-ink";

export default async function VentasPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; line?: string }> }) {
  const sp = await searchParams;
  const filter = { from: sp.from, to: sp.to, line: sp.line || undefined };
  const [summary, lines] = await Promise.all([getSalesSummary(filter), listLines()]);

  const link = (q: Record<string, string>) => "/admin/ventas?" + new URLSearchParams(q).toString();
```

Then replace the hardcoded MOVE/HIM links (the two `<Link href={link({ line: "MOVE" })}…>` / `"HIM"` lines) with a dynamic map:

```tsx
          <Link href="/admin/ventas" className={`${buttonClass("primary", "sm")} ${!sp.line ? "" : "opacity-50"} rounded-pill`}>Todo</Link>
          {lines.map((l) => (
            <Link key={l.slug} href={link({ line: l.slug })}
              className={`${buttonClass("primary", "sm")} ${sp.line === l.slug ? "" : "opacity-50"} rounded-pill`}>
              {l.slug}
            </Link>
          ))}
```

(The rest of the file — date form, KPI cards — is unchanged.)

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: AdminNav + ventas compile. Same caveat for the remaining shop/product files (fixed next).

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/AdminNav.tsx src/app/admin/ventas/page.tsx
git commit -m "feat(admin): nav links for lineas/categorias; dynamic ventas line filter"
```

---

### Task 10: Product form, validation, actions, and products repo → FKs

**Files:**
- Modify: `src/lib/admin/product-input.ts`
- Modify: `src/lib/repos/products.ts` (`listProducts` joins line slug)
- Modify: `src/app/admin/products/[id]/actions.ts` (raw keys)
- Modify: `src/app/admin/products/[id]/ProductForm.tsx` (dynamic dropdowns)
- Modify: `src/app/admin/products/[id]/page.tsx` (load lines + categories, pass to form)
- Modify: `src/app/admin/products/page.tsx` (show line slug)

**Interfaces:**
- Produces: `ProductPayload { name; line_id; category_id; description; price; status }`; `listProducts()` → `ProductListRow[]` where `ProductListRow = ProductRow & { lineSlug: string }`.
- Consumes: `listActiveLines`, `listCategories`.

- [ ] **Step 1: Rewrite `product-input.ts`**

```ts
// src/lib/admin/product-input.ts
import { parsePesosInput, type Centavos } from "@/domain/money";
import type { ProductStatus } from "@/domain/types";

const STATUSES: ProductStatus[] = ["draft", "active", "hidden"];

export interface ProductPayload {
  name: string;
  line_id: string;
  category_id: string;
  description: string;
  price: Centavos;
  status: ProductStatus;
}

export type ValidationResult =
  | { ok: true; value: ProductPayload }
  | { ok: false; errors: Record<string, string> };

/** Validate + normalize raw product form fields. Money fields are pesos strings.
 *  line_id / category_id are required UUIDs from the form dropdowns (FK enforces validity). */
export function validateProductInput(raw: Record<string, string>): ValidationResult {
  const errors: Record<string, string> = {};

  const name = (raw.name ?? "").trim();
  if (name === "") errors.name = "El nombre es obligatorio";

  const line_id = (raw.line_id ?? "").trim();
  if (line_id === "") errors.line_id = "La línea es obligatoria";

  const category_id = (raw.category_id ?? "").trim();
  if (category_id === "") errors.category_id = "La categoría es obligatoria";

  const status = raw.status as ProductStatus;
  if (!STATUSES.includes(status)) errors.status = "Estado inválido";

  const price = parsePesosInput(raw.price ?? "");
  if (price === null) errors.price = "Precio inválido";

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      name,
      line_id,
      category_id,
      description: (raw.description ?? "").trim(),
      price: price as Centavos,
      status,
    },
  };
}
```

- [ ] **Step 2: Update `listProducts` to join the line slug**

In `src/lib/repos/products.ts`, replace the `listProducts` function (lines 13–22) and add a row type above it:

```ts
export interface ProductListRow extends ProductRow {
  lineSlug: string;
}

export async function listProducts(): Promise<ProductListRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*, product_lines(slug)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  type Raw = ProductRow & { product_lines: { slug: string } | { slug: string }[] | null };
  return (data as Raw[]).map((r) => {
    const l = Array.isArray(r.product_lines) ? r.product_lines[0] : r.product_lines;
    return { ...r, lineSlug: l?.slug ?? "" };
  });
}
```

- [ ] **Step 3: Update product actions raw keys**

In `src/app/admin/products/[id]/actions.ts`, change the `saveProduct` raw extraction (lines 14–18) array from `["name", "line", "type", "description", "price", "status"]` to:

```ts
    ["name", "line_id", "category_id", "description", "price", "status"].map((k) => [
      k, String(formData.get(k) ?? ""),
    ]),
```

(The rest of `actions.ts` is unchanged.)

- [ ] **Step 4: Rewrite `ProductForm.tsx` with dynamic dropdowns**

```tsx
// src/app/admin/products/[id]/ProductForm.tsx
"use client";

import { useActionState } from "react";
import type { ProductRow, ProductLineRow, ProductCategoryRow } from "@/lib/db-types";
import { Button, inputClass } from "@/components/ui";

type Props = {
  product: Pick<ProductRow, "name" | "line_id" | "category_id" | "description" | "price" | "status"> | null;
  lines: Pick<ProductLineRow, "id" | "name">[];
  categories: Pick<ProductCategoryRow, "id" | "name">[];
  action: (prev: unknown, formData: FormData) => Promise<{ errors: Record<string, string> } | void>;
};

const peso = (centavos: number) => (centavos / 100).toString();

export default function ProductForm({ product, lines, categories, action }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const e = state?.errors ?? {};
  return (
    <form action={formAction} className="space-y-4 text-sm">
      <h1 className="text-lg font-bold text-ink">{product ? "Editar producto" : "Nuevo producto"}</h1>

      <label className="block text-ink-2">Nombre
        <input name="name" defaultValue={product?.name ?? ""} className={inputClass} />
        {e.name && <span className="text-red-600 text-xs">{e.name}</span>}
      </label>

      <label className="block text-ink-2">Línea
        <select name="line_id" defaultValue={product?.line_id ?? ""} className={inputClass}>
          <option value="" disabled>Selecciona una línea</option>
          {lines.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        {e.line_id && <span className="text-red-600 text-xs">{e.line_id}</span>}
      </label>

      <label className="block text-ink-2">Categoría
        <select name="category_id" defaultValue={product?.category_id ?? ""} className={inputClass}>
          <option value="" disabled>Selecciona una categoría</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {e.category_id && <span className="text-red-600 text-xs">{e.category_id}</span>}
      </label>

      <label className="block text-ink-2">Descripción
        <textarea name="description" defaultValue={product?.description ?? ""} className={inputClass} />
      </label>

      <div className="flex flex-wrap gap-3">
        <label className="block flex-1 text-ink-2">Precio (MXN)
          <input name="price" defaultValue={product ? peso(product.price) : ""} className={inputClass} />
          {e.price && <span className="text-red-600 text-xs">{e.price}</span>}
        </label>
      </div>

      <label className="block text-ink-2">Estado
        <select name="status" defaultValue={product?.status ?? "draft"} className={inputClass}>
          <option value="draft">Borrador</option>
          <option value="active">Activa</option>
          <option value="hidden">Oculta</option>
        </select>
        {e.status && <span className="text-red-600 text-xs">{e.status}</span>}
      </label>

      <Button type="submit" disabled={pending} variant="primary" size="md">
        {pending ? "Guardando…" : "Guardar"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 5: Load lines + categories in the product editor page**

In `src/app/admin/products/[id]/page.tsx`:

Add imports near the top:

```tsx
import { listActiveLines } from "@/lib/repos/lines";
import { listCategories } from "@/lib/repos/categories";
```

After the `const variants = …` / `colors` setup, load taxonomy and pass to the form. Replace the existing `<ProductForm product={existing?.product ?? null} action={saveProduct.bind(null, id)} />` line with a version that has the lists. First, add these loads inside the component body (after `const { id } = await params;` block, e.g. right after computing `images`):

```tsx
  const [lines, categories] = await Promise.all([listActiveLines(), listCategories()]);
```

Then the form usage:

```tsx
          <ProductForm
            product={existing?.product ?? null}
            lines={lines}
            categories={categories}
            action={saveProduct.bind(null, id)}
          />
```

- [ ] **Step 6: Show line slug in the products list**

In `src/app/admin/products/page.tsx`, change the line cell (currently `<Td className="text-ink-2">{p.line}</Td>`) to:

```tsx
              <Td className="text-ink-2">{p.lineSlug}</Td>
```

- [ ] **Step 7: Verify build + tests**

Run: `npm run build`
Expected: the admin product flow compiles. Remaining errors should only be in `src/lib/repos/catalog.ts` and `src/app/(shop)/page.tsx` / `producto` (fixed in Tasks 11–13).

Run: `npm test`
Expected: all pure tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/admin/product-input.ts src/lib/repos/products.ts src/app/admin/products
git commit -m "feat(admin): product form uses line + category dropdowns"
```

---

### Task 11: Catalog repo — CatalogItem + line-aware loaders + detail join

**Files:**
- Modify: `src/lib/repos/catalog.ts` (replace `listActiveByLine`; add `CatalogItem`, `listActiveCatalog`, `listActiveCatalogByLine`; join line slug into `getActiveProduct`)
- Modify: `src/app/(shop)/producto/[id]/page.tsx` (use joined line slug)

**Interfaces:**
- Produces:
  - `interface CatalogItem { id; name; price; lineSlug; categorySlug; categoryName; images: {url; color}[]; colors: {color; color_hex}[] }`
  - `listActiveCatalog(): Promise<CatalogItem[]>`
  - `listActiveCatalogByLine(lineId: string): Promise<CatalogItem[]>`
  - `getActiveProduct(id)` unchanged signature but `CatalogProduct` now carries `product_lines: { slug: string }`.

- [ ] **Step 1: Rewrite `catalog.ts`**

```ts
// src/lib/repos/catalog.ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ProductRow, VariantRow, ProductImageRow } from "@/lib/db-types";

export interface CatalogProduct extends ProductRow {
  product_images: ProductImageRow[];
  product_lines: { slug: string };
}

export interface CatalogItem {
  id: string;
  name: string;
  price: number; // centavos
  lineSlug: string;
  categorySlug: string;
  categoryName: string;
  images: { url: string; color: string | null }[];
  colors: { color: string; color_hex: string }[];
}

const CATALOG_SELECT =
  "id,name,price,product_lines!inner(slug),product_categories!inner(slug,name),product_images(url,color),variants(color,color_hex)";

type CatalogRaw = {
  id: string;
  name: string;
  price: number;
  product_lines: { slug: string } | { slug: string }[];
  product_categories: { slug: string; name: string } | { slug: string; name: string }[];
  product_images: { url: string; color: string | null }[] | null;
  variants: { color: string; color_hex: string }[] | null;
};

const one = <T,>(v: T | T[]): T => (Array.isArray(v) ? v[0] : v);

function toItem(r: CatalogRaw): CatalogItem {
  const line = one(r.product_lines);
  const cat = one(r.product_categories);
  return {
    id: r.id,
    name: r.name,
    price: r.price,
    lineSlug: line.slug,
    categorySlug: cat.slug,
    categoryName: cat.name,
    images: r.product_images ?? [],
    colors: r.variants ?? [],
  };
}

/** All active products, shaped for client-side browse/filter. */
export async function listActiveCatalog(): Promise<CatalogItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(CATALOG_SELECT)
    .eq("status", "active")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as CatalogRaw[]).map(toItem);
}

/** Active products for one line (by line id). */
export async function listActiveCatalogByLine(lineId: string): Promise<CatalogItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(CATALOG_SELECT)
    .eq("status", "active")
    .is("deleted_at", null)
    .eq("line_id", lineId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as CatalogRaw[]).map(toItem);
}

export interface ProductDetail {
  product: CatalogProduct;
  variants: VariantRow[];
}

/** A single active product with images + line slug + variants. Null if not active/found. */
export async function getActiveProduct(id: string): Promise<ProductDetail | null> {
  const supabase = await createClient();
  const { data: product, error } = await supabase
    .from("products")
    .select("*, product_images(*), product_lines(slug)")
    .eq("id", id)
    .eq("status", "active")
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!product) return null;
  const { data: variants, error: vErr } = await supabase
    .from("variants").select("*").eq("product_id", id);
  if (vErr) throw vErr;
  const p = product as { product_lines: { slug: string } | { slug: string }[] } & Record<string, unknown>;
  const normalized = { ...p, product_lines: one(p.product_lines) } as unknown as CatalogProduct;
  return { product: normalized, variants: (variants ?? []) as VariantRow[] };
}
```

- [ ] **Step 2: Update the product detail page to use the joined slug**

In `src/app/(shop)/producto/[id]/page.tsx`, change the `line` prop (line 18) from `line={product.line}` to:

```tsx
      line={product.product_lines.slug}
```

(`ProductDetailClient` already types `line: string` and renders `CORVE {line}` — no change there.)

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: `catalog.ts` and the product detail page compile. The home page (`src/app/(shop)/page.tsx`) is the last remaining error (still imports the removed `listActiveByLine`/`Line`); fixed in Task 13.

- [ ] **Step 4: Commit**

```bash
git add src/lib/repos/catalog.ts "src/app/(shop)/producto/[id]/page.tsx"
git commit -m "feat(catalog): CatalogItem loaders + line-slug join for detail"
```

---

### Task 12: Storefront browse components

**Files:**
- Create: `src/app/(shop)/LineHero.tsx`
- Create: `src/app/(shop)/CatalogSideMenu.tsx`
- Create: `src/app/(shop)/CatalogFilterBar.tsx`
- Create: `src/app/(shop)/CatalogBrowser.tsx`

**Interfaces:**
- Consumes: `CatalogItem` (catalog repo), `matchesFilters` (catalog-filter), `aggregateColors` + `ColorSwatch` (catalog-colors), `productColors` (product-colors), `ProductCard`.
- Produces:
  - `interface BrowserLine { slug: string; hero_title: string; hero_message: string }`
  - `interface BrowserCategory { slug: string; name: string }`
  - `CatalogBrowser` default export with props `{ items: CatalogItem[]; lines: BrowserLine[]; categories: BrowserCategory[]; showSections: boolean }`
  - `LineHero` default export with props `{ line: BrowserLine }`

- [ ] **Step 1: Write `LineHero.tsx`**

```tsx
// src/app/(shop)/LineHero.tsx
import { Eyebrow, Blob } from "@/components/ui";
import type { BrowserLine } from "./CatalogBrowser";

export default function LineHero({ line }: { line: BrowserLine }) {
  return (
    <div className="relative h-[42vh] flex flex-col justify-end p-6 overflow-hidden bg-royal text-ink-on-royal">
      <Blob fill="periwinkle" className="absolute -top-16 -right-10 w-72 h-72 opacity-80" />
      <div className="relative">
        <Eyebrow className="text-periwinkle-2 mb-2">CORVE {line.slug}</Eyebrow>
        <h2 className="font-display font-bold text-5xl leading-none text-lime">{line.hero_title}</h2>
        <p className="italic opacity-80 mt-2">{line.hero_message}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write `CatalogSideMenu.tsx`**

```tsx
// src/app/(shop)/CatalogSideMenu.tsx
"use client";

import Link from "next/link";
import type { BrowserLine, BrowserCategory } from "./CatalogBrowser";

type Props = {
  lines: BrowserLine[];
  categories: BrowserCategory[];
  activeCats: string[];
  onToggleCategory: (slug: string) => void;
  open: boolean;
  onClose: () => void;
};

export default function CatalogSideMenu({ lines, categories, activeCats, onToggleCategory, open, onClose }: Props) {
  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-ink/30 backdrop-blur-sm md:hidden" onClick={onClose} aria-hidden />}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-white p-5 text-sm transition-transform duration-200 ease-out md:sticky md:top-[64px] md:z-auto md:h-[calc(100vh-64px)] md:w-56 md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="mb-6 flex items-center justify-between md:hidden">
          <span className="font-display text-lg font-bold text-ink">Menú</span>
          <button type="button" aria-label="Cerrar menú" onClick={onClose} className="text-ink-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>

        <nav className="space-y-6 overflow-y-auto">
          <div>
            <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-ink-3">Líneas</div>
            <ul className="space-y-1">
              {lines.map((l) => (
                <li key={l.slug}>
                  <Link href={`/linea/${l.slug}`} onClick={onClose}
                    className="block rounded-md px-3 py-2 text-ink-2 transition-colors hover:bg-mist hover:text-ink">
                    CORVE {l.slug}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-ink-3">Categorías</div>
            <ul className="space-y-1">
              {categories.map((c) => {
                const on = activeCats.includes(c.slug);
                return (
                  <li key={c.slug}>
                    <button type="button" onClick={() => onToggleCategory(c.slug)} aria-pressed={on}
                      className={`block w-full rounded-md px-3 py-2 text-left transition-colors ${on ? "bg-royal text-ink-on-royal" : "text-ink-2 hover:bg-mist hover:text-ink"}`}>
                      {c.name}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>
      </aside>
    </>
  );
}
```

- [ ] **Step 3: Write `CatalogFilterBar.tsx`**

```tsx
// src/app/(shop)/CatalogFilterBar.tsx
"use client";

import type { BrowserCategory } from "./CatalogBrowser";
import type { ColorSwatch } from "@/domain/catalog-colors";

type Props = {
  query: string;
  onQuery: (v: string) => void;
  categories: BrowserCategory[];
  activeCats: string[];
  onToggleCategory: (slug: string) => void;
  swatches: ColorSwatch[];
  activeColors: string[];
  onToggleColor: (key: string) => void;
  active: boolean;
  onClear: () => void;
  onOpenMenu: () => void;
};

export default function CatalogFilterBar({
  query, onQuery, categories, activeCats, onToggleCategory,
  swatches, activeColors, onToggleColor, active, onClear, onOpenMenu,
}: Props) {
  return (
    <div className="sticky top-[64px] z-20 space-y-3 border-b border-line bg-white/95 p-4 backdrop-blur">
      <div className="flex items-center gap-2">
        <button type="button" aria-label="Abrir menú" onClick={onOpenMenu} className="text-ink md:hidden">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <input value={query} onChange={(e) => onQuery(e.target.value)} placeholder="Buscar…" aria-label="Buscar"
          className="w-full rounded-pill border border-line bg-white px-4 py-2 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-royal/40" />
        {active && <button type="button" onClick={onClear} className="shrink-0 text-xs text-royal hover:underline">Limpiar</button>}
      </div>

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {categories.map((c) => {
            const on = activeCats.includes(c.slug);
            return (
              <button key={c.slug} type="button" onClick={() => onToggleCategory(c.slug)} aria-pressed={on}
                className={`rounded-pill border px-3 py-1 text-xs transition ${on ? "border-transparent bg-royal text-ink-on-royal" : "border-line-strong text-ink-2 hover:text-ink"}`}>
                {c.name}
              </button>
            );
          })}
        </div>
      )}

      {swatches.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {swatches.map((s) => {
            const on = activeColors.includes(s.key);
            return (
              <button key={s.key} type="button" onClick={() => onToggleColor(s.key)} aria-label={s.label} title={s.label} aria-pressed={on}
                className={`h-6 w-6 rounded-pill border border-line transition ${on ? "ring-2 ring-royal ring-offset-1" : ""}`}
                style={{ background: s.hex }} />
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Write `CatalogBrowser.tsx`**

```tsx
// src/app/(shop)/CatalogBrowser.tsx
"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import ProductCard from "./ProductCard";
import LineHero from "./LineHero";
import CatalogSideMenu from "./CatalogSideMenu";
import CatalogFilterBar from "./CatalogFilterBar";
import { matchesFilters } from "@/domain/catalog-filter";
import { aggregateColors } from "@/domain/catalog-colors";
import { productColors } from "@/domain/product-colors";
import type { CatalogItem } from "@/lib/repos/catalog";

export interface BrowserLine {
  slug: string;
  hero_title: string;
  hero_message: string;
}
export interface BrowserCategory {
  slug: string;
  name: string;
}

type Props = {
  items: CatalogItem[];
  lines: BrowserLine[];
  categories: BrowserCategory[];
  showSections: boolean;
};

function parseList(v: string | null): string[] {
  return v ? v.split(",").filter(Boolean) : [];
}

export default function CatalogBrowser({ items, lines, categories, showSections }: Props) {
  const sp = useSearchParams();
  const [query, setQuery] = useState(sp.get("q") ?? "");
  const [cats, setCats] = useState<string[]>(parseList(sp.get("cat")));
  const [colors, setColors] = useState<string[]>(parseList(sp.get("color")));
  const [menuOpen, setMenuOpen] = useState(false);

  const swatches = useMemo(() => aggregateColors(items.flatMap((i) => i.colors)), [items]);
  const active = query.trim() !== "" || cats.length > 0 || colors.length > 0;
  const filtered = useMemo(
    () => items.filter((i) => matchesFilters(i, { query, categorySlugs: cats, colorKeys: colors })),
    [items, query, cats, colors],
  );

  function sync(next: { q?: string; cat?: string[]; color?: string[] }) {
    const params = new URLSearchParams();
    const q = next.q ?? query;
    const c = next.cat ?? cats;
    const col = next.color ?? colors;
    if (q.trim()) params.set("q", q.trim());
    if (c.length) params.set("cat", c.join(","));
    if (col.length) params.set("color", col.join(","));
    const qs = params.toString();
    window.history.replaceState({}, "", qs ? `?${qs}` : window.location.pathname);
  }

  function onQuery(v: string) { setQuery(v); sync({ q: v }); }
  function toggleCat(slug: string) {
    const next = cats.includes(slug) ? cats.filter((s) => s !== slug) : [...cats, slug];
    setCats(next); sync({ cat: next });
  }
  function toggleColor(key: string) {
    const next = colors.includes(key) ? colors.filter((s) => s !== key) : [...colors, key];
    setColors(next); sync({ color: next });
  }
  function clearAll() { setQuery(""); setCats([]); setColors([]); sync({ q: "", cat: [], color: [] }); }

  const grid = (list: CatalogItem[]) => (
    <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
      {list.map((p) => (
        <ProductCard key={p.id} id={p.id} name={p.name} price={p.price}
          images={p.images} colors={productColors(p.colors, p.images)} />
      ))}
      {list.length === 0 && <p className="text-sm text-ink-3">Sin resultados.</p>}
    </div>
  );

  return (
    <div className="md:flex">
      <CatalogSideMenu
        lines={lines}
        categories={categories}
        activeCats={cats}
        onToggleCategory={toggleCat}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
      />
      <main className="min-w-0 flex-1">
        <CatalogFilterBar
          query={query}
          onQuery={onQuery}
          categories={categories}
          activeCats={cats}
          onToggleCategory={toggleCat}
          swatches={swatches}
          activeColors={colors}
          onToggleColor={toggleColor}
          active={active}
          onClear={clearAll}
          onOpenMenu={() => setMenuOpen(true)}
        />
        {showSections && !active
          ? lines.map((l) => (
              <section key={l.slug} className="mb-10">
                <LineHero line={l} />
                {grid(items.filter((i) => i.lineSlug === l.slug))}
              </section>
            ))
          : grid(filtered)}
      </main>
    </div>
  );
}
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: these components compile. The home page is wired next; if `page.tsx` still errors, that's expected until Task 13.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(shop)/LineHero.tsx" "src/app/(shop)/CatalogSideMenu.tsx" "src/app/(shop)/CatalogFilterBar.tsx" "src/app/(shop)/CatalogBrowser.tsx"
git commit -m "feat(shop): catalog browse components (side menu, filter bar, browser)"
```

---

### Task 13: Wire the home page

**Files:**
- Modify: `src/app/(shop)/page.tsx` (replace hardcoded sections with `CatalogBrowser`)

**Interfaces:**
- Consumes: `listActiveLines`, `listCategories`, `listActiveCatalog`, `CatalogBrowser`.

- [ ] **Step 1: Replace `page.tsx`**

```tsx
// src/app/(shop)/page.tsx
import { listActiveLines } from "@/lib/repos/lines";
import { listCategories } from "@/lib/repos/categories";
import { listActiveCatalog } from "@/lib/repos/catalog";
import CatalogBrowser from "./CatalogBrowser";

export default async function CatalogPage() {
  const [lines, categories, items] = await Promise.all([
    listActiveLines(),
    listCategories(),
    listActiveCatalog(),
  ]);
  return (
    <CatalogBrowser
      items={items}
      lines={lines.map((l) => ({ slug: l.slug, hero_title: l.hero_title, hero_message: l.hero_message }))}
      categories={categories.map((c) => ({ slug: c.slug, name: c.name }))}
      showSections
    />
  );
}
```

- [ ] **Step 2: Verify full build + tests**

Run: `npm run build`
Expected: **whole app compiles with no errors** (this was the last file importing removed symbols).

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(shop)/page.tsx"
git commit -m "feat(shop): dynamic home catalog with browse + filters"
```

---

### Task 14: Per-line page `/linea/[slug]`

**Files:**
- Create: `src/app/(shop)/linea/[slug]/page.tsx`

**Interfaces:**
- Consumes: `getActiveLineBySlug`, `listActiveLines`, `listCategories`, `listActiveCatalogByLine`, `CatalogBrowser`, `LineHero`.

- [ ] **Step 1: Write the line page**

```tsx
// src/app/(shop)/linea/[slug]/page.tsx
import { notFound } from "next/navigation";
import { getActiveLineBySlug, listActiveLines } from "@/lib/repos/lines";
import { listCategories } from "@/lib/repos/categories";
import { listActiveCatalogByLine } from "@/lib/repos/catalog";
import CatalogBrowser from "../../CatalogBrowser";
import LineHero from "../../LineHero";

export default async function LinePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const line = await getActiveLineBySlug(slug);
  if (!line) notFound();

  const [lines, categories, items] = await Promise.all([
    listActiveLines(),
    listCategories(),
    listActiveCatalogByLine(line.id),
  ]);

  const heroLine = { slug: line.slug, hero_title: line.hero_title, hero_message: line.hero_message };

  return (
    <>
      <LineHero line={heroLine} />
      <CatalogBrowser
        items={items}
        lines={lines.map((l) => ({ slug: l.slug, hero_title: l.hero_title, hero_message: l.hero_message }))}
        categories={categories.map((c) => ({ slug: c.slug, name: c.name }))}
        showSections={false}
      />
    </>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: `/linea/[slug]` route appears in the build output; no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(shop)/linea"
git commit -m "feat(shop): per-line pages at /linea/[slug]"
```

---

### Task 15: End-to-end manual verification

**Files:** none (verification only).

- [ ] **Step 1: Reset DB + seed a little data**

Run: `npx supabase db reset` (Docker up). Then start the app: `npm run dev`.
In `/admin/lines`, confirm MOVE + HIM exist; add a new line "CORVE FLOW" (slug auto `flow`, active).
In `/admin/categories`, add "Leggings" and "Shorts".
In `/admin/products`, create an active product, pick a line + category, add variants with two colors.

- [ ] **Step 2: Storefront checks**

- Home `/`: marketing sections render per active line; the new line appears.
- Open the side menu (mobile hamburger in the filter bar / desktop sidebar): lines link out, categories toggle.
- Type in search → sections collapse to a flat grid; results match name/category; URL gains `?q=`.
- Toggle a category chip and a color swatch → grid narrows; URL gains `?cat=` / `?color=`; "Limpiar" resets to sections.
- Visit `/linea/flow` → hero + that line's products only; filters still work; an unknown slug 404s.
- Product detail page shows "CORVE <slug>".

- [ ] **Step 3: Order + sales regression**

- Place a guest order through the cart. Confirm it succeeds (the `place_order` RPC now snapshots the line slug).
- In `/admin/ventas`, confirm the dynamic line buttons render and filtering by a line still totals correctly.

- [ ] **Step 4: Final full check**

Run: `npm test` → all PASS.
Run: `npm run build` → no errors.
Run: `npm run lint` → no errors.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "test: end-to-end verification fixes for catalog taxonomy"
```

(If nothing needed fixing, skip the commit.)

---

## Self-Review

**Spec coverage:**
- Admin-managed lines + categories tables → Tasks 4, 6, 7, 8. ✓
- Global categories (independent of line) → `products.category_id` independent FK, Task 4. ✓
- type→category rename, keep line, nullable `parent_id`, Collections reserved → Tasks 4, 5, 10. ✓
- Home keeps sections + gains menu/search/filters; per-line pages → Tasks 12, 13, 14. ✓
- Search matches name + category → Task 3 (`matchesFilters` searches name + categoryName). ✓
- Multi-select category + color filters → Tasks 3, 12. ✓
- Client-side, URL-synced filtering → Task 12 (`CatalogBrowser` `window.history.replaceState`). ✓
- Color facet derived from variants (normalized) → Tasks 2, 12. ✓
- `order_items.line` → text slug snapshot + `place_order` RPC update → Task 4. ✓
- Sales-by-line reporting intact → Task 5 (`line: string`), Task 9 (dynamic buttons). ✓
- RLS anon-read for new tables → Task 4. ✓
- Tests for filter/colors/slug → Tasks 1, 2, 3. ✓

**Placeholder scan:** No TBD/TODO; all code blocks complete. ✓

**Type consistency:** `CatalogItem` (Task 11) matches `FilterableItem` shape used by `matchesFilters` (Task 3: needs `name`, `categorySlug`, `categoryName`, `colors[].color` — all present). `ColorSwatch` (Task 2) consumed by `CatalogFilterBar` (Task 12). `ProductPayload` FK fields (Task 10) match `ProductRow` (Task 5) and the form `name=` attributes. `BrowserLine`/`BrowserCategory` defined in `CatalogBrowser` (Task 12) and imported by `LineHero`/`CatalogSideMenu`/`CatalogFilterBar`. `listProducts` → `ProductListRow.lineSlug` consumed by products list page (Task 10). ✓
