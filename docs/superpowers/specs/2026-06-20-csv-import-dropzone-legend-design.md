# CSV import: drop-zone file picker + corrected legend — Design

**Date:** 2026-06-20
**Status:** Approved (ready for implementation plan)

## Goal

On the product CSV import page (`/admin/products/import`):

1. Restyle the "choose file" control to look (and behave) like the
   drag-and-drop image uploader.
2. Correct the legend/help text so it accurately describes the existing
   import parser logic.

No changes to the CSV parser or import flow logic — visual + copy only.

## Current state

- `src/app/admin/products/import/ImportClient.tsx` uses a bare
  `<input type="file" accept=".csv,text/csv">` next to a "Previsualizar"
  button. It holds local `file` state and runs a two-step flow
  (preview → confirm) via `useTransition`, building `FormData` manually
  (it does **not** use a `<form action>`).
- `src/components/ui/ImageUploader.tsx` is a dashed drop-zone `<label>` with
  drag handlers, a hidden input, an upload icon, filename text, and a hint.
  It is image-specific (image preview, color `<select>`, immediate
  `form action` submit), so it cannot be reused directly here.
- `src/app/admin/products/import/page.tsx` shows a legend paragraph that is
  factually out of date: it says rows group by `name` alone and lists
  `description` as if required.

## Parser facts the legend must reflect

From `src/lib/admin/product-csv.ts`:

- Required columns: `name, line, category, price, color, size`
  (`REQUIRED`, line 114). `description` is optional.
- Product identity is **(name, line, category)** — rows roll up into one
  product only when all three match (lines 224–227). A repeated `name`
  under a different line/category is a separate product.
- Each row is a variant `(color, size)`; a duplicate color/size within a
  product is rejected (line 262), and a product that already exists
  (same name+line+category) is rejected (line 215).
- `price` and `description` are product-level and must be consistent across
  all rows of the same product (line 233).

## Part 1 — File picker (Approach A: inline drop zone)

Edit `ImportClient.tsx` only. Replace the bare `<input>` with a dashed
drop-zone `<label>` that mirrors `ImageUploader`'s visual language, reusing
the same Tailwind classes:
`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl
border-2 border-dashed p-6 text-center transition`, with the same
dragging/hover variants
(`dragging ? "border-royal bg-periwinkle-2/40" : "border-line bg-mist/30
hover:border-royal/60 hover:bg-mist/50"`).

- **Empty state:** the upload icon SVG (copied from `ImageUploader`) +
  bold text "Arrastra tu CSV o haz clic para elegir" + hint "Archivo .csv".
- **File chosen:** show `file.name` in place of the prompt text (no image
  preview — not applicable to CSV).
- Hidden `<input type="file" accept=".csv,text/csv" className="hidden">`
  inside the label; `onChange` sets the file and clears prior state
  (`setState(undefined)`), preserving current behavior.
- Drag handlers on the label: `onDragOver` (preventDefault + set
  `dragging`), `onDragLeave` (clear `dragging`), `onDrop` (preventDefault,
  clear `dragging`, `setFile(e.dataTransfer.files?.[0] ?? null)` and clear
  state). A new `dragging` boolean state is added.
- **Unchanged:** local `file` state, the `run()` preview/confirm logic,
  the "Previsualizar" and "Confirmar importación" buttons, and the error /
  result rendering. The "Previsualizar" button moves to **below** the drop
  zone (it was inline beside the old input).

`ImageUploader.tsx` is not modified. No shared component is extracted
(single use today — YAGNI).

## Part 2 — Legend copy

Rewrite the legend paragraph in `import/page.tsx` to:

> Sube un archivo CSV. Columnas requeridas:
> `name, line, category, price, color, size`. Opcional: `description`.
> Cada fila es una variante (color + talla). Las filas se agrupan en un
> mismo producto cuando coinciden **name + line + category**; un mismo
> `name` en otra línea o categoría es un producto distinto.
> `price` y `description` deben ser iguales en todas las filas de un mismo
> producto. Se rechazan variantes (color/talla) duplicadas y productos que
> ya existen.

Keep the existing `<code>` styling for column names where natural.

## Testing

No logic changes, so no new unit tests; `src/lib/admin/product-csv.test.ts`
continues to cover the parser. Verify in the browser preview:

- Click-to-choose a `.csv` populates the drop zone (filename shows) and
  "Previsualizar" enables.
- Dragging a `.csv` onto the zone toggles the drag style and selects the
  file on drop.
- Preview → Confirm still works end-to-end.
- The legend renders the corrected text.

## Files touched

- `src/app/admin/products/import/ImportClient.tsx` — modify (drop zone).
- `src/app/admin/products/import/page.tsx` — modify (legend).

## Out of scope

- No CSV parser or validation logic changes.
- No shared `FileDropzone` component; `ImageUploader` untouched.
- No image preview for the CSV picker.
