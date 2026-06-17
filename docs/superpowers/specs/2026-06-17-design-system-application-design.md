# CORVE — Apply the Corve Design System — Design Spec

**Date:** 2026-06-17
**Status:** Approved design, pending implementation plan
**Builds on:** Plans 1–4 + per-color images (the full app). Branch base: `color-images`.

---

## 1. Overview

Replace the app's **placeholder warm palette** (`#161311`, `#d8c1ad`, `#9a7a61`…) with the real CORVE brand identity defined in `design_system/`. The DS README states this directly: *"the warm cream foundation has been removed. The brand now lives in a fully cool, blue/periwinkle world."*

This is a **visual** application only. All Spanish copy, the MOVE/HIM model, the WhatsApp ordering flow, data, and business logic stay exactly as they are.

**Surfaces:** the customer-facing shop **and** admin (confirmed). The shop gets the rich treatment (Dream Avenue covers, blob, royal register); admin adopts the same tokens/type/components but stays utilitarian.

**Integration approach (chosen): A** — map the DS tokens into Tailwind v4 `@theme`, add a small `src/components/ui/` primitive layer, and restyle every surface in the app's existing utility idiom.

### Success criteria
- Every surface uses the DS palette/type/radii/shadows; no warm hex remains in `src/` (grep gate).
- Dream Avenue renders on catalog covers + wordmark; DM Sans is the UI/body font; DM Mono available.
- The soft register (white/ink/mist) is default; the bold register (royal/lime/snow) is used for catalog covers + primary CTAs.
- `npm run build` + `npx tsc --noEmit` clean; browser walk-through of all surfaces at mobile width passes (contrast + fonts).

### Out of scope (YAGNI)
- The DS **content voice** (English "studio letters", "drops") — copy is untouched.
- Dark mode — removed (DS is light-only).
- New product photography; the blob/flat-color treatment fills visual gaps instead.
- The DS adherence tooling (`_ds_bundle.js`, `_adherence.oxlintrc.json`) — not wired in.

---

## 2. Token foundation — `src/app/globals.css`

Replace the current file (which has Next defaults + a `@media (prefers-color-scheme: dark)` block + Arial body) with:

1. **Raw tokens** on `:root`, copied from `design_system/colors_and_type.css` (§"Brand palette", "Ink", "Border", "Shadow", "Radius", "Motion"): `--periwinkle #a0b5e7`, `--periwinkle-2 #c3d0ee`, `--mist #eef1fb`, `--lime #ddf344`, `--royal #4849eb`, `--royal-deep #2f30c4`, `--snow #f5f9ff`, `--ink #1a1b3a`, `--ink-2 #4a4c6e`, `--ink-3 #8487a4`, `--ink-on-royal #f5f9ff`, `--line rgba(26,27,58,.12)`, `--line-strong rgba(26,27,58,.24)`, the three shadows, the radii, the motion tokens.

2. **Tailwind `@theme`** registering those as utilities (Tailwind v4 maps `--color-x`→`bg-x/text-x/border-x`, `--radius-x`→`rounded-x`, `--shadow-x`→`shadow-x`, `--font-x`→`font-x`):
```css
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
  --shadow-1: 0 1px 2px rgba(26,27,58,.06), 0 2px 8px rgba(26,27,58,.04);
  --shadow-2: 0 2px 4px rgba(26,27,58,.06), 0 12px 28px rgba(26,27,58,.08);
  --shadow-bold: 0 8px 28px rgba(72,73,235,.22);
  --font-display: "Dream Avenue", "Cormorant Garamond", Georgia, serif;
  --font-sans: var(--font-dm-sans), -apple-system, "Helvetica Neue", Arial, sans-serif;
  --font-mono: var(--font-dm-mono), ui-monospace, Menlo, Consolas, monospace;
}
```

3. **Base layer:** `body { background: #fff; color: var(--ink); font-family: var(--font-sans); }`; `::selection { background: var(--lime); color: var(--ink); }`; default link color royal→royal-deep. The signature blob radius as a utility:
```css
@utility blob { border-radius: 62% 38% 55% 45% / 50% 60% 40% 50%; }
```
(`@font-face` for Dream Avenue lives here OR is provided by `next/font/local` — see §3; the project uses `next/font`, so prefer §3.)

No dark-mode block. No gradients anywhere.

---

## 3. Fonts & assets — `src/app/layout.tsx`, `public/`

- **DM Sans + DM Mono** via `next/font/google` (DM Sans weights 300–700; expose `--font-dm-sans`, `--font-dm-mono`).
- **Dream Avenue** via `next/font/local` from the `.otf` — copy `design_system/fonts/DreamAvenue-Regular.otf` to `src/app/fonts/DreamAvenue-Regular.otf`; load as `weight: "400"`, expose family name `"Dream Avenue"` (used by `--font-display`). Remove `Geist`/`Geist_Mono`.
- Root `<html>` className wires the three font variables; `lang="es"`.
- **Metadata:** `title: "CORVE"`, a real Spanish description (e.g. *"Activewear que se mueve contigo."*).
- **Assets:** copy `design_system/assets/logo-full.png` and `logo-isotipo.png` to `public/`. Favicon = isotipo (export/copy to `src/app/icon.png` or `public/favicon`). 

---

## 4. UI primitives — `src/components/ui/`

The app currently has no shared UI layer. Add focused primitives (each one file, props-driven, no business logic):

