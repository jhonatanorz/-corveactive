# Storefront Search & Navigation Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the storefront menu + search into the header, replace the toolbar with menu-driven (URL) category filtering, hide empty line sections, and add a full-screen search overlay with server-side autocomplete plus a `/buscar` results page filtered by line + color.

**Architecture:** A single client wrapper `ShopChrome` (rendered in the shop layout) owns the header, the global menu drawer, and the search overlay. Cross-component state flows through the URL: the menu writes `?cat=`, browse pages read it; the overlay routes to `/buscar?q=`. Autocomplete hits a `GET /api/search` route handler (debounced + cancelable); `/buscar` loads server-matched products and filters line/color client-side.

**Tech Stack:** Next.js 16 (App Router, RSC + route handlers), React 19, Supabase (Postgres + RLS, anon client), TypeScript, Tailwind v4, Vitest.

## Global Constraints

- **Language:** all user-facing copy in Spanish (e.g. "Menú", "Buscar productos…", "Sin resultados.", "Limpiar", "Ver todos los resultados", "Resultados para").
- **Money:** prices are integer centavos; format with `formatMXN` from `@/domain/money`; never use floats.
- **Server-only repos:** files in `src/lib/repos/` start with `import "server-only";` and get the client via `await createClient()` from `@/lib/supabase/server`.
- **Search scope:** match product **name + category name**, accent/case-insensitive, done in SQL under the anon client (RLS already limits to active products).
- **Filtering:** category filter is URL-driven (`?cat=`); `/buscar` line+color filters are multi-select, URL-synced (`?q=&line=&color=`); OR within a facet, AND across facets; empty facet = no constraint.
- **Menu:** drawer on ALL breakpoints (no persistent desktop sidebar).
- **Tests:** pure logic only, Vitest, colocated `*.test.ts`, run with `npm test`.
- **Per-task gate:** `npm run build` must compile green (types + lint + routes); the build does not require the database. Run `npm test` for the domain task.
- **Do not** reintroduce the deleted `CatalogFilterBar`, color/text filtering on home/line pages, or a category filter on `/buscar`.

---

### Task 1: Extend `matchesFilters` with a line facet

**Files:**
- Modify: `src/domain/catalog-filter.ts`
- Test: `src/domain/catalog-filter.test.ts`

**Interfaces:**
- Produces:
  - `FilterableItem { name: string; lineSlug: string; categorySlug: string; categoryName: string; colors: { color: string }[] }`
  - `CatalogFilters { query?: string; categorySlugs?: string[]; lineSlugs?: string[]; colorKeys?: string[] }`
  - `matchesFilters(item: FilterableItem, f: CatalogFilters): boolean` (each facet optional; empty/undefined = no constraint)

- [ ] **Step 1: Replace the test file**

```ts
// src/domain/catalog-filter.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- catalog-filter`
Expected: FAIL — `matchesFilters` rejects `{}` / `lineSlugs` not honored (type error on `{}` or assertion failures).

- [ ] **Step 3: Update the implementation**

```ts
// src/domain/catalog-filter.ts
import { normalizeColorKey } from "@/domain/catalog-colors";

export interface FilterableItem {
  name: string;
  lineSlug: string;
  categorySlug: string;
  categoryName: string;
  colors: { color: string }[];
}

export interface CatalogFilters {
  query?: string;
  categorySlugs?: string[];
  lineSlugs?: string[];
  colorKeys?: string[];
}

/** True when an item satisfies every active facet. Empty/undefined facet = no constraint. */
export function matchesFilters(item: FilterableItem, f: CatalogFilters): boolean {
  const q = normalizeColorKey(f.query ?? ""); // reuse: trim + lowercase + accent-strip
  if (q !== "") {
    const hay = normalizeColorKey(`${item.name} ${item.categoryName}`);
    if (!hay.includes(q)) return false;
  }
  if (f.lineSlugs && f.lineSlugs.length > 0 && !f.lineSlugs.includes(item.lineSlug)) return false;
  if (f.categorySlugs && f.categorySlugs.length > 0 && !f.categorySlugs.includes(item.categorySlug)) return false;
  if (f.colorKeys && f.colorKeys.length > 0) {
    const keys = new Set(item.colors.map((c) => normalizeColorKey(c.color)));
    if (!f.colorKeys.some((k) => keys.has(k))) return false;
  }
  return true;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- catalog-filter`
