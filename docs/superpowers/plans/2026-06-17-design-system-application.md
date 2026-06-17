# Corve Design System Application — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the app's placeholder warm palette with the real Corve cool-blue/periwinkle design system across the public shop and admin, visuals only.

**Architecture:** Map the DS tokens (`design_system/colors_and_type.css`) into Tailwind v4 `@theme`, load Dream Avenue (local) + DM Sans/Mono (Google) via `next/font`, add a small `src/components/ui/` primitive layer, then restyle all 18 surfaces in the app's existing utility idiom. The shop moves from dark-warm to light-cool; admin from light-warm to light-cool. No logic, copy, or data changes.

**Tech Stack:** Next.js 16, Tailwind v4, TypeScript, `next/font`. Spec: `docs/superpowers/specs/2026-06-17-design-system-application-design.md`.

## Global Constraints

- **Visuals only.** Never change Spanish copy, component logic, props, data flow, or routes. Only classNames, colors, fonts, and presentational markup (wrapping with `ui/` primitives, swapping decorative elements).
- **No gradients** anywhere (DS rule). Replace `from-[…] to-[…]` gradients with flat color or a `Blob`.
- **No dark mode.** Default background is white; text is `ink`.
- **Dream Avenue (`font-display`) is display-only** — use it ONLY for catalog line-cover titles and the `Wordmark`. Everything else is `font-sans` (DM Sans).
- **Buttons are always pill** via the `Button` primitive / `buttonClass`. **Inputs** use `inputClass`. **Cards** use `Card`.
- **Errors:** keep `text-red-600` (DS defines no error token; acceptable).
- Branch from `color-images`. Build must stay green at every task.

### Canonical swap reference (applies to every restyle task)

**Warm-DARK shop → light-cool:**

| Current | Becomes |
|---|---|
| `bg-[#161311]` (page/shell bg) | remove (white default); shell = `min-h-screen` only |
| `text-[#f4efe9]` / `text-white` (body text) | `text-ink` |
| muted `opacity-60/70/80` on text | `text-ink-2` (secondary) or `text-ink-3` (hint) |
| `bg-white/90 text-[#161311]` (CartPill) | `bg-royal text-ink-on-royal` |
| `bg-white/10` (inputs) | `inputClass` (`bg-white border border-line`) |
| `border-white/10` (dividers) | `border-line` |
| `border-white/40` (unselected chip) | `Button variant="ghost"` style (`border border-line-strong text-ink`) |
| `bg-white text-[#161311]` (selected chip) | `Button variant="soft"` style (`bg-periwinkle-2 text-royal`) |
| `bg-white text-[#161311] rounded-xl` (CTA) | `Button variant="primary"` (royal) |
| `from-[#d8c1ad] to-[#9a7a61]` cover gradient | `bg-royal` + a `Blob` |
| `from-[#d8c1ad] to-[#9a7a61]` tile/hero placeholder | `bg-mist` |
| `text-red-400` (error on dark) | `text-red-600` |

**Warm-LIGHT admin → light-cool:**

| Current | Becomes |
|---|---|
| `bg-[#fbf8f4]` (app bg) | `bg-snow` |
| `text-[#211d1a]` (body text) | `text-ink` |
| `bg-[#211d1a] text-[#d9cfc3]` (sidebar) | `bg-mist text-ink-2` |
| `bg-[#211d1a] text-white` / `bg-[#211d1a]` (buttons) | `Button variant="primary"` (royal) |
| `border-[#d8cdc0]` (input border) | `inputClass` (`border-line`) |
| `text-[#8a7d70]` / `text-[#a89c8e]` / `text-[#9a8b7d]` (muted) | `text-ink-3` |
| `text-[#6b5d50]` (secondary) | `text-ink-2` |
| `rounded-lg`/`rounded-xl` on buttons | `rounded-pill` (via `Button`) |
| card-ish containers | `Card` (`bg-white rounded-lg shadow-1`) |
| status chips (`pendiente`/`parcial`/etc.) | neutral `bg-mist text-ink-2`; active `bg-periwinkle-2 text-royal`; done `bg-lime text-ink` |

---

## Task 1: Token foundation (`globals.css`)

**Files:** Modify `src/app/globals.css` (full replace). Verified by build.

