# Per-Color Product Images Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a color-specific product image on the catalog (detail page swaps image by selected color; grid shows the default), falling back to the product's default image and then the gradient placeholder — and actually render uploaded images (the catalog shows placeholders today).

**Architecture:** Add a nullable `color` to `product_images` (NULL = default). A pure `pickProductImage(images, color)` selector encodes the fallback rule. The detail page is consolidated into one client component that owns color state so the hero image reacts to color. Admin upload gains a color picker with replace-on-upload + delete. Catalog uses `next/image` (Supabase host whitelisted).

**Tech Stack:** Next.js 16, TypeScript, Tailwind, Supabase (Postgres + Storage), Vitest. Builds on Plans 1–4. Spec: `docs/superpowers/specs/2026-06-16-per-color-product-images-design.md`.

Requires the local Supabase stack running. Implementation branches from `plan4-purchasing`.

---

## File Structure

- `supabase/migrations/0006_image_color.sql` — CREATE: add `color` to `product_images`.
- `src/domain/product-image.ts` (+ `.test.ts`) — CREATE: `pickProductImage` (pure).
- `src/lib/db-types.ts` — MODIFY: `ProductImageRow.color`.
- `src/lib/repos/products.ts` — MODIFY: `addProductImage` (color + replace), `deleteProductImage`.
- `next.config.ts` — MODIFY: `images.remotePatterns` for the Supabase storage host.
- `src/app/(shop)/page.tsx` — MODIFY: grid tiles render the default image.
- `src/app/(shop)/producto/[id]/page.tsx` — MODIFY: thin fetch-and-pass.
- `src/app/(shop)/producto/[id]/ProductDetailClient.tsx` — CREATE (evolves `AddToCart.tsx`): image + info + selector sharing color state.
- `src/app/(shop)/producto/[id]/AddToCart.tsx` — DELETE (absorbed).
- `src/app/admin/products/[id]/page.tsx` — MODIFY: color dropdown, labeled thumbnails, delete.
- `src/app/admin/products/[id]/actions.ts` — MODIFY: `uploadImage` passes color; add `deleteImage`.

---

## Task 1: Migration + `ProductImageRow.color`

**Files:** Create `supabase/migrations/0006_image_color.sql`; Modify `src/lib/db-types.ts`. Requires the local stack.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0006_image_color.sql`:
```sql
-- Per-color product images. color IS NULL = the product's default image;
-- color = a variants.color value = that color's image. One-per-color is kept at the
-- app layer (replace-on-upload), so no constraint that could fail on existing rows.
alter table product_images add column color text;
```

- [ ] **Step 2: Add `color` to the Row type**

In `src/lib/db-types.ts`, change `ProductImageRow` to:
```ts
export interface ProductImageRow {
  id: string;
  product_id: string;
  url: string;
  sort_order: number;
  color: string | null;
}
```

- [ ] **Step 3: Apply & verify**

Run `npx supabase db reset` (re-applies 0001–0006 + seed). Verify the column exists:
```bash
node --input-type=module -e "import{createClient}from'@supabase/supabase-js';const u='http://127.0.0.1:54321';const k='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';const c=createClient(u,k);const{error}=await c.from('product_images').select('id,color').limit(1);console.log(error?('ERR '+error.message):'color column OK')"
```
Expected: `color column OK`.

- [ ] **Step 4: Typecheck & commit**

Run: `npx tsc --noEmit` (exit 0).
```bash
git add supabase/migrations/0006_image_color.sql src/lib/db-types.ts
git commit -m "feat(db): add color to product_images for per-color images"
```

---

## Task 2: `pickProductImage` selector (pure, TDD)

**Files:** Create `src/domain/product-image.ts`, `src/domain/product-image.test.ts`.

- [ ] **Step 1: Write the failing test**

Create `src/domain/product-image.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { pickProductImage, type ImageChoice } from "@/domain/product-image";

const imgs: ImageChoice[] = [
  { url: "default.jpg", color: null },
  { url: "negro.jpg", color: "Negro" },
];

