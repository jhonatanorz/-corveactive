# Editable Contact Methods Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the store's WhatsApp number and Instagram/TikTok links editable from the admin panel, stored so a new channel is later a frontend-only change.

**Architecture:** A generic key-value `store_settings` table (anon-readable, admin-writable) backs a typed repo (`getStoreSettings`/`updateStoreSettings`). A pure domain validator normalizes input. A new `/admin/ajustes` page edits the values; the public footer and post-checkout page read them server-side.

**Tech Stack:** Next.js 16 (App Router, RSC + Server Actions), React 19 (`useActionState`), Supabase (Postgres + RLS), Vitest, Tailwind v4.

## Global Constraints

- WhatsApp is stored as **digits only**; consumers build the `wa.me` link via the existing `buildWhatsAppLink(phone, message)` in `src/domain/whatsapp.ts`.
- Instagram/TikTok are stored as **full URLs**; consumers render them verbatim.
- An **empty value means "hide that channel"** — never render a dead/broken link or button.
- Follow existing patterns: repos in `src/lib/repos/` start with `import "server-only"` and use `createClient()` from `src/lib/supabase/server.ts`; domain validators live in `src/domain/` and return `{ ok: true, ... } | { ok: false, errors }`.
- UI copy is Spanish. Tailwind classes use the project tokens (`text-ink`, `border-line`, `bg-snow`, `inputClass`, etc.).
- Test runner: `npm test` (= `vitest run`). Type/build gate: `npm run build`.

---

### Task 1: Domain validation/normalization

**Files:**
- Create: `src/domain/settings.ts`
- Test: `src/domain/settings.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface StoreSettings { whatsapp: string; instagram_url: string; tiktok_url: string }`
  - `type SettingsValidation = { ok: true; values: StoreSettings } | { ok: false; errors: Record<string, string> }`
  - `function validateStoreSettings(input: StoreSettings): SettingsValidation` — strips `whatsapp` to digits, trims URLs, validates, and returns the **normalized** values for storage.

- [ ] **Step 1: Write the failing test**

```ts
// src/domain/settings.test.ts
import { describe, it, expect } from "vitest";
import { validateStoreSettings } from "@/domain/settings";

describe("validateStoreSettings", () => {
  const ok = {
    whatsapp: "52 (55) 1234-5678",
    instagram_url: "https://instagram.com/corveactive/",
    tiktok_url: "https://www.tiktok.com/@corveactive",
  };

  it("accepts and normalizes valid settings (whatsapp → digits, urls trimmed)", () => {
    const r = validateStoreSettings({ ...ok, tiktok_url: "  https://www.tiktok.com/@corveactive  " });
    expect(r).toEqual({
      ok: true,
      values: {
        whatsapp: "525512345678",
        instagram_url: "https://instagram.com/corveactive/",
        tiktok_url: "https://www.tiktok.com/@corveactive",
      },
    });
  });

  it("allows all fields empty (everything hidden)", () => {
    const r = validateStoreSettings({ whatsapp: "", instagram_url: "", tiktok_url: "  " });
    expect(r).toEqual({ ok: true, values: { whatsapp: "", instagram_url: "", tiktok_url: "" } });
  });

  it("rejects a whatsapp with fewer than 10 digits when non-empty", () => {
    const r = validateStoreSettings({ ...ok, whatsapp: "55-1234" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.whatsapp).toBeDefined();
  });

  it("rejects a url without http(s) scheme when non-empty", () => {
    const r = validateStoreSettings({ ...ok, instagram_url: "instagram.com/corve" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.instagram_url).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/domain/settings.test.ts`
Expected: FAIL — cannot resolve `@/domain/settings` / `validateStoreSettings is not a function`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/domain/settings.ts
export interface StoreSettings {
  whatsapp: string;
  instagram_url: string;
  tiktok_url: string;
}

export type SettingsValidation =
  | { ok: true; values: StoreSettings }
  | { ok: false; errors: Record<string, string> };

/**
 * Validate + normalize the contact settings form.
 * - whatsapp: stripped to digits; if non-empty must be >=10 digits.
 * - instagram_url / tiktok_url: trimmed; if non-empty must start with http(s)://.
 * Empty values are allowed and mean "hide that channel".
 */