Expected: PASS (7 tests).

- [ ] **Step 5: Verify the whole suite still passes**

Run: `npm test`
Expected: all tests PASS (the existing `CatalogBrowser` call `matchesFilters(i, { query, categorySlugs, colorKeys })` still type-checks because facets are optional).

- [ ] **Step 6: Commit**

```bash
git add src/domain/catalog-filter.ts src/domain/catalog-filter.test.ts
git commit -m "feat(domain): add line facet to matchesFilters; optional facets"
```

---

### Task 2: Server-side search repo functions

**Files:**
- Modify: `src/lib/repos/catalog.ts`

**Interfaces:**
- Consumes: existing `CATALOG_SELECT`, `CatalogRaw`, `toItem`, `CatalogItem` (same file); `pickProductImage` from `@/domain/product-image`.
- Produces:
  - `SearchSuggestion { id: string; name: string; price: number; thumbnailUrl: string | null }`
  - `searchSuggestions(q: string): Promise<SearchSuggestion[]>` (≤8, slim)
  - `searchCatalog(q: string): Promise<CatalogItem[]>` (full items, matched by name+category)

- [ ] **Step 1: Add the search code to `catalog.ts`**

Add this import near the top (after the existing imports):

```ts
import { pickProductImage } from "@/domain/product-image";
```

Append the following to the end of `src/lib/repos/catalog.ts`:

```ts
export interface SearchSuggestion {
  id: string;
  name: string;
  price: number;
  thumbnailUrl: string | null;
}

type SuggestRaw = {
  id: string;
  name: string;
  price: number;
  product_images: { url: string; color: string | null }[] | null;
};

/** Escape LIKE wildcards so user input is matched literally. */
function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/**
 * Active products whose name OR category name matches q. Two queries merged by id
 * (avoids a cross-table PostgREST `.or` string). `select` is a PostgREST column spec;
 * pass an optional limit for autocomplete.
 */
async function searchRows<T extends { id: string }>(
  select: string,
  q: string,
  limit?: number,
): Promise<T[]> {
  const term = q.trim();
  if (term === "") return [];
  const supabase = await createClient();
  const pat = likePattern(term);

  const { data: catRows, error: catErr } = await supabase
    .from("product_categories").select("id").ilike("name", pat);
  if (catErr) throw catErr;
  const catIds = (catRows ?? []).map((c) => (c as { id: string }).id);

  let nameQ = supabase
    .from("products").select(select)
    .eq("status", "active").is("deleted_at", null)
    .ilike("name", pat)
    .order("created_at", { ascending: false });
  if (limit) nameQ = nameQ.limit(limit);
  const { data: byName, error: nameErr } = await nameQ;
  if (nameErr) throw nameErr;

  let byCat: unknown[] = [];
  if (catIds.length > 0) {
    let catQ = supabase
      .from("products").select(select)
      .eq("status", "active").is("deleted_at", null)
      .in("category_id", catIds)
      .order("created_at", { ascending: false });
    if (limit) catQ = catQ.limit(limit);
    const { data: catData, error: cErr } = await catQ;
    if (cErr) throw cErr;
    byCat = catData ?? [];
  }

  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of [...((byName ?? []) as unknown as T[]), ...(byCat as unknown as T[])]) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return limit ? out.slice(0, limit) : out;
}

/** Slim autocomplete suggestions (≤8) for products matching name or category. */
export async function searchSuggestions(q: string): Promise<SearchSuggestion[]> {
  const rows = await searchRows<SuggestRaw>("id,name,price,product_images(url,color)", q, 8);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    price: r.price,
    thumbnailUrl: pickProductImage(r.product_images ?? [], null),
  }));
}

/** Full catalog items for products matching name or category (for the /buscar page). */
export async function searchCatalog(q: string): Promise<CatalogItem[]> {
  const rows = await searchRows<CatalogRaw>(CATALOG_SELECT, q);
  return rows.map(toItem);
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors (the new functions are self-contained; `CatalogRaw`/`toItem`/`CATALOG_SELECT` are in the same file).

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: green.

- [ ] **Step 4: Commit**

```bash
git add src/lib/repos/catalog.ts
git commit -m "feat(catalog): server-side search (suggestions + full results)"
```

---

### Task 3: `/api/search` route handler

**Files:**
- Create: `src/app/api/search/route.ts`

**Interfaces:**
- Consumes: `searchSuggestions` from `@/lib/repos/catalog`.
- Produces: `GET /api/search?q=…` → `{ items: SearchSuggestion[] }` (JSON).

- [ ] **Step 1: Create the route handler**

```ts
// src/app/api/search/route.ts
import { NextResponse } from "next/server";
import { searchSuggestions } from "@/lib/repos/catalog";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  const items = await searchSuggestions(q);
  return NextResponse.json({ items });
}
```

- [ ] **Step 2: Build (confirms the route compiles)**

Run: `npm run build`
Expected: green; the route list includes `ƒ /api/search`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/search/route.ts
git commit -m "feat(api): /api/search autocomplete route handler"
```

