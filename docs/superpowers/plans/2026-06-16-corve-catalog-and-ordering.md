# CORVE Public Catalog & Ordering — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the public, shareable, no-login immersive catalog (direction C) where customers browse active products by line, add color/size variants to a cart, and place an order — plus the admin "Pedidos" area to process orders (status transitions and cancellation that restores stock).

**Architecture:** Next.js App Router. Public routes under `/` (catalog, product detail, cart, checkout, confirmation) read data as the `anon` role via new RLS policies. Order placement goes through one atomic `place_order` Postgres function (`SECURITY DEFINER`) that locks variant rows, decrements stock, snapshots `order_items`, logs `pedido` movements, and rolls back entirely on oversell — so anon never needs direct insert grants. The cart is client-side (React context + localStorage), since there are no accounts. Admin order management reuses Plan 2's authenticated/RLS access; cancellation restores stock via the `restoreStock` domain function, guarded by `orders.stock_restored`. Money stays integer centavos.

**Tech Stack:** Next.js 16, TypeScript, Tailwind 4, Supabase (Postgres + RLS + RPC), Vitest. Builds on Plan 1 (`@/domain/*` incl. `decrementStock`/`restoreStock`/`cartSubtotal`) and Plan 2 (admin, local stack, `0002_rls.sql`).

This is Phase 3 of 4 (Foundation → Admin → **Catalog & Ordering** → Purchasing/Sales). Depends on Plans 1–2 on the branch. Requires the local Supabase stack running (Plan 2 Task 1).

---

## File Structure

- `supabase/migrations/0003_catalog_orders.sql` — CREATE: anon catalog-read RLS + grants; `place_order` RPC + anon EXECUTE.
- `src/domain/checkout.ts` (+ `.test.ts`) — CREATE: `validateCheckout` (pure).
- `src/domain/whatsapp.ts` (+ `.test.ts`) — CREATE: `buildWhatsAppLink` (pure).
- `src/domain/availability.ts` (+ `.test.ts`) — CREATE: `availableByColor` for product detail (pure).
- `src/lib/repos/catalog.ts` — CREATE: anon catalog reads (server).
- `src/lib/repos/orders.ts` — CREATE: `placeOrder` (RPC wrapper), `getOrder`, admin order list/detail/status/cancel (server).
- `src/lib/cart/CartContext.tsx` — CREATE: client cart provider (localStorage).
- `src/lib/cart/types.ts` — CREATE: cart item shape shared client/server.
- `src/app/(shop)/layout.tsx` — CREATE: public shop shell (cart pill).
- `src/app/(shop)/page.tsx` — CREATE: catalog entry (line covers + products).
- `src/app/(shop)/producto/[id]/page.tsx` + `AddToCart.tsx` — CREATE: product detail + add-to-cart client.
- `src/app/(shop)/carrito/page.tsx` — CREATE: cart + checkout form.
- `src/app/(shop)/carrito/actions.ts` — CREATE: `submitOrder` server action.
- `src/app/(shop)/pedido/[id]/page.tsx` — CREATE: confirmation + WhatsApp link.
- `src/app/admin/pedidos/page.tsx` — CREATE: orders list.
- `src/app/admin/pedidos/[id]/page.tsx` + `actions.ts` — CREATE: order detail, status change, cancel.
- `src/app/admin/layout.tsx` — MODIFY: add "Pedidos" nav link.

Domain modules stay pure. Catalog/order repos are `server-only`. The public catalog lives in a `(shop)` route group so it does not inherit the admin layout.

---

## Task 1: Migration — anon catalog RLS + atomic place_order RPC

**Files:** Create `supabase/migrations/0003_catalog_orders.sql`. Requires the local stack running.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0003_catalog_orders.sql`:
```sql
-- Public catalog read access (anon) + atomic guest order placement.

-- anon may read ONLY active products and the variants/images of active products.
grant select on products, variants, product_images to anon;

create policy public_read_active_products on products
  for select to anon using (status = 'active');

create policy public_read_active_variants on variants
  for select to anon using (
    exists (select 1 from products p where p.id = variants.product_id and p.status = 'active')
  );

create policy public_read_active_images on product_images
  for select to anon using (
    exists (select 1 from products p where p.id = product_images.product_id and p.status = 'active')
  );

-- Atomic order placement. Runs as owner (bypasses RLS) so anon needs no insert grants.
-- Locks each variant row, refuses to oversell, snapshots items, logs 'pedido' movements.
-- Any exception rolls back the whole order.
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
    values (v_order_id, v_variant.id, v_product.name, v_product.line, v_variant.color, v_variant.size,
            v_product.price, v_product.cost, v_qty);

    insert into stock_movements (variant_id, delta, type, reference)
    values (v_variant.id, -v_qty, 'pedido', '#' || left(v_order_id::text, 8));

    v_total := v_total + v_product.price * v_qty;
  end loop;

  update orders set total = v_total where id = v_order_id;
  return v_order_id;
end;
$$;

