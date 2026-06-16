# CORVE Purchasing & Sales — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the admin **Compras** (suppliers + purchase orders + receiving that restocks and updates cost) and **Ventas** (revenue / units / profit report) areas — completing the inventory→finance loop.

**Architecture:** Next.js App Router admin pages, server-only repos over Supabase. Receiving runs through one atomic `receive_purchase_order` Postgres function (`SECURITY DEFINER`) that, per received line, adds stock, logs a `reabasto` movement, bumps the product cost to the PO's unit cost ("last cost wins"), advances `qty_received`, and recomputes PO status — all in one transaction (mirrors `place_order`/`cancel_order`). The Ventas report fetches paid+ orders with their item snapshots and runs the tested `summarizeSales` domain function. No new tables — `suppliers`, `purchase_orders`, `purchase_order_items` already exist (Plan 1 `0001`) with RLS + authenticated grants (Plan 2 `0002`).

**Tech Stack:** Next.js 16, TypeScript, Tailwind, Supabase (RPC + RLS), Vitest. Reuses Plan 1 domain (`receivePurchaseOrder`, `summarizeSales`, `SALE_STATUSES`, `formatMXN`, `calcMargin`) and Plan 2/3 admin patterns.

Phase 4 of 4. Depends on Plans 1–3 on the branch. Requires the local Supabase stack running.

---

## File Structure

- `supabase/migrations/0005_receive_po.sql` — CREATE: atomic `receive_purchase_order` RPC.
- `src/domain/po-total.ts` (+ `.test.ts`) — CREATE: `poTotalCost` (pure).
- `src/lib/repos/suppliers.ts` — CREATE: supplier list/create.
- `src/lib/repos/purchasing.ts` — CREATE: PO create/list/get/add-line/receive.
- `src/lib/repos/sales.ts` — CREATE: sales summary (uses `summarizeSales`).
- `src/app/admin/proveedores/page.tsx` + `actions.ts` — CREATE: suppliers list + add.
- `src/app/admin/compras/page.tsx` + `actions.ts` — CREATE: PO list + new-order.
- `src/app/admin/compras/[id]/page.tsx` + `actions.ts` — CREATE: PO editor (supplier, lines, receive).
- `src/app/admin/ventas/page.tsx` — CREATE: sales report (KPIs + filters).
- `src/app/admin/layout.tsx` — MODIFY: add Compras, Ventas, Proveedores nav links.

---

## Task 1: Atomic receive_purchase_order RPC

