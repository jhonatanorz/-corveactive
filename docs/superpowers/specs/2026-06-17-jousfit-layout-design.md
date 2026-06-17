# CORVE — jousfit-style Collection & Product Layouts — Design Spec

**Date:** 2026-06-17
**Status:** Approved design, pending implementation plan
**Builds on:** the full app + per-color images + design system. Branch base: `design-system`.

---

## 1. Overview

Adapt two layouts from jousfit.com into the CORVE shop, in CORVE's own design system (royal/ink/mist, Card, pill, DS motion — **not** jousfit's colors/fonts):

1. **Collection grid** — each product card gains a row of **color dots** (one per variant color). Clicking a dot **crossfades** the card image to that color's photo.
2. **Product page** — restructured into a jousfit-style **gallery layout**: a large main image + a thumbnail strip of **all** the product's images, alongside the product info (color dots, size, add-to-cart). Clicking a thumbnail or a color swaps the main image with a crossfade and keeps selection in sync.

Reference analysis (confirmed via DOM): jousfit PDP is two-column — vertical thumbnail strip + large main image on the left, product info (title, price, variant swatches, size, add-to-cart) on the right; collection is a portrait-card grid with per-card color swatches that change the card image.

### Success criteria
- Collection cards show color dots (variant `color_hex`); clicking one crossfades the card image to that color's image; active dot is ringed.
- PDP shows a main image + thumbnail strip of all product images; clicking a thumbnail sets the main image (crossfade); selecting a color swaps the main image and highlights its thumbnail; the two stay in sync.
- Responsive: PDP thumbnails below the main image on mobile, vertical-left on `md+`.
- All transitions use DS motion tokens; no layout/logic regressions; build/tsc/tests green; browser-verified on mobile + desktop.

### Out of scope (YAGNI)
- Multiple images per color / new admin upload (gallery shows the **existing** `product_images`: default + one per color).
- jousfit's palette, fonts, copy, "drops" model.
- Hover-to-swap (interaction is **click**, per the reference behavior described); zoom/lightbox.
- Data model, RLS, RPC, cart, or WhatsApp changes.

---

## 2. Domain — distinct colors helper (pure, TDD)

`src/domain/product-colors.ts`:
```ts
import { pickProductImage, type ImageChoice } from "./product-image";

export interface ColorOption { color: string; hex: string; url: string | null }

/**
 * Distinct colors for a product, in first-seen variant order, each with its hex
 * and its image (the color's own image, else the product default, else null).
 */
export function productColors(
  variants: { color: string; color_hex: string }[],
  images: ImageChoice[],
): ColorOption[]
```
- Dedupe variants by `color` (first-seen order), take `color_hex` from the first occurrence, resolve `url` via `pickProductImage(images, color)`.
- Unit-tested: dedupe, order preserved, hex from first occurrence, url falls back to default then null, empty inputs → `[]`.

Consumed by both the collection card and the PDP color selector.

---

## 3. Shared `FadeImage` primitive

`src/components/ui/FadeImage.tsx` (+ export from the `ui` barrel):
- Props: `src: string | null`, `alt: string`, `sizes?: string`, `className?: string`, plus `fill` behavior (renders inside a relative parent).
- Crossfade on `src` change: keep the previous `<Image>` visible while the new one fades in over it (two stacked layers keyed by url), using `transition-opacity duration-[var] ease-out` (~220ms, DS `--dur-2`/`--ease-out`). When `src` is `null`, show the `bg-mist` placeholder (no image).
- Uses `next/image` with `fill`. No business logic; pure presentational. Reused by the card and the PDP main image.

---

## 4. Collection cards — `ProductCard`

**Data change** — `src/lib/repos/catalog.ts`: `listActiveByLine` currently selects `*, product_images(*)`. Extend to also return each product's variants' color info: `*, product_images(*), variants(color,color_hex)`. (`CatalogProduct` type gains `variants: {color: string; color_hex: string}[]`.)