---

### Task 4: `/buscar` results page + `SearchResults`

**Files:**
- Create: `src/app/(shop)/buscar/page.tsx`
- Create: `src/app/(shop)/SearchResults.tsx`

**Interfaces:**
- Consumes: `searchCatalog` (`@/lib/repos/catalog`), `listActiveLines` (`@/lib/repos/lines`), `matchesFilters` (`@/domain/catalog-filter`), `aggregateColors` (`@/domain/catalog-colors`), `productColors` (`@/domain/product-colors`), `ProductCard` (`./ProductCard`), `CatalogItem` (`@/lib/repos/catalog`).
- Produces: route `/buscar`; `SearchResults` default export with props `{ query: string; items: CatalogItem[]; lines: { slug: string; name: string }[] }`.

- [ ] **Step 1: Create `SearchResults.tsx`**

```tsx
// src/app/(shop)/SearchResults.tsx
"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import ProductCard from "./ProductCard";
import { matchesFilters } from "@/domain/catalog-filter";
import { aggregateColors } from "@/domain/catalog-colors";
import { productColors } from "@/domain/product-colors";
import type { CatalogItem } from "@/lib/repos/catalog";

type Line = { slug: string; name: string };

function parseList(v: string | null): string[] {
  return v ? v.split(",").filter(Boolean) : [];
}

export default function SearchResults({
  query,
  items,
  lines,
}: {
  query: string;
  items: CatalogItem[];
  lines: Line[];
}) {
  const sp = useSearchParams();
  const [lineSlugs, setLineSlugs] = useState<string[]>(parseList(sp.get("line")));
  const [colors, setColors] = useState<string[]>(parseList(sp.get("color")));

  const swatches = useMemo(() => aggregateColors(items.flatMap((i) => i.colors)), [items]);
  const filtered = useMemo(
    () => items.filter((i) => matchesFilters(i, { lineSlugs, colorKeys: colors })),
    [items, lineSlugs, colors],
  );
  const active = lineSlugs.length > 0 || colors.length > 0;

  function sync(next: { line?: string[]; color?: string[] }) {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    const ls = next.line ?? lineSlugs;
    const cs = next.color ?? colors;
    if (ls.length) params.set("line", ls.join(","));
    if (cs.length) params.set("color", cs.join(","));
    window.history.replaceState({}, "", `?${params.toString()}`);
  }
  function toggleLine(slug: string) {
    const n = lineSlugs.includes(slug) ? lineSlugs.filter((s) => s !== slug) : [...lineSlugs, slug];
    setLineSlugs(n); sync({ line: n });
  }
  function toggleColor(key: string) {
    const n = colors.includes(key) ? colors.filter((s) => s !== key) : [...colors, key];
    setColors(n); sync({ color: n });
  }
  function clearAll() { setLineSlugs([]); setColors([]); sync({ line: [], color: [] }); }

  return (
    <main className="p-4">
      <h1 className="mb-4 text-lg text-ink">Resultados para “{query}”</h1>

      <div className="mb-4 space-y-3">
        {lines.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {lines.map((l) => {
              const on = lineSlugs.includes(l.slug);
              return (
                <button key={l.slug} type="button" onClick={() => toggleLine(l.slug)} aria-pressed={on}
                  className={`rounded-pill border px-3 py-1 text-xs transition ${on ? "border-transparent bg-royal text-ink-on-royal" : "border-line-strong text-ink-2 hover:text-ink"}`}>
                  {l.name}
                </button>
              );
            })}
          </div>
        )}
        {swatches.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {swatches.map((s) => {
              const on = colors.includes(s.key);
              return (
                <button key={s.key} type="button" onClick={() => toggleColor(s.key)} aria-label={s.label} title={s.label} aria-pressed={on}
                  className={`h-6 w-6 rounded-pill border border-line transition ${on ? "ring-2 ring-royal ring-offset-1" : ""}`}
                  style={{ background: s.hex }} />
              );
            })}
          </div>
        )}
        {active && <button type="button" onClick={clearAll} className="text-xs text-royal hover:underline">Limpiar</button>}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
        {filtered.map((p) => (
          <ProductCard key={p.id} id={p.id} name={p.name} price={p.price}
            images={p.images} colors={productColors(p.colors, p.images)} />
        ))}
        {filtered.length === 0 && <p className="text-sm text-ink-3">Sin resultados.</p>}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Create the `/buscar` page**

```tsx
// src/app/(shop)/buscar/page.tsx
import { searchCatalog } from "@/lib/repos/catalog";
import { listActiveLines } from "@/lib/repos/lines";
import SearchResults from "../SearchResults";

