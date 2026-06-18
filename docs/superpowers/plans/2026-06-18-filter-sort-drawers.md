# Filter & Sort Drawers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reusable Filtros + Ordenar bottom-sheet drawers (with price asc/desc sorting) to the `/buscar` and `/linea/[slug]` pages, driven by URL state.

**Architecture:** A shared client `ProductBrowser` renders a sticky filter/sort bar, two bottom sheets, and the product grid. It reads facet selections (`line`/`cat`/`color`) and `sort` from the URL via `useSearchParams` and writes them with `router.replace`. `/buscar` enables Línea+Color facets; `/linea/[slug]` enables Categoría+Color. Sorting is a pure `sortItems` helper. Reusable pieces: `BottomSheet`, `ProductGrid`, `FilterSortBar`, `FilterSheet`, `SortSheet`.

**Tech Stack:** Next.js 16 (App Router, client components), React 19, TypeScript, Tailwind v4, Vitest.

## Global Constraints

- **Language:** Spanish UI copy — "Filtros", "Ordenar", "Línea", "Categoría", "Color", "Limpiar", "Ver resultados (N)", "Predeterminado", "Precio: menor a mayor", "Precio: mayor a menor", "Sin resultados.", "Cerrar".
- **Money:** prices are integer centavos; sort numerically by `price`; never use floats; display via `formatMXN`.
- **State source of truth:** the URL. Facet params `line` / `cat` / `color` (comma lists) and `sort` (`price_asc` | `price_desc`; omit for default). Read with `useSearchParams`, write with `router.replace(pathname?…, { scroll:false })`, preserving unrelated params (e.g. `q`).
- **Drawers:** bottom sheets (slide up from bottom, dimmed backdrop, `z-50` above the `z-40` header); two of them (Filtros, Ordenar); dismiss via backdrop / ✕ / Esc.
- **Filter facets:** `/buscar` = Línea + Color; `/linea/[slug]` = Categoría + Color.
- **Sort options:** Predeterminado (server order) + Precio ↑ + Precio ↓.
- **Tests:** pure logic only, Vitest, colocated `*.test.ts`, run with `npm test`.
- **Per-task gate:** BOTH `npm run build` (compiles + routes) AND `npm run lint` (eslint — `next build` does NOT fail on these rules) must pass. Run `npm test` for the domain task and the wiring task. Neither build nor tests require the database.
- **JSX text:** use typographic curly quotes `“ ”` (not straight `"`) to satisfy `react/no-unescaped-entities`.

---

### Task 1: `sortItems` + `parseSortKey` domain helper

**Files:**
- Create: `src/domain/catalog-sort.ts`
- Test: `src/domain/catalog-sort.test.ts`

**Interfaces:**
- Produces:
  - `type SortKey = "default" | "price_asc" | "price_desc"`
  - `parseSortKey(v: string | null): SortKey` (unknown/null → `"default"`)
  - `sortItems<T extends { price: number }>(items: T[], sort: SortKey): T[]` (pure; stable; never mutates input)

- [ ] **Step 1: Write the failing test**

```ts
// src/domain/catalog-sort.test.ts
import { describe, it, expect } from "vitest";
import { sortItems, parseSortKey } from "@/domain/catalog-sort";

const items = [
  { id: "a", price: 300 },
  { id: "b", price: 100 },
  { id: "c", price: 200 },
  { id: "d", price: 100 },
];

describe("parseSortKey", () => {
  it("accepts the two price keys", () => {
    expect(parseSortKey("price_asc")).toBe("price_asc");
    expect(parseSortKey("price_desc")).toBe("price_desc");
  });
  it("falls back to default for unknown/null/default", () => {
    expect(parseSortKey(null)).toBe("default");
    expect(parseSortKey("whatever")).toBe("default");
    expect(parseSortKey("default")).toBe("default");
  });
});

describe("sortItems", () => {
  it("default returns original order, as a copy", () => {
    const r = sortItems(items, "default");
    expect(r.map((x) => x.id)).toEqual(["a", "b", "c", "d"]);
    expect(r).not.toBe(items);
  });
  it("price_asc sorts ascending, stable on ties", () => {
    expect(sortItems(items, "price_asc").map((x) => x.id)).toEqual(["b", "d", "c", "a"]);
  });
  it("price_desc sorts descending, stable on ties", () => {
    expect(sortItems(items, "price_desc").map((x) => x.id)).toEqual(["a", "c", "b", "d"]);
  });
  it("does not mutate the input", () => {
    const copy = items.slice();
    sortItems(items, "price_asc");
    expect(items).toEqual(copy);
  });
  it("handles empty input", () => {
    expect(sortItems([], "price_asc")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- catalog-sort`
