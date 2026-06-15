# CORVE Admin: Products & Inventory — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the authenticated admin area where the owner manages products (with size/color variants), prices/cost/margin, product status, images, manual stock corrections, and views current inventory plus its movement history — backed by a real Supabase project.

**Architecture:** Next.js App Router. Pure logic (money parsing, variant-grid building, correction math, input validation) lives in `src/domain/` and `src/lib/admin/` as framework-free, unit-tested functions. Supabase access is isolated in server-only repository modules (`src/lib/repos/`). Admin routes under `/admin` are protected by middleware that refreshes the Supabase session. UI is React Server Components for reads + Server Actions for writes; only interactive forms are Client Components.

**Tech Stack:** Next.js 16, TypeScript, Tailwind 4, Supabase (Postgres + Auth + Storage), Vitest. Builds on Plan 1's domain library (`@/domain/*`).

This is Phase 2 of 4 (Foundation → **Admin** → Catalog → Purchasing/Sales). It depends on Plan 1 being merged/available on the branch.

**Prerequisite:** Development runs against a **local Supabase stack** (Supabase CLI + Docker — Postgres/Auth/Storage on localhost), which auto-applies `supabase/migrations/`. Task 1 starts it. The **cloud Supabase project + Vercel deploy are deferred to a final deployment step** (a later plan). Docker Desktop must be running for Task 1 and any runtime verification; the pure-logic tasks (3–6) need neither Docker nor Supabase.

---

## File Structure

- `src/domain/money.ts` — MODIFY: add `parsePesosInput` (pure, tested).
- `src/lib/admin/variant-grid.ts` — CREATE: build a color×size matrix from variant rows (pure, tested).
- `src/lib/admin/correction.ts` — CREATE: compute a stock correction delta (pure, tested).
- `src/lib/admin/product-input.ts` — CREATE: validate + normalize product form input (pure, tested).
- `src/lib/db-types.ts` — CREATE: hand-written Row types for the tables this plan touches.
- `src/lib/repos/products.ts` — CREATE: product + variant data access (server-only).
- `src/lib/repos/inventory.ts` — CREATE: stock correction + movement-history data access (server-only).
- `src/lib/supabase/middleware.ts` — CREATE: `updateSession` helper for the middleware.
- `src/middleware.ts` — CREATE: refresh session + protect `/admin`.
- `src/app/admin/login/page.tsx` — CREATE: login form.
- `src/app/admin/login/actions.ts` — CREATE: sign-in / sign-out server actions.
- `src/app/admin/layout.tsx` — CREATE: admin shell (sidebar nav + sign-out).
- `src/app/admin/page.tsx` — CREATE: redirect to products.
- `src/app/admin/products/page.tsx` — CREATE: product list.
- `src/app/admin/products/[id]/page.tsx` — CREATE: product editor (new + existing via `new` sentinel).
- `src/app/admin/products/[id]/ProductForm.tsx` — CREATE: client form component.
- `src/app/admin/products/[id]/actions.ts` — CREATE: create/update product + save variants + correct stock server actions.
- `src/app/admin/inventory/page.tsx` — CREATE: inventory + movement history.
- `supabase/storage.md` — CREATE: documents the `product-images` bucket setup.

Pure modules (`src/domain`, `src/lib/admin`) never import React/Next/Supabase. Repos are server-only (`import "server-only"`).

---

## Task 1: Local Supabase stack, env, seed user & storage bucket

**Files:** Create `supabase/config.toml` (via CLI), `supabase/seed.sql`, `supabase/storage.md`; Modify `.env.local` (gitignored). Requires Docker running.

Development uses the local Supabase stack. The cloud project is a deployment-time concern, deferred.

- [ ] **Step 1: Initialize the Supabase project config**

Run (answer "N" to generating VS Code settings if asked):
```bash
npx --yes supabase init
```
This creates `supabase/config.toml`. The existing `supabase/migrations/0001_init.sql` is picked up automatically.

- [ ] **Step 2: Create a seed (admin user via SQL is not portable; use a seed for the bucket + a known auth user)**

Create `supabase/seed.sql` (runs automatically on `supabase start`/`db reset`):
```sql
-- Public bucket for product images
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- Seed admin user (local dev only): admin@corve.test / corve1234
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
        'admin@corve.test', crypt('corve1234', gen_salt('bf')), now(), now(), now(),
        '{"provider":"email","providers":["email"]}', '{}')
on conflict do nothing;
```

- [ ] **Step 3: Start the stack**

Run (first run pulls images; can take a few minutes):
```bash
npx --yes supabase start
```
It prints `API URL`, `anon key`, and `service_role key`. The migration and seed are applied automatically.

- [ ] **Step 4: Put the local keys in `.env.local`**

Create `.env.local` (gitignored) with the printed values (defaults shown — confirm against the `supabase start` output):
```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from supabase start>
```

- [ ] **Step 5: Document storage**

Create `supabase/storage.md`:
```markdown
# Storage

Bucket `product-images` (public): holds product photos. Created by `supabase/seed.sql`.
Path convention: `products/<productId>/<epoch>-<filename>`.
Public read; authenticated insert.
```

- [ ] **Step 6: Verify connectivity**

```bash
node --env-file=.env.local -e "const{createClient}=require('@supabase/supabase-js');const c=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);c.from('products').select('id').then(r=>{if(r.error)throw r.error;console.log('OK rows:',r.data.length)})"
```
Expected: `OK rows: 0`.