export default async function BuscarPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const [items, lines] = await Promise.all([
    query ? searchCatalog(query) : Promise.resolve([]),
    listActiveLines(),
  ]);
  return (
    <SearchResults
      query={query}
      items={items}
      lines={lines.map((l) => ({ slug: l.slug, name: l.name }))}
    />
  );
}
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: green; route list includes `ƒ /buscar`.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(shop)/buscar/page.tsx" "src/app/(shop)/SearchResults.tsx"
git commit -m "feat(shop): /buscar results page with line + color filters"
```

---

### Task 5: Slim `CatalogBrowser`; delete `CatalogFilterBar`; hide empty lines

**Files:**
- Modify: `src/app/(shop)/CatalogBrowser.tsx` (full replacement)
- Delete: `src/app/(shop)/CatalogFilterBar.tsx`
- Modify: `src/app/(shop)/page.tsx`
- Modify: `src/app/(shop)/linea/[slug]/page.tsx`

**Interfaces:**
- Consumes: `matchesFilters` (`@/domain/catalog-filter`), `productColors`, `ProductCard`, `LineHero`, `CatalogItem`.
- Produces: `CatalogBrowser` default export with props `{ items: CatalogItem[]; lines: BrowserLine[]; showSections: boolean }`; still exports `BrowserLine` + `BrowserCategory` (consumed by the menu + chrome in later tasks).

- [ ] **Step 1: Replace `CatalogBrowser.tsx`**

```tsx
// src/app/(shop)/CatalogBrowser.tsx
"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import ProductCard from "./ProductCard";
import LineHero from "./LineHero";
import { matchesFilters } from "@/domain/catalog-filter";
import { productColors } from "@/domain/product-colors";
import type { CatalogItem } from "@/lib/repos/catalog";