grant execute on function place_order(text, text, text, jsonb) to anon, authenticated;
```

- [ ] **Step 2: Apply & verify**

Run `npx supabase db reset` (re-applies 0001–0003 + seed). Then verify with a throwaway script (place it in the project, run, delete) using the local anon key — confirm: (a) anon can SELECT an active product but NOT a draft one; (b) calling `rpc('place_order', ...)` as anon for an in-stock variant returns an order id and decrements stock + logs a `pedido` movement; (c) a second call exceeding stock throws `insufficient_stock` and leaves stock unchanged (atomic rollback). To set up data, insert (as service role) one active product + variant with stock 2. Assert the oversell call (qty 5) fails and stock is still the post-first-order value.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0003_catalog_orders.sql
git commit -m "feat(db): anon catalog RLS and atomic place_order RPC"
```

---

## Task 2: validateCheckout (pure, TDD)

**Files:** Create `src/domain/checkout.ts`, `src/domain/checkout.test.ts`.

- [ ] **Step 1: Failing test** — create `src/domain/checkout.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { validateCheckout } from "@/domain/checkout";

describe("validateCheckout", () => {
  const ok = { name: "Ana", whatsapp: "5215512345678", itemCount: 2 };
  it("accepts valid checkout", () => {
    expect(validateCheckout(ok)).toEqual({ ok: true });
  });
  it("requires a name", () => {
    const r = validateCheckout({ ...ok, name: "  " });
    expect(r).toEqual({ ok: false, errors: { name: "Tu nombre es obligatorio" } });
  });
  it("requires a whatsapp with at least 10 digits", () => {
    const r = validateCheckout({ ...ok, whatsapp: "55-1234" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.whatsapp).toBeDefined();
  });
  it("rejects an empty cart", () => {
    const r = validateCheckout({ ...ok, itemCount: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.cart).toBeDefined();
  });
});
```

- [ ] **Step 2: Run** `npm test -- checkout` → FAIL (module not found).

- [ ] **Step 3: Implement** — create `src/domain/checkout.ts`:
```ts
export interface CheckoutInput {
  name: string;
  whatsapp: string;
  itemCount: number;
}

export type CheckoutValidation =
  | { ok: true }
  | { ok: false; errors: Record<string, string> };

/** Validate the guest checkout form (name, WhatsApp with >=10 digits, non-empty cart). */
export function validateCheckout(input: CheckoutInput): CheckoutValidation {
  const errors: Record<string, string> = {};
  if (input.name.trim() === "") errors.name = "Tu nombre es obligatorio";
  const digits = input.whatsapp.replace(/\D/g, "");
  if (digits.length < 10) errors.whatsapp = "WhatsApp inválido (incluye lada)";
  if (input.itemCount <= 0) errors.cart = "Tu carrito está vacío";
  return Object.keys(errors).length === 0 ? { ok: true } : { ok: false, errors };
}
```

- [ ] **Step 4: Run** `npm test -- checkout` → PASS (4).

- [ ] **Step 5: Commit**
```bash
git add src/domain/checkout.ts src/domain/checkout.test.ts
git commit -m "feat(domain): validateCheckout for guest orders"
```

---

## Task 3: buildWhatsAppLink (pure, TDD)

**Files:** Create `src/domain/whatsapp.ts`, `src/domain/whatsapp.test.ts`.

- [ ] **Step 1: Failing test** — create `src/domain/whatsapp.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildWhatsAppLink } from "@/domain/whatsapp";

describe("buildWhatsAppLink", () => {
  it("builds a wa.me link with a url-encoded message", () => {
    const link = buildWhatsAppLink("52 (55) 1234-5678", "Hola CORVE, pedido #abc");
    expect(link).toBe("https://wa.me/525512345678?text=Hola%20CORVE%2C%20pedido%20%23abc");
  });
  it("strips all non-digits from the phone", () => {
    expect(buildWhatsAppLink("+52-55-0000", "x")).toBe("https://wa.me/52550000?text=x");
  });
});
```

- [ ] **Step 2: Run** `npm test -- whatsapp` → FAIL.

- [ ] **Step 3: Implement** — create `src/domain/whatsapp.ts`:
```ts
/** Build a wa.me deep link to a phone with a prefilled message. */
export function buildWhatsAppLink(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
```

- [ ] **Step 4: Run** `npm test -- whatsapp` → PASS (2).

- [ ] **Step 5: Commit**
```bash
git add src/domain/whatsapp.ts src/domain/whatsapp.test.ts
git commit -m "feat(domain): buildWhatsAppLink deep link"
```

---

## Task 4: availableByColor (pure, TDD)

**Files:** Create `src/domain/availability.ts`, `src/domain/availability.test.ts`.

Product detail needs, per color, which sizes are in stock (stock > 0) vs sold-out, in canonical size order.