- [ ] **Step 7: Commit config & docs**

```bash
git add supabase/config.toml supabase/seed.sql supabase/storage.md
git commit -m "chore(db): local Supabase stack config, seed user and bucket"
```
(`.env.local` is gitignored — do not commit it. The seed credentials are local-dev only.)

---

## Task 2: Database Row types

**Files:** Create `src/lib/db-types.ts`.

Hand-written Row types for the tables this plan reads/writes, kept in sync with `0001_init.sql`. (When the Supabase CLI is available later, these can be replaced by generated types; hand-writing avoids a CLI dependency now.)

- [ ] **Step 1: Write the types**

Create `src/lib/db-types.ts`:
```ts
import type { Line, ProductStatus } from "@/domain/types";

export interface ProductRow {
  id: string;
  name: string;
  line: Line;
  type: string;
  description: string;
  price: number; // centavos
  cost: number; // centavos
  status: ProductStatus;
  created_at: string;
  updated_at: string;
}

export interface VariantRow {
  id: string;
  product_id: string;
  color: string;
  color_hex: string;
  size: string;
  stock: number;
  sku: string | null;
}

export interface ProductImageRow {
  id: string;
  product_id: string;
  url: string;
  sort_order: number;
}

export interface StockMovementRow {
  id: string;
  variant_id: string;
  delta: number;
  type: import("@/domain/types").MovementType;
  reference: string | null;
  reason: string | null;
  created_at: string;
}
```

- [ ] **Step 2: Add `ProductStatus` to the domain types**

`ProductStatus` is referenced above but lives with the other shared types. In `src/domain/types.ts`, add after `Line`:
```ts
export type ProductStatus = "draft" | "active" | "hidden";
```

- [ ] **Step 3: Verify type-check and commit**

Run: `npx tsc --noEmit`
Expected: exit 0.
```bash
git add src/lib/db-types.ts src/domain/types.ts
git commit -m "feat(db): hand-written Row types and ProductStatus"
```

---

## Task 3: Parse peso input to centavos (pure, TDD)

**Files:** Modify `src/domain/money.ts`; Test `src/domain/money.test.ts`.

The admin form lets the owner type a price in pesos ("690" or "690.50"). We need to parse that to centavos, rejecting garbage.

- [ ] **Step 1: Add failing tests**

Append to `src/domain/money.test.ts`:
```ts
import { parsePesosInput } from "@/domain/money";

describe("parsePesosInput", () => {
  it("parses whole pesos", () => {
    expect(parsePesosInput("690")).toBe(69000);
  });
  it("parses pesos with two decimals", () => {
    expect(parsePesosInput("690.50")).toBe(69050);
  });
  it("trims surrounding whitespace and a leading $", () => {
    expect(parsePesosInput(" $1,040.00 ")).toBe(104000);
  });
  it("returns null for empty input", () => {
    expect(parsePesosInput("")).toBeNull();
  });
  it("returns null for non-numeric input", () => {
    expect(parsePesosInput("abc")).toBeNull();
  });
  it("returns null for negative input", () => {
    expect(parsePesosInput("-5")).toBeNull();
  });
  it("rounds more than two decimals to the nearest centavo", () => {
    expect(parsePesosInput("10.005")).toBe(1001);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- money`
Expected: FAIL — `parsePesosInput` is not exported.

- [ ] **Step 3: Implement**

Append to `src/domain/money.ts`:
```ts
/**
 * Parse a user-entered peso amount ("690", "690.50", "$1,040.00") into centavos.
 * Returns null for empty, non-numeric, or negative input. More than two decimals
 * are rounded to the nearest centavo.
 */
export function parsePesosInput(input: string): Centavos | null {
  const cleaned = input.trim().replace(/[$,\s]/g, "");
  if (cleaned === "") return null;
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- money`
Expected: PASS (all money tests, including the new 7).

- [ ] **Step 5: Commit**

```bash
git add src/domain/money.ts src/domain/money.test.ts
git commit -m "feat(domain): parsePesosInput for admin price entry"
```

---

## Task 4: Build variant grid matrix (pure, TDD)

**Files:** Create `src/lib/admin/variant-grid.ts`; Test `src/lib/admin/variant-grid.test.ts`.

The product editor shows a color×size grid. Given flat variant rows, build a matrix: ordered sizes (canonical XS→XXL, unknowns appended), ordered colors (first-seen), and a stock lookup per (color,size) cell (null when that combination has no variant).

- [ ] **Step 1: Write failing tests**

Create `src/lib/admin/variant-grid.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildVariantGrid, type GridVariant } from "@/lib/admin/variant-grid";

const variants: GridVariant[] = [
  { color: "Negro", size: "M", stock: 6 },
  { color: "Negro", size: "S", stock: 8 },
  { color: "Arena", size: "M", stock: 0 },
  { color: "Negro", size: "XS", stock: 5 },
];

describe("buildVariantGrid", () => {
  it("orders sizes canonically (XS, S, M ...)", () => {
    expect(buildVariantGrid(variants).sizes).toEqual(["XS", "S", "M"]);
  });

  it("orders colors by first appearance", () => {
    expect(buildVariantGrid(variants).colors).toEqual(["Negro", "Arena"]);
  });

  it("maps stock per color+size, null where no variant exists", () => {
    const grid = buildVariantGrid(variants);
    expect(grid.cell("Negro", "S")).toBe(8);
    expect(grid.cell("Arena", "M")).toBe(0);
    expect(grid.cell("Arena", "S")).toBeNull();
  });

  it("appends unknown sizes after canonical ones", () => {
    const grid = buildVariantGrid([
      { color: "Negro", size: "Única", stock: 3 },
      { color: "Negro", size: "M", stock: 1 },
    ]);
    expect(grid.sizes).toEqual(["M", "Única"]);
  });

  it("handles an empty list", () => {
    const grid = buildVariantGrid([]);
    expect(grid.sizes).toEqual([]);
    expect(grid.colors).toEqual([]);
    expect(grid.cell("Negro", "M")).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- variant-grid`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/lib/admin/variant-grid.ts`:
```ts
export interface GridVariant {
  color: string;
  size: string;
  stock: number;
}

