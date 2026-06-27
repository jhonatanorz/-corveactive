# Multiple Images Per Color Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each product color own an ordered list of images — admins upload many per color and drag to reorder (first = primary); the storefront shows only the selected color's images.

**Architecture:** App-layer only — the `product_images` table already permits multiple rows per `(product_id, color)`, so no migration. `sort_order` becomes the per-color ordering key. A pure domain function `imagesForColor` filters+orders images for a color (falling back to the Default/untagged group); `pickProductImage` (primary URL) is rebuilt on top of it. The admin editor gets a client `ImageGallery` with native HTML5 drag-and-drop that persists order via a server action; the storefront detail gallery switches from "all images" to `imagesForColor`.

**Tech Stack:** Next.js 16 (App Router, server actions), React 19, Supabase (Postgres + Storage), Tailwind v4, Vitest. Spanish UI copy.

## Global Constraints

- **No SQL migration.** The schema already supports multiple images per color; do not add a migration file.
- Images are keyed by **color** only (shared across that color's sizes). `color IS NULL` = the Default/untagged group.
- Ordering is **per-color**: images are ordered by `sort_order` ascending within their color group; the lowest = primary. Drag-and-drop reorders **within a single color group only**.
- **No new npm dependencies** — use native HTML5 drag-and-drop (`draggable` + `onDragStart`/`onDragOver`/`onDrop`).
- Follow the existing **server-action + `revalidatePath`** pattern (see `actions.ts`); all admin mutations go through it.
- UI copy is **Spanish** (e.g. "Principal", "imágenes subidas").
- Verify with `npx vitest run` (unit) and `npx tsc --noEmit` (typecheck); use `npm run dev` + browser for E2E (prefer dev — prod build OOMs on this machine).

---

### Task 1: Domain — `imagesForColor` + ordered `pickProductImage`

**Files:**
- Modify: `src/domain/product-image.ts`
- Test: `src/domain/product-image.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface ImageChoice { url: string; color: string | null; sortOrder: number }`
  - `function imagesForColor(images: ImageChoice[], color: string | null): ImageChoice[]`
  - `function pickProductImage(images: ImageChoice[], color: string | null): string | null`

> Note: adding the required `sortOrder` field means construction sites in `src/lib/repos/*` and pages won't typecheck until Task 2. That is expected; Task 1's gate is the domain unit test (`vitest`), Task 2 restores a clean `tsc`.

- [ ] **Step 1: Rewrite the test file**

Replace the entire contents of `src/domain/product-image.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { pickProductImage, imagesForColor, type ImageChoice } from "@/domain/product-image";

const imgs: ImageChoice[] = [
  { url: "default-a.jpg", color: null, sortOrder: 0 },
  { url: "negro-2.jpg", color: "Negro", sortOrder: 1 },
  { url: "negro-1.jpg", color: "Negro", sortOrder: 0 },
];

describe("imagesForColor", () => {
  it("returns the color's own images ordered by sortOrder", () => {
    expect(imagesForColor(imgs, "Negro").map((i) => i.url)).toEqual(["negro-1.jpg", "negro-2.jpg"]);
  });
  it("falls back to the default group when the color has no images", () => {
    expect(imagesForColor(imgs, "Arena").map((i) => i.url)).toEqual(["default-a.jpg"]);
  });
  it("returns the default group (ordered) when color is null", () => {
    const two: ImageChoice[] = [
      { url: "d2.jpg", color: null, sortOrder: 1 },
      { url: "d1.jpg", color: null, sortOrder: 0 },
    ];
    expect(imagesForColor(two, null).map((i) => i.url)).toEqual(["d1.jpg", "d2.jpg"]);
  });
  it("returns [] when there are no images at all", () => {
    expect(imagesForColor([], "Negro")).toEqual([]);
  });
  it("returns [] when the color has no images and there is no default", () => {
    expect(imagesForColor([{ url: "n.jpg", color: "Negro", sortOrder: 0 }], "Arena")).toEqual([]);
  });
});

describe("pickProductImage", () => {
  it("returns the primary (lowest sortOrder) image of the color", () => {
    expect(pickProductImage(imgs, "Negro")).toBe("negro-1.jpg");
  });
  it("falls back to the default primary when the color has no image", () => {
    expect(pickProductImage(imgs, "Arena")).toBe("default-a.jpg");
  });
  it("returns the default primary when color is null (grid)", () => {
    expect(pickProductImage(imgs, null)).toBe("default-a.jpg");
  });
  it("returns null when there are no images", () => {
    expect(pickProductImage([], "Negro")).toBeNull();
  });
  it("returns null when no default and the color has no image", () => {
    expect(pickProductImage([{ url: "n.jpg", color: "Negro", sortOrder: 0 }], "Arena")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/domain/product-image.test.ts`
Expected: FAIL — `imagesForColor` is not exported / `sortOrder` missing from `ImageChoice`.

- [ ] **Step 3: Rewrite `product-image.ts`**

Replace the entire contents of `src/domain/product-image.ts`:

```ts
export interface ImageChoice {
  url: string;
  color: string | null;
  sortOrder: number;
}

const byOrder = (xs: ImageChoice[]): ImageChoice[] =>
  [...xs].sort((a, b) => a.sortOrder - b.sortOrder);

/**
 * Ordered images to show for a selected color (the storefront gallery):
 *  - the color's own images, sorted by sortOrder ascending;
 *  - else the Default images (color === null), sorted ascending;
 *  - else [] (caller shows the gradient placeholder).
 * Pass null to get the Default group directly.
 */
export function imagesForColor(images: ImageChoice[], color: string | null): ImageChoice[] {
  if (color !== null) {
    const own = images.filter((i) => i.color === color);
    if (own.length > 0) return byOrder(own);
  }
  return byOrder(images.filter((i) => i.color === null));
}

/**
 * The primary image URL for a color = the first of imagesForColor(images, color),
 * or null when there are none. Used by the grid tile, the cart line image, and the
 * detail hero default.
 */
export function pickProductImage(images: ImageChoice[], color: string | null): string | null {
  const list = imagesForColor(images, color);
  return list.length > 0 ? list[0].url : null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/domain/product-image.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/product-image.ts src/domain/product-image.test.ts
git commit -m "feat(images): per-color ordered image selectors"
```

---

### Task 2: Thread `sortOrder` through repos and consumers

**Files:**
- Modify: `src/lib/repos/catalog.ts`
- Modify: `src/lib/repos/products.ts:92-105` (`imagesByProducts`)
- Modify: `src/app/(shop)/producto/[id]/page.tsx:11`

**Interfaces:**
- Consumes: `ImageChoice` (with `sortOrder`) from Task 1.
- Produces: every `ImageChoice` constructed in the codebase now carries `sortOrder`; `CatalogItem.images: ImageChoice[]`. No behavior change (still one image per color at this point).

- [ ] **Step 1: Update `catalog.ts` — select, types, mappers**

In `src/lib/repos/catalog.ts`:

Add the import of the type (top of file, alongside existing imports):

```ts
import type { ImageChoice } from "@/domain/product-image";
```

Change `CatalogItem.images` (currently `images: { url: string; color: string | null }[];`) to:

```ts
  images: ImageChoice[];
```

Change `CATALOG_SELECT` to fetch `sort_order`:

```ts
const CATALOG_SELECT =
  "id,name,price,product_lines!inner(slug),product_categories!inner(slug,name),product_images(url,color,sort_order),variants(color,color_hex)";
```

Change `CatalogRaw.product_images` to include `sort_order`:

```ts
  product_images: { url: string; color: string | null; sort_order: number }[] | null;
```

Change the `images:` line inside `toItem` (currently `images: r.product_images ?? [],`) to map to `ImageChoice`:

```ts
    images: (r.product_images ?? []).map((i) => ({ url: i.url, color: i.color, sortOrder: i.sort_order })),
```

Update `SuggestRaw.product_images` to include `sort_order`:

```ts
  product_images: { url: string; color: string | null; sort_order: number }[] | null;
```

Update the `searchSuggestions` select and `pickProductImage` call:

```ts
export async function searchSuggestions(q: string): Promise<SearchSuggestion[]> {
  const rows = await searchRows<SuggestRaw>("id,name,price,product_images(url,color,sort_order)", q, 8);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    price: r.price,
    thumbnailUrl: pickProductImage(
      (r.product_images ?? []).map((i) => ({ url: i.url, color: i.color, sortOrder: i.sort_order })),
      null,
    ),
  }));
}
```

`getActiveProduct` already selects `product_images(*)` (includes `sort_order`) — no change there.

- [ ] **Step 2: Update `imagesByProducts` in `products.ts`**

In `src/lib/repos/products.ts`, change the select and the row mapping in `imagesByProducts` (lines ~97–104):

```ts
  const { data, error } = await supabase
    .from("product_images").select("product_id,url,color,sort_order").in("product_id", ids);
  if (error) throw error;
  const out: Record<string, ImageChoice[]> = {};
  for (const r of (data ?? []) as { product_id: string; url: string; color: string | null; sort_order: number }[]) {
    (out[r.product_id] ??= []).push({ url: r.url, color: r.color, sortOrder: r.sort_order });
  }
  return out;
```

- [ ] **Step 3: Update the detail page image mapping**

In `src/app/(shop)/producto/[id]/page.tsx`, change line 11:

```ts
  const images = product.product_images.map((i) => ({ url: i.url, color: i.color, sortOrder: i.sort_order }));
```

- [ ] **Step 4: Typecheck the whole project**

Run: `npx tsc --noEmit`
Expected: PASS — no type errors. (This confirms every `ImageChoice` construction site now supplies `sortOrder`.)

- [ ] **Step 5: Run the unit tests**

Run: `npx vitest run`
Expected: PASS (all existing tests + Task 1's).

- [ ] **Step 6: Commit**

```bash
git add src/lib/repos/catalog.ts src/lib/repos/products.ts "src/app/(shop)/producto/[id]/page.tsx"
git commit -m "refactor(images): thread sortOrder through repos and consumers"
```

---

### Task 3: Append-on-upload + reorder (repo + actions)

**Files:**
- Modify: `src/lib/repos/products.ts` (`addProductImage`; add `reorderImages`)
- Modify: `src/app/admin/products/[id]/actions.ts` (`uploadImage` multi-file; add `reorderImages`)

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - repo `addProductImage(productId: string, file: File, color: string | null): Promise<void>` — now **appends** (no replace).
  - repo `reorderImages(productId: string, color: string | null, orderedIds: string[]): Promise<void>` — assigns `sort_order = index` within the group.
  - server action `reorderImages(productId: string, color: string | null, orderedIds: string[]): Promise<void>`.
  - server action `uploadImage(productId: string, formData: FormData): Promise<void>` — accepts multiple files.

- [ ] **Step 1: Rewrite `addProductImage` to append**

In `src/lib/repos/products.ts`, replace the whole `addProductImage` function (lines ~115–136) with:

```ts
/** Upload a product image, optionally tagged with a color (null = default). Appends
 *  to the color group: sort_order = max(group) + 1. Multiple images per color allowed. */
export async function addProductImage(productId: string, file: File, color: string | null = null): Promise<void> {
  const supabase = await createClient();

  // next sort_order within this (product, color) group
  const base = supabase.from("product_images").select("sort_order").eq("product_id", productId);
  const { data: existing } = await (color === null ? base.is("color", null) : base.eq("color", color));
  const next = (existing ?? []).reduce(
    (m, r) => Math.max(m, (r as { sort_order: number }).sort_order + 1),
    0,
  );

  const path = `products/${productId}/${Date.now()}-${file.name}`;
  const { error: upErr } = await supabase.storage.from("product-images").upload(path, file);
  if (upErr) throw upErr;
  const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
  const { error } = await supabase.from("product_images")
    .insert({ product_id: productId, url: pub.publicUrl, sort_order: next, color });
  if (error) throw error;
}
```

- [ ] **Step 2: Add `reorderImages` to the repo**

In `src/lib/repos/products.ts`, add this function immediately after `addProductImage`:

```ts
/** Persist a new order for one color group: sort_order = position in orderedIds.
 *  Scoped to the product + color group for safety. */
export async function reorderImages(
  productId: string,
  color: string | null,
  orderedIds: string[],
): Promise<void> {
  const supabase = await createClient();
  for (let i = 0; i < orderedIds.length; i++) {
    let q = supabase
      .from("product_images")
      .update({ sort_order: i })
      .eq("id", orderedIds[i])
      .eq("product_id", productId);
    q = color === null ? q.is("color", null) : q.eq("color", color);
    const { error } = await q;
    if (error) throw error;
  }
}
```

- [ ] **Step 3: Update the `actions.ts` import line**

In `src/app/admin/products/[id]/actions.ts`, change the repo import (line 6) to alias the repo reorder and pull it in:

```ts
import { createProduct, updateProduct, saveVariants, updateVariant, softDeleteProduct, addProductImage, deleteProductImage, reorderImages as reorderImagesRepo } from "@/lib/repos/products";
```

- [ ] **Step 4: Rewrite `uploadImage` to accept multiple files**

In `src/app/admin/products/[id]/actions.ts`, replace the `uploadImage` function (lines ~65–73) with:

```ts
export async function uploadImage(productId: string, formData: FormData): Promise<void> {
  const files = formData.getAll("image").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return;
  const color = String(formData.get("color") ?? "").trim() || null;
  const label = files.length === 1 ? "Imagen subida" : `${files.length} imágenes subidas`;
  await withFlash(label, async () => {
    for (const file of files) await addProductImage(productId, file, color);
  });
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/");
  revalidatePath(`/producto/${productId}`);
}
```

- [ ] **Step 5: Add the `reorderImages` server action**

In `src/app/admin/products/[id]/actions.ts`, add this after `deleteImage`:

```ts
export async function reorderImages(
  productId: string,
  color: string | null,
  orderedIds: string[],
): Promise<void> {
  if (orderedIds.length === 0) return;
  await reorderImagesRepo(productId, color, orderedIds);
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/");
  revalidatePath(`/producto/${productId}`);
}
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/repos/products.ts "src/app/admin/products/[id]/actions.ts"
git commit -m "feat(images): append on upload, add reorder action"
```

---

### Task 4: Admin — drag-and-drop `ImageGallery` + multi-file upload

**Files:**
- Create: `src/app/admin/products/[id]/ImageGallery.tsx`
- Modify: `src/app/admin/products/[id]/page.tsx` (render `ImageGallery`; pass `multiple` to uploader)
- Modify: `src/components/ui/ImageUploader.tsx` (add `multiple` prop)

**Interfaces:**
- Consumes: `ProductImageRow` (`{ id, product_id, url, sort_order, color }`) from `listImages`; server actions `reorderImages`, `deleteImage` from `./actions`.
- Produces: `<ImageGallery productId={string} images={ProductImageRow[]} />`.

- [ ] **Step 1: Create the `ImageGallery` client component**

Create `src/app/admin/products/[id]/ImageGallery.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { ProductImageRow } from "@/lib/db-types";
import { reorderImages, deleteImage } from "./actions";

type Group = { color: string | null; label: string; images: ProductImageRow[] };

function groupByColor(images: ProductImageRow[]): Group[] {
  const map = new Map<string | null, ProductImageRow[]>();
  for (const img of images) {
    const arr = map.get(img.color) ?? [];
    arr.push(img);
    map.set(img.color, arr);
  }
  const groups: Group[] = [];
  for (const [color, imgs] of map) {
    groups.push({
      color,
      label: color ?? "Default",
      images: [...imgs].sort((a, b) => a.sort_order - b.sort_order),
    });
  }
  // named colors first (alphabetical), Default group last
  groups.sort((a, b) => {
    if (a.color === null) return 1;
    if (b.color === null) return -1;
    return a.color.localeCompare(b.color);
  });
  return groups;
}

export default function ImageGallery({
  productId,
  images,
}: {
  productId: string;
  images: ProductImageRow[];
}) {
  const [groups, setGroups] = useState<Group[]>(() => groupByColor(images));
  const [drag, setDrag] = useState<{ color: string | null; index: number } | null>(null);

  function moveWithinGroup(color: string | null, from: number, to: number) {
    const g = groups.find((x) => x.color === color);
    if (!g || from === to) return;
    const imgs = [...g.images];
    const [moved] = imgs.splice(from, 1);
    imgs.splice(to, 0, moved);
    setGroups((gs) => gs.map((x) => (x.color === color ? { ...x, images: imgs } : x)));
    void reorderImages(productId, color, imgs.map((i) => i.id));
  }

  if (images.length === 0) return null;

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.label} className="space-y-1.5">
          <div className="text-[11px] font-medium text-ink-2">{g.label}</div>
          <div className="flex flex-wrap gap-3">
            {g.images.map((img, index) => (
              <div
                key={img.id}
                draggable
                onDragStart={() => setDrag({ color: g.color, index })}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (drag && drag.color === g.color) moveWithinGroup(g.color, drag.index, index);
                  setDrag(null);
                }}
                className="w-16 cursor-grab text-center active:cursor-grabbing"
              >
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt="" className="h-20 w-16 rounded object-cover" />
                  {index === 0 && (
                    <span className="absolute left-0 top-0 rounded-br rounded-tl bg-royal px-1 text-[9px] font-medium text-white">
                      Principal
                    </span>
                  )}
                </div>
                <form action={deleteImage.bind(null, productId)}>
                  <input type="hidden" name="imageId" value={img.id} />
                  <button className="text-[10px] text-red-600">eliminar</button>
                </form>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Add a `multiple` prop to `ImageUploader`**

In `src/components/ui/ImageUploader.tsx`:

Change the props signature (lines ~8–14) to add `multiple`:

```tsx
export function ImageUploader({
  action,
  colors,
  multiple = false,
}: {
  action: (formData: FormData) => void | Promise<void>;
  colors: string[];
  multiple?: boolean;
}) {
```

Replace `setFile` (lines ~20–26) with a version that tracks one or many files:

```tsx
  function setFiles(files: FileList | File[] | null) {
    const list = files ? Array.from(files) : [];
    setFileName(
      list.length === 0
        ? null
        : list.length === 1
          ? list[0].name
          : `${list.length} imágenes seleccionadas`,
    );
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return list[0] ? URL.createObjectURL(list[0]) : null;
    });
  }
```

Replace `onDrop` (lines ~28–38) to carry all dropped files into the input:

```tsx
  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files ?? []);
    if (dropped.length > 0 && inputRef.current) {
      const dt = new DataTransfer();
      for (const f of dropped) dt.items.add(f);
      inputRef.current.files = dt.files;
      setFiles(dropped);
    }
  }