- [ ] **Step 1: Failing test** — create `src/domain/availability.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { availableByColor, type AvailVariant } from "@/domain/availability";

const variants: AvailVariant[] = [
  { color: "Negro", size: "M", stock: 3 },
  { color: "Negro", size: "S", stock: 0 },
  { color: "Negro", size: "XS", stock: 5 },
  { color: "Arena", size: "M", stock: 2 },
];

describe("availableByColor", () => {
  it("groups by color with sizes in canonical order and an inStock flag", () => {
    expect(availableByColor(variants)).toEqual([
      { color: "Negro", sizes: [
        { size: "XS", inStock: true },
        { size: "S", inStock: false },
        { size: "M", inStock: true },
      ] },
      { color: "Arena", sizes: [
        { size: "M", inStock: true },
      ] },
    ]);
  });
  it("handles no variants", () => {
    expect(availableByColor([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run** `npm test -- availability` → FAIL.

- [ ] **Step 3: Implement** — create `src/domain/availability.ts`:
```ts
export interface AvailVariant {
  color: string;
  size: string;
  stock: number;
}

export interface ColorAvailability {
  color: string;
  sizes: { size: string; inStock: boolean }[];
}

const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL"];

function orderSizes(sizes: string[]): string[] {
  const known = SIZE_ORDER.filter((s) => sizes.includes(s));
  const unknown = sizes.filter((s) => !SIZE_ORDER.includes(s));
  return [...known, ...unknown];
}

/** Group variants by color (first-seen order); list each color's sizes in canonical order with an inStock flag. */
export function availableByColor(variants: AvailVariant[]): ColorAvailability[] {
  const byColor = new Map<string, Map<string, number>>();
  const colorOrder: string[] = [];
  for (const v of variants) {
    if (!byColor.has(v.color)) {
      byColor.set(v.color, new Map());
      colorOrder.push(v.color);
    }
    byColor.get(v.color)!.set(v.size, v.stock);
  }
  return colorOrder.map((color) => {
    const sizeMap = byColor.get(color)!;
    const sizes = orderSizes([...sizeMap.keys()]).map((size) => ({
      size,
      inStock: (sizeMap.get(size) ?? 0) > 0,
    }));
    return { color, sizes };
  });
}
```

- [ ] **Step 4: Run** `npm test -- availability` → PASS (2).

- [ ] **Step 5: Commit**
```bash
git add src/domain/availability.ts src/domain/availability.test.ts
git commit -m "feat(domain): availableByColor for product detail"
```

---

## Task 5: Catalog repo (anon reads)

**Files:** Create `src/lib/repos/catalog.ts`. Verified by build.

- [ ] **Step 1: Implement** — create `src/lib/repos/catalog.ts`:
```ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Line } from "@/domain/types";
import type { ProductRow, VariantRow, ProductImageRow } from "@/lib/db-types";

export interface CatalogProduct extends ProductRow {
  product_images: ProductImageRow[];
}

/** Active products for a line, with their images (anon-readable via RLS). */
export async function listActiveByLine(line: Line): Promise<CatalogProduct[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*, product_images(*)")
    .eq("status", "active")
    .eq("line", line)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CatalogProduct[];
}

export interface ProductDetail {
  product: CatalogProduct;
  variants: VariantRow[];
}

/** A single active product with images + variants. Returns null if not active/found. */
export async function getActiveProduct(id: string): Promise<ProductDetail | null> {
  const supabase = await createClient();
  const { data: product, error } = await supabase
    .from("products").select("*, product_images(*)").eq("id", id).eq("status", "active").maybeSingle();
  if (error) throw error;
  if (!product) return null;
  const { data: variants, error: vErr } = await supabase
    .from("variants").select("*").eq("product_id", id);
  if (vErr) throw vErr;
  return { product: product as CatalogProduct, variants: (variants ?? []) as VariantRow[] };
}
```

- [ ] **Step 2: Verify & commit** — `npx tsc --noEmit` (exit 0).
```bash
git add src/lib/repos/catalog.ts
git commit -m "feat(shop): catalog repository (anon reads)"
```

---

## Task 6: Orders repo (place + admin management)

**Files:** Create `src/lib/repos/orders.ts`. Verified by build.

- [ ] **Step 1: Implement** — create `src/lib/repos/orders.ts`:
```ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { restoreStock } from "@/domain/stock";
import type { OrderStatus } from "@/domain/types";

export interface PlaceOrderInput {
  name: string;
  whatsapp: string;
  note: string;
  items: { variant_id: string; qty: number }[];
}

/** Place a guest order via the atomic place_order RPC. Returns the new order id. */
export async function placeOrder(input: PlaceOrderInput): Promise<{ ok: true; id: string } | { ok: false; reason: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("place_order", {
    p_customer_name: input.name,
    p_customer_whatsapp: input.whatsapp,
    p_delivery_note: input.note,
    p_items: input.items,
  });
  if (error) {
    const reason = error.message.includes("insufficient_stock") ? "insufficient_stock" : "error";
    return { ok: false, reason };
  }
  return { ok: true, id: data as string };
}

export interface OrderRow {
  id: string;
  customer_name: string;
  customer_whatsapp: string;
  delivery_note: string | null;
  status: OrderStatus;
  total: number;
  stock_restored: boolean;
  created_at: string;
}
export interface OrderItemRow {
  id: string; product_name: string; line: string; color: string; size: string;
  unit_price: number; cost: number; qty: number;
}