export interface VariantGrid {
  colors: string[];
  sizes: string[];
  cell(color: string, size: string): number | null;
}

const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL"];

/** Build an ordered color×size grid with a per-cell stock lookup. */
export function buildVariantGrid(variants: GridVariant[]): VariantGrid {
  const colors: string[] = [];
  const sizesSeen: string[] = [];
  const stockByKey = new Map<string, number>();

  for (const v of variants) {
    if (!colors.includes(v.color)) colors.push(v.color);
    if (!sizesSeen.includes(v.size)) sizesSeen.push(v.size);
    stockByKey.set(`${v.color}__${v.size}`, v.stock);
  }

  const known = SIZE_ORDER.filter((s) => sizesSeen.includes(s));
  const unknown = sizesSeen.filter((s) => !SIZE_ORDER.includes(s));
  const sizes = [...known, ...unknown];

  return {
    colors,
    sizes,
    cell(color, size) {
      const value = stockByKey.get(`${color}__${size}`);
      return value === undefined ? null : value;
    },
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- variant-grid`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/variant-grid.ts src/lib/admin/variant-grid.test.ts
git commit -m "feat(admin): build color/size variant grid"
```

---

## Task 5: Compute stock correction (pure, TDD)

**Files:** Create `src/lib/admin/correction.ts`; Test `src/lib/admin/correction.test.ts`.

A manual correction sets a variant's stock to a new absolute count. We compute the signed delta and the movement to log. Reject negative targets and no-op changes (delta 0 → no movement).

- [ ] **Step 1: Write failing tests**

Create `src/lib/admin/correction.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { computeCorrection } from "@/lib/admin/correction";

describe("computeCorrection", () => {
  it("computes a positive delta", () => {
    expect(computeCorrection(6, 10)).toEqual({ ok: true, delta: 4, newStock: 10 });
  });
  it("computes a negative delta", () => {
    expect(computeCorrection(6, 2)).toEqual({ ok: true, delta: -4, newStock: 2 });
  });
  it("rejects a no-op (no movement to log)", () => {
    expect(computeCorrection(6, 6)).toEqual({ ok: false, reason: "no_change" });
  });
  it("rejects a negative target", () => {
    expect(computeCorrection(6, -1)).toEqual({ ok: false, reason: "negative_target" });
  });
  it("rejects a non-integer target", () => {
    expect(computeCorrection(6, 2.5)).toEqual({ ok: false, reason: "non_integer" });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- correction`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/lib/admin/correction.ts`:
```ts
export type CorrectionResult =
  | { ok: true; delta: number; newStock: number }
  | { ok: false; reason: "no_change" | "negative_target" | "non_integer" };

/** Compute the signed delta to set `current` stock to an absolute `target` count. */
export function computeCorrection(current: number, target: number): CorrectionResult {
  if (!Number.isInteger(target)) return { ok: false, reason: "non_integer" };
  if (target < 0) return { ok: false, reason: "negative_target" };
  const delta = target - current;
  if (delta === 0) return { ok: false, reason: "no_change" };
  return { ok: true, delta, newStock: target };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- correction`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/correction.ts src/lib/admin/correction.test.ts
git commit -m "feat(admin): compute stock correction delta"
```

---

## Task 6: Validate product input (pure, TDD)

**Files:** Create `src/lib/admin/product-input.ts`; Test `src/lib/admin/product-input.test.ts`.

Validate and normalize raw form values into a typed product payload (centavos), or return field errors. Uses `parsePesosInput` from Task 3.

- [ ] **Step 1: Write failing tests**

Create `src/lib/admin/product-input.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { validateProductInput } from "@/lib/admin/product-input";

const valid = {
  name: "Legging Aurora",
  line: "MOVE",
  type: "legging",
  description: "Te abraza sin apretar.",
  price: "690",
  cost: "250",
  status: "active",
};

describe("validateProductInput", () => {
  it("accepts valid input and converts money to centavos", () => {
    const r = validateProductInput(valid);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toEqual({
        name: "Legging Aurora",
        line: "MOVE",
        type: "legging",
        description: "Te abraza sin apretar.",
        price: 69000,
        cost: 25000,
        status: "active",
      });
    }
  });

  it("trims the name and rejects when empty", () => {
    const r = validateProductInput({ ...valid, name: "   " });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.name).toBeDefined();
  });

  it("rejects an invalid line", () => {
    const r = validateProductInput({ ...valid, line: "FLOW" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.line).toBeDefined();
  });

  it("rejects an invalid status", () => {
    const r = validateProductInput({ ...valid, status: "live" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.status).toBeDefined();
  });

  it("rejects an unparseable price", () => {
    const r = validateProductInput({ ...valid, price: "abc" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.price).toBeDefined();
  });

  it("defaults cost to 0 when blank", () => {
    const r = validateProductInput({ ...valid, cost: "" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.cost).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- product-input`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/lib/admin/product-input.ts`:
```ts
import { parsePesosInput, type Centavos } from "@/domain/money";
import type { Line, ProductStatus } from "@/domain/types";

const LINES: Line[] = ["MOVE", "HIM"];
const STATUSES: ProductStatus[] = ["draft", "active", "hidden"];

export interface ProductPayload {
  name: string;
  line: Line;
  type: string;
  description: string;
  price: Centavos;
  cost: Centavos;
  status: ProductStatus;
}

export type ValidationResult =
  | { ok: true; value: ProductPayload }
  | { ok: false; errors: Record<string, string> };

/** Validate + normalize raw product form fields. Money fields are pesos strings. */
export function validateProductInput(raw: Record<string, string>): ValidationResult {
  const errors: Record<string, string> = {};

  const name = (raw.name ?? "").trim();
  if (name === "") errors.name = "El nombre es obligatorio";

  const line = raw.line as Line;
  if (!LINES.includes(line)) errors.line = "Línea inválida";

  const status = raw.status as ProductStatus;
  if (!STATUSES.includes(status)) errors.status = "Estado inválido";

  const type = (raw.type ?? "").trim();
  if (type === "") errors.type = "El tipo es obligatorio";

  const price = parsePesosInput(raw.price ?? "");
  if (price === null) errors.price = "Precio inválido";

  const costRaw = (raw.cost ?? "").trim();
  const cost = costRaw === "" ? 0 : parsePesosInput(costRaw);
  if (cost === null) errors.cost = "Costo inválido";

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      name,
      line,
      type,
      description: (raw.description ?? "").trim(),
      price: price as Centavos,
      cost: cost as Centavos,
      status,
    },
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- product-input`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/product-input.ts src/lib/admin/product-input.test.ts
git commit -m "feat(admin): validate and normalize product input"
```

---

## Task 7: Auth — session middleware, login, sign-out

**Files:** Create `src/lib/supabase/middleware.ts`, `src/middleware.ts`, `src/app/admin/login/page.tsx`, `src/app/admin/login/actions.ts`. Verified by build + manual (needs Task 1).

- [ ] **Step 1: Session updater**

Create `src/lib/supabase/middleware.ts`:
```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Refresh the Supabase auth session and gate /admin behind a logged-in user. */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAdmin = path.startsWith("/admin");
  const isLogin = path === "/admin/login";

  if (isAdmin && !isLogin && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    return NextResponse.redirect(url);
  }
  if (isLogin && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/products";
    return NextResponse.redirect(url);
  }

  return response;
}
```

- [ ] **Step 2: Middleware entry**

Create `src/middleware.ts`:
```ts
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: ["/admin/:path*"],
};
```

- [ ] **Step 3: Login actions**

Create `src/app/admin/login/actions.ts`:
```ts
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signIn(_prev: unknown, formData: FormData): Promise<{ error: string } | void> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Correo o contraseña incorrectos" };
  redirect("/admin/products");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
```

- [ ] **Step 4: Login page**

Create `src/app/admin/login/page.tsx`:
```tsx
"use client";

import { useActionState } from "react";
import { signIn } from "./actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, undefined);
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#fbf8f4] text-[#211d1a]">
      <form action={formAction} className="w-80 space-y-3 p-6">
        <h1 className="tracking-[0.28em] text-center text-lg">C O R V E</h1>
        <p className="text-center text-sm text-[#8a7d70]">Panel de administración</p>
        <input name="email" type="email" required placeholder="Correo"
          className="w-full rounded-lg border border-[#d8cdc0] p-3 text-sm" />
        <input name="password" type="password" required placeholder="Contraseña"
          className="w-full rounded-lg border border-[#d8cdc0] p-3 text-sm" />
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button type="submit" disabled={pending}
          className="w-full rounded-lg bg-[#211d1a] p-3 text-sm text-white disabled:opacity-60">
          {pending ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: compiles successfully (type-checks even without live Supabase).

- [ ] **Step 6: Manual verification (needs Task 1)**

`npm run dev`, visit `/admin/products` → redirected to `/admin/login`. Log in with the Task 1 user → redirected to `/admin/products` (404 until Task 9 — that's expected; the redirect itself confirms auth). Wrong password → error message.

- [ ] **Step 7: Commit**

```bash
git add src/lib/supabase/middleware.ts src/middleware.ts src/app/admin/login
git commit -m "feat(admin): supabase session middleware and login"
```

---

## Task 8: Product repository (server data access)

**Files:** Create `src/lib/repos/products.ts`. Verified by build + manual.

- [ ] **Step 1: Implement the repo**

Create `src/lib/repos/products.ts`:
```ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ProductRow, VariantRow } from "@/lib/db-types";
import type { ProductPayload } from "@/lib/admin/product-input";

export interface ProductWithVariants {
  product: ProductRow;
  variants: VariantRow[];
}

export async function listProducts(): Promise<ProductRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as ProductRow[];
}

export async function getProduct(id: string): Promise<ProductWithVariants | null> {
  const supabase = await createClient();
  const { data: product, error } = await supabase
    .from("products").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!product) return null;
  const { data: variants, error: vErr } = await supabase
    .from("variants").select("*").eq("product_id", id);
  if (vErr) throw vErr;
  return { product: product as ProductRow, variants: (variants ?? []) as VariantRow[] };
}