**New** `src/app/(shop)/ProductCard.tsx` (client component):
- Props: `id`, `name`, `price`, `images: ImageChoice[]`, `colors: ColorOption[]` (from `productColors`).
- State: `selected: string | null` (null = default). Current url = `selected ? pickProductImage(images, selected) : pickProductImage(images, null)`.
- Renders: `<Link href={/producto/id}>` wrapping a `Card` (`relative h-44 overflow-hidden bg-mist`) containing `<FadeImage>`; below the link, the **color dots** row + name (`text-ink`) + price (`text-ink-2`).
- **Color dots:** for each `ColorOption`, a round button (`w-4 h-4 rounded-pill border border-line`) with `background: hex`; clicking sets `selected` (and is `type=button`, `stopPropagation`/`preventDefault` so it doesn't navigate). Active dot: `ring-2 ring-royal ring-offset-1`. Dots are **outside** the `<Link>` (or stop navigation) so tapping a dot swaps the image without opening the product.
- **`src/app/(shop)/page.tsx`:** replace the inline tile markup with `<ProductCard … />`, mapping `product_images`→`ImageChoice[]` and `productColors(variants, images)`→`colors`. Catalog covers (royal + blob + Dream Avenue) unchanged.

## 5. Product page — gallery layout

**`src/app/(shop)/producto/[id]/ProductDetailClient.tsx`** (props unchanged: it already receives `images`, `variants`, etc.). Restructure the render into a responsive two-column layout; optionally extract a `ProductGallery.tsx` for the gallery half.

- **Gallery** (left on `md+`, top on mobile):
  - **Main image:** `<FadeImage>` showing `activeUrl`.
  - **Thumbnails:** all `images` (every `product_images` row). Mobile: horizontal scroll strip **below** the main image; `md+`: vertical column **left** of the main image. Each thumb is a `bg-mist rounded-md` button with `next/image`; the active thumb gets `ring-2 ring-royal`.
- **State:** `color` (existing), `size` (existing), and `activeUrl`.
  - Initial `activeUrl = pickProductImage(images, colors[0]?.color ?? null)`.
  - Selecting a **color dot** → `setColor` + `activeUrl = pickProductImage(images, color)`; the matching thumbnail highlights.
  - Clicking a **thumbnail** → `activeUrl = thumb.url`; if `thumb.color` is non-null, also `setColor(thumb.color)`.
- **Info column** (right on `md+`, below on mobile): title (DM Sans `h1 text-ink`), `price · CORVE línea`, description, **color dots** (the same dot UI as the card, replacing the current text color chips), **size** pills (unchanged), royal **Agregar** `Button` (unchanged behavior — adds the chosen variant). The `Eyebrow` "Color"/"Talla" labels stay.
- Crossfade on the main image via `FadeImage`.

## 6. Motion

All image swaps crossfade via `FadeImage` (opacity, `--dur-2` ≈220ms, `--ease-out`). Dots/thumbnails get the standard `transition` on ring/border. No bounce, no layout shift (fixed aspect containers).

---

## 7. Files touched

- **Create:** `src/domain/product-colors.ts` (+ `.test.ts`), `src/components/ui/FadeImage.tsx`, `src/app/(shop)/ProductCard.tsx`. Optionally `src/app/(shop)/producto/[id]/ProductGallery.tsx`.
- **Modify:** `src/lib/repos/catalog.ts` (variants in `listActiveByLine` + `CatalogProduct` type), `src/components/ui/index.ts` (export `FadeImage`), `src/app/(shop)/page.tsx` (use `ProductCard`), `src/app/(shop)/producto/[id]/ProductDetailClient.tsx` (gallery + dots).

## 8. Testing / verification

- **Unit (TDD):** `productColors` (dedupe/order/hex/url-fallback/empty).
- **Build/tsc:** clean; `CatalogProduct.variants` threads through.
- **Browser walk-through** (prod build via `npm start`, per the dev-server Turbopack/font caveat; mobile ~390px + desktop ≥768px):
  1. Collection — a card with ≥2 colors shows dots; clicking a dot crossfades the card image; active dot ringed; tapping a dot does **not** navigate; tapping the image/name does.
  2. PDP — main image + thumbnail strip of all images; clicking a thumbnail crossfades the main and (for a color image) selects that color; selecting a color dot swaps the main image and highlights its thumbnail; Agregar still adds the selected variant.
  3. Responsive — thumbnails below main on mobile, vertical-left on desktop.

Implementation branches from `design-system`.