describe("pickProductImage", () => {
  it("returns the image matching the selected color", () => {
    expect(pickProductImage(imgs, "Negro")).toBe("negro.jpg");
  });
  it("falls back to the default when the color has no image", () => {
    expect(pickProductImage(imgs, "Arena")).toBe("default.jpg");
  });
  it("returns the default when color is null (grid)", () => {
    expect(pickProductImage(imgs, null)).toBe("default.jpg");
  });
  it("returns null when there are no images", () => {
    expect(pickProductImage([], "Negro")).toBeNull();
  });
  it("returns null when no default and the color has no image", () => {
    expect(pickProductImage([{ url: "negro.jpg", color: "Negro" }], "Arena")).toBeNull();
  });
  it("prefers the color image over the default", () => {
    expect(pickProductImage(imgs, "Negro")).toBe("negro.jpg");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- product-image`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/domain/product-image.ts`:
```ts
export interface ImageChoice {
  url: string;
  color: string | null;
}

/**
 * Pick the image URL for a selected color: the color's own image, else the default
 * (color === null), else null (caller shows the placeholder). Pass null for the grid.
 */
export function pickProductImage(images: ImageChoice[], color: string | null): string | null {
  if (color !== null) {
    const match = images.find((i) => i.color === color);
    if (match) return match.url;
  }
  const def = images.find((i) => i.color === null);
  return def ? def.url : null;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- product-image`
Expected: PASS (6).

- [ ] **Step 5: Commit**

```bash
git add src/domain/product-image.ts src/domain/product-image.test.ts
git commit -m "feat(domain): pickProductImage color-fallback selector"
```

---

## Task 3: Repo — color upload (replace) + delete

**Files:** Modify `src/lib/repos/products.ts`. Verified by typecheck.

- [ ] **Step 1: Replace `addProductImage` and add `deleteProductImage`**

In `src/lib/repos/products.ts`, replace the existing `addProductImage` function (and keep `listImages` as-is; it already `select("*")` so `color` is included) with:
```ts
/** Upload a product image, optionally tagged with a color (null = default). One image
 *  per (product, color): any existing image for that color is removed first. */
export async function addProductImage(productId: string, file: File, color: string | null = null): Promise<void> {
  const supabase = await createClient();

  // remove existing image(s) for this (product, color), incl. best-effort storage cleanup
  const base = supabase.from("product_images").select("id,url").eq("product_id", productId);
  const { data: existing } = await (color === null ? base.is("color", null) : base.eq("color", color));
  for (const row of (existing ?? []) as { id: string; url: string }[]) {
    const path = row.url.split("/product-images/")[1];
    if (path) await supabase.storage.from("product-images").remove([decodeURIComponent(path)]);
    await supabase.from("product_images").delete().eq("id", row.id);
  }

  const path = `products/${productId}/${Date.now()}-${file.name}`;
  const { error: upErr } = await supabase.storage.from("product-images").upload(path, file);
  if (upErr) throw upErr;
  const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
  const { error } = await supabase.from("product_images")
    .insert({ product_id: productId, url: pub.publicUrl, sort_order: 0, color });
  if (error) throw error;
}

/** Delete a product image (DB row + best-effort storage object). */
export async function deleteProductImage(imageId: string): Promise<void> {
  const supabase = await createClient();
  const { data: row } = await supabase.from("product_images").select("url").eq("id", imageId).maybeSingle();
  if (row) {
    const path = (row as { url: string }).url.split("/product-images/")[1];
    if (path) await supabase.storage.from("product-images").remove([decodeURIComponent(path)]);
  }
  const { error } = await supabase.from("product_images").delete().eq("id", imageId);
  if (error) throw error;
}
```
(The existing `import type { ProductImageRow }` at the top stays; `color` now flows through `listImages`.)

- [ ] **Step 2: Verify & commit**

Run: `npx tsc --noEmit` (exit 0). Note: `addProductImage`'s third param defaults to `null`, so the current `uploadImage` action (calls it with two args) still compiles.
```bash
git add src/lib/repos/products.ts
git commit -m "feat(admin): per-color image upload (replace) and delete"
```

---

## Task 4: Whitelist Supabase image host

**Files:** Modify `next.config.ts`. Verified by build.

- [ ] **Step 1: Add remotePatterns**

Replace `next.config.ts` with:
```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Local Supabase Storage. Add the cloud project host (e.g. <ref>.supabase.co) at deploy time.
      { protocol: "http", hostname: "127.0.0.1", port: "54321", pathname: "/storage/v1/object/public/**" },
    ],
  },
};

export default nextConfig;
```

- [ ] **Step 2: Verify & commit**

Run: `npm run build` (compiles).
```bash
git add next.config.ts
git commit -m "chore: allow Supabase storage host for next/image"
```

---

## Task 5: Grid shows the default image

**Files:** Modify `src/app/(shop)/page.tsx`. Verified by build + manual.

- [ ] **Step 1: Render the default image per tile**

Replace `src/app/(shop)/page.tsx` with:
```tsx
import Link from "next/link";
import Image from "next/image";
import { listActiveByLine } from "@/lib/repos/catalog";
import { formatMXN } from "@/domain/money";
import { pickProductImage } from "@/domain/product-image";
import type { Line } from "@/domain/types";

const LINES: { line: Line; title: string; message: string }[] = [
  { line: "MOVE", title: "Muévete desde el amor", message: "Confianza en cada movimiento" },
  { line: "HIM", title: "Una rutina que respeta tu ritmo", message: "Confianza en cada movimiento" },
];

export default async function CatalogPage() {
  const sections = await Promise.all(
    LINES.map(async (l) => ({ ...l, products: await listActiveByLine(l.line) })),
  );
  return (
    <main>
      {sections.map((s) => (
        <section key={s.line} className="mb-10">
          <div className="relative h-[60vh] flex flex-col justify-end p-6"
            style={{ background: "linear-gradient(180deg,rgba(0,0,0,.1),rgba(0,0,0,.6)),linear-gradient(135deg,#c9a487,#7c5942)" }}>
            <div className="tracking-[0.3em] text-xs mb-2">CORVE {s.line}</div>
            <h2 className="text-3xl font-bold leading-none">{s.title}</h2>
            <p className="italic opacity-80 mt-1">{s.message}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 p-4">
            {s.products.map((p) => {
              const url = pickProductImage(p.product_images.map((i) => ({ url: i.url, color: i.color })), null);
              return (
                <Link key={p.id} href={`/producto/${p.id}`} className="block">
                  <div className="relative h-44 rounded-lg overflow-hidden bg-gradient-to-br from-[#d8c1ad] to-[#9a7a61]">
                    {url && <Image src={url} alt={p.name} fill sizes="50vw" className="object-cover" />}
                  </div>
                  <div className="text-sm mt-2">{p.name}</div>
                  <div className="text-sm opacity-70">{formatMXN(p.price)}</div>
                </Link>
              );
            })}
            {s.products.length === 0 && <p className="opacity-60 text-sm">Pronto.</p>}
          </div>
        </section>
      ))}
    </main>
  );
}
```
(`p.product_images` is `ProductImageRow[]` incl. `color` from `listActiveByLine`'s `*, product_images(*)`.)

- [ ] **Step 2: Verify & manual**

Run: `npm run build`. Manual (after Task 7 lets you upload): a product with a default image shows it on the grid tile; one without shows the gradient.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(shop)/page.tsx"
git commit -m "feat(shop): catalog grid shows product default image"
```

---

## Task 6: Detail page — color-reactive image

**Files:** Create `src/app/(shop)/producto/[id]/ProductDetailClient.tsx`; Modify `src/app/(shop)/producto/[id]/page.tsx`; Delete `src/app/(shop)/producto/[id]/AddToCart.tsx`. Verified by build + manual.

- [ ] **Step 1: Create the consolidated client component**

Create `src/app/(shop)/producto/[id]/ProductDetailClient.tsx`:
```tsx
"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart/CartContext";
import { availableByColor, type AvailVariant } from "@/domain/availability";
import { pickProductImage, type ImageChoice } from "@/domain/product-image";
import { formatMXN } from "@/domain/money";

interface VariantLite extends AvailVariant { id: string }

type Props = {
  productId: string;
  productName: string;
  price: number;
  line: string;
  description: string;
  variants: VariantLite[];
  images: ImageChoice[];
};

export default function ProductDetailClient({ productId, productName, price, line, description, variants, images }: Props) {
  const router = useRouter();
  const { add } = useCart();
  const colors = availableByColor(variants);
  const [color, setColor] = useState(colors[0]?.color ?? "");
  const [size, setSize] = useState("");

  const sizes = colors.find((c) => c.color === color)?.sizes ?? [];
  const chosen = variants.find((v) => v.color === color && v.size === size);
  const heroUrl = pickProductImage(images, color || null);

  return (
    <main>
      <div className="relative h-72 bg-gradient-to-br from-[#d8c1ad] to-[#9a7a61]">
        {heroUrl && <Image src={heroUrl} alt={productName} fill sizes="100vw" className="object-cover" />}
      </div>
      <div className="p-4">
        <h1 className="text-2xl font-bold">{productName}</h1>
        <div className="opacity-70 mb-2">{formatMXN(price)} · CORVE {line}</div>
        {description && <p className="italic text-sm opacity-80">{description}</p>}
      </div>
      <div className="p-4 space-y-3">
        <div className="text-xs uppercase tracking-wider opacity-60">Color</div>
        <div className="flex gap-2">
          {colors.map((c) => (
            <button key={c.color} onClick={() => { setColor(c.color); setSize(""); }}
              className={`px-3 py-1 rounded border text-sm ${c.color === color ? "bg-white text-[#161311]" : "border-white/40"}`}>
              {c.color}
            </button>
          ))}
        </div>
        <div className="text-xs uppercase tracking-wider opacity-60">Talla</div>
        <div className="flex gap-2">
          {sizes.map((s) => (
            <button key={s.size} disabled={!s.inStock} onClick={() => setSize(s.size)}
              className={`px-3 py-1 rounded border text-sm ${s.size === size ? "bg-white text-[#161311]" : "border-white/40"} ${!s.inStock ? "opacity-30 line-through" : ""}`}>
              {s.size}
            </button>
          ))}
        </div>
        <button disabled={!chosen}
          onClick={() => {
            if (!chosen) return;
            add({ variantId: chosen.id, productId, productName, color, size, unitPrice: price, qty: 1 });
            router.push("/carrito");
          }}
          className="w-full rounded-xl bg-white text-[#161311] py-3 text-sm disabled:opacity-40">
          Agregar · {formatMXN(price)}
        </button>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Make the page a thin fetch-and-pass**

Replace `src/app/(shop)/producto/[id]/page.tsx` with:
```tsx
import { notFound } from "next/navigation";
import { getActiveProduct } from "@/lib/repos/catalog";
import ProductDetailClient from "./ProductDetailClient";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getActiveProduct(id);
  if (!detail) notFound();
  const { product, variants } = detail;

  return (
    <ProductDetailClient
      productId={product.id}
      productName={product.name}
      price={product.price}
      line={product.line}
      description={product.description}
      variants={variants.map((v) => ({ id: v.id, color: v.color, size: v.size, stock: v.stock }))}
      images={product.product_images.map((i) => ({ url: i.url, color: i.color }))}
    />
  );
}
```

- [ ] **Step 3: Delete the old component**

```bash
git rm "src/app/(shop)/producto/[id]/AddToCart.tsx"
```

- [ ] **Step 4: Verify & manual**

Run: `npm run build` (compiles; `AddToCart` no longer referenced). Manual: open a product — the hero swaps to the color's image when you tap a color; a color without an image shows the default; no images shows the gradient. Add-to-cart still works.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(shop)/producto/[id]"
git commit -m "feat(shop): color-reactive product hero image"
```

---

## Task 7: Admin — upload by color + delete

**Files:** Modify `src/app/admin/products/[id]/actions.ts` and `src/app/admin/products/[id]/page.tsx`. Verified by build + manual. Read both files first.

- [ ] **Step 1: Actions — color on upload + delete**

In `src/app/admin/products/[id]/actions.ts`: update the products import to include `deleteProductImage`, replace `uploadImage`, and add `deleteImage`.

Update the import that pulls from the products repo to also import `deleteProductImage` (it currently imports `addProductImage`):
```ts
import { addProductImage, deleteProductImage } from "@/lib/repos/products";
```
Replace the existing `uploadImage` action with:
```ts
export async function uploadImage(productId: string, formData: FormData): Promise<void> {
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return;
  const color = String(formData.get("color") ?? "").trim() || null;
  await addProductImage(productId, file, color);
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/");
  revalidatePath(`/producto/${productId}`);
}

export async function deleteImage(productId: string, formData: FormData): Promise<void> {
  const imageId = String(formData.get("imageId") ?? "");
  if (!imageId) return;
  await deleteProductImage(imageId);
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/");
  revalidatePath(`/producto/${productId}`);
}
```
(`revalidatePath` is already imported in this file.)

- [ ] **Step 2: Page — color dropdown, labeled thumbnails, delete**

In `src/app/admin/products/[id]/page.tsx`: add `deleteImage` to the actions import; compute the product's colors; and replace the images `<div>` + upload `<form>` block (lines rendering thumbnails and the "Subir foto" form) with the version below.

Change the actions import line to:
```tsx
import { saveProduct, addVariant, correctVariant, uploadImage, deleteImage } from "./actions";
```
After `const variants = existing?.variants ?? [];` add:
```tsx
  const colors = [...new Set(variants.map((v) => v.color))];
```
Replace the existing images thumbnails `<div className="flex gap-2 mb-3 flex-wrap">...</div>` and the `<form action={uploadImage.bind(null, id)} className="mb-4">...</form>` with:
```tsx
          <div className="flex gap-3 mb-3 flex-wrap">
            {images.map((img) => (
              <div key={img.id} className="text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt="" className="h-20 w-16 object-cover rounded" />
                <div className="text-[10px] text-[#6b5d50]">{img.color ?? "Default"}</div>
                <form action={deleteImage.bind(null, id)}>
                  <input type="hidden" name="imageId" value={img.id} />
                  <button className="text-[10px] text-red-600">eliminar</button>
                </form>
              </div>
            ))}
          </div>
          <form action={uploadImage.bind(null, id)} className="mb-4 flex gap-2 items-center">
            <input type="file" name="image" accept="image/*" className="text-xs" />
            <select name="color" className="text-xs rounded border border-[#d8cdc0] p-1">
              <option value="">Default (todas)</option>
              {colors.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <button className="rounded bg-[#211d1a] text-white px-3 py-1 text-xs">Subir foto</button>
          </form>
```

- [ ] **Step 3: Verify & manual**

Run: `npm run build` (compiles). Manual: on a saved product, upload an image with color "Default" and another with color "Negro"; thumbnails show labels "Default"/"Negro"; re-uploading "Negro" replaces it (still one Negro thumbnail); "eliminar" removes one.

- [ ] **Step 4: Commit**

```bash
git add "src/app/admin/products/[id]"
git commit -m "feat(admin): upload images per color and delete"
```

---

## Task 8: Full gate + browser verification

**Files:** none.

- [ ] **Step 1: Tests + typecheck + build**

Run: `npm test` (adds product-image), `npx tsc --noEmit`, `npm run build`. Confirm clean tree.

- [ ] **Step 2: Browser E2E** (clean window, logged-in admin, local stack):
  1. Admin → a product → upload a **Default** image and a **Negro** image.
  2. Catalog `/` → the product tile shows the **default** image.
  3. Product detail → with **Negro** selected the hero shows the Negro image; select a color **without** an image → hero shows the **default**; add-to-cart still works.
  4. Admin → **eliminar** the Negro image → detail with Negro now shows the default.

---

## Self-Review (completed by plan author)

- **Spec coverage:** nullable `color` column (Task 1); `pickProductImage` fallback (Task 2); replace-on-upload + delete + storage cleanup (Task 3); `next/image` host (Task 4); grid default image (Task 5); color-reactive detail via consolidated client component (Task 6); admin color dropdown + labels + delete (Task 7); unit + browser tests (Tasks 2, 8). RLS unchanged (no task needed — adding a column doesn't affect the existing anon policy).
- **Placeholder scan:** every step has complete code; no TBD/TODO. The only conditional (Task 1 Docker) is a concrete verify command.
- **Type consistency:** `ProductImageRow.color: string | null` (Task 1) flows to `listImages`/`CatalogProduct.product_images` and is mapped to `ImageChoice { url, color }` (Task 2) consumed by grid (Task 5) and detail (Task 6); `addProductImage(productId, file, color=null)` / `deleteProductImage(imageId)` (Task 3) are called by `uploadImage`/`deleteImage` (Task 7). `pickProductImage` signature identical across Tasks 2/5/6.

---

## After this feature
At deploy time, add the cloud Supabase storage host to `next.config.ts` `images.remotePatterns` (alongside the local entry).