export interface BrowserLine {
  slug: string;
  name: string;
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
  showSections: boolean;
};

function parseList(v: string | null): string[] {
  return v ? v.split(",").filter(Boolean) : [];
}

export default function CatalogBrowser({ items, lines, showSections }: Props) {
  const sp = useSearchParams();
  const catParam = sp.get("cat") ?? "";
  const cats = useMemo(() => parseList(catParam), [catParam]);
  const active = cats.length > 0;
  const filtered = useMemo(
    () => items.filter((i) => matchesFilters(i, { categorySlugs: cats })),
    [items, cats],
  );

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
    <main className="min-w-0">
      {showSections && !active
        ? lines
            .filter((l) => items.some((i) => i.lineSlug === l.slug))
            .map((l) => (
              <section key={l.slug} className="mb-10">
                <LineHero line={l} />
                {grid(items.filter((i) => i.lineSlug === l.slug))}
              </section>
            ))
        : grid(filtered)}
    </main>
  );
}
```

- [ ] **Step 2: Delete `CatalogFilterBar.tsx`**

```bash
git rm "src/app/(shop)/CatalogFilterBar.tsx"
```

- [ ] **Step 3: Update `page.tsx` (drop categories)**

```tsx
// src/app/(shop)/page.tsx
import { listActiveLines } from "@/lib/repos/lines";
import { listActiveCatalog } from "@/lib/repos/catalog";
import CatalogBrowser from "./CatalogBrowser";

export default async function CatalogPage() {
  const [lines, items] = await Promise.all([listActiveLines(), listActiveCatalog()]);
  return (
    <CatalogBrowser
      items={items}
      lines={lines.map((l) => ({ slug: l.slug, name: l.name, hero_title: l.hero_title, hero_message: l.hero_message }))}
      showSections
    />
  );
}
```

- [ ] **Step 4: Update the line page (drop categories)**

```tsx
// src/app/(shop)/linea/[slug]/page.tsx
import { notFound } from "next/navigation";
import { getActiveLineBySlug, listActiveLines } from "@/lib/repos/lines";
import { listActiveCatalogByLine } from "@/lib/repos/catalog";
import CatalogBrowser from "../../CatalogBrowser";
import LineHero from "../../LineHero";

export default async function LinePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const line = await getActiveLineBySlug(slug);
  if (!line) notFound();

  const [lines, items] = await Promise.all([
    listActiveLines(),
    listActiveCatalogByLine(line.id),
  ]);

  const heroLine = { slug: line.slug, name: line.name, hero_title: line.hero_title, hero_message: line.hero_message };

  return (
    <>
      <LineHero line={heroLine} />
      <CatalogBrowser
        items={items}
        lines={lines.map((l) => ({ slug: l.slug, name: l.name, hero_title: l.hero_title, hero_message: l.hero_message }))}
        showSections={false}
      />
    </>
  );
}
```

- [ ] **Step 5: Build + test**

Run: `npm run build`
Expected: green. (`CatalogSideMenu.tsx` is now orphaned but still compiles — it is rewritten in Task 6. The menu is temporarily not reachable in the UI; that's expected until Task 8.)

Run: `npm test`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(shop)/CatalogBrowser.tsx" "src/app/(shop)/page.tsx" "src/app/(shop)/linea/[slug]/page.tsx"
git commit -m "feat(shop): slim CatalogBrowser to URL category filter; hide empty lines; remove toolbar"
```

---

### Task 6: `CatalogSideMenu` → drawer-everywhere + URL-driven categories

**Files:**
- Modify: `src/app/(shop)/CatalogSideMenu.tsx` (full replacement)

**Interfaces:**
- Consumes: `BrowserLine`, `BrowserCategory` from `./CatalogBrowser`.
- Produces: `CatalogSideMenu` default export with props `{ lines: BrowserLine[]; categories: BrowserCategory[]; open: boolean; onClose: () => void }`. It reads/writes `?cat=` itself via `next/navigation`.