**Interfaces:**
- Produces: Tailwind utilities `bg-royal|royal-deep|periwinkle|periwinkle-2|mist|lime|snow|ink|ink-2|ink-3|ink-on-royal`, `border-line|line-strong`, `text-*` equivalents, `rounded-sm|md|lg|xl|pill`, `shadow-1|2|bold`, `font-display|sans|mono`, and a `.blob` class. Font vars `--font-dm-sans`, `--font-dm-mono`, `--font-dream-avenue` are supplied by Task 2.

- [ ] **Step 1: Replace the file**

Replace all of `src/app/globals.css` with:
```css
@import "tailwindcss";

:root {
  /* Brand palette */
  --periwinkle: #a0b5e7;
  --periwinkle-2: #c3d0ee;
  --mist: #eef1fb;
  --lime: #ddf344;
  --royal: #4849eb;
  --royal-deep: #2f30c4;
  --snow: #f5f9ff;
  /* Ink */
  --ink: #1a1b3a;
  --ink-2: #4a4c6e;
  --ink-3: #8487a4;
  --ink-on-royal: #f5f9ff;
  /* Border */
  --line: rgba(26, 27, 58, 0.12);
  --line-strong: rgba(26, 27, 58, 0.24);
}

@theme inline {
  --color-royal: var(--royal);
  --color-royal-deep: var(--royal-deep);
  --color-periwinkle: var(--periwinkle);
  --color-periwinkle-2: var(--periwinkle-2);
  --color-mist: var(--mist);
  --color-lime: var(--lime);
  --color-snow: var(--snow);
  --color-ink: var(--ink);
  --color-ink-2: var(--ink-2);
  --color-ink-3: var(--ink-3);
  --color-ink-on-royal: var(--ink-on-royal);
  --color-line: var(--line);
  --color-line-strong: var(--line-strong);

  --radius-sm: 12px;
  --radius-md: 18px;
  --radius-lg: 28px;
  --radius-xl: 44px;
  --radius-pill: 999px;

  --shadow-1: 0 1px 2px rgba(26, 27, 58, 0.06), 0 2px 8px rgba(26, 27, 58, 0.04);
  --shadow-2: 0 2px 4px rgba(26, 27, 58, 0.06), 0 12px 28px rgba(26, 27, 58, 0.08);
  --shadow-bold: 0 8px 28px rgba(72, 73, 235, 0.22);

  --font-display: var(--font-dream-avenue), "Cormorant Garamond", Georgia, serif;
  --font-sans: var(--font-dm-sans), -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif;
  --font-mono: var(--font-dm-mono), ui-monospace, Menlo, Consolas, monospace;
}

@utility blob {
  border-radius: 62% 38% 55% 45% / 50% 60% 40% 50%;
}

body {
  background: #ffffff;
  color: var(--ink);
}

::selection {
  background: var(--lime);
  color: var(--ink);
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: `✓ Compiled successfully`. (Font vars are undefined until Task 2 but resolve to the fallbacks — fine.)

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git -c user.name="CORVE" -c user.email="jhonatan0110011@gmail.com" commit -m "feat(ui): Corve design tokens in Tailwind theme"
```

---

## Task 2: Fonts, assets, metadata (`layout.tsx`)

**Files:** Modify `src/app/layout.tsx`; Create `src/app/fonts/DreamAvenue-Regular.otf`, `src/app/icon.png`, `public/logo-full.png`, `public/logo-isotipo.png` (copies). Verified by build.