**Files:** Create `supabase/migrations/0005_receive_po.sql`. Requires the local stack.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0005_receive_po.sql`:
```sql
-- Atomic PO receiving. For each received line: add stock, log a 'reabasto' movement,
-- set the product cost to the line's unit_cost (last-cost-wins), advance qty_received.
-- Then recompute PO status (parcial vs recibida). One transaction; rolls back on error.
create or replace function receive_purchase_order(p_po_id uuid, p_receipts jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb;
  v_add int;
  v_line purchase_order_items%rowtype;
  v_all_complete boolean;
  v_ref text := 'OC-' || left(p_po_id::text, 8);
begin
  for r in select * from jsonb_array_elements(p_receipts)
  loop
    v_add := (r->>'qty')::int;
    if v_add is null or v_add < 0 then raise exception 'invalid_receipt'; end if;
    if v_add = 0 then continue; end if;

    select * into v_line from purchase_order_items
      where po_id = p_po_id and variant_id = (r->>'variant_id')::uuid for update;
    if not found then raise exception 'po_line_not_found'; end if;
    if v_add > (v_line.qty_ordered - v_line.qty_received) then
      raise exception 'exceeds_outstanding';
    end if;

    update variants set stock = stock + v_add where id = v_line.variant_id;

    insert into stock_movements (variant_id, delta, type, reference)
      values (v_line.variant_id, v_add, 'reabasto', v_ref);

    update purchase_order_items set qty_received = qty_received + v_add where id = v_line.id;

    update products set cost = v_line.unit_cost, updated_at = now()
      where id = (select product_id from variants where id = v_line.variant_id);
  end loop;

  select bool_and(qty_received >= qty_ordered) into v_all_complete
    from purchase_order_items where po_id = p_po_id;

  update purchase_orders
    set status = case when coalesce(v_all_complete, false) then 'recibida' else 'parcial' end
    where id = p_po_id;
end;
$$;

grant execute on function receive_purchase_order(uuid, jsonb) to authenticated;
```

- [ ] **Step 2: Apply & verify**

Run `npx supabase db reset`. Then a throwaway script (authenticated admin) that: seeds a product + variant (stock 0) + a supplier + a PO with one line (qty_ordered 10, unit_cost 25000); calls `rpc('receive_purchase_order', { p_po_id, p_receipts: [{variant_id, qty: 4}] })`; asserts variant stock = 4, a `reabasto` movement exists, product cost = 25000, PO status = `parcial`; then receives 6 more → stock 10, status `recibida`; then receiving 1 more → throws `exceeds_outstanding` and stock stays 10.

- [ ] **Step 3: Commit**
```bash
git add supabase/migrations/0005_receive_po.sql
git commit -m "feat(db): atomic receive_purchase_order RPC"
```

---

## Task 2: poTotalCost (pure, TDD)

**Files:** Create `src/domain/po-total.ts`, `src/domain/po-total.test.ts`.

- [ ] **Step 1: Failing test** — `src/domain/po-total.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { poTotalCost, type POLineCost } from "@/domain/po-total";

const lines: POLineCost[] = [
  { qtyOrdered: 10, unitCost: 25000 },
  { qtyOrdered: 5, unitCost: 14000 },
];

describe("poTotalCost", () => {
  it("sums qtyOrdered * unitCost in centavos", () => {
    expect(poTotalCost(lines)).toBe(320000); // 250000 + 70000
  });
  it("is 0 for no lines", () => {
    expect(poTotalCost([])).toBe(0);
  });
});
```

- [ ] **Step 2: Run** `npm test -- po-total` → FAIL.

- [ ] **Step 3: Implement** — `src/domain/po-total.ts`:
```ts
import type { Centavos } from "@/domain/money";

export interface POLineCost {
  qtyOrdered: number;
  unitCost: Centavos;
}

/** Total cost of a purchase order, in centavos. */
export function poTotalCost(lines: POLineCost[]): Centavos {
  return lines.reduce((sum, l) => sum + l.qtyOrdered * l.unitCost, 0);
}
```

- [ ] **Step 4: Run** `npm test -- po-total` → PASS (2).

- [ ] **Step 5: Commit**
```bash
git add src/domain/po-total.ts src/domain/po-total.test.ts
git commit -m "feat(domain): poTotalCost"
```

---

## Task 3: Suppliers repo + Proveedores page

**Files:** Create `src/lib/repos/suppliers.ts`, `src/app/admin/proveedores/page.tsx`, `src/app/admin/proveedores/actions.ts`. Verified by build + manual.

- [ ] **Step 1: Repo** — `src/lib/repos/suppliers.ts`:
```ts
import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface SupplierRow { id: string; name: string; contact: string | null }

export async function listSuppliers(): Promise<SupplierRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("suppliers").select("*").order("name");
  if (error) throw error;
  return (data ?? []) as SupplierRow[];
}

export async function createSupplier(name: string, contact: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("suppliers").insert({ name, contact: contact || null });
  if (error) throw error;
}
```

- [ ] **Step 2: Actions** — `src/app/admin/proveedores/actions.ts`:
```ts
"use server";
import { revalidatePath } from "next/cache";
import { createSupplier } from "@/lib/repos/suppliers";

export async function addSupplier(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  const contact = String(formData.get("contact") ?? "").trim();
  if (!name) return;
  await createSupplier(name, contact);
  revalidatePath("/admin/proveedores");
}
```

- [ ] **Step 3: Page** — `src/app/admin/proveedores/page.tsx`:
```tsx
import { listSuppliers } from "@/lib/repos/suppliers";
import { addSupplier } from "./actions";

