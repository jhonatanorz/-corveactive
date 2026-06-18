# CORVE — Filter & Sort Drawers (reusable) — Design

- **Date:** 2026-06-18
- **Status:** Approved (design), pending implementation plan
- **Branch base:** `catalog-taxonomy-and-search`
- **Builds on:** `2026-06-18-storefront-search-navigation-design.md`

## Problem

The search page (`/buscar`) shows filters as inline pills/swatches and has no sort.
Line pages (`/linea/[slug]`) have no in-page filters or sort at all. We want both
pages to expose **Filtros** and **Ordenar** buttons that open bottom-sheet drawers,
add price ascending/descending sorting, and share reusable components.

## Decisions (resolved during brainstorming)

| Topic | Decision |
| --- | --- |
| Filter facets — `/buscar` | **Línea + Color** |
| Filter facets — `/linea/[slug]` | **Categoría + Color** |
| Sort options | **Predeterminado** (newest, server order) + **Precio ↑** + **Precio ↓** |
| Drawer style | **Bottom sheet** (slide-up + dimmed backdrop) |
| Drawer count | **Two** — one for Filtros, one for Ordenar |
| State source of truth | **URL** (`?line=&cat=&color=&sort=`), read reactively |

## Architecture

A single client orchestrator, **`ProductBrowser`**, renders the filter/sort bar, both
bottom sheets, and the product grid. It is driven entirely by the URL: it reads facet
selections + sort from `useSearchParams()` and writes them with
`router.replace(pathname?…, { scroll:false })`, preserving any unrelated param (e.g.
`q` on `/buscar`). Both `/buscar` and `/linea/[slug]` render `ProductBrowser` with a
page-specific facet list. The home page is unchanged.

Using the URL as the single source of truth (rather than local component state) keeps
filters/sort shareable, keeps the in-page drawer and the global header menu in sync on
line pages (both use `?cat=`), and avoids the dual-source-of-truth stale-state bugs seen
previously.

**Trade-off:** on `/buscar`, the page is server-rendered from `q`, so each facet/sort
toggle re-runs `searchCatalog(q)` (returns the same set). At boutique catalog scale this
query is cheap; the consistency + bug-resistance is worth it.

## Components

### `BottomSheet` (new, client) — `src/components/ui/BottomSheet.tsx`

Generic, presentational. Props `{ open: boolean; onClose: () => void; title: string; children: React.ReactNode }`.
- Returns `null` when `!open`.
- Renders a fixed dimmed backdrop (`onClick={onClose}`, `aria-hidden`) and a bottom panel
  that slides up (`translate-y` transition), pinned to the viewport bottom, rounded top,
  `max-h` with internal scroll, `z-50` (above the `z-40` header).
- Header row: `title` + a close button (✕, `aria-label="Cerrar"`).
- Esc closes (keydown listener bound only while open, cleaned up on unmount/close).
- Exported from `src/components/ui/index.ts`.

### `ProductGrid` (new) — `src/app/(shop)/ProductGrid.tsx`

Extracted shared grid. Props `{ items: CatalogItem[] }`.
- Renders `grid grid-cols-2 gap-3 p-4 md:grid-cols-3 md:gap-4 lg:grid-cols-4` of
  `ProductCard` (using `productColors(p.colors, p.images)`); empty → `<p>` "Sin resultados.".
- Used by `ProductBrowser` and `CatalogBrowser`.

### `FilterSortBar` (new, client) — `src/app/(shop)/FilterSortBar.tsx`

Props `{ activeFilterCount: number; sortLabel: string; onOpenFilter: () => void; onOpenSort: () => void }`.
- Sticky bar (`sticky top-[64px] z-30`, border-bottom, white/blur) with two buttons:
  - **Filtros** (funnel icon) — shows a count badge when `activeFilterCount > 0`.
  - **Ordenar** (arrows icon) — shows `sortLabel`.

### `FilterSheet` (new, client) — `src/app/(shop)/FilterSheet.tsx`

Renders a `BottomSheet title="Filtros"`. Props:
```ts
type ChipOption = { value: string; label: string };
type SwatchOption = { value: string; label: string; hex: string };
type FilterGroup =
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
```
- Each group: a label + chips (pills, `aria-pressed`) or swatches (color buttons,
  `aria-label`, `aria-pressed`), matching the existing pill/swatch styling.
- Footer: "Limpiar" (left, when any selected) + "Ver resultados (N)" primary button
  (closes the sheet). Toggles call `onToggle` (apply immediately via URL).

### `SortSheet` (new, client) — `src/app/(shop)/SortSheet.tsx`

Renders a `BottomSheet title="Ordenar"`. Props `{ open; onClose; value: SortKey; onChange: (v: SortKey) => void }`.
- Radio-style list: **Predeterminado** (`default`), **Precio: menor a mayor** (`price_asc`),
  **Precio: mayor a menor** (`price_desc`). Selecting calls `onChange` then `onClose`.

### `ProductBrowser` (new, client) — `src/app/(shop)/ProductBrowser.tsx`