export async function getOrder(id: string): Promise<{ order: OrderRow; items: OrderItemRow[] } | null> {
  const supabase = await createClient();
  const { data: order, error } = await supabase.from("orders").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!order) return null;
  const { data: items, error: iErr } = await supabase
    .from("order_items").select("id,product_name,line,color,size,unit_price,cost,qty").eq("order_id", id);
  if (iErr) throw iErr;
  return { order: order as OrderRow, items: (items ?? []) as OrderItemRow[] };
}

export async function listOrders(): Promise<OrderRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as OrderRow[];
}

export async function setOrderStatus(id: string, status: OrderStatus): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("orders").update({ status }).eq("id", id);
  if (error) throw error;
}

/**
 * Cancel an order: set status 'cancelado' and restore each item's stock exactly once
 * (guarded by stock_restored), logging a 'cancelacion' movement per variant.
 */
export async function cancelOrder(id: string): Promise<void> {
  const supabase = await createClient();
  const { data: order, error } = await supabase
    .from("orders").select("id, stock_restored").eq("id", id).single();
  if (error) throw error;

  if (!(order as { stock_restored: boolean }).stock_restored) {
    const { data: items, error: iErr } = await supabase
      .from("order_items").select("variant_id, qty").eq("order_id", id).not("variant_id", "is", null);
    if (iErr) throw iErr;
    for (const it of (items ?? []) as { variant_id: string; qty: number }[]) {
      const { data: v, error: vErr } = await supabase
        .from("variants").select("stock").eq("id", it.variant_id).single();
      if (vErr) throw vErr;
      const newStock = restoreStock((v as { stock: number }).stock, it.qty);
      const { error: upErr } = await supabase.from("variants").update({ stock: newStock }).eq("id", it.variant_id);
      if (upErr) throw upErr;
      const { error: mvErr } = await supabase.from("stock_movements").insert({
        variant_id: it.variant_id, delta: it.qty, type: "cancelacion", reference: `#${id.slice(0, 8)}`,
      });
      if (mvErr) throw mvErr;
    }
  }
  const { error: stErr } = await supabase
    .from("orders").update({ status: "cancelado", stock_restored: true }).eq("id", id);
  if (stErr) throw stErr;
}
```

- [ ] **Step 2: Verify & commit** — `npx tsc --noEmit` (exit 0).
```bash
git add src/lib/repos/orders.ts
git commit -m "feat(orders): order placement and admin management repo"
```

---

## Task 7: Cart context (client, localStorage)

**Files:** Create `src/lib/cart/types.ts`, `src/lib/cart/CartContext.tsx`. Verified by build.

- [ ] **Step 1: Cart types** — create `src/lib/cart/types.ts`:
```ts
export interface CartItem {
  variantId: string;
  productId: string;
  productName: string;
  color: string;
  size: string;
  unitPrice: number; // centavos
  qty: number;
}
```

- [ ] **Step 2: Provider** — create `src/lib/cart/CartContext.tsx`:
```tsx
"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { CartItem } from "./types";