Expected: FAIL — cannot find module `@/domain/catalog-sort`.

- [ ] **Step 3: Write the implementation**

```ts
// src/domain/catalog-sort.ts
export type SortKey = "default" | "price_asc" | "price_desc";

/** Parse a raw URL value into a SortKey; anything unrecognized → "default". */
export function parseSortKey(v: string | null): SortKey {
  return v === "price_asc" || v === "price_desc" ? v : "default";
}

/** Sort by price (stable); "default" returns a copy in the original order. Never mutates input. */
export function sortItems<T extends { price: number }>(items: T[], sort: SortKey): T[] {
  if (sort === "default") return items.slice();
  const dir = sort === "price_asc" ? 1 : -1;
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => (a.item.price - b.item.price) * dir || a.index - b.index)
    .map((x) => x.item);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- catalog-sort`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/catalog-sort.ts src/domain/catalog-sort.test.ts
git commit -m "feat(domain): sortItems + parseSortKey (price asc/desc, default)"
```

---

### Task 2: `BottomSheet` reusable UI component

**Files:**
- Create: `src/components/ui/BottomSheet.tsx`
- Modify: `src/components/ui/index.ts`

**Interfaces:**
- Produces: `BottomSheet` (named export) with props `{ open: boolean; onClose: () => void; title: string; children: React.ReactNode }`.

- [ ] **Step 1: Create `BottomSheet.tsx`**

```tsx
// src/components/ui/BottomSheet.tsx
"use client";

import { useEffect } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
};

/** Bottom sheet: dimmed backdrop + slide-up panel. Always mounted so it can animate;
 *  the backdrop ignores pointer events while closed. Esc closes. */