export async function createProduct(payload: ProductPayload): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products").insert(payload).select("id").single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function updateProduct(id: string, payload: ProductPayload): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("products").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

/** Replace the variant set for a product: upsert provided variants, delete the rest. */
export async function saveVariants(
  productId: string,
  variants: { color: string; color_hex: string; size: string; stock: number }[],
): Promise<void> {
  const supabase = await createClient();
  const rows = variants.map((v) => ({ ...v, product_id: productId }));
  const { error } = await supabase
    .from("variants")
    .upsert(rows, { onConflict: "product_id,color,size" });
  if (error) throw error;
}
```

- [ ] **Step 2: Verify build & commit**

Run: `npx tsc --noEmit` (exit 0).
```bash
git add src/lib/repos/products.ts
git commit -m "feat(admin): product repository (server data access)"
```

---

## Task 9: Admin shell + product list

**Files:** Create `src/app/admin/layout.tsx`, `src/app/admin/page.tsx`, `src/app/admin/products/page.tsx`. Verified by build + manual.

- [ ] **Step 1: Admin layout (sidebar + sign-out)**

Create `src/app/admin/layout.tsx`:
```tsx
import Link from "next/link";
import { signOut } from "./login/actions";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-[#fbf8f4] text-[#211d1a]">
      <aside className="w-44 bg-[#211d1a] text-[#d9cfc3] p-4 text-sm flex flex-col">
        <div className="tracking-[0.28em] text-white pb-4">C O R V E</div>
        <nav className="space-y-1 flex-1">
          <Link href="/admin/products" className="block py-2">Productos</Link>
          <Link href="/admin/inventory" className="block py-2">Inventario</Link>
        </nav>
        <form action={signOut}>
          <button className="text-left py-2 text-[#a89c8e]">Cerrar sesión</button>
        </form>
      </aside>
      <main className="flex-1">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Admin index redirect**

Create `src/app/admin/page.tsx`:
```tsx
import { redirect } from "next/navigation";
export default function AdminIndex() {
  redirect("/admin/products");
}
```

- [ ] **Step 3: Product list page**

Create `src/app/admin/products/page.tsx`:
```tsx
import Link from "next/link";
import { listProducts } from "@/lib/repos/products";
import { formatMXN } from "@/domain/money";
import { calcMargin } from "@/domain/margin";

export default async function ProductsPage() {
  const products = await listProducts();
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold">Productos</h1>
        <Link href="/admin/products/new" className="rounded-md bg-[#211d1a] text-white text-sm px-3 py-2">
          + Nuevo producto
        </Link>
      </div>
      <table className="w-full text-sm">
        <thead className="text-left text-[#9a8b7d] text-xs">
          <tr><th className="py-2">Nombre</th><th>Línea</th><th>Precio</th><th>Margen</th><th>Estado</th></tr>
        </thead>
        <tbody>
          {products.map((p) => {
            const m = calcMargin(p.price, p.cost);
            return (
              <tr key={p.id} className="border-t border-[#eadfd3]">
                <td className="py-2"><Link href={`/admin/products/${p.id}`}>{p.name}</Link></td>
                <td>{p.line}</td>
                <td>{formatMXN(p.price)}</td>
                <td>{formatMXN(m.amount)} · {m.pct}%</td>
                <td>{p.status}</td>
              </tr>
            );
          })}
          {products.length === 0 && (
            <tr><td colSpan={5} className="py-6 text-center text-[#9a8b7d]">Aún no hay productos.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Verify build & manual**

Run: `npm run build` (success). Manual (needs Task 1): log in → `/admin/products` shows the empty state and the "+ Nuevo producto" button; sign-out works.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/layout.tsx src/app/admin/page.tsx src/app/admin/products/page.tsx
git commit -m "feat(admin): admin shell and product list"
```

---

## Task 10: Product editor (create/edit) + server action

**Files:** Create `src/app/admin/products/[id]/page.tsx`, `ProductForm.tsx`, `actions.ts`. Verified by build + manual.

- [ ] **Step 1: Save action**

Create `src/app/admin/products/[id]/actions.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { validateProductInput } from "@/lib/admin/product-input";
import { createProduct, updateProduct } from "@/lib/repos/products";

export async function saveProduct(
  id: string,
  _prev: unknown,
  formData: FormData,
): Promise<{ errors: Record<string, string> } | void> {
  const raw = Object.fromEntries(
    ["name", "line", "type", "description", "price", "cost", "status"].map((k) => [
      k, String(formData.get(k) ?? ""),
    ]),
  );
  const result = validateProductInput(raw);
  if (!result.ok) return { errors: result.errors };

  if (id === "new") {
    const newId = await createProduct(result.value);
    redirect(`/admin/products/${newId}`);
  } else {
    await updateProduct(id, result.value);
    revalidatePath(`/admin/products/${id}`);
    revalidatePath("/admin/products");
  }
}
```

- [ ] **Step 2: Form component**

Create `src/app/admin/products/[id]/ProductForm.tsx`:
```tsx
"use client";

import { useActionState } from "react";
import type { ProductRow } from "@/lib/db-types";

type Props = {
  product: Pick<ProductRow, "name" | "line" | "type" | "description" | "price" | "cost" | "status"> | null;
  action: (prev: unknown, formData: FormData) => Promise<{ errors: Record<string, string> } | void>;
};

const peso = (centavos: number) => (centavos / 100).toString();

export default function ProductForm({ product, action }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const e = state?.errors ?? {};
  return (
    <form action={formAction} className="max-w-md space-y-3 p-6 text-sm">
      <h1 className="text-lg font-bold">{product ? "Editar producto" : "Nuevo producto"}</h1>

      <label className="block">Nombre
        <input name="name" defaultValue={product?.name ?? ""} className="w-full rounded border border-[#d8cdc0] p-2" />
        {e.name && <span className="text-red-600 text-xs">{e.name}</span>}
      </label>

      <label className="block">Línea
        <select name="line" defaultValue={product?.line ?? "MOVE"} className="w-full rounded border border-[#d8cdc0] p-2">
          <option value="MOVE">CORVE MOVE</option>
          <option value="HIM">CORVE HIM</option>
        </select>
        {e.line && <span className="text-red-600 text-xs">{e.line}</span>}
      </label>

      <label className="block">Tipo
        <input name="type" defaultValue={product?.type ?? ""} className="w-full rounded border border-[#d8cdc0] p-2" />
        {e.type && <span className="text-red-600 text-xs">{e.type}</span>}
      </label>

      <label className="block">Descripción
        <textarea name="description" defaultValue={product?.description ?? ""} className="w-full rounded border border-[#d8cdc0] p-2" />
      </label>

      <div className="flex gap-3">
        <label className="block flex-1">Precio (MXN)
          <input name="price" defaultValue={product ? peso(product.price) : ""} className="w-full rounded border border-[#d8cdc0] p-2" />
          {e.price && <span className="text-red-600 text-xs">{e.price}</span>}
        </label>
        <label className="block flex-1">Costo (MXN)
          <input name="cost" defaultValue={product ? peso(product.cost) : ""} className="w-full rounded border border-[#d8cdc0] p-2" />
          {e.cost && <span className="text-red-600 text-xs">{e.cost}</span>}
        </label>
      </div>

      <label className="block">Estado
        <select name="status" defaultValue={product?.status ?? "draft"} className="w-full rounded border border-[#d8cdc0] p-2">
          <option value="draft">Borrador</option>
          <option value="active">Activa</option>
          <option value="hidden">Oculta</option>
        </select>
        {e.status && <span className="text-red-600 text-xs">{e.status}</span>}
      </label>

      <button type="submit" disabled={pending} className="rounded bg-[#211d1a] text-white px-4 py-2 disabled:opacity-60">
        {pending ? "Guardando…" : "Guardar"}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Editor page (wires action + loads existing)**

Create `src/app/admin/products/[id]/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import { getProduct } from "@/lib/repos/products";
import { saveProduct } from "./actions";
import ProductForm from "./ProductForm";

export default async function ProductEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const existing = id === "new" ? null : await getProduct(id);
  if (id !== "new" && !existing) notFound();

  const action = saveProduct.bind(null, id);
  return <ProductForm product={existing?.product ?? null} action={action} />;
}
```

- [ ] **Step 4: Verify build & manual**

Run: `npm run build` (success). Manual (Task 1): create a product (price "690", cost "250") → saved, list shows it with margin 64%; submitting an empty name shows the inline error; editing persists changes.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/products/[id]
git commit -m "feat(admin): product create/edit form and save action"
```