```

Update the `<input>` (lines ~69–76) to allow multiple and use the new handler:

```tsx
        <input
          ref={inputRef}
          type="file"
          name="image"
          accept="image/*"
          multiple={multiple}
          className="hidden"
          onChange={(e) => setFiles(e.target.files)}
        />
```

(The drop placeholder copy "Arrastra una imagen…" can stay; it still reads fine for multiple.)

- [ ] **Step 3: Wire `ImageGallery` into the editor page**

In `src/app/admin/products/[id]/page.tsx`:

Add the import (after the `DeleteProductButton` import, line ~8):

```tsx
import ImageGallery from "./ImageGallery";
```

Replace the inline thumbnail block — the whole `{images.length > 0 && ( … )}` expression (lines ~58–72) — with:

```tsx
              <ImageGallery key={images.map((i) => `${i.id}:${i.sort_order}`).join(",")} productId={id} images={images} />
```

The `key` (derived from image ids + sort_order) forces a remount whenever the server data changes — so an upload or delete (which revalidates this page) re-initializes the gallery's local state from the fresh props instead of showing stale state.

Pass `multiple` to the uploader (line ~73):

```tsx
              <ImageUploader action={uploadImage.bind(null, id)} colors={colors} multiple />
```

`deleteImage` is now used inside `ImageGallery`, so remove it from the page's `./actions` import (line 6) — it should read:

```tsx
import { saveProduct, addVariant, editVariant, uploadImage, deleteProduct } from "./actions";
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/admin/products/[id]/ImageGallery.tsx" "src/app/admin/products/[id]/page.tsx" src/components/ui/ImageUploader.tsx
git commit -m "feat(images): admin drag-and-drop gallery grouped by color"
```

---

### Task 5: Storefront — color-filtered detail gallery

**Files:**
- Modify: `src/app/(shop)/producto/[id]/ProductDetailClient.tsx`

**Interfaces:**
- Consumes: `imagesForColor`, `pickProductImage` from `@/domain/product-image`.
- Produces: the detail gallery shows only the selected color's images (admin order), main image = that color's primary.

- [ ] **Step 1: Import `imagesForColor`**

In `src/app/(shop)/producto/[id]/ProductDetailClient.tsx`, change the domain import (line 8) to:

```tsx
import { pickProductImage, imagesForColor, type ImageChoice } from "@/domain/product-image";
```

- [ ] **Step 2: Derive the gallery from the selected color**

Add a derived `gallery` right after the existing `chosen` line (around line 36):

```tsx
  const gallery = imagesForColor(images, color);