export function validateStoreSettings(input: StoreSettings): SettingsValidation {
  const errors: Record<string, string> = {};

  const whatsapp = input.whatsapp.replace(/\D/g, "");
  if (whatsapp !== "" && whatsapp.length < 10) {
    errors.whatsapp = "WhatsApp inválido (incluye lada)";
  }

  const instagram_url = input.instagram_url.trim();
  if (instagram_url !== "" && !/^https?:\/\//.test(instagram_url)) {
    errors.instagram_url = "Debe iniciar con http:// o https://";
  }

  const tiktok_url = input.tiktok_url.trim();
  if (tiktok_url !== "" && !/^https?:\/\//.test(tiktok_url)) {
    errors.tiktok_url = "Debe iniciar con http:// o https://";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, values: { whatsapp, instagram_url, tiktok_url } };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/domain/settings.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/settings.ts src/domain/settings.test.ts
git commit -m "feat(settings): domain validation for contact settings"
```

---

### Task 2: `store_settings` migration

**Files:**
- Create: `supabase/migrations/0007_store_settings.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: table `store_settings(key text pk, value text not null default '', updated_at timestamptz)`, seeded with keys `whatsapp` (blank), `instagram_url`, `tiktok_url`. Anon `select`; authenticated all.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0007_store_settings.sql
-- Editable store contact settings (key-value). Public reads, admin writes.

create table store_settings (
  key        text primary key,
  value      text not null default '',
  updated_at timestamptz not null default now()
);

-- Seed the three channels. Socials get the real values already in the footer;
-- whatsapp starts blank for the admin to fill in.
insert into store_settings (key, value) values
  ('whatsapp', ''),
  ('instagram_url', 'https://www.instagram.com/corveactive/'),
  ('tiktok_url', 'https://www.tiktok.com/@corveactive');

alter table store_settings enable row level security;

create policy admin_all on store_settings
  for all to authenticated using (true) with check (true);
create policy public_read on store_settings
  for select to anon using (true);

grant select on store_settings to anon;
```

- [ ] **Step 2: Apply the migration to the local DB**

Ensure Docker/Supabase is running, then run: `npx supabase migration up`
Expected: applies `0007_store_settings.sql` with no errors.

- [ ] **Step 3: Verify the table + seed exist**

Run: `npx supabase db reset` is NOT needed; instead verify the seed via the Supabase Studio SQL editor or:
`npx supabase db dump --data-only --schema public | findstr store_settings`
Expected: output shows the three seeded rows (`whatsapp` empty, the two social URLs).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0007_store_settings.sql
git commit -m "feat(settings): store_settings table (anon-read, admin-write)"
```

---

### Task 3: Settings repo

**Files:**
- Create: `src/lib/repos/settings.ts`

**Interfaces:**
- Consumes: `StoreSettings` from `src/domain/settings.ts`; `createClient` from `src/lib/supabase/server.ts`.
- Produces:
  - `async function getStoreSettings(): Promise<StoreSettings>` — reads all rows, returns a typed object with `""` defaults for any missing key.
  - `async function updateStoreSettings(values: StoreSettings): Promise<void>` — upserts the three keys, stamping `updated_at`.

- [ ] **Step 1: Write the repo**

```ts
// src/lib/repos/settings.ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { StoreSettings } from "@/domain/settings";

const DEFAULTS: StoreSettings = { whatsapp: "", instagram_url: "", tiktok_url: "" };

/** Read all settings rows into a typed object, filling missing keys with "". */
export async function getStoreSettings(): Promise<StoreSettings> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("store_settings").select("key, value");
  if (error) throw error;
  const map = new Map((data ?? []).map((r) => [r.key as string, r.value as string]));
  return {
    whatsapp: map.get("whatsapp") ?? DEFAULTS.whatsapp,
    instagram_url: map.get("instagram_url") ?? DEFAULTS.instagram_url,
    tiktok_url: map.get("tiktok_url") ?? DEFAULTS.tiktok_url,
  };
}

/** Upsert the three known settings keys. */
export async function updateStoreSettings(values: StoreSettings): Promise<void> {
  const supabase = await createClient();
  const updated_at = new Date().toISOString();
  const rows = [
    { key: "whatsapp", value: values.whatsapp, updated_at },
    { key: "instagram_url", value: values.instagram_url, updated_at },
    { key: "tiktok_url", value: values.tiktok_url, updated_at },
  ];
  const { error } = await supabase.from("store_settings").upsert(rows, { onConflict: "key" });
  if (error) throw error;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (This repo follows the no-unit-test convention for `src/lib/repos/*`, matching `suppliers.ts`; correctness is exercised end-to-end by Tasks 4–6 plus the build gate.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/repos/settings.ts
git commit -m "feat(settings): getStoreSettings + updateStoreSettings repo"
```

---

### Task 4: Admin `/admin/ajustes` page + action + nav link

**Files:**
- Create: `src/app/admin/ajustes/page.tsx`
- Create: `src/app/admin/ajustes/actions.ts`
- Create: `src/app/admin/ajustes/SettingsForm.tsx`
- Modify: `src/app/admin/AdminNav.tsx` (add nav link to the `LINKS` array)

**Interfaces:**
- Consumes: `getStoreSettings`, `updateStoreSettings` (Task 3); `validateStoreSettings`, `StoreSettings` (Task 1); `Button`, `inputClass` from `@/components/ui`.
- Produces:
  - `type SaveState = { ok: boolean; errors: Record<string, string>; saved: boolean }`
  - `async function saveSettings(prev: SaveState, formData: FormData): Promise<SaveState>` (server action).

- [ ] **Step 1: Write the server action**

```ts
// src/app/admin/ajustes/actions.ts
"use server";
import { revalidatePath } from "next/cache";
import { validateStoreSettings } from "@/domain/settings";
import { updateStoreSettings } from "@/lib/repos/settings";

export type SaveState = { ok: boolean; errors: Record<string, string>; saved: boolean };

export async function saveSettings(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const v = validateStoreSettings({
    whatsapp: String(formData.get("whatsapp") ?? ""),
    instagram_url: String(formData.get("instagram_url") ?? ""),
    tiktok_url: String(formData.get("tiktok_url") ?? ""),
  });
  if (!v.ok) return { ok: false, errors: v.errors, saved: false };
  await updateStoreSettings(v.values);
  revalidatePath("/", "layout"); // shop footer + pedido pages
  revalidatePath("/admin/ajustes");
  return { ok: true, errors: {}, saved: true };
}
```

- [ ] **Step 2: Write the client form**

```tsx
// src/app/admin/ajustes/SettingsForm.tsx
"use client";
import { useActionState } from "react";
import { Button, inputClass } from "@/components/ui";
import { saveSettings, type SaveState } from "./actions";
import type { StoreSettings } from "@/domain/settings";

const INITIAL: SaveState = { ok: true, errors: {}, saved: false };

export default function SettingsForm({ initial }: { initial: StoreSettings }) {
  const [state, formAction, pending] = useActionState(saveSettings, INITIAL);
  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label className="block mb-1 text-ink-2">WhatsApp (solo número, con lada)</label>
        <input name="whatsapp" defaultValue={initial.whatsapp} placeholder="5215512345678" className={inputClass} />
        {state.errors.whatsapp && <p className="text-red-600 text-xs mt-1">{state.errors.whatsapp}</p>}
      </div>
      <div>
        <label className="block mb-1 text-ink-2">Instagram (URL)</label>
        <input name="instagram_url" defaultValue={initial.instagram_url} placeholder="https://instagram.com/..." className={inputClass} />
        {state.errors.instagram_url && <p className="text-red-600 text-xs mt-1">{state.errors.instagram_url}</p>}
      </div>
      <div>
        <label className="block mb-1 text-ink-2">TikTok (URL)</label>
        <input name="tiktok_url" defaultValue={initial.tiktok_url} placeholder="https://tiktok.com/@..." className={inputClass} />
        {state.errors.tiktok_url && <p className="text-red-600 text-xs mt-1">{state.errors.tiktok_url}</p>}
      </div>
      <Button type="submit" variant="primary" disabled={pending}>{pending ? "Guardando…" : "Guardar"}</Button>
      {state.saved && <p className="text-green-700 text-xs">Guardado.</p>}
    </form>
  );
}
```

- [ ] **Step 3: Write the page**

```tsx
// src/app/admin/ajustes/page.tsx
import { getStoreSettings } from "@/lib/repos/settings";
import SettingsForm from "./SettingsForm";

export default async function AjustesPage() {
  const settings = await getStoreSettings();
  return (
    <div className="p-6 max-w-lg text-sm">
      <h1 className="text-lg font-bold mb-4 text-ink">Ajustes de contacto</h1>
      <p className="text-ink-3 mb-4">Estos datos alimentan el footer de la tienda y el botón de WhatsApp tras el pedido. Deja un campo vacío para ocultarlo.</p>
      <SettingsForm initial={settings} />
    </div>
  );
}
```

- [ ] **Step 4: Add the nav link**

In `src/app/admin/AdminNav.tsx`, add as the last entry of the `LINKS` array (after `Proveedores`):

```ts
  { href: "/admin/ajustes", label: "Ajustes" },
```

- [ ] **Step 5: Typecheck/build**

Run: `npm run build`
Expected: build succeeds; `/admin/ajustes` compiles.

- [ ] **Step 6: Manual verification**

With `npm run dev` and Supabase running, log into the admin, open `/admin/ajustes`. Set WhatsApp to `5215512345678`, save → "Guardado." appears. Enter `instagram.com/x` (no scheme) → save shows the Instagram error and does not persist.

- [ ] **Step 7: Commit**

```bash
git add src/app/admin/ajustes src/app/admin/AdminNav.tsx
git commit -m "feat(settings): admin ajustes page to edit contact methods"
```

---

### Task 5: Footer consumes settings

**Files:**
- Modify: `src/app/(shop)/Footer.tsx`

**Interfaces:**
- Consumes: `getStoreSettings` (Task 3); `buildWhatsAppLink` from `@/domain/whatsapp`.
- Produces: nothing (leaf component). Already rendered as `<Footer />` in `src/app/(shop)/layout.tsx` — an async server component works without changes there.

- [ ] **Step 1: Rewrite the footer to read settings and render conditionally**

```tsx
// src/app/(shop)/Footer.tsx
import { getStoreSettings } from "@/lib/repos/settings";
import { buildWhatsAppLink } from "@/domain/whatsapp";

const ICON_BASE =
  "w-10 h-10 rounded-pill bg-white/15 flex items-center justify-center text-ink-on-royal";
const ICON_LINK = `${ICON_BASE} hover:bg-white/30 transition`;

export default async function Footer() {
  const { whatsapp, instagram_url, tiktok_url } = await getStoreSettings();
  const waLink = whatsapp ? buildWhatsAppLink(whatsapp, "Hola CORVE 💛") : null;

  return (
    <footer className="bg-royal text-ink-on-royal">
      <div className="max-w-2xl mx-auto px-6 py-12 md:py-16">
        <p className="text-base md:text-lg leading-relaxed">
          Creemos en mover el cuerpo desde el amor, no desde la exigencia. Honramos los
          procesos, la comodidad, la seguridad y la libertad. CORVE es corazón en movimiento.
        </p>
        <div className="flex gap-3 mt-6">
          {instagram_url && (
            <a href={instagram_url} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className={ICON_LINK}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" stroke="none" />
              </svg>
            </a>
          )}
          {tiktok_url && (
            <a href={tiktok_url} target="_blank" rel="noopener noreferrer" aria-label="TikTok" className={ICON_LINK}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 3h2.6c.3 1.9 1.6 3.4 3.4 3.9v2.6c-1.3 0-2.5-.35-3.6-1v6.2A5.6 5.6 0 1 1 11.6 10v2.7c-.3-.1-.6-.1-.9-.1a2.9 2.9 0 1 0 2.9 2.9V3z" />
              </svg>
            </a>
          )}
          {waLink && (
            <a href={waLink} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className={ICON_LINK}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.46 1.32 4.96L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 1.8c2.17 0 4.21.85 5.74 2.38a8.06 8.06 0 0 1 2.38 5.73c0 4.54-3.7 8.23-8.24 8.23-1.5 0-2.97-.4-4.25-1.16l-.3-.18-3.12.82.83-3.04-.2-.31a8.16 8.16 0 0 1-1.26-4.36c0-4.54 3.7-8.23 8.24-8.23zm-3.7 4.32c-.18 0-.46.07-.7.33-.24.26-.92.9-.92 2.2 0 1.3.94 2.55 1.07 2.73.13.18 1.85 2.82 4.48 3.96.63.27 1.12.43 1.5.55.63.2 1.2.17 1.66.1.5-.07 1.56-.64 1.78-1.25.22-.61.22-1.14.16-1.25-.07-.11-.24-.18-.5-.31-.26-.13-1.56-.77-1.8-.86-.24-.09-.42-.13-.6.13-.18.26-.69.86-.84 1.04-.16.18-.31.2-.57.07-.26-.13-1.11-.41-2.11-1.3-.78-.7-1.31-1.56-1.46-1.82-.16-.26-.02-.4.11-.53.12-.12.26-.31.4-.46.13-.16.18-.26.26-.44.09-.18.04-.33-.02-.46-.07-.13-.6-1.45-.82-1.98-.22-.52-.44-.45-.6-.46h-.51z" />
              </svg>
            </a>
          )}
        </div>
        <div className="mt-8 text-xs text-ink-on-royal/70">© CORVE · Confianza en cada movimiento</div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Manual verification**

With dev running: when WhatsApp is set in `/admin/ajustes`, the footer's WhatsApp icon is now a working `wa.me` link (opens a chat). Clearing Instagram in the admin hides its icon on the storefront after save.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(shop)/Footer.tsx"
git commit -m "feat(settings): footer reads editable contact methods"
```

---

### Task 6: Post-checkout page reads the WhatsApp number

**Files:**
- Modify: `src/app/(shop)/pedido/[id]/page.tsx` (becomes a thin server component)
- Create: `src/app/(shop)/pedido/[id]/OrderConfirmation.tsx` (client component — moved logic)

**Interfaces:**
- Consumes: `getStoreSettings` (Task 3); `buildWhatsAppLink`, `formatMXN`, `Card`, `buttonClass`, `FloatingBar` (existing).
- Produces: `OrderConfirmation` client component with props `{ id: string; storeWhatsapp: string }`.

- [ ] **Step 1: Create the client component (current logic, number via prop)**

```tsx
// src/app/(shop)/pedido/[id]/OrderConfirmation.tsx
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { buildWhatsAppLink } from "@/domain/whatsapp";
import { formatMXN } from "@/domain/money";
import { Card, buttonClass, FloatingBar } from "@/components/ui";

interface LastOrder {
  id: string;
  name: string;
  items: { productName: string; color: string; size: string; qty: number; unitPrice: number; image?: string | null }[];
  total: number;
}

export default function OrderConfirmation({ id, storeWhatsapp }: { id: string; storeWhatsapp: string }) {
  const [order, setOrder] = useState<LastOrder | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("corve-last-order");
      if (raw) {
        const o = JSON.parse(raw) as LastOrder;
        if (o.id === id) setOrder(o);
      }
    } catch {
      // ignore
    }
  }, [id]);

  const short = id.slice(0, 8);

  if (!order) {
    const wa = storeWhatsapp ? buildWhatsAppLink(storeWhatsapp, `Hola CORVE, mi pedido #${short}`) : null;
    return (
      <>
        <main className="p-6 max-w-md mx-auto text-center pb-28">
          <h1 className="text-2xl font-bold mb-2 text-ink">¡Pedido recibido!</h1>
          <p className="text-ink-2 text-sm mb-4">Tu pedido #{short} fue recibido. Te contactamos por WhatsApp.</p>
        </main>
        {wa && (
          <FloatingBar>
            <a href={wa} target="_blank" rel="noopener noreferrer" className={`${buttonClass("primary", "lg")} w-full`}>Continuar por WhatsApp</a>
          </FloatingBar>
        )}
      </>
    );
  }

  const lines = order.items.map((i) => `• ${i.productName} ${i.color}/${i.size} x${i.qty}`).join("\n");
  const message = `Hola CORVE 💛 Soy ${order.name}. Mi pedido #${short}:\n${lines}\nTotal: ${formatMXN(order.total)} MXN`;
  const wa = storeWhatsapp ? buildWhatsAppLink(storeWhatsapp, message) : null;

  return (
    <>
      <main className="p-6 max-w-md mx-auto text-center pb-28">
        <h1 className="text-2xl font-bold mb-2 text-ink">¡Gracias, {order.name}!</h1>
        <p className="text-ink-2 text-sm mb-4">Tu pedido #{short} fue recibido. Te contactamos por WhatsApp para confirmar pago y envío.</p>
        <Card className="p-4 mb-5 text-left">
          <ul>
            {order.items.map((i, idx) => (
              <li key={idx} className="flex items-center gap-2 border-b border-line py-2 text-sm">
                <div className="relative w-10 h-12 shrink-0 rounded-md overflow-hidden bg-mist">
                  {i.image && <Image src={i.image} alt={i.productName} fill sizes="40px" className="object-cover" />}
                </div>
                <span className="flex-1 text-ink">{i.productName} · {i.color}/{i.size} ×{i.qty}</span>
                <span className="text-ink">{formatMXN(i.unitPrice * i.qty)}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between text-sm pt-2 text-ink"><span>Total</span><span>{formatMXN(order.total)} MXN</span></div>
        </Card>
      </main>
      {wa && (
        <FloatingBar>
          <a href={wa} target="_blank" rel="noopener noreferrer" className={`${buttonClass("primary", "lg")} w-full`}>Continuar por WhatsApp</a>
        </FloatingBar>
      )}
    </>
  );
}
```

- [ ] **Step 2: Replace the page with a thin server wrapper**

```tsx
// src/app/(shop)/pedido/[id]/page.tsx
import { getStoreSettings } from "@/lib/repos/settings";
import OrderConfirmation from "./OrderConfirmation";

export default async function OrderConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { whatsapp } = await getStoreSettings();
  return <OrderConfirmation id={id} storeWhatsapp={whatsapp} />;
}
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build succeeds; the hardcoded `STORE_WHATSAPP` constant is gone (grep confirms).

Run: `git grep -n "STORE_WHATSAPP" -- "src/app/(shop)/pedido"` → Expected: no matches.

- [ ] **Step 4: Manual verification**

Place a test order; on `/pedido/<id>`, the "Continuar por WhatsApp" button opens a chat to the **admin-set** number with the order summary prefilled. With WhatsApp cleared in the admin, the button is hidden (no broken link).

- [ ] **Step 5: Commit**

```bash
git add "src/app/(shop)/pedido/[id]/page.tsx" "src/app/(shop)/pedido/[id]/OrderConfirmation.tsx"
git commit -m "feat(settings): post-checkout WhatsApp button uses editable number"
```

---

## Self-Review

**Spec coverage:**
- §1 Data layer → Task 2. ✅
- §2 Repo + validation → Task 1 (`src/domain/settings.ts`), Task 3 (`src/lib/repos/settings.ts`). ✅
- §3 Frontend consumers (Footer, pedido split, revalidation) → Task 5 (footer), Task 6 (pedido split), Task 4 Step 1 (`revalidatePath("/", "layout")`). ✅
- §4 Admin page + nav → Task 4. ✅
- §5 Testing → Task 1 (`settings.test.ts`); `buildWhatsAppLink` already covered; no UI tests, matching convention. ✅
- "Empty = hide channel" rule → enforced in Task 1 validation and rendered conditionally in Tasks 5 & 6. ✅

**Placeholder scan:** No TBD/TODO; every code step shows complete code; every command has expected output.

**Type consistency:** `StoreSettings { whatsapp; instagram_url; tiktok_url }` defined in Task 1 and used identically in Tasks 3, 4, 6. `validateStoreSettings` returns `{ ok: true; values } | { ok: false; errors }`, consumed correctly in Task 4's `saveSettings`. `getStoreSettings`/`updateStoreSettings` signatures match between Task 3 and their callers. `SaveState` defined in Task 4 `actions.ts` and imported by `SettingsForm.tsx`.