**Interfaces:**
- Produces: CSS vars `--font-dm-sans`, `--font-dm-mono`, `--font-dream-avenue` on `<html>` (consumed by Task 1's `@theme`).

- [ ] **Step 1: Copy font + assets**

```bash
cd "C:/Users/jhona/OneDrive/Desktop/corve-app"
mkdir -p src/app/fonts
cp design_system/fonts/DreamAvenue-Regular.otf src/app/fonts/DreamAvenue-Regular.otf
cp design_system/assets/logo-full.png public/logo-full.png
cp design_system/assets/logo-isotipo.png public/logo-isotipo.png
cp design_system/assets/logo-isotipo.png src/app/icon.png
```

- [ ] **Step 2: Replace `src/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { DM_Sans, DM_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-dm-sans",
});
const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-mono",
});
const dreamAvenue = localFont({
  src: "./fonts/DreamAvenue-Regular.otf",
  weight: "400",
  display: "swap",
  variable: "--font-dream-avenue",
});

export const metadata: Metadata = {
  title: "CORVE",
  description: "Activewear que se mueve contigo.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      className={`${dmSans.variable} ${dmMono.variable} ${dreamAvenue.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: Build & verify fonts resolve**

Run: `npm run build`
Expected: `✓ Compiled successfully` (next/font fetches DM Sans/Mono and bundles Dream Avenue).

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx src/app/fonts src/app/icon.png public/logo-full.png public/logo-isotipo.png
git -c user.name="CORVE" -c user.email="jhonatan0110011@gmail.com" commit -m "feat(ui): Dream Avenue + DM Sans fonts, Corve metadata and favicon"
```

---

## Task 3: UI primitives (`src/components/ui/`)

**Files:** Create `src/components/ui/{Button,Card,Field,Eyebrow,Blob,Wordmark,index}.tsx`. Verified by build/tsc.

**Interfaces:**
- Produces:
  - `buttonClass(variant?, size?): string` and `Button` (`<button>` with `variant`, `size`, `className`, all button props).
  - `Card` (`<div>` props + `className`).
  - `inputClass: string`; `Field` (`label?: string`, `error?: string`, wraps children).
  - `Eyebrow` (`className?`, children).
  - `Blob` (`fill?: "periwinkle"|"periwinkle-2"|"lime"|"royal"`, `className?`, `style?`).
  - `Wordmark` (`href?: string`, `className?`).
  - Barrel: `@/components/ui`.

- [ ] **Step 1: Button**

Create `src/components/ui/Button.tsx`:
```tsx
import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "accent" | "ghost" | "soft";
export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center rounded-pill font-medium transition active:translate-y-px active:scale-[.98] disabled:opacity-40 disabled:pointer-events-none";
const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-royal text-ink-on-royal shadow-bold hover:bg-royal-deep",
  accent: "bg-lime text-ink hover:brightness-95",
  ghost: "border border-line-strong text-ink hover:bg-ink/5",
  soft: "bg-periwinkle-2 text-royal hover:bg-periwinkle",
};
const SIZES: Record<ButtonSize, string> = {
  sm: "text-xs px-4 py-2",
  md: "text-sm px-5 py-3",
  lg: "text-base px-7 py-4",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md"): string {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]}`;
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({ variant = "primary", size = "md", className = "", ...props }: Props) {
  return <button className={`${buttonClass(variant, size)} ${className}`} {...props} />;
}
```

- [ ] **Step 2: Card, Eyebrow, Blob, Wordmark**

Create `src/components/ui/Card.tsx`:
```tsx
import type { HTMLAttributes } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`bg-white rounded-lg shadow-1 ${className}`} {...props} />;
}
```

Create `src/components/ui/Eyebrow.tsx`:
```tsx
import type { HTMLAttributes } from "react";

export function Eyebrow({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`text-[12px] uppercase tracking-[0.18em] font-medium text-ink-2 ${className}`}
      {...props}
    />
  );
}
```

Create `src/components/ui/Blob.tsx`:
```tsx
type Fill = "periwinkle" | "periwinkle-2" | "lime" | "royal";

export function Blob({
  fill = "periwinkle",
  className = "",
  style,
}: {
  fill?: Fill;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      aria-hidden
      className={`blob ${className}`}
      style={{ background: `var(--${fill})`, ...style }}
    />
  );
}
```

Create `src/components/ui/Wordmark.tsx`:
```tsx
import Link from "next/link";

export function Wordmark({ href = "/", className = "" }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={`font-display lowercase text-ink ${className}`}>
      corve
    </Link>
  );
}
```

- [ ] **Step 3: Field + inputClass**

Create `src/components/ui/Field.tsx`:
```tsx
export const inputClass =
  "w-full rounded-sm border border-line bg-white p-3 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-royal/40";