export default async function ProveedoresPage() {
  const suppliers = await listSuppliers();
  return (
    <div className="p-6 max-w-lg text-sm">
      <h1 className="text-lg font-bold mb-4">Proveedores</h1>
      <ul className="mb-4">
        {suppliers.map((s) => (
          <li key={s.id} className="flex justify-between border-b border-[#f3efe9] py-1">
            <span>{s.name}</span><span className="opacity-60">{s.contact}</span>
          </li>
        ))}
        {suppliers.length === 0 && <li className="text-[#9a8b7d]">Sin proveedores aún.</li>}
      </ul>
      <form action={addSupplier} className="flex gap-2">
        <input name="name" placeholder="Nombre" className="flex-1 rounded border border-[#d8cdc0] p-2" />
        <input name="contact" placeholder="Contacto" className="flex-1 rounded border border-[#d8cdc0] p-2" />
        <button className="rounded bg-[#211d1a] text-white px-3">Agregar</button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Verify & commit** — `npm run build`. 
```bash
git add src/lib/repos/suppliers.ts "src/app/admin/proveedores"
git commit -m "feat(admin): suppliers (proveedores) management"
```

---

## Task 4: Purchasing repo

**Files:** Create `src/lib/repos/purchasing.ts`. Verified by build.

- [ ] **Step 1: Repo** — `src/lib/repos/purchasing.ts`:
```ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { poTotalCost } from "@/domain/po-total";
import type { POStatus } from "@/domain/purchase";

export interface PORow {
  id: string; supplier_id: string | null; status: POStatus;
  expected_at: string | null; notes: string | null; total_cost: number; created_at: string;
}
export interface POItemRow {
  id: string; variant_id: string; qty_ordered: number; qty_received: number; unit_cost: number;
}
export interface VariantOption { id: string; label: string }

export async function createDraftPO(): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("purchase_orders").insert({ status: "borrador" }).select("id").single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function listPOs(): Promise<(PORow & { suppliers: { name: string } | null })[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("purchase_orders").select("*, suppliers(name)").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as (PORow & { suppliers: { name: string } | null })[];
}

export async function getPO(id: string): Promise<{ po: PORow; items: (POItemRow & { variants: { color: string; size: string; products: { name: string } } })[] } | null> {
  const supabase = await createClient();
  const { data: po, error } = await supabase.from("purchase_orders").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!po) return null;
  const { data: items, error: iErr } = await supabase
    .from("purchase_order_items")
    .select("*, variants(color,size,products(name))").eq("po_id", id);
  if (iErr) throw iErr;
  return { po: po as PORow, items: (items ?? []) as never };
}

export async function setPOSupplier(id: string, supplierId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("purchase_orders")
    .update({ supplier_id: supplierId || null, status: "pedida" }).eq("id", id);
  if (error) throw error;
}

/** Add a line and recompute total_cost. */
export async function addPOLine(poId: string, variantId: string, qtyOrdered: number, unitCost: number): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("purchase_order_items")
    .insert({ po_id: poId, variant_id: variantId, qty_ordered: qtyOrdered, unit_cost: unitCost });
  if (error) throw error;
  const { data: items } = await supabase.from("purchase_order_items").select("qty_ordered,unit_cost").eq("po_id", poId);
  const total = poTotalCost((items ?? []).map((i) => ({ qtyOrdered: i.qty_ordered, unitCost: i.unit_cost })));
  await supabase.from("purchase_orders").update({ total_cost: total }).eq("id", poId);
}

/** Receive a batch via the atomic RPC. */
export async function receivePO(poId: string, receipts: { variant_id: string; qty: number }[]): Promise<{ ok: boolean; reason?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("receive_purchase_order", { p_po_id: poId, p_receipts: receipts });
  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}

/** All variants as options for the line picker. */
export async function listVariantOptions(): Promise<VariantOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("variants").select("id,color,size,products(name)").order("color");
  if (error) throw error;
  return (data ?? []).map((v: { id: string; color: string; size: string; products: { name: string } | null }) =>
    ({ id: v.id, label: `${v.products?.name ?? "—"} · ${v.color} · ${v.size}` }));
}
```

- [ ] **Step 2: Verify & commit** — `npx tsc --noEmit`.
```bash
git add src/lib/repos/purchasing.ts
git commit -m "feat(admin): purchasing repository (PO create/list/get/receive)"
```

---

## Task 5: Compras list + new order

**Files:** Create `src/app/admin/compras/page.tsx`, `src/app/admin/compras/actions.ts`. Verified by build + manual.

- [ ] **Step 1: Action** — `src/app/admin/compras/actions.ts`:
```ts
"use server";
import { redirect } from "next/navigation";
import { createDraftPO } from "@/lib/repos/purchasing";

export async function newOrder(): Promise<void> {
  const id = await createDraftPO();
  redirect(`/admin/compras/${id}`);
}
```

- [ ] **Step 2: Page** — `src/app/admin/compras/page.tsx`:
```tsx
import Link from "next/link";
import { listPOs } from "@/lib/repos/purchasing";
import { formatMXN } from "@/domain/money";
import { newOrder } from "./actions";

export default async function ComprasPage() {
  const pos = await listPOs();
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold">Órdenes de compra</h1>
        <form action={newOrder}><button className="rounded-md bg-[#211d1a] text-white text-sm px-3 py-2">+ Nueva orden</button></form>
      </div>
      <table className="w-full text-sm">
        <thead className="text-left text-[#9a8b7d] text-xs"><tr><th className="py-2">#</th><th>Proveedor</th><th>Costo</th><th>Estado</th><th>Fecha</th></tr></thead>
        <tbody>
          {pos.map((p) => (
            <tr key={p.id} className="border-t border-[#eadfd3]">
              <td className="py-2"><Link href={`/admin/compras/${p.id}`}>OC-{p.id.slice(0, 8)}</Link></td>
              <td>{p.suppliers?.name ?? "—"}</td>
              <td>{formatMXN(p.total_cost)}</td>
              <td>{p.status}</td>
              <td>{p.created_at.slice(0, 10)}</td>
            </tr>
          ))}
          {pos.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-[#9a8b7d]">Sin órdenes aún.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Verify & commit** — `npm run build`.
```bash
git add "src/app/admin/compras/page.tsx" "src/app/admin/compras/actions.ts"
git commit -m "feat(admin): purchase orders list and create"
```

---

## Task 6: PO editor (supplier, lines, receive)

**Files:** Create `src/app/admin/compras/[id]/page.tsx`, `src/app/admin/compras/[id]/actions.ts`. Verified by build + manual.

- [ ] **Step 1: Actions** — `src/app/admin/compras/[id]/actions.ts`:
```ts
"use server";
import { revalidatePath } from "next/cache";
import { setPOSupplier, addPOLine, receivePO } from "@/lib/repos/purchasing";
import { parsePesosInput } from "@/domain/money";

export async function chooseSupplier(poId: string, formData: FormData): Promise<void> {
  await setPOSupplier(poId, String(formData.get("supplier_id") ?? ""));
  revalidatePath(`/admin/compras/${poId}`);
}

export async function addLine(poId: string, formData: FormData): Promise<void> {
  const variantId = String(formData.get("variant_id") ?? "");
  const qty = Number(formData.get("qty") ?? 0);
  const unitCost = parsePesosInput(String(formData.get("unit_cost") ?? ""));
  if (!variantId || !Number.isInteger(qty) || qty <= 0 || unitCost === null) return;
  await addPOLine(poId, variantId, qty, unitCost);
  revalidatePath(`/admin/compras/${poId}`);
}

export async function receive(poId: string, formData: FormData): Promise<void> {
  // formData has received_<variantId> fields
  const receipts: { variant_id: string; qty: number }[] = [];
  for (const [k, v] of formData.entries()) {
    if (k.startsWith("received_")) {
      const qty = Number(v);
      if (Number.isInteger(qty) && qty > 0) receipts.push({ variant_id: k.slice("received_".length), qty });
    }
  }
  if (receipts.length > 0) await receivePO(poId, receipts);
  revalidatePath(`/admin/compras/${poId}`);
  revalidatePath("/admin/inventory");
}
```

- [ ] **Step 2: Page** — `src/app/admin/compras/[id]/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import { getPO, listVariantOptions } from "@/lib/repos/purchasing";
import { listSuppliers } from "@/lib/repos/suppliers";
import { formatMXN } from "@/domain/money";
import { chooseSupplier, addLine, receive } from "./actions";

export default async function POEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getPO(id);
  if (!data) notFound();
  const { po, items } = data;
  const suppliers = await listSuppliers();
  const variantOptions = await listVariantOptions();
  const editable = po.status === "borrador" || po.status === "pedida";

  return (
    <div className="p-6 max-w-2xl text-sm">
      <h1 className="text-lg font-bold">OC-{id.slice(0, 8)} <span className="text-xs font-normal">· {po.status}</span></h1>

      <form action={chooseSupplier.bind(null, id)} className="flex gap-2 mt-3">
        <select name="supplier_id" defaultValue={po.supplier_id ?? ""} className="rounded border border-[#d8cdc0] p-2">
          <option value="">— Proveedor —</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button className="rounded bg-[#211d1a] text-white px-3">Guardar proveedor</button>
      </form>

      <table className="w-full mt-4">
        <thead className="text-left text-[#9a8b7d] text-xs"><tr><th>Variante</th><th>Costo u.</th><th>Pedidas</th><th>Recibidas</th></tr></thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id} className="border-t border-[#f3efe9]">
              <td className="py-1">{it.variants.products.name} · {it.variants.color} · {it.variants.size}</td>
              <td>{formatMXN(it.unit_cost)}</td>
              <td>{it.qty_ordered}</td>
              <td>{it.qty_received}</td>
            </tr>
          ))}
          {items.length === 0 && <tr><td colSpan={4} className="py-3 text-[#9a8b7d]">Sin líneas.</td></tr>}
        </tbody>
      </table>
      <div className="flex justify-between font-semibold mt-2"><span>Total</span><span>{formatMXN(po.total_cost)}</span></div>

      {editable && (
        <form action={addLine.bind(null, id)} className="flex gap-2 mt-4 flex-wrap items-end">
          <select name="variant_id" className="rounded border border-[#d8cdc0] p-2">
            <option value="">— Variante —</option>
            {variantOptions.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>
          <input name="qty" type="number" min="1" placeholder="Cant." className="w-20 rounded border border-[#d8cdc0] p-2" />
          <input name="unit_cost" placeholder="Costo u. (MXN)" className="w-28 rounded border border-[#d8cdc0] p-2" />
          <button className="rounded bg-[#211d1a] text-white px-3 py-2">+ Línea</button>
        </form>
      )}

      {items.length > 0 && po.status !== "recibida" && (
        <form action={receive.bind(null, id)} className="mt-6 border-t border-[#eadfd3] pt-4">
          <h2 className="font-semibold mb-2">Recibir</h2>
          {items.map((it) => (
            <div key={it.id} className="flex items-center gap-2 mb-1">
              <span className="flex-1">{it.variants.products.name} · {it.variants.color} · {it.variants.size} (faltan {it.qty_ordered - it.qty_received})</span>
              <input name={`received_${it.variant_id}`} type="number" min="0" max={it.qty_ordered - it.qty_received} defaultValue="0"
                className="w-20 rounded border border-[#d8cdc0] p-1" />
            </div>
          ))}
          <button className="rounded bg-[#2f6b3a] text-white px-4 py-2 mt-2">Recibir → sumar al stock</button>
        </form>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify & manual** — `npm run build`. Manual: create a PO, pick a supplier, add a line (a real variant, qty 10, cost 250), then receive 4 → the variant's stock rises by 4, PO becomes `parcial`, product cost updates; receive the remaining 6 → `recibida`.

- [ ] **Step 4: Commit**
```bash
git add "src/app/admin/compras/[id]"
git commit -m "feat(admin): PO editor with supplier, lines and receiving"
```

---

## Task 7: Sales repo

**Files:** Create `src/lib/repos/sales.ts`. Verified by build.

- [ ] **Step 1: Repo** — `src/lib/repos/sales.ts`:
```ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { summarizeSales, type SaleOrder, type SalesFilter, type SalesSummary } from "@/domain/sales";
import { SALE_STATUSES } from "@/domain/types";

/** Aggregate realized sales (paid or beyond) using the tested summarizeSales domain function. */
export async function getSalesSummary(filter: SalesFilter): Promise<SalesSummary> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("status, created_at, order_items(line, unit_price, cost, qty)")
    .in("status", SALE_STATUSES as unknown as string[]);
  if (error) throw error;

  const orders: SaleOrder[] = (data ?? []).map((o: { status: string; created_at: string; order_items: { line: string; unit_price: number; cost: number; qty: number }[] }) => ({
    status: o.status as SaleOrder["status"],
    createdAt: o.created_at,
    items: (o.order_items ?? []).map((i) => ({
      line: i.line as SaleOrder["items"][number]["line"],
      unitPrice: i.unit_price, cost: i.cost, qty: i.qty,
    })),
  }));
  return summarizeSales(orders, filter);
}
```

- [ ] **Step 2: Verify & commit** — `npx tsc --noEmit`.
```bash
git add src/lib/repos/sales.ts
git commit -m "feat(admin): sales summary repo (uses summarizeSales)"
```

---

## Task 8: Ventas report page

**Files:** Create `src/app/admin/ventas/page.tsx`. Verified by build + manual.

- [ ] **Step 1: Page** — `src/app/admin/ventas/page.tsx` (filters via search params):
```tsx
import Link from "next/link";
import { getSalesSummary } from "@/lib/repos/sales";
import { formatMXN } from "@/domain/money";
import type { Line } from "@/domain/types";

export default async function VentasPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; line?: string }> }) {
  const sp = await searchParams;
  const filter = { from: sp.from, to: sp.to, line: (sp.line as Line | undefined) || undefined };
  const summary = await getSalesSummary(filter);

  const link = (q: Record<string, string>) => "/admin/ventas?" + new URLSearchParams(q).toString();

  return (
    <div className="p-6 max-w-2xl text-sm">
      <h1 className="text-lg font-bold mb-3">Ventas</h1>
      <div className="flex gap-2 mb-4">
        <Link href="/admin/ventas" className={`rounded-full border px-3 py-1 ${!sp.line ? "bg-[#211d1a] text-white" : "border-[#d8cdc0]"}`}>Todo</Link>
        <Link href={link({ line: "MOVE" })} className={`rounded-full border px-3 py-1 ${sp.line === "MOVE" ? "bg-[#211d1a] text-white" : "border-[#d8cdc0]"}`}>MOVE</Link>
        <Link href={link({ line: "HIM" })} className={`rounded-full border px-3 py-1 ${sp.line === "HIM" ? "bg-[#211d1a] text-white" : "border-[#d8cdc0]"}`}>HIM</Link>
      </div>
      <form className="flex gap-2 mb-4 items-end">
        <label className="text-xs">Desde<input name="from" type="date" defaultValue={sp.from} className="block rounded border border-[#d8cdc0] p-1" /></label>
        <label className="text-xs">Hasta<input name="to" type="date" defaultValue={sp.to} className="block rounded border border-[#d8cdc0] p-1" /></label>
        {sp.line && <input type="hidden" name="line" value={sp.line} />}
        <button className="rounded bg-[#211d1a] text-white px-3 py-1">Filtrar</button>
      </form>
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-[#ece5db] p-4"><div className="text-xs uppercase text-[#9a8b7d]">Ingresos</div><div className="text-2xl font-bold">{formatMXN(summary.revenue)}</div></div>
        <div className="rounded-xl border border-[#ece5db] p-4"><div className="text-xs uppercase text-[#9a8b7d]">Unidades</div><div className="text-2xl font-bold">{summary.units}</div></div>
        <div className="rounded-xl border border-[#ece5db] p-4"><div className="text-xs uppercase text-[#9a8b7d]">Ganancia</div><div className="text-2xl font-bold text-[#2f6b3a]">{formatMXN(summary.profit)}</div></div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify & manual** — `npm run build`. Manual: mark an order `pagado` in Pedidos, then Ventas shows non-zero ingresos/unidades/ganancia; filtering by line/date narrows it; a `cancelado` order is excluded.

- [ ] **Step 3: Commit**
```bash
git add "src/app/admin/ventas/page.tsx"
git commit -m "feat(admin): sales (Ventas) report with filters"
```

---

## Task 9: Admin nav links

**Files:** Modify `src/app/admin/layout.tsx`. Verified by build.

- [ ] **Step 1:** In `src/app/admin/layout.tsx`, inside `<nav>`, after the existing "Inventario" link, add:
```tsx
          <Link href="/admin/compras" className="block py-2">Compras</Link>
          <Link href="/admin/ventas" className="block py-2">Ventas</Link>
          <Link href="/admin/proveedores" className="block py-2">Proveedores</Link>
```

- [ ] **Step 2: Verify & commit** — `npm run build`.
```bash
git add src/app/admin/layout.tsx
git commit -m "feat(admin): nav links for Compras, Ventas, Proveedores"
```

---

## Task 10: Full gate + browser verification

**Files:** none.

- [ ] **Step 1: Tests + typecheck + build** — `npm test` (adds po-total), `npx tsc --noEmit`, `npm run build`. Confirm clean tree.

- [ ] **Step 2: End-to-end browser run** (clean window, logged-in admin): Proveedores → add a supplier. Compras → Nueva orden → pick supplier → add a line (variant, qty 10, cost 250) → Recibir 4 → variant stock +4, PO `parcial`, product cost = $250 (check Inventario / product margin); Recibir 6 → `recibida`. Then mark a guest order `pagado` in Pedidos → Ventas shows ingresos/unidades/ganancia; filter by line; confirm a `cancelado` order is excluded. (Use real DOM clicks for any React-`onClick` buttons; forms submit natively.)

---

## Self-Review (completed by plan author)

- **Spec coverage (§6.4 Compras, §6.5 Ventas):** suppliers list/create (Task 3); PO list + create (Task 5); PO editor with supplier, lines, status (Task 6); receiving that adds stock + logs `reabasto` + updates cost (last-cost-wins) + advances status — atomic (Task 1 RPC, Task 4/6); Ventas revenue/units/profit over `pagado`+ with line/date filters, excluding cancelled (Tasks 7, 8). No low-stock alerts (deferred, per spec).
- **Placeholder scan:** every code step has complete code. No TBD/TODO/placeholders.
- **Type consistency:** `POStatus` from `@/domain/purchase`; `poTotalCost` used by `addPOLine`; receiving mirrors the tested `receivePurchaseOrder` math in SQL (same outstanding/partial/complete rules); `summarizeSales`/`SALE_STATUSES`/`SaleOrder` reused by the sales repo exactly; `parsePesosInput`/`formatMXN`/`calcMargin` reused.
- **Carried-forward notes honored:** receiving is atomic (RPC); product cost update keeps margin accurate; sale exclusion of cancelled is automatic (status leaves SALE_STATUSES); `created_at.slice(0,10)` UTC date compare for filters (admin convenience).

---

## After Plan 4 — Deployment (separate effort)
Cloud Supabase project (apply migrations 0001–0005 + RLS + all RPCs), set the real store WhatsApp number (replace `5215500000000` in `pedido/[id]/page.tsx`), configure Vercel env + deploy, optional custom domain. Merge the stacked branches `plan1-foundation`→`plan2-admin`→`plan3-catalog`→`plan4-*` to `master` (or open PRs) in order.