interface CartApi {
  items: CartItem[];
  add: (item: CartItem) => void;
  setQty: (variantId: string, qty: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
  count: number;
}

const CartContext = createContext<CartApi | null>(null);
const KEY = "corve-cart";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {
      // ignore corrupt storage
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(items));
  }, [items]);

  const add = useCallback((item: CartItem) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.variantId === item.variantId);
      if (existing) {
        return prev.map((i) => (i.variantId === item.variantId ? { ...i, qty: i.qty + item.qty } : i));
      }
      return [...prev, item];
    });
  }, []);

  const setQty = useCallback((variantId: string, qty: number) => {
    setItems((prev) =>
      prev.flatMap((i) => (i.variantId === variantId ? (qty <= 0 ? [] : [{ ...i, qty }]) : [i])),
    );
  }, []);

  const remove = useCallback((variantId: string) => {
    setItems((prev) => prev.filter((i) => i.variantId !== variantId));
  }, []);

  const clear = useCallback(() => setItems([]), []);
  const count = items.reduce((s, i) => s + i.qty, 0);

  return (
    <CartContext.Provider value={{ items, add, setQty, remove, clear, count }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartApi {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
```

- [ ] **Step 3: Verify & commit** — `npx tsc --noEmit` (exit 0).
```bash
git add src/lib/cart
git commit -m "feat(shop): client cart context with localStorage"
```

---

## Task 8: Shop shell + catalog entry (line covers + products)

**Files:** Create `src/app/(shop)/layout.tsx`, `src/app/(shop)/page.tsx`. Verified by build + manual.

- [ ] **Step 1: Shop layout** — create `src/app/(shop)/layout.tsx`:
```tsx
import Link from "next/link";
import { CartProvider } from "@/lib/cart/CartContext";
import CartPill from "./CartPill";

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <div className="min-h-screen bg-[#161311] text-[#f4efe9]">
        <header className="flex items-center justify-between px-5 py-4">
          <Link href="/" className="tracking-[0.3em] text-sm">C O R V E</Link>
          <CartPill />
        </header>
        {children}
      </div>
    </CartProvider>
  );
}
```

- [ ] **Step 2: Cart pill** — create `src/app/(shop)/CartPill.tsx`:
```tsx
"use client";
import Link from "next/link";
import { useCart } from "@/lib/cart/CartContext";

export default function CartPill() {
  const { count } = useCart();
  return (
    <Link href="/carrito" className="rounded-full bg-white/90 text-[#161311] text-xs px-3 py-1">
      🛍 {count}
    </Link>
  );
}
```

- [ ] **Step 3: Catalog entry** — create `src/app/(shop)/page.tsx`. Renders one full-bleed cover per active line followed by its product grid:
```tsx
import Link from "next/link";
import { listActiveByLine } from "@/lib/repos/catalog";
import { formatMXN } from "@/domain/money";
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
            {s.products.map((p) => (
              <Link key={p.id} href={`/producto/${p.id}`} className="block">
                <div className="h-44 rounded-lg bg-gradient-to-br from-[#d8c1ad] to-[#9a7a61]" />
                <div className="text-sm mt-2">{p.name}</div>
                <div className="text-sm opacity-70">{formatMXN(p.price)}</div>
              </Link>
            ))}
            {s.products.length === 0 && <p className="opacity-60 text-sm">Pronto.</p>}
          </div>
        </section>
      ))}
    </main>
  );
}
```

- [ ] **Step 4: Verify & manual** — `npm run build`. Manual: visit `/` (logged out) — covers for MOVE/HIM render; the active product from earlier testing appears under its line; tapping it opens the product page (Task 9).

- [ ] **Step 5: Commit**
```bash
git add "src/app/(shop)/layout.tsx" "src/app/(shop)/page.tsx" "src/app/(shop)/CartPill.tsx"
git commit -m "feat(shop): immersive catalog entry with line covers"
```

---

## Task 9: Product detail + add to cart

**Files:** Create `src/app/(shop)/producto/[id]/page.tsx`, `src/app/(shop)/producto/[id]/AddToCart.tsx`. Verified by build + manual.

- [ ] **Step 1: AddToCart client** — create `src/app/(shop)/producto/[id]/AddToCart.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart/CartContext";
import { availableByColor, type AvailVariant } from "@/domain/availability";
import { formatMXN } from "@/domain/money";

interface VariantLite extends AvailVariant { id: string }

type Props = {
  productId: string;
  productName: string;
  price: number;
  variants: VariantLite[];
};

export default function AddToCart({ productId, productName, price, variants }: Props) {
  const router = useRouter();
  const { add } = useCart();
  const colors = availableByColor(variants);
  const [color, setColor] = useState(colors[0]?.color ?? "");
  const [size, setSize] = useState("");

  const sizes = colors.find((c) => c.color === color)?.sizes ?? [];
  const chosen = variants.find((v) => v.color === color && v.size === size);

  return (
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
  );
}
```

- [ ] **Step 2: Product page** — create `src/app/(shop)/producto/[id]/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import { getActiveProduct } from "@/lib/repos/catalog";
import { formatMXN } from "@/domain/money";
import AddToCart from "./AddToCart";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getActiveProduct(id);
  if (!detail) notFound();
  const { product, variants } = detail;

  return (
    <main>
      <div className="h-72 bg-gradient-to-br from-[#d8c1ad] to-[#9a7a61]" />
      <div className="p-4">
        <h1 className="text-2xl font-bold">{product.name}</h1>
        <div className="opacity-70 mb-2">{formatMXN(product.price)} · CORVE {product.line}</div>
        {product.description && <p className="italic text-sm opacity-80">{product.description}</p>}
      </div>
      <AddToCart
        productId={product.id}
        productName={product.name}
        price={product.price}
        variants={variants.map((v) => ({ id: v.id, color: v.color, size: v.size, stock: v.stock }))}
      />
    </main>
  );
}
```

- [ ] **Step 3: Verify & manual** — `npm run build`. Manual: open a product, pick color/size (sold-out sizes disabled), Agregar → routed to `/carrito` with the item.

- [ ] **Step 4: Commit**
```bash
git add "src/app/(shop)/producto"
git commit -m "feat(shop): product detail with color/size add-to-cart"
```

---

## Task 10: Cart + checkout

**Files:** Create `src/app/(shop)/carrito/page.tsx`, `src/app/(shop)/carrito/actions.ts`. Verified by build + manual.

- [ ] **Step 1: Submit action** — create `src/app/(shop)/carrito/actions.ts`:
```ts
"use server";

import { placeOrder } from "@/lib/repos/orders";