The orchestrator both pages use.
```ts
type FacetKind = "line" | "category" | "color";
type Props = {
  items: CatalogItem[];
  facets: FacetKind[];                          // e.g. ["line","color"] or ["category","color"]
  lineOptions?: { slug: string; name: string }[];     // required iff "line" ∈ facets
  categoryOptions?: { slug: string; name: string }[]; // required iff "category" ∈ facets
};
```
Behavior:
- URL param per facet: `line` → `lineSlugs`; `category` → `cat` → `categorySlugs`;
  `color` → `colorKeys`. Sort param: `sort`.
- Reads current values from `useSearchParams()` (comma lists; `sort` parsed to a valid
  `SortKey`, default `"default"`).
- `filtered = sortItems(items.filter(i => matchesFilters(i, builtFilters)), sort)`, where
  `builtFilters` includes only the enabled facets.
- Color swatch options derived via `aggregateColors(items.flatMap(i => i.colors))`.
- Writes: clone `new URLSearchParams(sp.toString())`, set/delete the relevant param,
  `router.replace(\`${pathname}?${params}\`, { scroll:false })` (preserves `q`).
- `activeFilterCount` = total selected across enabled facets. `sortLabel` from sort key.
- Renders `<FilterSortBar>`, `<FilterSheet>`, `<SortSheet>`, `<ProductGrid items={filtered}>`;
  owns the two sheets' open booleans in local `useState`.

## Domain

### `catalog-sort.ts` (new) — `src/domain/catalog-sort.ts`

```ts
export type SortKey = "default" | "price_asc" | "price_desc";
export function parseSortKey(v: string | null): SortKey; // unknown → "default"
export function sortItems<T extends { price: number }>(items: T[], sort: SortKey): T[];
```
- `default` → returns a copy in original order (server's newest-first).
- `price_asc` / `price_desc` → stable sort by `price` (ascending / descending), not
  mutating the input.

`matchesFilters` (with its optional `lineSlugs`/`categorySlugs`/`colorKeys` facets) is reused as-is.

## Per-page wiring

- **`/buscar`** (`src/app/(shop)/buscar/page.tsx`): keep the "Resultados para “{q}”"
  heading; render `<ProductBrowser items={searchCatalog(q)} facets={["line","color"]}
  lineOptions={lines} />`. **Delete `SearchResults.tsx`** (its inline pills/swatches,
  `window.history` sync, `key={query}` remount, and seq-guard concerns are superseded by
  `ProductBrowser`).
- **`/linea/[slug]`** (`src/app/(shop)/linea/[slug]/page.tsx`): after `<LineHero>`, render
  `<ProductBrowser items={lineItems} facets={["category","color"]} categoryOptions={categories} />`
  instead of `<CatalogBrowser>`. Load `listCategories()` for the options.
- **Home (`/`)**: unchanged behavior; `CatalogBrowser` keeps marketing sections + global-menu
  category filtering, and adopts `ProductGrid` for the grid (DRY). No drawers on home.

## Files touched

- `src/components/ui/BottomSheet.tsx` (new) + `src/components/ui/index.ts` (export)
- `src/app/(shop)/ProductGrid.tsx` (new)
- `src/app/(shop)/FilterSortBar.tsx` (new)
- `src/app/(shop)/FilterSheet.tsx` (new)
- `src/app/(shop)/SortSheet.tsx` (new)
- `src/app/(shop)/ProductBrowser.tsx` (new)
- `src/domain/catalog-sort.ts` (new) + `src/domain/catalog-sort.test.ts` (new)
- `src/app/(shop)/buscar/page.tsx` (use `ProductBrowser`; render heading)
- `src/app/(shop)/SearchResults.tsx` (delete)
- `src/app/(shop)/linea/[slug]/page.tsx` (use `ProductBrowser`; load categories)
- `src/app/(shop)/CatalogBrowser.tsx` (use `ProductGrid`)

## Testing

- **Unit (Vitest):** `sortItems` (price_asc, price_desc, default passthrough, empty input,
  stable on ties, input not mutated) and `parseSortKey` (valid keys, unknown/null → default).
- **Manual:** on `/buscar` and `/linea/[slug]` — Filtros button opens a bottom sheet with
  the right facets; toggles filter the grid and update the URL; "Limpiar" resets; Ordenar
  button opens the sort sheet; Precio ↑/↓ reorders the grid and persists in the URL;
  bottom sheets dismiss via backdrop/✕/Esc; line-page category filter stays in sync with
  the global menu (`?cat=`).

## Out of scope (YAGNI)

- Sort by name / popularity / relevance; server-side sorting.
- Price-range or size facets; drawers on the home page.
- Persisting sort/filters beyond the URL (no localStorage).

## Risks

- **`/buscar` re-fetch per toggle:** URL-driven filters re-run `searchCatalog(q)` server-side
  on each toggle. Cheap at boutique scale; flagged so the reviewer expects it.
- **Sheet open-state across soft navigation:** `router.replace` re-renders but does not
  remount `ProductBrowser`, so the sheet's `useState` open flag persists while toggling —
  intended.
- **Param sync with the global menu:** the line-page category facet and the global menu both
  use `?cat=` read reactively, so they stay consistent — relies on `ProductBrowser` reading
  from `useSearchParams` (not seeding local state).
