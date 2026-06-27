# CORVE — Multiple Images Per Color — Design Spec

**Date:** 2026-06-26
**Status:** Approved design, pending implementation plan
**Builds on:** [2026-06-16 Per-Color Product Images](2026-06-16-per-color-product-images-design.md), which scoped to **one image per color**. This design lifts that limit.

---

## 1. Overview

Each color owns an **ordered list** of images instead of a single one. Admins upload as many images as they want per color, reorder them by **drag-and-drop**, and the first image in the order is the **primary** — shown on the catalog grid tile and as the main image when that color is selected.

On the storefront, selecting a color shows **only that color's images** (in admin-defined order). A color with no images of its own falls back to the **Default/untagged** image(s); a product with no images at all shows the existing gradient placeholder.

This evolves the prior per-color design, whose "multiple images per color / carousel" was explicitly out of scope.

### Success criteria
- Uploading several images to one color keeps them all (no more replace-on-upload).
- Admin can drag to reorder images within a color; the first is marked "Principal" and drives the grid tile + main image.
- Storefront detail: selecting a color shows that color's images in admin order; a color with no images falls back to the Default image(s).
- Grid tile shows the selected color's **primary** image (Default when that color has none).
- Deleting one image leaves the rest of that color's images intact.

### Out of scope (YAGNI)
- Reordering images **across** colors (drag is within a single color group only).
- Per-size images (images remain keyed by **color**, shared across that color's sizes).
- Zoom/lightbox, cropping/editing.
- Touch-drag polish — native HTML5 DnD targets the desktop admin; touch is best-effort.

---

## 2. Data model — no migration required

The existing `product_images` table already supports this:

```
product_images (
  id         uuid pk,
  product_id uuid fk -> products,
  url        text,
  sort_order integer not null default 0,
  color      text null
)
```

- **No unique constraint** on `(product_id, color)` exists — multiple rows per color are already legal at the schema level.
- The only thing enforcing "one image per color" today is the **replace logic inside `addProductImage`** (it deletes existing rows for the `(product, color)` before inserting). Removing that is the core change.
- `sort_order` becomes the **per-color ordering** key: images are ordered ascending within each color group; the lowest `sort_order` in a group is that color's **primary**. `color IS NULL` (Default) is its own group.
- Read queries currently **do not order images at all** — they must order by `sort_order` (or the domain must sort; see §3).
- **RLS unchanged** — adding more rows to an already-readable/writable table needs no policy change.

No SQL migration is added.

---

## 3. Domain selectors — `src/domain/product-image.ts`

`ImageChoice` gains `sortOrder` so the pure functions order deterministically regardless of query order:

```ts
export interface ImageChoice {
  url: string;
  color: string | null;
  sortOrder: number;
}

/**
 * Ordered images to display for a selected color (the storefront gallery):
 *  - the color's own images, sorted by sortOrder ascending;
 *  - else the Default images (color === null), sorted ascending;
 *  - else [] (caller shows the gradient placeholder).
 */
export function imagesForColor(images: ImageChoice[], color: string | null): ImageChoice[];

/**
 * The primary image URL for a color = the first of imagesForColor(images, color),
 * or null when there are none. Used by the grid tile, the cart line image, and the
 * detail hero default. (Pass null to get the Default primary.)
 */
export function pickProductImage(images: ImageChoice[], color: string | null): string | null;
```

`pickProductImage` is reimplemented on top of `imagesForColor` (first element's `url`, else `null`), preserving all its current callers.

**Unit tests (TDD):**
- `imagesForColor`: orders a color's images by `sortOrder`; falls back to Default when the color has none; returns `[]` for an empty list / a color with no images and no default.
- `pickProductImage`: primary = first by `sortOrder`; Default fallback; `null` when empty.

---

## 4. Admin — drag-and-drop gallery

Location: `src/app/admin/products/[id]/`.

The current flat thumbnail wrap (in `page.tsx`) becomes a **client component `ImageGallery.tsx`** that groups thumbnails **by color** — one section per color plus a "Default" section — each section listing its images in `sort_order`.

- **Reorder:** native HTML5 drag-and-drop (`draggable` + `onDragStart` / `onDragOver` / `onDrop`) **within a single color group** — no new dependency. The component keeps optimistic local order; on drop it calls a server action `reorderImages(productId, color, orderedIds[])` that rewrites `sort_order` for that group and revalidates. Dragging a thumbnail to the front of its group makes it the primary.
- **Primary badge:** the first thumbnail in each group shows a "Principal" pill so it is obvious which image drives the grid tile and the main image.
- **Upload:** the existing color `<select>` upload form stays; the file `<input>` gains `multiple` so several images can be added at once. `addProductImage` now **appends** — it computes the next `sort_order = max(sort_order in that group) + 1` instead of deleting existing rows.
- **Delete:** unchanged per-image delete (already implemented).

**Server actions (`actions.ts`):**
- `uploadImage` — handle one *or many* files (iterate the `FormData` file entries), each appended to the selected color.
- `reorderImages(productId, color, orderedIds[])` — **new**; persists the new order for one color group.
- `deleteImage` — unchanged.

**Repo (`src/lib/repos/products.ts`):**
- `addProductImage(productId, file, color)` — drop the replace step; compute next `sort_order` for the `(product, color)` group and insert.
- `reorderImages(productId, color, orderedIds[])` — **new**; assign `sort_order = index` to each id in order (scoped to that product + color group).
- `listImages` — order by `color` then `sort_order` for stable grouping.

If a product has no variants yet, the upload dropdown shows only "Default" (unchanged from prior design).

---

## 5. Storefront — color-filtered gallery

`src/app/(shop)/producto/[id]/ProductDetailClient.tsx`:

- The gallery's thumbnail strip + main image switch from "all images" to **`imagesForColor(images, color)`**.
- Selecting a color rebuilds the strip to just that color's images (admin order) and resets the main image to that color's primary.
- Clicking a thumbnail swaps the main image **within the current color** (it no longer cross-jumps to another color).
- A color with no images of its own falls back to the Default image(s), then to the gradient placeholder.
- The "Agregado al carrito" modal and the cart line image keep calling `pickProductImage(images, color)` → now the color's primary.

`src/app/(shop)/ProductCard.tsx` (grid) already calls `pickProductImage(images, selectedColor)` → now returns that color's **primary** image (Default when the color has none). No structural change; works once ordering is fixed.

**Repos surface `sortOrder`:** `catalog.ts` (and any `products.ts` path that builds `ImageChoice`) add `sort_order` to their `product_images(...)` selects and map it to `sortOrder` so the domain functions can order. `getActiveProduct` (`product_images(*)`) already returns `sort_order`; map it through.

---

## 6. Data flow

1. Admin uploads one or more images to a color → appended `product_images` rows with increasing `sort_order` in that group.
2. Admin drags to reorder within a color → `reorderImages` rewrites that group's `sort_order`; first = primary.
3. Storefront detail (client) → `imagesForColor(images, selectedColor)` → filtered, ordered gallery; main image = primary, reactive to color.
4. Grid (server) + cart → `pickProductImage(images, color)` → that color's primary (Default fallback).

---

## 7. Testing

- **Unit (TDD):** `imagesForColor` (ordering within a color, default fallback, empty) and `pickProductImage` (primary = first, fallback, null).
- **Build/typecheck:** `sortOrder` threads through `ImageChoice` and every construction site (`catalog.ts`, `products.ts`, components).
- **Browser E2E:** upload 3 images to "Negro"; drag to reorder → the front one shows "Principal"; on the storefront, selecting Negro shows all 3 in that order with the primary as the main image; select a color with no images → shows Default; the grid tile shows Negro's primary; delete one image → the others remain.

---

## 8. Files touched

- **Modify:** `src/domain/product-image.ts` (+ `product-image.test.ts`) — add `sortOrder`, `imagesForColor`, rework `pickProductImage`.
- **Modify:** `src/lib/repos/products.ts` — append in `addProductImage`, new `reorderImages`, order `listImages`.
- **Modify:** `src/lib/repos/catalog.ts` — add `sort_order` to `product_images(...)` selects, surface `sortOrder`.
- **Modify:** `src/app/admin/products/[id]/actions.ts` — `reorderImages` action, multi-file `uploadImage`.
- **Create:** `src/app/admin/products/[id]/ImageGallery.tsx` — client drag-and-drop gallery grouped by color.
- **Modify:** `src/app/admin/products/[id]/page.tsx` — render `ImageGallery` in place of the flat thumbnail wrap.
- **Modify:** `src/app/(shop)/producto/[id]/ProductDetailClient.tsx` — color-filtered gallery via `imagesForColor`.
- **No migration.** `ProductImageRow` in `db-types.ts` already has `sort_order` and `color`.