export async function submitOrder(input: {
  name: string; whatsapp: string; note: string;
  items: { variant_id: string; qty: number }[];
}): Promise<{ ok: true; id: string } | { ok: false; reason: string }> {
  return placeOrder(input);
}
```

- [ ] **Step 2: Cart page** — create `src/app/(shop)/carrito/page.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart/CartContext";
import { cartSubtotal } from "@/domain/cart";
import { formatMXN } from "@/domain/money";
import { validateCheckout } from "@/domain/checkout";
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
    clear();
    router.push(`/pedido/${res.id}`);
  }

  return (
    <main className="p-4 max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-3">Tu pedido</h1>
      {items.length === 0 && <p className="opacity-70">Tu carrito está vacío.</p>}
      <ul className="space-y-2">
        {items.map((i) => (
          <li key={i.variantId} className="flex items-center gap-2 text-sm">
            <div className="flex-1">
              <div>{i.productName}</div>
              <div className="opacity-60">{i.color} · {i.size}</div>
            </div>
            <input type="number" min={1} value={i.qty}
              onChange={(e) => setQty(i.variantId, Number(e.target.value))}
              className="w-14 rounded bg-white/10 p-1 text-center" />
            <button onClick={() => remove(i.variantId)} className="opacity-60">✕</button>
          </li>
        ))}
      </ul>
      {items.length > 0 && (
        <>
          <div className="flex justify-between border-t border-white/10 mt-3 pt-3 text-sm">
            <span>Subtotal</span><span>{formatMXN(subtotal)} MXN</span>
          </div>
          <div className="space-y-2 mt-4">
            <input placeholder="Tu nombre" value={name} onChange={(e) => setName(e.target.value)}
              className="w-full rounded bg-white/10 p-3 text-sm" />
            {errors.name && <p className="text-red-400 text-xs">{errors.name}</p>}
            <input placeholder="WhatsApp (con lada)" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)}
              className="w-full rounded bg-white/10 p-3 text-sm" />
            {errors.whatsapp && <p className="text-red-400 text-xs">{errors.whatsapp}</p>}
            <textarea placeholder="Nota / zona de entrega (opcional)" value={note} onChange={(e) => setNote(e.target.value)}
              className="w-full rounded bg-white/10 p-3 text-sm" />
            {errors.cart && <p className="text-red-400 text-xs">{errors.cart}</p>}
            <button onClick={onSubmit} disabled={pending}
              className="w-full rounded-xl bg-white text-[#161311] py-3 text-sm disabled:opacity-50">
              {pending ? "Enviando…" : "Enviar pedido"}
            </button>
          </div>
        </>
      )}
    </main>
  );
}
```

- [ ] **Step 3: Verify & manual** — `npm run build`. Manual: with an item in cart, submit with empty name → inline error; valid submit → stock decrements (check admin inventory), cart clears, routed to `/pedido/<id>`.

- [ ] **Step 4: Commit**
```bash
git add "src/app/(shop)/carrito"
git commit -m "feat(shop): cart and guest checkout"
```

---

## Task 11: Order confirmation + WhatsApp

**Files:** Create `src/app/(shop)/pedido/[id]/page.tsx`. Verified by build + manual.

- [ ] **Step 1: Confirmation page** — create `src/app/(shop)/pedido/[id]/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import { getOrder } from "@/lib/repos/orders";
import { formatMXN } from "@/domain/money";
import { buildWhatsAppLink } from "@/domain/whatsapp";

// The store's WhatsApp number (replace with the real one at deploy time).
const STORE_WHATSAPP = "5215500000000";

