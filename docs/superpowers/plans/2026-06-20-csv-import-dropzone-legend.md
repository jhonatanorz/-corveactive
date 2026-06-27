# CSV Import Drop-Zone + Legend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the product CSV import "choose file" control as a drag-and-drop drop zone (matching the image uploader) and correct the import legend to reflect the real parser logic.

**Architecture:** Two isolated edits — `import/page.tsx` (legend copy) and `ImportClient.tsx` (inline dashed drop-zone `<label>` reusing the image uploader's Tailwind classes + drag handlers, keeping the existing two-step preview/confirm flow). No parser, server-action, or shared-component changes.

**Tech Stack:** Next.js (App Router, client components), React `useState`/`useTransition`, Tailwind.

## Global Constraints

- No CSV parser / validation / server-action logic changes — visual + copy only.
- `ImageUploader.tsx` is NOT modified; no shared `FileDropzone` component is extracted.
- The CSV picker has NO image preview.
- Reuse the image uploader's exact drop-zone Tailwind classes (dashed border, rounded-xl, hover + dragging states) for visual consistency.
- Preserve the existing two-step flow: local `file` state, manual `FormData`, `previewImport` then `commitImport`, "Previsualizar" / "Confirmar importación" buttons, and the error/result rendering.
- File input must keep `accept=".csv,text/csv"`.
- Choosing or dropping a new file must clear prior result/error state (`setState(undefined)`), as the current `onChange` does.
- Spanish UI copy.
- Verification per task: `npm run lint` clean and `npm run test` (full suite, 143 tests) green. No new unit tests (no pure-logic units added).

---

## File Structure

- `src/app/admin/products/import/page.tsx` — **modify**. Legend paragraph only.
- `src/app/admin/products/import/ImportClient.tsx` — **modify**. Replace bare file input with drop-zone label + drag state; move "Previsualizar" below the zone.

---

### Task 1: Correct the import legend copy

**Files:**
- Modify: `src/app/admin/products/import/page.tsx:13-16` (the legend `<p>`)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing consumed by later tasks (pure copy change).

> Copy-only change; verified by lint + full suite (no unit test).

- [ ] **Step 1: Replace the legend paragraph**

In `src/app/admin/products/import/page.tsx`, replace the single legend `<p>` (lines 13–16) with these two paragraphs:

```tsx
      <p className="text-sm text-ink-2">
        Sube un archivo CSV. Columnas requeridas:{" "}
        <code>name, line, category, price, color, size</code>. Opcional: <code>description</code>.
      </p>
      <p className="text-sm text-ink-2">
        Cada fila es una variante (color + talla). Las filas se agrupan en un mismo producto
        cuando coinciden <strong>name + line + category</strong>; un mismo <code>name</code> en
        otra línea o categoría es un producto distinto. <code>price</code> y{" "}
        <code>description</code> deben ser iguales en todas las filas de un mismo producto.
        Se rechazan variantes (color/talla) duplicadas y productos que ya existen.
      </p>
```

(The surrounding `<div className="p-6 space-y-4">`, `PageHeader`, and `<ImportClient />` stay unchanged; the `space-y-4` spacing handles the two paragraphs.)

- [ ] **Step 2: Verify lint and tests**

Run: `npm run lint`
Expected: no errors in `page.tsx`.

Run: `npm run test`
Expected: PASS (143 tests; no regressions).

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/products/import/page.tsx
git commit -m "docs(import): legend reflects name+line+category grouping and required columns"
```

---

### Task 2: Drag-and-drop drop zone for the CSV picker

**Files:**
- Modify: `src/app/admin/products/import/ImportClient.tsx` (full file rewrite)

**Interfaces:**
- Consumes: `previewImport`, `commitImport`, `PreviewState` from `./actions` (unchanged); `Button` from `@/components/ui`.
- Produces: nothing consumed by later tasks.

> UI change with no pure-logic unit to test; verified by lint, full suite, and browser preview.

- [ ] **Step 1: Rewrite ImportClient with a drop-zone label**

Replace the entire contents of `src/app/admin/products/import/ImportClient.tsx` with:

```tsx
"use client";

import { useState, useTransition, type DragEvent } from "react";
import { Button } from "@/components/ui";
import { previewImport, commitImport, type PreviewState } from "./actions";

export default function ImportClient() {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [state, setState] = useState<PreviewState>(undefined);
  const [pending, startTransition] = useTransition();

  // Choosing/dropping a new file clears any prior preview/confirm result.
  function chooseFile(f: File | null) {
    setFile(f);
    setState(undefined);
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragging(false);
    chooseFile(e.dataTransfer.files?.[0] ?? null);
  }

  function run(action: typeof previewImport) {
    if (!file) {
      setState({ fileError: "Selecciona un archivo CSV." });
      return;
    }
    const fd = new FormData();
    fd.set("file", file);
    startTransition(async () => {
      const next = await action(undefined, fd);
      if (next) setState(next); // commit success redirects and never returns
    });
  }

  const fileError = state && "fileError" in state ? state.fileError : null;
  const result = state && "ok" in state ? state : null;

  return (
    <div className="space-y-4 text-sm">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition ${
          dragging
            ? "border-royal bg-periwinkle-2/40"
            : "border-line bg-mist/30 hover:border-royal/60 hover:bg-mist/50"
        }`}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-royal">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <span className="text-sm font-medium text-ink">
          {file ? file.name : "Arrastra tu CSV o haz clic para elegir"}
        </span>
        <span className="text-xs text-ink-3">Archivo .csv</span>
        <input
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => chooseFile(e.target.files?.[0] ?? null)}
        />
      </label>

      <Button type="button" variant="ghost" size="md" disabled={pending || !file}
        onClick={() => run(previewImport)}>
        {pending ? "Validando…" : "Previsualizar"}
      </Button>

      {fileError && <p className="text-red-600">{fileError}</p>}

      {result && (
        <div className="space-y-3">
          <p className="text-ink">
            {result.counts.products} producto(s) y {result.counts.variants} variante(s) se crearán.
          </p>

          {!result.ok && (
            <div className="rounded border border-red-200 bg-red-50 p-3">
              <p className="font-medium text-red-700">
                {result.errors.length} error(es) &mdash; corrige el archivo y vuelve a subirlo:
              </p>
              <ul className="mt-2 space-y-1">
                {result.errors.map((e, i) => (
                  <li key={i} className="text-red-700">
                    Fila {e.row}
                    {e.field ? ` · ${e.field}` : ""}: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.ok && (
            <Button type="button" variant="primary" size="md" disabled={pending}
              onClick={() => run(commitImport)}>
              {pending ? "Importando…" : "Confirmar importación"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify lint and tests**

Run: `npm run lint`
Expected: no errors in `ImportClient.tsx`.

Run: `npm run test`
Expected: PASS (143 tests; no regressions).

- [ ] **Step 3: Verify in the browser**

Start the dev server and open `/admin/products/import` (Docker/Supabase up; admin login). Confirm:
- The drop zone renders with the dashed border, upload icon, "Arrastra tu CSV o haz clic para elegir", and the "Archivo .csv" hint.
- Clicking the zone opens the file dialog; choosing a `.csv` shows its filename and enables "Previsualizar".
- Dragging a file over the zone switches it to the highlighted (`border-royal`) style; dropping a `.csv` selects it.
- "Previsualizar" then "Confirmar importación" still complete the import flow; row errors still render.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/products/import/ImportClient.tsx
git commit -m "feat(import): drag-and-drop drop zone for the CSV file picker"
```

---

## Self-Review

**Spec coverage:**
- Drop-zone restyle (Approach A, reuse uploader classes, drag support, filename, no preview) → Task 2. ✓
- Legend corrected (required vs optional columns; name+line+category grouping; price/description consistency; duplicate/existing rejection) → Task 1. ✓
- `ImageUploader` untouched, no shared component, two-step flow preserved, `accept` kept, state cleared on new file → enforced in Task 2 code + Global Constraints. ✓

**Placeholder scan:** No TBD/TODO/vague steps; both code edits shown in full. ✓

**Type consistency:** `run(action: typeof previewImport)`, `PreviewState`, `chooseFile`, and the `fileError`/`result` narrowing are unchanged from the working original except the added `dragging` state and `chooseFile` helper; `onDrop` is typed `DragEvent<HTMLLabelElement>` matching the `<label>` it's attached to. ✓