- [ ] **Step 1: Replace `CatalogSideMenu.tsx`**

```tsx
// src/app/(shop)/CatalogSideMenu.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { BrowserLine, BrowserCategory } from "./CatalogBrowser";

type Props = {
  lines: BrowserLine[];
  categories: BrowserCategory[];
  open: boolean;
  onClose: () => void;
};

function parseList(v: string | null): string[] {
  return v ? v.split(",").filter(Boolean) : [];
}

export default function CatalogSideMenu({ lines, categories, open, onClose }: Props) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const router = useRouter();
  const activeCats = parseList(sp.get("cat"));

  function toggleCategory(slug: string) {
    const next = activeCats.includes(slug) ? activeCats.filter((s) => s !== slug) : [...activeCats, slug];
    const qs = next.length ? `?cat=${next.join(",")}` : "";
    const onBrowse = pathname === "/" || pathname.startsWith("/linea/");
    if (onBrowse) router.replace(`${pathname}${qs}`, { scroll: false });
    else router.push(`/${qs}`);
    onClose();
  }

  return (
    <>
      {open && <div className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-sm" onClick={onClose} aria-hidden />}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-line bg-white p-5 text-sm transition-transform duration-200 ease-out ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="mb-6 flex items-center justify-between">
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
                    {l.name}
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
                    <button type="button" onClick={() => toggleCategory(c.slug)} aria-pressed={on}
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

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: green. (`CatalogSideMenu` is still orphaned — wired up in Task 8.)

- [ ] **Step 3: Commit**

```bash
git add "src/app/(shop)/CatalogSideMenu.tsx"
git commit -m "feat(shop): menu drawer everywhere, URL-driven category filter"
```

---

### Task 7: `SearchOverlay`

**Files:**
- Create: `src/app/(shop)/SearchOverlay.tsx`

**Interfaces:**
- Consumes: `/api/search` (Task 3); `formatMXN` (`@/domain/money`); `next/image`, `next/navigation`.
- Produces: `SearchOverlay` default export with props `{ open: boolean; onClose: () => void }`.

- [ ] **Step 1: Create `SearchOverlay.tsx`**

```tsx
// src/app/(shop)/SearchOverlay.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { formatMXN } from "@/domain/money";

type Suggestion = { id: string; name: string; price: number; thumbnailUrl: string | null };