export default async function OrderConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getOrder(id);
  if (!data) notFound();
  const { order, items } = data;

  const lines = items.map((i) => `• ${i.product_name} ${i.color}/${i.size} x${i.qty}`).join("\n");
  const message = `Hola CORVE 💛 Soy ${order.customer_name}. Mi pedido #${id.slice(0, 8)}:\n${lines}\nTotal: ${formatMXN(order.total)} MXN`;
  const wa = buildWhatsAppLink(STORE_WHATSAPP, message);

  return (
    <main className="p-6 max-w-md mx-auto text-center">
      <h1 className="text-2xl font-bold mb-2">¡Gracias, {order.customer_name}!</h1>
      <p className="opacity-70 text-sm mb-4">Tu pedido #{id.slice(0, 8)} fue recibido. Te contactamos por WhatsApp para confirmar pago y envío.</p>
      <ul className="text-sm text-left mb-4">
        {items.map((i) => (
          <li key={i.id} className="flex justify-between border-b border-white/10 py-1">
            <span>{i.product_name} · {i.color}/{i.size} ×{i.qty}</span>
            <span>{formatMXN(i.unit_price * i.qty)}</span>
          </li>
        ))}
      </ul>
      <div className="flex justify-between text-sm mb-5"><span>Total</span><span>{formatMXN(order.total)} MXN</span></div>
      <a href={wa} target="_blank" rel="noopener noreferrer"
        className="inline-block rounded-xl bg-[#25D366] text-white px-5 py-3 text-sm">Continuar por WhatsApp</a>
    </main>
  );
}
```

- [ ] **Step 2: Verify & manual** — `npm run build`. Manual: after checkout, the confirmation shows the order summary and a working "Continuar por WhatsApp" link with the items pre-filled. Note: `getOrder` reads the `orders` table; anon has no select policy on orders, so this page works because the order id is known and... see the caveat below.

  **Caveat to handle:** anon cannot SELECT `orders` (no policy). The confirmation page runs server-side as anon and will get null. Fix: add a narrow policy allowing anon to read a single order BY ID is unsafe (id is a UUID, but still). Instead, render the confirmation from the data returned by `place_order` is not possible across a redirect. **Resolution for this task:** add to `0003` (amend in Step 1 of Task 1 if not yet applied, else a tiny `0004`) a policy: `create policy public_read_own_order on orders for select to anon using (true);` is too broad. Prefer: pass the order summary via the confirmation without a DB read — store the just-placed order summary in `sessionStorage` on the client and render confirmation client-side. **Choose the sessionStorage approach** (no new policy, no anon orders exposure): make `pedido/[id]/page.tsx` a client component that reads a `corve-last-order` sessionStorage entry written by the cart on success; if absent (e.g. refresh), show a generic "Pedido recibido #id" with the WhatsApp link built from the id only.

  Implement that: in `carrito/page.tsx` success branch, before `router.push`, write `sessionStorage.setItem("corve-last-order", JSON.stringify({ id: res.id, name, items: items.map(...), total: subtotal }))`. Make the confirmation page `"use client"`, read it, and fall back gracefully.

- [ ] **Step 3: Commit**
```bash
git add "src/app/(shop)/pedido" "src/app/(shop)/carrito/page.tsx"
git commit -m "feat(shop): order confirmation with WhatsApp handoff"
```

---

## Task 12: Admin Pedidos list

**Files:** Modify `src/app/admin/layout.tsx` (add nav link); Create `src/app/admin/pedidos/page.tsx`. Verified by build + manual.

- [ ] **Step 1: Add nav link** — in `src/app/admin/layout.tsx`, add inside `<nav>` above "Productos":
```tsx
          <Link href="/admin/pedidos" className="block py-2">Pedidos</Link>
```

- [ ] **Step 2: Orders list** — create `src/app/admin/pedidos/page.tsx`:
```tsx
import Link from "next/link";
import { listOrders } from "@/lib/repos/orders";
import { formatMXN } from "@/domain/money";

