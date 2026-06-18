# Editable Contact Methods — Design

**Date:** 2026-06-18
**Status:** Approved, ready for implementation plan

## Problem

The store's contact channels are hardcoded across the app:

- Social links (Instagram `instagram.com/corveactive/`, TikTok `@corveactive`) are hardcoded `<a href>` in `src/app/(shop)/Footer.tsx`. The WhatsApp icon there is a dead `<span>` ("sin enlace por ahora").
- The store WhatsApp number is hardcoded as `STORE_WHATSAPP = "5215500000000"` in `src/app/(shop)/pedido/[id]/page.tsx` (with a "replace at deploy time" comment). It powers the "Continuar por WhatsApp" button after checkout.

Changing any of these requires a code edit and redeploy. The admin should be able to edit them from the admin panel.

## Goal

Make **WhatsApp number, Instagram, and TikTok** editable from the admin panel. Store them so that adding a *new* channel later (Facebook, email, etc.) is a **frontend-only change** — no DB migration.

Non-goals: editing other copy/content, per-channel scheduling, analytics.

## Approach

A generic **key-value `store_settings` table** (anon-readable, admin-writable), matching the existing RLS model. Adding a channel later = seed one row + drop an icon+link in the footer. (Rejected alternatives: typed single-row table — needs a migration per new channel; env vars — not admin-editable.)

For each channel the admin enters a **raw value**, and the frontend renders it directly:

- WhatsApp: admin types **only a number** (with lada). Stored as digits. Every consumer builds the `wa.me` link via the existing `buildWhatsAppLink()`.
- Instagram / TikTok: admin pastes the **full URL**. Frontend renders it as-is.

An empty value means "hide that channel's icon" — forgiving and extensible.

## 1. Data layer

New migration `supabase/migrations/0007_store_settings.sql`:

```sql
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
create policy admin_all on store_settings for all to authenticated using (true) with check (true);
create policy public_read on store_settings for select to anon using (true);
grant select on store_settings to anon;
```

Contact info is inherently public, so anon reads every row — no per-key filtering.

## 2. Repo + validation

**`src/lib/repos/settings.ts`** (follows the `suppliers.ts` pattern):

```ts
export interface StoreSettings { whatsapp: string; instagram_url: string; tiktok_url: string }

// Reads all rows → typed object, with safe defaults if a key is missing.
export async function getStoreSettings(): Promise<StoreSettings>
// Upserts each key, stamps updated_at.
export async function updateStoreSettings(values: StoreSettings): Promise<void>
```

**`src/domain/settings.ts`** — pure validation/normalization, unit-tested like `checkout.ts`:

- `whatsapp` — strip to digits; if non-empty must be ≥10 digits (same rule as checkout). Stored as digits.
- `instagram_url` / `tiktok_url` — trimmed; if non-empty must start with `http://` or `https://`. Empty allowed.
- Returns `{ ok: true, values }` or `{ ok: false, errors }` (same shape as `validateCheckout`).

## 3. Frontend consumers

**Footer** (`src/app/(shop)/Footer.tsx`) → async server component:

- Reads `getStoreSettings()`.
- Instagram / TikTok: render the `<a>` only if the URL is non-empty.
- WhatsApp: if a number is set, render `<a href={buildWhatsAppLink(whatsapp, "Hola CORVE 💛")}>` — replacing today's dead icon with a working link.

**Post-checkout page** (`src/app/(shop)/pedido/[id]/page.tsx`):

- Delete the hardcoded `STORE_WHATSAPP` constant.
- The page is a client component (reads `sessionStorage`), so split it: a thin **server** `page.tsx` fetches the number via `getStoreSettings()` and passes it as a `storeWhatsapp` prop into a **client** `OrderConfirmation` component (current logic moves there). The button then uses the admin-set number.

**Revalidation**: the admin save action calls `revalidatePath("/", "layout")` so the footer (shop layout) and pedido pages pick up new values immediately.

## 4. Admin page + nav

**New page `/admin/ajustes`** (Ajustes):

- Server component reads `getStoreSettings()` and renders a form with three fields — **WhatsApp (solo número, con lada)**, **Instagram (URL)**, **TikTok (URL)** — using the input styling from `proveedores/page.tsx`.
- Server action `saveSettings(formData)` → runs `src/domain/settings.ts` validation → `updateStoreSettings()` → `revalidatePath("/", "layout")` + `revalidatePath("/admin/ajustes")`. On validation error, re-renders with field errors (same shape as the cart form). Shows a "Guardado" confirmation on success.

**Nav** — add `{ href: "/admin/ajustes", label: "Ajustes" }` as the last item in the `LINKS` array in `src/app/admin/AdminNav.tsx`.

## 5. Testing

- `src/domain/settings.test.ts` — whatsapp digit-stripping/min-length, URL scheme validation, empty-allowed cases (mirrors `checkout.test.ts`).
- `buildWhatsAppLink` already covered; no UI/integration tests (consistent with the rest of the admin).

## Extending later (Facebook, email, …)

1. Add the key to the seed (or insert a row).
2. Add the field to `StoreSettings`, the admin form, and `src/domain/settings.ts`.
3. Render the icon+link in `Footer.tsx`.

No migration needed beyond the optional seed row; the table shape never changes.