```

- [ ] **Step 3: Simplify `selectThumb` (no cross-color jump)**

Replace `selectThumb` (lines ~50–56) with a version that only swaps the main image within the current color:

```tsx
  function selectThumb(img: ImageChoice) {
    setActiveUrl(img.url);
  }
```

- [ ] **Step 4: Render the filtered gallery**

Replace the thumbnail strip block — the `{images.length > 1 && ( … )}` expression (lines ~65–79) — so it iterates `gallery` instead of `images`:

```tsx
        {gallery.length > 1 && (
          <div className="order-2 md:order-1 flex md:flex-col gap-2 p-3 md:p-0 overflow-x-auto md:overflow-visible">
            {gallery.map((img) => (
              <button
                key={img.url}
                type="button"
                aria-label="Ver imagen"
                onClick={() => selectThumb(img)}
                className={`relative w-16 h-20 shrink-0 rounded-md overflow-hidden bg-mist border transition ${activeUrl === img.url ? "ring-2 ring-royal border-transparent" : "border-line"}`}
              >
                <Image src={img.url} alt="" fill sizes="64px" className="object-cover" />
              </button>
            ))}
          </div>
        )}
```

The hero (`FadeImage src={activeUrl}`), `selectColor` (which already does `setActiveUrl(pickProductImage(images, c))`), the cart `add(...)` image, and the "Agregado" modal image all keep using `pickProductImage(images, color)` — unchanged, now returning the color's primary.

- [ ] **Step 5: Typecheck + unit tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(shop)/producto/[id]/ProductDetailClient.tsx"
git commit -m "feat(images): color-filtered storefront detail gallery"
```