export function Field({
  label,
  error,
  children,
}: {
  label?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      {label && (
        <div className="text-[12px] uppercase tracking-[0.18em] font-medium text-ink-2">{label}</div>
      )}
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Barrel**

Create `src/components/ui/index.ts`:
```ts
export { Button, buttonClass } from "./Button";
export type { ButtonVariant, ButtonSize } from "./Button";
export { Card } from "./Card";
export { Eyebrow } from "./Eyebrow";
export { Blob } from "./Blob";
export { Wordmark } from "./Wordmark";
export { Field, inputClass } from "./Field";
```

- [ ] **Step 5: Build & commit**

Run: `npx tsc --noEmit` (exit 0) then `npm run build` (compiles; tree-shaking drops unused exports — fine).
```bash
git add src/components/ui
git -c user.name="CORVE" -c user.email="jhonatan0110011@gmail.com" commit -m "feat(ui): Button, Card, Field, Eyebrow, Blob, Wordmark primitives"
```

---

## Task 4: Shop shell + catalog (light-cool + bold covers)

**Files:** Replace `src/app/(shop)/layout.tsx`, `src/app/(shop)/CartPill.tsx`, `src/app/(shop)/page.tsx`. Verified by build.

**Interfaces:**
- Consumes: `Wordmark`, `Button`/`buttonClass`, `Card`, `Eyebrow`, `Blob` from `@/components/ui`; `pickProductImage` from `@/domain/product-image`.

- [ ] **Step 1: Shell**

Replace `src/app/(shop)/layout.tsx`:
```tsx
import { CartProvider } from "@/lib/cart/CartContext";
import { Wordmark } from "@/components/ui";
import CartPill from "./CartPill";

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <div className="min-h-screen bg-white text-ink">
        <header className="flex items-center justify-between px-5 py-4 border-b border-line">
          <Wordmark className="text-2xl" />
          <CartPill />
        </header>
        {children}
      </div>
    </CartProvider>
  );
}
```

Replace `src/app/(shop)/CartPill.tsx`:
```tsx
"use client";
import Link from "next/link";
import { useCart } from "@/lib/cart/CartContext";
import { buttonClass } from "@/components/ui";

export default function CartPill() {
  const { count } = useCart();
  return (
    <Link href="/carrito" className={buttonClass("primary", "sm")}>
      🛍 {count}
    </Link>
  );
}
```

- [ ] **Step 2: Catalog (bold royal covers + Card tiles)**

Replace `src/app/(shop)/page.tsx`:
```tsx
import Link from "next/link";
import Image from "next/image";
import { listActiveByLine } from "@/lib/repos/catalog";
import { formatMXN } from "@/domain/money";
import { pickProductImage } from "@/domain/product-image";
import { Card, Eyebrow, Blob } from "@/components/ui";
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
          <div className="relative h-[60vh] flex flex-col justify-end p-6 overflow-hidden bg-royal text-ink-on-royal">
            <Blob fill="periwinkle" className="absolute -top-16 -right-10 w-72 h-72 opacity-80" />
            <Blob fill="lime" className="absolute -bottom-20 -left-10 w-64 h-64 opacity-90 mix-blend-screen" />
            <div className="relative">
              <Eyebrow className="text-periwinkle-2 mb-2">CORVE {s.line}</Eyebrow>
              <h2 className="font-display text-5xl leading-none">{s.title}</h2>
              <p className="italic opacity-80 mt-2">{s.message}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 p-4">
            {s.products.map((p) => {
              const url = pickProductImage(p.product_images.map((i) => ({ url: i.url, color: i.color })), null);
              return (
                <Link key={p.id} href={`/producto/${p.id}`} className="block">
                  <Card className="relative h-44 overflow-hidden bg-mist">
                    {url && <Image src={url} alt={p.name} fill sizes="50vw" className="object-cover" />}
                  </Card>
                  <div className="text-sm mt-2 text-ink">{p.name}</div>
                  <div className="text-sm text-ink-2">{formatMXN(p.price)}</div>
                </Link>
              );
            })}
            {s.products.length === 0 && <p className="text-ink-3 text-sm">Pronto.</p>}
          </div>
        </section>
      ))}
    </main>
  );
}
```

- [ ] **Step 3: Build & commit**

Run: `npm run build` (compiles). Manual: catalog covers are royal with blobs + Dream Avenue titles; tiles are white cards.
```bash
git add "src/app/(shop)/layout.tsx" "src/app/(shop)/CartPill.tsx" "src/app/(shop)/page.tsx"
git -c user.name="CORVE" -c user.email="jhonatan0110011@gmail.com" commit -m "feat(shop): light-cool shell + bold royal catalog covers"
```

---

## Task 5: Product detail + cart + confirmation

**Files:** Replace `src/app/(shop)/producto/[id]/ProductDetailClient.tsx`, `src/app/(shop)/carrito/page.tsx`; Modify `src/app/(shop)/pedido/[id]/page.tsx` (read + swap). Verified by build.

**Interfaces:**
- Consumes: `Button`, `Card`, `inputClass`, `Eyebrow` from `@/components/ui`.

- [ ] **Step 1: Product detail (light, chips, royal Agregar)**

Replace `src/app/(shop)/producto/[id]/ProductDetailClient.tsx`:
```tsx
"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart/CartContext";
import { availableByColor, type AvailVariant } from "@/domain/availability";
import { pickProductImage, type ImageChoice } from "@/domain/product-image";
import { formatMXN } from "@/domain/money";
import { Button, Eyebrow } from "@/components/ui";

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
      <div className="relative h-72 bg-mist">
        {heroUrl && <Image src={heroUrl} alt={productName} fill sizes="100vw" className="object-cover" />}
      </div>
      <div className="p-4">
        <h1 className="text-2xl font-semibold text-ink">{productName}</h1>
        <div className="text-ink-2 mb-2">{formatMXN(price)} · CORVE {line}</div>
        {description && <p className="italic text-sm text-ink-2">{description}</p>}
      </div>
      <div className="p-4 space-y-3">
        <Eyebrow>Color</Eyebrow>
        <div className="flex gap-2">
          {colors.map((c) => (
            <button key={c.color} onClick={() => { setColor(c.color); setSize(""); }}
              className={`px-3 py-1 rounded-pill border text-sm transition ${c.color === color ? "bg-periwinkle-2 text-royal border-transparent" : "border-line-strong text-ink"}`}>
              {c.color}
            </button>
          ))}
        </div>
        <Eyebrow>Talla</Eyebrow>
        <div className="flex gap-2">
          {sizes.map((s) => (
            <button key={s.size} disabled={!s.inStock} onClick={() => setSize(s.size)}
              className={`px-3 py-1 rounded-pill border text-sm transition ${s.size === size ? "bg-periwinkle-2 text-royal border-transparent" : "border-line-strong text-ink"} ${!s.inStock ? "opacity-30 line-through" : ""}`}>
              {s.size}
            </button>
          ))}
        </div>
        <Button variant="primary" disabled={!chosen} className="w-full"
          onClick={() => {
            if (!chosen) return;
            add({ variantId: chosen.id, productId, productName, color, size, unitPrice: price, qty: 1 });
            router.push("/carrito");
          }}>
          Agregar · {formatMXN(price)}
        </Button>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Cart / checkout**

Replace `src/app/(shop)/carrito/page.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart/CartContext";
import { cartSubtotal } from "@/domain/cart";
import { formatMXN } from "@/domain/money";
import { validateCheckout } from "@/domain/checkout";
import { Button, Card, inputClass } from "@/components/ui";
import { submitOrder } from "./actions";

export default function CartPage() {
  const router = useRouter();
  const { items, setQty, remove, clear, count } = useCart();
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  const subtotal = cartSubtotal(items.map((i) => ({ variantId: i.variantId, unitPrice: i.unitPrice, qty: i.qty })));

  async function onSubmit() {
    const v = validateCheckout({ name, whatsapp, itemCount: count });
    if (!v.ok) { setErrors(v.errors); return; }
    setErrors({}); setPending(true);
    const res = await submitOrder({
      name, whatsapp, note,
      items: items.map((i) => ({ variant_id: i.variantId, qty: i.qty })),
    });
    setPending(false);
    if (!res.ok) {
      setErrors({ cart: res.reason === "insufficient_stock" ? "Una prenda se agotó. Ajusta tu carrito." : "No se pudo enviar el pedido." });
      return;
    }
    sessionStorage.setItem("corve-last-order", JSON.stringify({
      id: res.id, name,
      items: items.map((i) => ({ productName: i.productName, color: i.color, size: i.size, qty: i.qty, unitPrice: i.unitPrice })),
      total: subtotal,
    }));
    clear();
    router.push(`/pedido/${res.id}`);
  }

  return (
    <main className="p-4 max-w-md mx-auto">
      <h1 className="text-xl font-semibold mb-3 text-ink">Tu pedido</h1>
      {items.length === 0 && <p className="text-ink-3">Tu carrito está vacío.</p>}
      <ul className="space-y-2">
        {items.map((i) => (
          <Card key={i.variantId} className="flex items-center gap-2 text-sm p-3">
            <div className="flex-1">
              <div className="text-ink">{i.productName}</div>
              <div className="text-ink-3">{i.color} · {i.size}</div>
            </div>
            <input type="number" min={1} value={i.qty}
              onChange={(e) => setQty(i.variantId, Number(e.target.value))}
              className="w-14 rounded-sm border border-line p-1 text-center text-ink" />
            <button onClick={() => remove(i.variantId)} className="text-ink-3 hover:text-ink">✕</button>
          </Card>
        ))}
      </ul>
      {items.length > 0 && (
        <>
          <div className="flex justify-between border-t border-line mt-3 pt-3 text-sm text-ink">
            <span>Subtotal</span><span>{formatMXN(subtotal)} MXN</span>
          </div>
          <div className="space-y-2 mt-4">
            <input placeholder="Tu nombre" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
            {errors.name && <p className="text-red-600 text-xs">{errors.name}</p>}
            <input placeholder="WhatsApp (con lada)" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className={inputClass} />
            {errors.whatsapp && <p className="text-red-600 text-xs">{errors.whatsapp}</p>}
            <textarea placeholder="Nota / zona de entrega (opcional)" value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
            {errors.cart && <p className="text-red-600 text-xs">{errors.cart}</p>}
            <Button variant="primary" onClick={onSubmit} disabled={pending} className="w-full">
              {pending ? "Enviando…" : "Enviar pedido"}
            </Button>
          </div>
        </>
      )}
    </main>
  );
}
```

- [ ] **Step 3: Confirmation page (read + swap)**

Read `src/app/(shop)/pedido/[id]/page.tsx`. Apply the **Warm-DARK shop → light-cool** swap table. Specifically: ensure the page reads on white/ink (remove any dark bg / white text), wrap the order summary in `Card`, and render the WhatsApp action as the primary CTA — if it is an `<a href>`, give it `className={buttonClass("primary","lg")}` (import `buttonClass` from `@/components/ui`); if a `<button>`, use `<Button variant="primary">`. Keep all Spanish copy and the `wa.me` link logic unchanged.

- [ ] **Step 4: Build & commit**

Run: `npm run build` (compiles). Manual: PDP chips toggle periwinkle; Agregar is royal; cart fields are bordered on white; confirmation WhatsApp button is royal.
```bash
git add "src/app/(shop)/producto/[id]/ProductDetailClient.tsx" "src/app/(shop)/carrito/page.tsx" "src/app/(shop)/pedido/[id]/page.tsx"
git -c user.name="CORVE" -c user.email="jhonatan0110011@gmail.com" commit -m "feat(shop): restyle product detail, cart, confirmation"
```

---

## Task 6: Admin shell + login

**Files:** Replace `src/app/admin/layout.tsx`, `src/app/admin/login/page.tsx`. Verified by build.

**Interfaces:**
- Consumes: `Wordmark`, `Button`, `Card`, `inputClass`, `Blob` from `@/components/ui`.

- [ ] **Step 1: Admin shell**

Replace `src/app/admin/layout.tsx`:
```tsx
import Link from "next/link";
import { Wordmark } from "@/components/ui";
import { signOut } from "./login/actions";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-snow text-ink">
      <aside className="w-44 bg-mist text-ink-2 p-4 text-sm flex flex-col border-r border-line">
        <Wordmark href="/admin/pedidos" className="text-xl pb-4" />
        <nav className="space-y-1 flex-1">
          <Link href="/admin/pedidos" className="block py-2 hover:text-royal">Pedidos</Link>
          <Link href="/admin/products" className="block py-2 hover:text-royal">Productos</Link>
          <Link href="/admin/inventory" className="block py-2 hover:text-royal">Inventario</Link>
          <Link href="/admin/compras" className="block py-2 hover:text-royal">Compras</Link>
          <Link href="/admin/ventas" className="block py-2 hover:text-royal">Ventas</Link>
          <Link href="/admin/proveedores" className="block py-2 hover:text-royal">Proveedores</Link>
        </nav>
        <form action={signOut}>
          <button className="text-left py-2 text-ink-3 hover:text-royal">Cerrar sesión</button>
        </form>
      </aside>
      <main className="flex-1">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Login (soft branded panel)**

Replace `src/app/admin/login/page.tsx`:
```tsx
"use client";

import { useActionState } from "react";
import { Button, Card, Wordmark, inputClass, Blob } from "@/components/ui";
import { signIn } from "./actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, undefined);
  return (
    <main className="min-h-screen flex items-center justify-center bg-snow text-ink relative overflow-hidden">
      <Blob fill="periwinkle" className="absolute -top-24 -left-16 w-80 h-80 opacity-50" />
      <Card className="w-80 p-6 relative">
        <form action={formAction} className="space-y-3">
          <Wordmark href="/admin/pedidos" className="block text-center text-2xl" />
          <p className="text-center text-sm text-ink-3">Panel de administración</p>
          <input name="email" type="email" required placeholder="Correo" className={inputClass} />
          <input name="password" type="password" required placeholder="Contraseña" className={inputClass} />
          {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
          <Button type="submit" variant="primary" disabled={pending} className="w-full">
            {pending ? "Entrando…" : "Entrar"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
```

- [ ] **Step 3: Build & commit**

Run: `npm run build` (compiles). Manual: admin shows mist sidebar + ink links; login is a white card with a periwinkle blob + royal button.
```bash
git add src/app/admin/layout.tsx src/app/admin/login/page.tsx
git -c user.name="CORVE" -c user.email="jhonatan0110011@gmail.com" commit -m "feat(admin): light-cool shell + branded login"
```

---

## Task 7: Admin — products (list, editor, form)

**Files:** Modify `src/app/admin/products/page.tsx`, `src/app/admin/products/[id]/page.tsx`, `src/app/admin/products/[id]/ProductForm.tsx`. Verified by build.

**Interfaces:**
- Consumes: `Button`/`buttonClass`, `Card`, `inputClass`, `Eyebrow` from `@/components/ui`.

- [ ] **Step 1: Apply swaps to all three files**

For each file: **Read it**, then apply the **Warm-LIGHT admin → light-cool** swap table exactly. Concretely:
- Replace every `bg-[#211d1a] text-white` (or `text-[#d9cfc3]`) button with `<Button variant="primary" …>` (move existing `onClick`/`type`/`disabled`/`form` props onto `Button`; drop the old `rounded-*`/`bg`/`px`/`py` classes). For buttons inside server-action `<form>` that are anchors, use `className={buttonClass("primary","sm")}`.
- Replace every input/select `className="… border border-[#d8cdc0] …"` with `className={inputClass}` (keep `name`/`type`/`defaultValue`/etc.).
- Replace muted text colors per the table (`text-[#6b5d50]`→`text-ink-2`, `text-[#9a8b7d]`/`#8a7d70`→`text-ink-3`).
- Wrap each list row / panel container that currently relies on a warm border or bg in `<Card className="p-3 …">`.
- Keep the existing image-thumbnail markup (color label + "eliminar"); just ensure its container reads on white and the thumbnail stays `rounded-md`.
- Secondary buttons (e.g. "+ Variante", "Corregir", "eliminar") may use `<Button variant="ghost" size="sm">` or `variant="soft"` for a lighter weight — pick `ghost` for destructive/secondary, `primary` for the main save/create action.

- [ ] **Step 2: Build & commit**

Run: `npm run build` (compiles) and `npx tsc --noEmit` (exit 0). Manual: the product editor uses white cards, bordered inputs, royal primary buttons; no warm tones remain.
```bash
git add "src/app/admin/products"
git -c user.name="CORVE" -c user.email="jhonatan0110011@gmail.com" commit -m "feat(admin): restyle products list and editor"
```

---

## Task 8: Admin — inventory, pedidos, compras, ventas, proveedores

**Files:** Modify `src/app/admin/inventory/page.tsx`, `src/app/admin/pedidos/page.tsx`, `src/app/admin/pedidos/[id]/page.tsx`, `src/app/admin/compras/page.tsx`, `src/app/admin/compras/[id]/page.tsx`, `src/app/admin/ventas/page.tsx`, `src/app/admin/proveedores/page.tsx`. Verified by build.

**Interfaces:**
- Consumes: `Button`/`buttonClass`, `Card`, `inputClass`, `Eyebrow` from `@/components/ui`.

- [ ] **Step 1: Apply swaps to each file**

For each of the seven files: **Read it**, apply the **Warm-LIGHT admin → light-cool** swap table (identical rules to Task 7 Step 1). Additionally:
- Section/column headers and metric labels → wrap in `<Eyebrow>` where they are short uppercase-style labels.
- Metric/summary panels (Ventas totals, Compras totals) → `<Card className="p-4">` with `text-ink` numbers and `text-ink-2` captions.
- **Status chips** (order `pendiente`/`pagado`/`cancelado`, PO `borrador`/`parcial`/`recibida`): apply the swap-reference chip rule — neutral `bg-mist text-ink-2`, in-progress `bg-periwinkle-2 text-royal`, done `bg-lime text-ink`. Keep the Spanish labels and the conditional that picks them; only change the color classes.
- Date/number filter inputs and selects → `className={inputClass}`.
- Primary action buttons (e.g. "Marcar pagado", "Recibir", "+ Proveedor", "Crear OC") → `<Button variant="primary">`; secondary/destructive (e.g. "Cancelar") → `<Button variant="ghost">`.

- [ ] **Step 2: Build & commit**

Run: `npm run build` (compiles) and `npx tsc --noEmit` (exit 0). Manual: each admin report reads on snow/white with cool chips and royal actions.
```bash
git add "src/app/admin/inventory" "src/app/admin/pedidos" "src/app/admin/compras" "src/app/admin/ventas" "src/app/admin/proveedores"
git -c user.name="CORVE" -c user.email="jhonatan0110011@gmail.com" commit -m "feat(admin): restyle inventory, pedidos, compras, ventas, proveedores"
```

---

## Task 9: Verification gate

**Files:** none.

- [ ] **Step 1: No warm hex remains**

Run (PowerShell-safe via Grep tool or rg):
```bash
rg -n "#161311|#211d1a|#d8c1ad|#9a7a61|#6b5d50|#d8cdc0|#9a8b7d|#f4efe9|#fbf8f4|#d9cfc3|#8a7d70|#a89c8e|from-\[#|to-\[#|bg-white/10|border-white/" src
```
Expected: **no matches**. If any remain, fix them per the swap reference, then re-run.

- [ ] **Step 2: Tests + types + build**

Run: `npm test` (71 pass — styling adds none), `npx tsc --noEmit` (exit 0), `npm run build` (compiles).

- [ ] **Step 3: Browser walk-through** (local stack up, dev server running):
  1. **Catalog `/`** — royal covers with blobs + Dream Avenue titles (confirm the serif actually loaded, not the Georgia fallback); white card tiles with images.
  2. **Product** — image hero, periwinkle color/size chips, royal "Agregar".
  3. **Cart** — white cards, bordered inputs, royal "Enviar pedido".
  4. **Confirmation** — royal WhatsApp button; summary card.
  5. **Admin** — login (white card + blob + royal button); pedidos/products/inventory/compras/ventas/proveedores each on snow with mist sidebar, cool chips, royal actions.
  6. Spot-check contrast: `ink` text on white/mist; `ink-on-royal` on royal covers/buttons.

- [ ] **Step 4: Final commit (if any walk-through fixes)**

```bash
git add -A
git -c user.name="CORVE" -c user.email="jhonatan0110011@gmail.com" commit -m "fix(ui): design-system walk-through polish"
```

---

## Self-Review (completed by plan author)

- **Spec coverage:** tokens+@theme (T1); fonts+assets+metadata (T2); `ui/` primitives — Button/Card/Field/Eyebrow/Blob/Wordmark (T3); soft/bold registers + per-surface restyle — shop shell+covers (T4), PDP+cart+confirmation (T5), admin shell+login (T6), admin products (T7), admin reports (T8); motion rules baked into `Button`/`Card`; verification incl. grep gate + browser walk-through (T9). WhatsApp=royal and product-name=sans decisions encoded in T5. Copy/data/logic untouched (Global Constraints).
- **Placeholder scan:** Tasks 1–6 carry full code; Tasks 7–8 are deterministic swap-table applications over files whose exact current text the implementer reads first (the table is the explicit "how"). No TBD/TODO.
- **Type consistency:** `buttonClass(variant,size)`/`Button` props, `Card`, `inputClass`/`Field`, `Eyebrow`, `Blob(fill)`, `Wordmark(href)` are defined in T3 and consumed with those exact names/signatures in T4–T8. `pickProductImage` usage unchanged from the existing code.

---

## After this feature
At deploy, the catalog `next/image` Supabase host still needs the cloud entry in `next.config.ts` (carried from the per-color-images plan). No new deploy steps from this restyle.