export default async function PedidosPage() {
  const orders = await listOrders();
  return (
    <div className="p-6">
      <h1 className="text-lg font-bold mb-4">Pedidos</h1>
      <table className="w-full text-sm">
        <thead className="text-left text-[#9a8b7d] text-xs">
          <tr><th className="py-2">#</th><th>Cliente</th><th>Total</th><th>Estado</th><th>Fecha</th></tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className={`border-t border-[#eadfd3] ${o.status === "nuevo" ? "bg-[#fbf4ec]" : ""}`}>
              <td className="py-2"><Link href={`/admin/pedidos/${o.id}`}>#{o.id.slice(0, 8)}</Link></td>
              <td>{o.customer_name}</td>
              <td>{formatMXN(o.total)}</td>
              <td>{o.status}</td>
              <td>{o.created_at.slice(0, 10)}</td>
            </tr>
          ))}
          {orders.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-[#9a8b7d]">Sin pedidos aún.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Verify & manual** — `npm run build`. Manual: `/admin/pedidos` lists the order placed in Task 10, newest first, "nuevo" highlighted.

- [ ] **Step 4: Commit**
```bash
git add src/app/admin/layout.tsx src/app/admin/pedidos/page.tsx
git commit -m "feat(admin): orders list (Pedidos)"
```

---

## Task 13: Admin order detail — status & cancel

**Files:** Create `src/app/admin/pedidos/[id]/page.tsx`, `src/app/admin/pedidos/[id]/actions.ts`. Verified by build + manual.

- [ ] **Step 1: Actions** — create `src/app/admin/pedidos/[id]/actions.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { setOrderStatus, cancelOrder } from "@/lib/repos/orders";
import type { OrderStatus } from "@/domain/types";

export async function changeStatus(id: string, formData: FormData): Promise<void> {
  const status = String(formData.get("status") ?? "") as OrderStatus;
  await setOrderStatus(id, status);
  revalidatePath(`/admin/pedidos/${id}`);
  revalidatePath("/admin/pedidos");
}

export async function cancel(id: string): Promise<void> {
  await cancelOrder(id);
  revalidatePath(`/admin/pedidos/${id}`);
  revalidatePath("/admin/pedidos");
  revalidatePath("/admin/inventory");
}
```

- [ ] **Step 2: Detail page** — create `src/app/admin/pedidos/[id]/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import { getOrder } from "@/lib/repos/orders";
import { formatMXN } from "@/domain/money";
import { buildWhatsAppLink } from "@/domain/whatsapp";
import { changeStatus, cancel } from "./actions";

const FLOW = ["nuevo", "confirmado", "pagado", "enviado", "entregado"];

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getOrder(id);
  if (!data) notFound();
  const { order, items } = data;
  const wa = buildWhatsAppLink(order.customer_whatsapp, `Hola ${order.customer_name}, sobre tu pedido CORVE #${id.slice(0, 8)}…`);

  return (
    <div className="p-6 max-w-lg text-sm">
      <h1 className="text-lg font-bold">Pedido #{id.slice(0, 8)}</h1>
      <p className="mt-1">{order.customer_name} · <a className="underline" href={wa} target="_blank" rel="noopener noreferrer">{order.customer_whatsapp}</a></p>
      {order.delivery_note && <p className="opacity-70">{order.delivery_note}</p>}
      <ul className="my-3">
        {items.map((i) => (
          <li key={i.id} className="flex justify-between border-b border-[#f3efe9] py-1">
            <span>{i.product_name} · {i.color}/{i.size} ×{i.qty}</span>
            <span>{formatMXN(i.unit_price * i.qty)}</span>
          </li>
        ))}
      </ul>
      <div className="flex justify-between font-semibold"><span>Total</span><span>{formatMXN(order.total)}</span></div>
      <p className="mt-3">Estado: <b>{order.status}</b></p>

      {order.status !== "cancelado" && (
        <>
          <form action={changeStatus.bind(null, id)} className="mt-3 flex gap-2">
            <select name="status" defaultValue={order.status} className="rounded border border-[#d8cdc0] p-2">
              {FLOW.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button className="rounded bg-[#211d1a] text-white px-3">Actualizar</button>
          </form>
          <form action={cancel.bind(null, id)} className="mt-3">
            <button className="rounded border border-red-600 text-red-600 px-3 py-1">Cancelar pedido (devuelve stock)</button>
          </form>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify & manual** — `npm run build`. Manual: open the order, move `nuevo → pagado` (sales-eligible later in Plan 4). Then on another order, **Cancelar** → status `cancelado`, the variant's stock is restored (check `/admin/inventory`), and a `cancelacion` movement is logged. Cancelling again is impossible (controls hidden) — and `stock_restored` prevents double restore.

- [ ] **Step 4: Commit**
```bash
git add "src/app/admin/pedidos/[id]"
git commit -m "feat(admin): order detail with status transitions and cancellation"
```

---

## Task 14: Full gate + browser verification

**Files:** none.

- [ ] **Step 1: Tests + typecheck + build** — `npm test` (Plan 1–3 suites pass: adds checkout, whatsapp, availability), `npx tsc --noEmit` (exit 0), `npm run build` (compiles). Confirm clean tree.

- [ ] **Step 2: End-to-end browser run** (local stack + dev server): as a logged-out guest, open `/`, pick the active product, choose color/size, Agregar → `/carrito`, fill name + WhatsApp, **Enviar pedido** → confirmation with WhatsApp link. Then in admin: `/admin/pedidos` shows the new order; `/admin/inventory` shows the variant's stock decremented and a `pedido` movement. Cancel the order → stock restored + `cancelacion` movement. Verify oversell: add more than stock and confirm the friendly "se agotó" error (the RPC rolls back).

---

## Self-Review (completed by plan author)

- **Spec coverage (§5 catalog flow, §6.1 Pedidos, §7 stock decrement + cancellation, §8 anon access):** immersive covers + grid (Task 8); product detail with swatches/sizes/sold-out (Tasks 4, 9); cart + guest checkout, name+WhatsApp, no login (Tasks 7, 10); atomic order placement decrementing stock + logging `pedido` + snapshots incl. line/cost (Task 1 RPC, Task 6); confirmation + WhatsApp handoff (Tasks 3, 11); admin Pedidos list + detail + status flow (Tasks 12, 13); cancellation restoring stock exactly once via `stock_restored` + `cancelacion` movement (Tasks 6, 13); anon catalog-read RLS, no anon order/inventory exposure (Task 1, confirmation uses sessionStorage not an anon orders read).
- **Placeholder scan:** every code step has complete code. Task 11 Step 2 contains a design caveat + its concrete resolution (sessionStorage confirmation) — implement that resolution, not a TODO.
- **Type consistency:** `CartItem` (cart/types) flows client→action→RPC `p_items` ({variant_id, qty}); `OrderStatus`/`Line` from `@/domain/types`; `decrementStock` enforced in the RPC (SQL mirror), `restoreStock` used by `cancelOrder`; `cartSubtotal`/`formatMXN`/`validateCheckout`/`buildWhatsAppLink`/`availableByColor` reused exactly as defined.
- **Carried-forward notes honored:** UTC dates only displayed as `created_at.slice(0,10)` for list (acceptable); oversell handled atomically; `stock_restored` guard prevents double restore (matches Plan 1 schema field).

---

## Next phase (not part of this plan)
- **Plan 4 — Purchasing & sales:** suppliers, purchase orders, receiving (uses `receivePurchaseOrder`), and the Ventas report (uses `summarizeSales` over `pagado`+ orders). Then deployment: cloud Supabase project + `place_order`/RLS applied + Vercel + real store WhatsApp number.