---

### Task 6: Browser E2E verification

**Files:** none (manual/preview verification).

> Pre-req: Docker + local Supabase up (`docker info`; containers running), `npm run dev` serving on :3000, admin signed in (`admin@corve.test` / `corve1234`). Disable the Night Eye extension on localhost or use Incognito (it breaks hydration → inert buttons).

- [ ] **Step 1: Upload multiple images to one color**

Open `/admin/products/<a product with a "Negro" variant>`. In **Imágenes**, select color **Negro**, choose **3 files** (multi-select), click **Subir foto**. Expected: flash "3 imágenes subidas"; the Negro group shows 3 thumbnails; the first has a **Principal** badge.

- [ ] **Step 2: Reorder by drag-and-drop**

Drag the 3rd Negro thumbnail to the front. Expected: it moves to position 1 and gains the **Principal** badge; reload the page → the new order persists (server `reorderImages` ran).

- [ ] **Step 3: Storefront shows only that color's images, in order**

Open `/producto/<id>`. Select **Negro**. Expected: the thumbnail strip shows exactly the 3 Negro images in admin order; the main image is the primary; clicking a thumbnail swaps only the main image (no color change).

- [ ] **Step 4: Fallback for a color with no images**

Select a different color that has no images. Expected: the main image falls back to the Default image (or the gradient placeholder if there is no Default); the strip shows the Default group (or nothing).

- [ ] **Step 5: Grid primary**

Open `/`. Find the product tile and click its **Negro** swatch. Expected: the tile shows Negro's **primary** image.

- [ ] **Step 6: Delete leaves the rest intact**

Back in the admin editor, click **eliminar** on one Negro image. Expected: flash "Imagen eliminada"; the other two remain; if the deleted one was primary, the next becomes Principal.

- [ ] **Step 7: Final tests + commit (if any cleanup was needed)**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS. If you made fixes during E2E, commit them:

```bash
git add -A
git commit -m "fix(images): E2E adjustments for multiple images per color"
```