export default function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // focus on open; reset on close
  useEffect(() => {
    if (open) inputRef.current?.focus();
    else { setQ(""); setItems([]); setLoading(false); }
  }, [open]);

  // debounced, cancelable fetch
  useEffect(() => {
    const term = q.trim();
    if (term === "") { setItems([]); setLoading(false); return; }
    setLoading(true);
    const t = setTimeout(() => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ac.signal })
        .then((r) => r.json())
        .then((d) => setItems(d.items ?? []))
        .catch((e) => { if ((e as Error).name !== "AbortError") setItems([]); })
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  // Esc closes
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function goAll() {
    const term = q.trim();
    if (term) { router.push(`/buscar?q=${encodeURIComponent(term)}`); onClose(); }
  }
  function onSubmit(e: React.FormEvent) { e.preventDefault(); goAll(); }
  function pick(id: string) { router.push(`/producto/${id}`); onClose(); }

  return (
    <div className="fixed inset-0 z-50 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-full max-w-2xl flex-col p-4">
        <form onSubmit={onSubmit} className="flex items-center gap-2">
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar productos…" aria-label="Buscar productos"
            className="w-full rounded-pill border border-line bg-white px-4 py-3 text-base text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-royal/40" />
          <button type="button" onClick={onClose} aria-label="Cerrar búsqueda" className="shrink-0 text-ink-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </form>

        <div className="mt-4 flex-1 overflow-y-auto">
          {q.trim() !== "" && !loading && items.length === 0 && (
            <p className="text-sm text-ink-3">Sin resultados.</p>
          )}
          <ul className="space-y-1">
            {items.map((it) => (
              <li key={it.id}>
                <button type="button" onClick={() => pick(it.id)}
                  className="flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-mist">
                  <span className="relative h-14 w-12 shrink-0 overflow-hidden rounded bg-mist">
                    {it.thumbnailUrl && <Image src={it.thumbnailUrl} alt={it.name} fill sizes="48px" className="object-cover" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink">{it.name}</span>
                    <span className="block text-sm text-ink-2">{formatMXN(it.price)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {q.trim() !== "" && (
            <button type="button" onClick={goAll} className="mt-3 text-sm text-royal hover:underline">
              Ver todos los resultados →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: green. (Overlay is wired up in Task 8.)

- [ ] **Step 3: Commit**

```bash
git add "src/app/(shop)/SearchOverlay.tsx"
git commit -m "feat(shop): full-screen search overlay with debounced autocomplete"
```

---

### Task 8: `ShopChrome` + header wiring (menu + search in header)

**Files:**
- Create: `src/app/(shop)/ShopChrome.tsx`
- Modify: `src/app/(shop)/layout.tsx`

**Interfaces:**
- Consumes: `Wordmark` (`@/components/ui`), `CartPill` (`./CartPill`), `CatalogSideMenu` (Task 6), `SearchOverlay` (Task 7), `BrowserLine`/`BrowserCategory` (`./CatalogBrowser`), `listActiveLines` (`@/lib/repos/lines`), `listCategories` (`@/lib/repos/categories`).
- Produces: `ShopChrome` default export with props `{ lines: BrowserLine[]; categories: BrowserCategory[]; children: React.ReactNode }`.

- [ ] **Step 1: Create `ShopChrome.tsx`**

```tsx
// src/app/(shop)/ShopChrome.tsx
"use client";

import { useState } from "react";
import { Wordmark } from "@/components/ui";
import CartPill from "./CartPill";
import CatalogSideMenu from "./CatalogSideMenu";
import SearchOverlay from "./SearchOverlay";
import type { BrowserLine, BrowserCategory } from "./CatalogBrowser";

type Props = {
  lines: BrowserLine[];
  categories: BrowserCategory[];
  children: React.ReactNode;
};

export default function ShopChrome({ lines, categories, children }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-line bg-white/95 px-5 py-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Abrir menú" onClick={() => setMenuOpen(true)} className="text-ink">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <Wordmark className="text-2xl" />
        </div>
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Buscar" onClick={() => setSearchOpen(true)} className="text-ink">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
          <CartPill />
        </div>
      </header>

      <CatalogSideMenu lines={lines} categories={categories} open={menuOpen} onClose={() => setMenuOpen(false)} />
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />

      {children}
    </>
  );
}
```

- [ ] **Step 2: Replace `layout.tsx`**

```tsx
// src/app/(shop)/layout.tsx
import { CartProvider } from "@/lib/cart/CartContext";
import { listActiveLines } from "@/lib/repos/lines";
import { listCategories } from "@/lib/repos/categories";
import ShopChrome from "./ShopChrome";
import Footer from "./Footer";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const [lines, categories] = await Promise.all([listActiveLines(), listCategories()]);
  return (
    <CartProvider>
      <div className="min-h-screen bg-white text-ink">
        <ShopChrome
          lines={lines.map((l) => ({ slug: l.slug, name: l.name, hero_title: l.hero_title, hero_message: l.hero_message }))}
          categories={categories.map((c) => ({ slug: c.slug, name: c.name }))}
        >
          {children}
        </ShopChrome>
        <Footer />
      </div>
    </CartProvider>
  );
}
```

- [ ] **Step 3: Build + full test**

Run: `npm run build`
Expected: green; routes include `/`, `/linea/[slug]`, `/buscar`, `/api/search`.

Run: `npm test`
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(shop)/ShopChrome.tsx" "src/app/(shop)/layout.tsx"
git commit -m "feat(shop): header menu + search; global ShopChrome wrapper"
```

---

### Task 9: End-to-end manual verification

**Files:** none (verification only).

- [ ] **Step 1: Reset DB + seed data, start app**

Run: `npx supabase db reset` (Docker up), then recreate the admin user (Auth Admin API), then `npm run dev`. Via `/admin`, ensure ≥2 active lines, ≥2 categories, and a few active products with variants in multiple colors; leave at least one line with **no** products.

- [ ] **Step 2: Header + menu checks**

- Header shows `[☰] [logo]` left and `[🔍] [🛍]` right.
- `☰` opens the drawer on both a narrow and a wide viewport (no persistent sidebar).
- Drawer "Líneas" links navigate to `/linea/[slug]` and close the drawer.
- Drawer "Categorías" toggles filter the current page in place; the URL gains `?cat=…`; toggling from a product page navigates to `/?cat=…`.

- [ ] **Step 3: Home / line checks (#1, #2)**

- Home shows a section per line **except** the empty line (hidden).
- No toolbar (search/filter bar) under the header.
- With a category active, sections collapse to one flat grid; clearing the category (toggle off) restores sections.

- [ ] **Step 4: Search checks (#4, #5)**

- `🔍` opens the full-screen overlay; typing shows product suggestions with thumbnail + name + price; rapid typing never shows stale results.
- Clicking a suggestion goes to `/producto/[id]`; pressing Enter or "Ver todos los resultados" goes to `/buscar?q=…`.
- `/buscar` lists matches; Línea + Color filters narrow results (multi-select), the URL reflects `?q=&line=&color=`, and "Limpiar" resets.

- [ ] **Step 5: Final checks**

Run: `npm test` → all PASS.
Run: `npm run build` → green.
Run: `npm run lint` → clean.

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "test: e2e verification fixes for search & navigation"
```

(If nothing needed fixing, skip the commit.)

---

## Self-Review

**Spec coverage:**
- #1 Hide empty lines → Task 5 (`lines.filter(l => items.some(...))`). ✓
- #2 Remove toolbar; filters only in menu → Task 5 (delete `CatalogFilterBar`, slim `CatalogBrowser`) + Task 6 (menu categories). ✓
- #3 Menu icon in header → Task 8 (`ShopChrome` header) + Task 6 (drawer-everywhere). ✓
- #4 Search icon + overlay + image autocomplete → Task 7 (`SearchOverlay`), Task 3 (`/api/search`), Task 2 (`searchSuggestions`), Task 8 (header button). ✓
- #5 `/buscar` with line + color filters → Task 4 (`/buscar` + `SearchResults`), Task 2 (`searchCatalog`), Task 1 (`lineSlugs` facet). ✓
- Server-side per-keystroke search (name+category) → Tasks 2 + 3 + 7. ✓
- URL-driven category filter → Tasks 5 (read) + 6 (write). ✓
- Drawer everywhere → Task 6 (no `md:` sidebar classes). ✓

**Placeholder scan:** No TBD/TODO; every code step has complete code. ✓

**Type consistency:** `CatalogItem` satisfies `FilterableItem` (has `lineSlug`, `categorySlug`, `categoryName`, `colors[].color`) — used by `SearchResults` (Task 4) and `CatalogBrowser` (Task 5) against the Task 1 predicate. `BrowserLine`/`BrowserCategory` defined+exported in `CatalogBrowser` (Task 5) and imported by `CatalogSideMenu` (Task 6) and `ShopChrome` (Task 8). `SearchSuggestion` (Task 2) returned by `/api/search` (Task 3) and consumed as `Suggestion` shape in `SearchOverlay` (Task 7) — fields match (`id`, `name`, `price`, `thumbnailUrl`). `searchCatalog`/`searchSuggestions` signatures (Task 2) match their callers (Tasks 3, 4). ✓

**Build sequencing:** Each task leaves a green build — search stack (1–4) is additive; the chrome refactor (5→6→7→8) removes the menu from `CatalogBrowser` before changing the menu's props, so no task references a renamed interface that doesn't yet exist. ✓