---

## Task 11: Variant grid editor + stock correction

**Files:** Create `src/lib/repos/inventory.ts`; Modify `src/app/admin/products/[id]/actions.ts` and `ProductForm.tsx` (add a variants editor + correction action). Verified by build + manual.

- [ ] **Step 1: Inventory repo (correction + add variant)**

Create `src/lib/repos/inventory.ts`:
```ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { computeCorrection } from "@/lib/admin/correction";
import type { StockMovementRow } from "@/lib/db-types";

/** Set a variant's stock to an absolute count, logging a `correccion` movement. */
export async function correctStock(
  variantId: string,
  target: number,
  reason: string,
): Promise<void> {
  const supabase = await createClient();
  const { data: variant, error } = await supabase
    .from("variants").select("stock").eq("id", variantId).single();
  if (error) throw error;

  const result = computeCorrection((variant as { stock: number }).stock, target);
  if (!result.ok) {
    if (result.reason === "no_change") return; // nothing to do
    throw new Error(`Invalid correction: ${result.reason}`);
  }

  const { error: upErr } = await supabase
    .from("variants").update({ stock: result.newStock }).eq("id", variantId);
  if (upErr) throw upErr;

  const { error: mvErr } = await supabase.from("stock_movements").insert({
    variant_id: variantId,
    delta: result.delta,
    type: "correccion",
    reason,
  });
  if (mvErr) throw mvErr;
}

export async function listMovements(limit = 100): Promise<StockMovementRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stock_movements").select("*").order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return data as StockMovementRow[];
}
```