- **`Button.tsx`** — `variant`: `primary` (`bg-royal text-ink-on-royal shadow-bold hover:bg-royal-deep`), `accent` (`bg-lime text-ink hover:brightness-95`), `ghost` (`border border-line-strong text-ink hover:bg-ink/5`), `soft` (`bg-periwinkle-2 text-royal hover:bg-periwinkle`); `size`: sm/md/lg; always `rounded-pill`; `active:translate-y-px active:scale-[.98]`; `disabled:opacity-40`. Renders `<button>`; accepts `className` passthrough. (No `asChild`; for links wrap a `<Link>` or pass `as`.)
- **`Card.tsx`** — `bg-white rounded-lg shadow-1` (+ optional `hover:shadow-2 transition`); `className` passthrough; no border.
- **`Field.tsx`** — label (Eyebrow style) + input/select styled `border border-line rounded-sm bg-white focus:outline-none focus:ring-2 focus:ring-royal/40`. Thin wrapper; supports `as="select"`.
- **`Eyebrow.tsx`** — `text-[12px] uppercase tracking-[0.18em] text-ink-2 font-medium`.
- **`Blob.tsx`** — decorative `<div className="blob">` with a `fill` prop (periwinkle | lime | royal) and size; used in covers + empty states + login.
- **`Wordmark.tsx`** — lowercase `corve` in `font-display` (or the `logo-full.png`), linking to `/`.

These are presentational; no tests beyond type/build (visual verification covers them).

---

## 5. Registers → per-surface restyle (18 files)

**Soft register** (white + ink + mist) is the default everywhere except the two bold cases below.

**Bold register** (royal bg + lime accent + ink-on-royal):
- **Catalog line covers** (`(shop)/page.tsx`, currently warm `linear-gradient`): flat **royal** full-bleed panels, **Dream Avenue** (`font-display`) line title, an **Eyebrow** ("CORVE MOVE"), a decorative **Blob** (lime/periwinkle), white/snow text. No gradient.
- **Primary CTAs**: `Agregar` (product), checkout/continue, **"enviar pedido" (WhatsApp)** → `Button variant="primary"` (royal). *Decision: WhatsApp button is royal, not green — DS has no green.*

Per-file intent (swap warm hex → tokens/primitives, keep structure/copy):

| File | Treatment |
|---|---|
| `(shop)/layout.tsx` | white header, `Wordmark`, mist/line divider |
| `(shop)/CartPill.tsx` | royal pill, ink-on-royal count |
| `(shop)/page.tsx` | bold royal covers (Dream Avenue + Blob + Eyebrow); tiles → `Card` w/ image, `text-ink` name, `text-ink-2` price |
| `(shop)/producto/[id]/ProductDetailClient.tsx` | hero image kept; **name = strong DM Sans h1** (not display); color/size chips → `soft`/`ghost` pills; `Agregar` → `Button primary` |
| `(shop)/carrito/page.tsx` | `Card` rows, `Button` qty/remove, royal subtotal CTA |
| `(shop)/pedido/[id]/page.tsx` | confirmation `Card`, royal "enviar pedido" `Button` |
| `admin/layout.tsx` | mist sidebar/nav, ink links, `Wordmark` |
| `admin/login/page.tsx` | soft branded panel (`Card`, `Field`, `Button primary`, a `Blob`) |
| `admin/products/page.tsx` + `[id]/page.tsx` + `ProductForm.tsx` | `Card` lists, `Field` inputs, `Button` actions, color/image thumbnails on `rounded-md` |
| `admin/inventory`, `pedidos` (+`[id]`), `compras` (+`[id]`), `ventas`, `proveedores` | `Card` tables, `Field` inputs, `Button` actions, `Eyebrow` section headers; status chips use periwinkle/lime/line tones |

Status/semantic chips (e.g. order states `pendiente`/`pagado`, PO `parcial`/`recibida`): use brand tones — neutral `bg-mist text-ink-2`, active `bg-periwinkle-2 text-royal`, done `bg-lime text-ink`. Keep the Spanish labels.

---

## 6. Motion & interaction (DS rules)

- Transitions use `--ease-out`; buttons press `translateY(1px) scale(.98)` at `--dur-1` (120ms); cards lift shadow-1→shadow-2 (no scale); links deepen color. No bounces on controls, no parallax, no gradient. Blob may slow-morph (optional, ≤ one subtle keyframe) — not required for v1.

---

## 7. Testing / verification

- **Build:** `npx tsc --noEmit` + `npm run build` clean (fonts resolve, `ui/` types check).
- **Grep gate:** no warm hex (`#161311|#211d1a|#d8c1ad|#9a7a61|#6b5d50|#d8cdc0|#9a8b7d`) remains in `src/`.
- **Browser walk-through** (mobile width ~390px, the shop is mobile-first; admin at desktop width): catalog (royal covers + Dream Avenue render), product (image + chips + royal Agregar), cart, checkout, confirmation (royal WhatsApp button), admin login + each admin page. Confirm contrast (ink on white/mist; ink-on-royal on royal) and that Dream Avenue actually loaded (not the serif fallback).

---

## 8. Files touched

- **Foundation:** `src/app/globals.css`, `src/app/layout.tsx`, `public/` (2 logos + favicon), `src/app/fonts/DreamAvenue-Regular.otf`.
- **New:** `src/components/ui/{Button,Card,Field,Eyebrow,Blob,Wordmark}.tsx`.
- **Restyled (18):** the shop + admin files listed in §5.

Implementation branches from `color-images`. Order: foundation → primitives → shop surfaces → admin surfaces → verification, so the app builds at every step.