export function BottomSheet({ open, onClose, title, children }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <div
        className={`fixed inset-0 z-50 bg-ink/30 backdrop-blur-sm transition-opacity duration-200 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-label={title}
        className={`fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-2xl border-t border-line bg-white transition-transform duration-200 ease-out ${open ? "translate-y-0" : "translate-y-full"}`}
      >
        <div className="flex items-center justify-between border-b border-line p-4">
          <span className="font-display text-lg font-bold text-ink">{title}</span>
          <button type="button" aria-label="Cerrar" onClick={onClose} className="text-ink-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto p-4">{children}</div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Export it from the UI barrel**

Add to `src/components/ui/index.ts` (after the `FloatingBar` export line):

```ts
export { BottomSheet } from "./BottomSheet";
```

- [ ] **Step 3: Build + lint**

Run: `npm run build`
Expected: green.
Run: `npm run lint`
Expected: clean (0 problems).

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/BottomSheet.tsx src/components/ui/index.ts
git commit -m "feat(ui): reusable BottomSheet"
```

---

### Task 3: `ProductGrid` reusable grid

**Files:**
- Create: `src/app/(shop)/ProductGrid.tsx`

**Interfaces:**
- Consumes: `ProductCard` (`./ProductCard`), `productColors` (`@/domain/product-colors`), `CatalogItem` (`@/lib/repos/catalog`).
- Produces: `ProductGrid` (default export) with props `{ items: CatalogItem[] }`.

- [ ] **Step 1: Create `ProductGrid.tsx`**

```tsx
// src/app/(shop)/ProductGrid.tsx
import ProductCard from "./ProductCard";
import { productColors } from "@/domain/product-colors";
import type { CatalogItem } from "@/lib/repos/catalog";

export default function ProductGrid({ items }: { items: CatalogItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
      {items.map((p) => (
        <ProductCard key={p.id} id={p.id} name={p.name} price={p.price}
          images={p.images} colors={productColors(p.colors, p.images)} />
      ))}
      {items.length === 0 && <p className="text-sm text-ink-3">Sin resultados.</p>}
    </div>
  );
}
```

- [ ] **Step 2: Build + lint**

Run: `npm run build`
Expected: green.
Run: `npm run lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(shop)/ProductGrid.tsx"
git commit -m "feat(shop): reusable ProductGrid"
```

---

### Task 4: `FilterSortBar`

**Files:**
- Create: `src/app/(shop)/FilterSortBar.tsx`

**Interfaces:**
- Produces: `FilterSortBar` (default export) with props `{ activeFilterCount: number; sortLabel: string; onOpenFilter: () => void; onOpenSort: () => void }`.

- [ ] **Step 1: Create `FilterSortBar.tsx`**

```tsx
// src/app/(shop)/FilterSortBar.tsx
"use client";

type Props = {
  activeFilterCount: number;
  sortLabel: string;
  onOpenFilter: () => void;
  onOpenSort: () => void;
};

export default function FilterSortBar({ activeFilterCount, sortLabel, onOpenFilter, onOpenSort }: Props) {
  return (
    <div className="sticky top-[64px] z-30 flex items-center gap-2 border-b border-line bg-white/95 px-4 py-3 backdrop-blur">
      <button type="button" onClick={onOpenFilter}
        className="flex items-center gap-2 rounded-pill border border-line-strong px-4 py-1.5 text-sm text-ink transition hover:bg-mist">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
        Filtros
        {activeFilterCount > 0 && (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-pill bg-royal px-1 text-xs text-ink-on-royal">
            {activeFilterCount}
          </span>
        )}
      </button>
      <button type="button" onClick={onOpenSort}
        className="flex items-center gap-2 rounded-pill border border-line-strong px-4 py-1.5 text-sm text-ink transition hover:bg-mist">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="6" x2="21" y2="6" /><line x1="7" y1="12" x2="17" y2="12" /><line x1="10" y1="18" x2="14" y2="18" />
        </svg>
        {sortLabel}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Build + lint**

Run: `npm run build`
Expected: green.
Run: `npm run lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(shop)/FilterSortBar.tsx"
git commit -m "feat(shop): FilterSortBar (Filtros + Ordenar triggers)"
```

---

### Task 5: `FilterSheet`

**Files:**
- Create: `src/app/(shop)/FilterSheet.tsx`

**Interfaces:**
- Consumes: `BottomSheet` (`@/components/ui`).
- Produces:
  - `type ChipOption = { value: string; label: string }`
  - `type SwatchOption = { value: string; label: string; hex: string }`
  - `type FilterGroup = { key: string; label: string; type: "chips"; options: ChipOption[]; selected: string[] } | { key: string; label: string; type: "swatches"; options: SwatchOption[]; selected: string[] }`
  - `FilterSheet` (default export) props `{ open: boolean; onClose: () => void; groups: FilterGroup[]; onToggle: (groupKey: string, value: string) => void; onClear: () => void; resultCount: number }`

- [ ] **Step 1: Create `FilterSheet.tsx`**

```tsx
// src/app/(shop)/FilterSheet.tsx
"use client";

import { BottomSheet } from "@/components/ui";

export type ChipOption = { value: string; label: string };
export type SwatchOption = { value: string; label: string; hex: string };
export type FilterGroup =
  | { key: string; label: string; type: "chips"; options: ChipOption[]; selected: string[] }
  | { key: string; label: string; type: "swatches"; options: SwatchOption[]; selected: string[] };

type Props = {
  open: boolean;
  onClose: () => void;
  groups: FilterGroup[];
  onToggle: (groupKey: string, value: string) => void;
  onClear: () => void;
  resultCount: number;
};

export default function FilterSheet({ open, onClose, groups, onToggle, onClear, resultCount }: Props) {
  const anySelected = groups.some((g) => g.selected.length > 0);
  return (
    <BottomSheet open={open} onClose={onClose} title="Filtros">
      <div className="space-y-5">
        {groups.map((g) => (
          <div key={g.key}>
            <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-ink-3">{g.label}</div>
            {g.type === "chips" ? (
              <div className="flex flex-wrap gap-1.5">
                {g.options.map((o) => {
                  const on = g.selected.includes(o.value);
                  return (
                    <button key={o.value} type="button" onClick={() => onToggle(g.key, o.value)} aria-pressed={on}
                      className={`rounded-pill border px-3 py-1 text-xs transition ${on ? "border-transparent bg-royal text-ink-on-royal" : "border-line-strong text-ink-2 hover:text-ink"}`}>
                      {o.label}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {g.options.map((o) => {
                  const on = g.selected.includes(o.value);
                  return (
                    <button key={o.value} type="button" onClick={() => onToggle(g.key, o.value)} aria-label={o.label} title={o.label} aria-pressed={on}
                      className={`h-7 w-7 rounded-pill border border-line transition ${on ? "ring-2 ring-royal ring-offset-1" : ""}`}
                      style={{ background: o.hex }} />
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-6 flex items-center justify-between">
        {anySelected ? (
          <button type="button" onClick={onClear} className="text-sm text-royal hover:underline">Limpiar</button>
        ) : (
          <span />
        )}
        <button type="button" onClick={onClose} className="rounded-pill bg-royal px-5 py-2 text-sm text-ink-on-royal">
          Ver resultados ({resultCount})
        </button>
      </div>
    </BottomSheet>
  );
}
```

- [ ] **Step 2: Build + lint**

Run: `npm run build`
Expected: green.
Run: `npm run lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(shop)/FilterSheet.tsx"
git commit -m "feat(shop): FilterSheet (chips + swatches bottom sheet)"
```

---

### Task 6: `SortSheet`

**Files:**
- Create: `src/app/(shop)/SortSheet.tsx`

**Interfaces:**
- Consumes: `BottomSheet` (`@/components/ui`), `SortKey` (`@/domain/catalog-sort`).
- Produces: `SortSheet` (default export) props `{ open: boolean; onClose: () => void; value: SortKey; onChange: (v: SortKey) => void }`.

- [ ] **Step 1: Create `SortSheet.tsx`**

```tsx
// src/app/(shop)/SortSheet.tsx
"use client";

import { BottomSheet } from "@/components/ui";
import type { SortKey } from "@/domain/catalog-sort";

const OPTIONS: { value: SortKey; label: string }[] = [
  { value: "default", label: "Predeterminado" },
  { value: "price_asc", label: "Precio: menor a mayor" },
  { value: "price_desc", label: "Precio: mayor a menor" },
];

type Props = { open: boolean; onClose: () => void; value: SortKey; onChange: (v: SortKey) => void };

export default function SortSheet({ open, onClose, value, onChange }: Props) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Ordenar">
      <ul className="space-y-1">
        {OPTIONS.map((o) => {
          const on = o.value === value;
          return (
            <li key={o.value}>
              <button type="button" onClick={() => { onChange(o.value); onClose(); }} aria-pressed={on}
                className={`flex w-full items-center justify-between rounded-md px-3 py-3 text-left text-sm transition ${on ? "bg-mist text-ink" : "text-ink-2 hover:bg-mist hover:text-ink"}`}>
                {o.label}
                {on && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </BottomSheet>
  );
}
```

- [ ] **Step 2: Build + lint**

Run: `npm run build`
Expected: green.
Run: `npm run lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(shop)/SortSheet.tsx"
git commit -m "feat(shop): SortSheet (price asc/desc + default)"
```

---

### Task 7: `ProductBrowser` orchestrator

**Files:**
- Create: `src/app/(shop)/ProductBrowser.tsx`

**Interfaces:**
- Consumes: `ProductGrid` (`./ProductGrid`), `FilterSortBar` (`./FilterSortBar`), `FilterSheet` + `FilterGroup` (`./FilterSheet`), `SortSheet` (`./SortSheet`), `matchesFilters` (`@/domain/catalog-filter`), `aggregateColors` (`@/domain/catalog-colors`), `sortItems` + `parseSortKey` + `SortKey` (`@/domain/catalog-sort`), `CatalogItem` (`@/lib/repos/catalog`).
- Produces:
  - `type FacetKind = "line" | "category" | "color"`
  - `ProductBrowser` (default export) props `{ items: CatalogItem[]; facets: FacetKind[]; lineOptions?: { slug: string; name: string }[]; categoryOptions?: { slug: string; name: string }[] }`

- [ ] **Step 1: Create `ProductBrowser.tsx`**

```tsx
// src/app/(shop)/ProductBrowser.tsx
"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import ProductGrid from "./ProductGrid";
import FilterSortBar from "./FilterSortBar";
import FilterSheet, { type FilterGroup } from "./FilterSheet";
import SortSheet from "./SortSheet";
import { matchesFilters } from "@/domain/catalog-filter";
import { aggregateColors } from "@/domain/catalog-colors";
import { sortItems, parseSortKey, type SortKey } from "@/domain/catalog-sort";
import type { CatalogItem } from "@/lib/repos/catalog";

export type FacetKind = "line" | "category" | "color";

type Props = {
  items: CatalogItem[];
  facets: FacetKind[];
  lineOptions?: { slug: string; name: string }[];
  categoryOptions?: { slug: string; name: string }[];
};

const SORT_LABELS: Record<SortKey, string> = {
  default: "Ordenar",
  price_asc: "Precio ↑",
  price_desc: "Precio ↓",
};
const PARAM: Record<FacetKind, string> = { line: "line", category: "cat", color: "color" };

function parseList(v: string | null): string[] {
  return v ? v.split(",").filter(Boolean) : [];
}

export default function ProductBrowser({ items, facets, lineOptions = [], categoryOptions = [] }: Props) {
  const sp = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  const lineSel = parseList(sp.get("line"));
  const catSel = parseList(sp.get("cat"));
  const colorSel = parseList(sp.get("color"));
  const sort = parseSortKey(sp.get("sort"));
  const selFor = (facet: FacetKind) => (facet === "line" ? lineSel : facet === "category" ? catSel : colorSel);

  const swatches = useMemo(() => aggregateColors(items.flatMap((i) => i.colors)), [items]);

  const filtered = useMemo(() => {
    const f = {
      lineSlugs: facets.includes("line") ? lineSel : undefined,
      categorySlugs: facets.includes("category") ? catSel : undefined,
      colorKeys: facets.includes("color") ? colorSel : undefined,
    };
    return sortItems(items.filter((i) => matchesFilters(i, f)), sort);
  }, [items, facets, lineSel, catSel, colorSel, sort]);

  function writeParam(param: string, values: string[]) {
    const params = new URLSearchParams(sp.toString());
    if (values.length) params.set(param, values.join(","));
    else params.delete(param);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }
  function toggle(facet: FacetKind, value: string) {
    const cur = selFor(facet);
    const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
    writeParam(PARAM[facet], next);
  }
  function clearAll() {
    const params = new URLSearchParams(sp.toString());
    for (const f of facets) params.delete(PARAM[f]);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }
  function setSort(next: SortKey) {
    const params = new URLSearchParams(sp.toString());
    if (next === "default") params.delete("sort");
    else params.set("sort", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const groups: FilterGroup[] = facets.flatMap((facet) => {
    if (facet === "line")
      return [{ key: "line", label: "Línea", type: "chips" as const, options: lineOptions.map((l) => ({ value: l.slug, label: l.name })), selected: lineSel }];
    if (facet === "category")
      return [{ key: "category", label: "Categoría", type: "chips" as const, options: categoryOptions.map((c) => ({ value: c.slug, label: c.name })), selected: catSel }];
    return [{ key: "color", label: "Color", type: "swatches" as const, options: swatches.map((s) => ({ value: s.key, label: s.label, hex: s.hex })), selected: colorSel }];
  });

  const activeFilterCount = facets.reduce((n, f) => n + selFor(f).length, 0);

  return (
    <>
      <FilterSortBar
        activeFilterCount={activeFilterCount}
        sortLabel={SORT_LABELS[sort]}
        onOpenFilter={() => setFilterOpen(true)}
        onOpenSort={() => setSortOpen(true)}
      />
      <FilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        groups={groups}
        onToggle={(gk, v) => toggle(gk as FacetKind, v)}
        onClear={clearAll}
        resultCount={filtered.length}
      />
      <SortSheet open={sortOpen} onClose={() => setSortOpen(false)} value={sort} onChange={setSort} />
      <ProductGrid items={filtered} />
    </>
  );
}
```

- [ ] **Step 2: Build + lint**

Run: `npm run build`
Expected: green.
Run: `npm run lint`
Expected: clean (verify no `react-hooks/exhaustive-deps` warnings on the `useMemo` calls — the dependency arrays list exactly the referenced values).

- [ ] **Step 3: Commit**

```bash
git add "src/app/(shop)/ProductBrowser.tsx"
git commit -m "feat(shop): ProductBrowser orchestrator (URL-driven filters + sort)"
```

---

### Task 8: Wire `/buscar` + `/linea/[slug]` to `ProductBrowser`; adopt `ProductGrid`

**Files:**
- Modify: `src/app/(shop)/buscar/page.tsx`
- Delete: `src/app/(shop)/SearchResults.tsx`
- Modify: `src/app/(shop)/linea/[slug]/page.tsx`
- Modify: `src/app/(shop)/CatalogBrowser.tsx`

**Interfaces:**
- Consumes: `ProductBrowser` (`./ProductBrowser`), `ProductGrid` (`./ProductGrid`), `listCategories` (`@/lib/repos/categories`).

- [ ] **Step 1: Replace `buscar/page.tsx`**

```tsx
// src/app/(shop)/buscar/page.tsx
import { searchCatalog } from "@/lib/repos/catalog";
import { listActiveLines } from "@/lib/repos/lines";
import ProductBrowser from "../ProductBrowser";

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
    <main className="min-w-0">
      <h1 className="px-4 pt-4 text-lg text-ink">Resultados para “{query}”</h1>
      <ProductBrowser
        items={items}
        facets={["line", "color"]}
        lineOptions={lines.map((l) => ({ slug: l.slug, name: l.name }))}
      />
    </main>
  );
}
```

- [ ] **Step 2: Delete `SearchResults.tsx`**

```bash
git rm "src/app/(shop)/SearchResults.tsx"
```

- [ ] **Step 3: Replace `linea/[slug]/page.tsx`**

```tsx
// src/app/(shop)/linea/[slug]/page.tsx
import { notFound } from "next/navigation";
import { getActiveLineBySlug } from "@/lib/repos/lines";
import { listCategories } from "@/lib/repos/categories";
import { listActiveCatalogByLine } from "@/lib/repos/catalog";
import ProductBrowser from "../../ProductBrowser";
import LineHero from "../../LineHero";

export default async function LinePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const line = await getActiveLineBySlug(slug);
  if (!line) notFound();

  const [categories, items] = await Promise.all([
    listCategories(),
    listActiveCatalogByLine(line.id),
  ]);

  const heroLine = { slug: line.slug, name: line.name, hero_title: line.hero_title, hero_message: line.hero_message };

  return (
    <>
      <LineHero line={heroLine} />
      <main className="min-w-0">
        <ProductBrowser
          items={items}
          facets={["category", "color"]}
          categoryOptions={categories.map((c) => ({ slug: c.slug, name: c.name }))}
        />
      </main>
    </>
  );
}
```

- [ ] **Step 4: Refactor `CatalogBrowser.tsx` to use `ProductGrid`**

```tsx
// src/app/(shop)/CatalogBrowser.tsx
"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import ProductGrid from "./ProductGrid";
import LineHero from "./LineHero";
import { matchesFilters } from "@/domain/catalog-filter";
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

  return (
    <main className="min-w-0">
      {showSections && !active
        ? lines
            .filter((l) => items.some((i) => i.lineSlug === l.slug))
            .map((l) => (
              <section key={l.slug} className="mb-10">
                <LineHero line={l} />
                <ProductGrid items={items.filter((i) => i.lineSlug === l.slug)} />
              </section>
            ))
        : <ProductGrid items={filtered} />}
    </main>
  );
}
```

- [ ] **Step 5: Build + lint + test**

Run: `npm run build`
Expected: green; routes include `/`, `/linea/[slug]`, `/buscar`, `/api/search`.
Run: `npm run lint`
Expected: clean.
Run: `npm test`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(shop)/buscar/page.tsx" "src/app/(shop)/linea/[slug]/page.tsx" "src/app/(shop)/CatalogBrowser.tsx"
git commit -m "feat(shop): filter+sort drawers on /buscar and /linea via ProductBrowser"
```

---

### Task 9: End-to-end manual verification

**Files:** none (verification only).

- [ ] **Step 1: Start the app**

Run: `npx supabase db reset` (Docker up), recreate the admin user, `npm run dev`. Ensure ≥2 lines, several categories, and active products across multiple categories + colors, with varied prices.

- [ ] **Step 2: `/buscar` checks**

- Search something from the header overlay → land on `/buscar?q=…`.
- A sticky bar shows **Filtros** + **Ordenar**.
- **Filtros** opens a bottom sheet with **Línea** chips + **Color** swatches; toggling narrows the grid, updates the URL (`?q=&line=&color=`), the Filtros badge shows the count; "Limpiar" resets; "Ver resultados (N)" closes.
- **Ordenar** opens a sheet with Predeterminado / Precio ↑ / Precio ↓; choosing reorders the grid and persists (`?sort=`), the button label reflects it.
- Sheets dismiss via backdrop / ✕ / Esc.

- [ ] **Step 3: `/linea/[slug]` checks**

- Visit a line page → hero + the same Filtros/Ordenar bar.
- Filtros sheet shows **Categoría** chips + **Color** swatches (no Línea); filtering + sort work and persist in the URL.
- The global header menu's category toggle and the line page's category filter stay in sync (both `?cat=`).

- [ ] **Step 4: Regression checks**

- Home page still renders marketing sections (empty lines hidden) and the grid via `ProductGrid`.
- `npm test` → all PASS · `npm run build` → green · `npm run lint` → clean.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "test: e2e verification fixes for filter & sort drawers"
```

(If nothing needed fixing, skip the commit.)

---

## Self-Review

**Spec coverage:**
- Filtros + Ordenar buttons opening drawers → Tasks 4 (bar), 5 (filter sheet), 6 (sort sheet), 2 (bottom sheet), 7 (wiring into bar). ✓
- Bottom sheets → Task 2. ✓
- Sort price asc/desc + default → Tasks 1 (`sortItems`/`parseSortKey`), 6 (sheet), 7 (apply). ✓
- `/buscar` facets Línea+Color · `/linea` facets Categoría+Color → Task 8 (`facets` props). ✓
- Reusable components → `BottomSheet`, `ProductGrid`, `FilterSortBar`, `FilterSheet`, `SortSheet`, `ProductBrowser` (Tasks 2–7), shared by both pages (Task 8). ✓
- URL-driven state preserving `q` → Task 7 (`writeParam`/`setSort` clone `sp`). ✓
- Line-page/menu `?cat=` sync → Task 7 reads `cat` from `useSearchParams`; Task 8 line page uses `category` facet. ✓

**Placeholder scan:** No TBD/TODO; every code step is complete. ✓

**Type consistency:** `SortKey` defined in Task 1, consumed by Tasks 6 + 7. `FilterGroup`/`ChipOption`/`SwatchOption` defined in Task 5, consumed by Task 7. `FacetKind` + `ProductBrowser` props defined in Task 7, consumed by Task 8. `CatalogItem` carries `price` (satisfies `sortItems` constraint) and `colors`/`lineSlug`/`categorySlug` (satisfies `matchesFilters`). `BottomSheet` named export (Task 2) imported by Tasks 5 + 6. ✓

**Build sequencing:** Tasks 1–7 add unused modules (build/lint green throughout); Task 8 wires them in and deletes `SearchResults` in the same commit that stops importing it. ✓