- [ ] **Step 2: Add-variant + correction server actions**

Append to `src/app/admin/products/[id]/actions.ts`:
```ts
import { saveVariants } from "@/lib/repos/products";
import { correctStock } from "@/lib/repos/inventory";

export async function addVariant(productId: string, formData: FormData): Promise<void> {
  const color = String(formData.get("color") ?? "").trim();
  const color_hex = String(formData.get("color_hex") ?? "#000000");
  const size = String(formData.get("size") ?? "").trim();
  const stock = Number(formData.get("stock") ?? 0);
  if (!color || !size || !Number.isInteger(stock) || stock < 0) return;
  await saveVariants(productId, [{ color, color_hex, size, stock }]);
  revalidatePath(`/admin/products/${productId}`);
}

export async function correctVariant(productId: string, formData: FormData): Promise<void> {
  const variantId = String(formData.get("variantId") ?? "");
  const target = Number(formData.get("target") ?? NaN);
  const reason = String(formData.get("reason") ?? "Corrección manual");
  await correctStock(variantId, target, reason);
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/admin/inventory");
}
```

- [ ] **Step 3: Render the variant grid in the editor page**

In `src/app/admin/products/[id]/page.tsx`, below `<ProductForm .../>`, render the existing variants as a grid (only for saved products). Replace the return with:
```tsx
  const action = saveProduct.bind(null, id);
  const variants = existing?.variants ?? [];
  return (
    <div>
      <ProductForm product={existing?.product ?? null} action={action} />
      {id !== "new" && (
        <section className="max-w-md px-6 pb-8 text-sm">
          <h2 className="font-semibold mb-2">Variantes (color × talla)</h2>
          <ul className="space-y-1">
            {variants.map((v) => (
              <li key={v.id} className="flex items-center gap-2">
                <span className="flex-1">{v.color} · {v.size}</span>
                <span className="text-[#6b5d50]">stock {v.stock}</span>
                <form action={correctVariant.bind(null, id)} className="flex gap-1">
                  <input type="hidden" name="variantId" value={v.id} />
                  <input name="target" type="number" min="0" defaultValue={v.stock}
                    className="w-16 rounded border border-[#d8cdc0] p-1" />
                  <input name="reason" placeholder="motivo" className="w-24 rounded border border-[#d8cdc0] p-1" />
                  <button className="rounded bg-[#211d1a] text-white px-2">Corregir</button>
                </form>
              </li>
            ))}
            {variants.length === 0 && <li className="text-[#9a8b7d]">Sin variantes aún.</li>}
          </ul>
          <form action={addVariant.bind(null, id)} className="mt-3 flex gap-2 items-end flex-wrap">
            <input name="color" placeholder="Color" className="w-24 rounded border border-[#d8cdc0] p-1" />
            <input name="color_hex" type="color" defaultValue="#000000" className="h-8 w-10" />
            <input name="size" placeholder="Talla" className="w-16 rounded border border-[#d8cdc0] p-1" />
            <input name="stock" type="number" min="0" defaultValue="0" className="w-16 rounded border border-[#d8cdc0] p-1" />
            <button className="rounded bg-[#211d1a] text-white px-3 py-1">+ Variante</button>
          </form>
        </section>
      )}
    </div>
  );
```
Add the imports at the top of the page: `import { addVariant, correctVariant } from "./actions";`.

- [ ] **Step 4: Verify build & manual**

Run: `npm run build` (success). Manual (Task 1): on a saved product, add a variant (Negro/M/6) → appears; correct its stock to 10 with reason "reabasto inicial" → stock updates; the movement appears in Task 12's inventory view.

- [ ] **Step 5: Commit**

```bash
git add src/lib/repos/inventory.ts "src/app/admin/products/[id]/actions.ts" "src/app/admin/products/[id]/page.tsx"
git commit -m "feat(admin): variant editor and manual stock correction"
```

---

## Task 12: Inventory view (stock + movement history)

**Files:** Create `src/app/admin/inventory/page.tsx`. Verified by build + manual.

- [ ] **Step 1: Inventory page**

Create `src/app/admin/inventory/page.tsx`:
```tsx
import { createClient } from "@/lib/supabase/server";
import { listMovements } from "@/lib/repos/inventory";
import type { VariantRow } from "@/lib/db-types";

export default async function InventoryPage() {
  const supabase = await createClient();
  const { data: variants, error } = await supabase
    .from("variants").select("*, products(name)").order("stock", { ascending: true });
  if (error) throw error;
  const movements = await listMovements(50);
  const rows = (variants ?? []) as (VariantRow & { products: { name: string } | null })[];

  return (
    <div className="p-6 grid grid-cols-2 gap-8 text-sm">
      <div>
        <h1 className="text-lg font-bold mb-3">Inventario</h1>
        <table className="w-full">
          <thead className="text-left text-xs text-[#9a8b7d]"><tr><th>Variante</th><th>Stock</th></tr></thead>
          <tbody>
            {rows.map((v) => (
              <tr key={v.id} className="border-t border-[#f3efe9]">
                <td className="py-1">{v.products?.name ?? "—"} · {v.color} · {v.size}</td>
                <td className={v.stock <= 1 ? "text-[#a85a23]" : ""}>{v.stock}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={2} className="py-4 text-[#9a8b7d]">Sin variantes.</td></tr>}
          </tbody>
        </table>
      </div>
      <div>
        <h2 className="text-lg font-bold mb-3">Movimientos</h2>
        <ul className="space-y-1">
          {movements.map((m) => (
            <li key={m.id} className="flex justify-between border-b border-[#f3efe9] py-1">
              <span>{m.type}{m.reference ? ` · ${m.reference}` : ""}{m.reason ? ` · ${m.reason}` : ""}</span>
              <span className={m.delta >= 0 ? "text-[#2f6b3a]" : "text-[#9a5a1c]"}>
                {m.delta >= 0 ? "+" : ""}{m.delta}
              </span>
            </li>
          ))}
          {movements.length === 0 && <li className="text-[#9a8b7d]">Sin movimientos aún.</li>}
        </ul>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build & manual**

Run: `npm run build` (success). Manual (Task 1): visit `/admin/inventory` → variants listed by stock ascending (low highlighted), movements from Task 11 shown newest-first.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/inventory/page.tsx
git commit -m "feat(admin): inventory and movement history view"
```

---

## Task 13: Product image upload

**Files:** Modify `src/lib/repos/products.ts` (add image helpers) and the editor page/form. Verified by build + manual.

- [ ] **Step 1: Image repo helpers**

Append to `src/lib/repos/products.ts`:
```ts
import type { ProductImageRow } from "@/lib/db-types";

export async function listImages(productId: string): Promise<ProductImageRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_images").select("*").eq("product_id", productId).order("sort_order");
  if (error) throw error;
  return data as ProductImageRow[];
}

/** Upload a file to the public product-images bucket and record it. */
export async function addProductImage(productId: string, file: File): Promise<void> {
  const supabase = await createClient();
  const path = `products/${productId}/${Date.now()}-${file.name}`;
  const { error: upErr } = await supabase.storage.from("product-images").upload(path, file);
  if (upErr) throw upErr;
  const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
  const { count } = await supabase
    .from("product_images").select("id", { count: "exact", head: true }).eq("product_id", productId);
  const { error } = await supabase.from("product_images")
    .insert({ product_id: productId, url: pub.publicUrl, sort_order: count ?? 0 });
  if (error) throw error;
}
```

- [ ] **Step 2: Upload action**

Append to `src/app/admin/products/[id]/actions.ts`:
```ts
import { addProductImage } from "@/lib/repos/products";

export async function uploadImage(productId: string, formData: FormData): Promise<void> {
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return;
  await addProductImage(productId, file);
  revalidatePath(`/admin/products/${productId}`);
}
```

- [ ] **Step 3: Show images + upload control on the editor**

In `src/app/admin/products/[id]/page.tsx`, when `id !== "new"`, load `listImages(id)` and render thumbnails plus an upload form (`encType` handled automatically by Server Actions with a `File` input):
```tsx
// add import: import { getProduct, listImages } from "@/lib/repos/products";
//             import { uploadImage } from "./actions";
// after computing `existing`:
const images = id === "new" ? [] : await listImages(id);
// inside the id !== "new" section, above the variants block:
<div className="flex gap-2 mb-3 flex-wrap">
  {images.map((img) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img key={img.id} src={img.url} alt="" className="h-20 w-16 object-cover rounded" />
  ))}
</div>
<form action={uploadImage.bind(null, id)} className="mb-4">
  <input type="file" name="image" accept="image/*" className="text-xs" />
  <button className="rounded bg-[#211d1a] text-white px-3 py-1 ml-2 text-xs">Subir foto</button>
</form>
```

- [ ] **Step 4: Verify build & manual**

Run: `npm run build` (success — the `no-img-element` lint is disabled inline for the admin thumbnail). Manual (Task 1): upload a JPG to a saved product → thumbnail appears; the public URL loads in a new tab.

- [ ] **Step 5: Commit**

```bash
git add src/lib/repos/products.ts "src/app/admin/products/[id]/actions.ts" "src/app/admin/products/[id]/page.tsx"
git commit -m "feat(admin): product image upload to storage"
```

---

## Task 14: Full gate

**Files:** none (verification only).

- [ ] **Step 1: Tests**

Run: `npm test`
Expected: all pass — the Plan 1 suite plus the new pure modules (money +7, variant-grid, correction, product-input).

- [ ] **Step 2: Type-check & build**

Run: `npx tsc --noEmit` (exit 0), then `npm run build` (compiles successfully).

- [ ] **Step 3: Clean tree**

Run: `git status` → "nothing to commit, working tree clean".

---

## Self-Review (completed by plan author)

- **Spec coverage (§6.2 Productos, §6.3 Inventario, §3 stack, §8 auth/images):** product CRUD with line/type/description/status (Tasks 6,8,10); price+cost→live margin (margin reused in list + form; Task 9/10); variant color×size grid + stock (Tasks 4,8,11); manual correction logged as `correccion` movement (Tasks 5,11); inventory stock view + movement history (Task 12); draft/active/hidden status (Task 6,10); images (Task 13); admin auth (Task 7); migration applied to Supabase (Task 1). Low-stock **coloring** only (Task 12), no alerts — matches the deferred-alerts decision.
- **Placeholder scan:** every code step has complete code; no TBD/TODO. The only human steps (Task 1) are explicitly human and gated by a connectivity check.
- **Type consistency:** `ProductPayload` (product-input.ts) is the single write shape used by `createProduct`/`updateProduct`. `ProductRow`/`VariantRow`/`StockMovementRow`/`ProductImageRow` (db-types.ts) match `0001_init.sql`. `MovementType` (from Plan 1) types the `stock_movements.type` insert (`"correccion"`). `parsePesosInput`/`Centavos` shared from money.ts. `buildVariantGrid`/`computeCorrection` are used by repos/UI exactly as defined.
- **Carried-forward Plan 1 notes honored:** integer/positive quantity guards live in `computeCorrection` and `addVariant`; UTC handled where timestamps are formatted (none rendered here beyond raw movement display).

---

## Next phases (not part of this plan)
- **Plan 3 — Customer catalog & ordering:** public immersive catalog, cart, checkout, order creation (uses `decrementStock`), cancellation (uses `restoreStock`).
- **Plan 4 — Purchasing & sales:** suppliers, POs, receiving (uses `receivePurchaseOrder`), sales reporting (uses `summarizeSales`).
