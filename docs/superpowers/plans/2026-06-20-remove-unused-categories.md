# Remove Unused Categories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin delete a product category, but only when no live product depends on it.

**Architecture:** A pure domain module holds the two testable pieces (tally products per category; detect a Postgres FK violation). The repo layer adds count + delete queries on top of it. A server action wraps the delete with a friendly fallback when the database FK still refuses (archived products). A single client component renders the delete control — disabled with a count note when the category has live products — and is wired into both the category editor page and the categories list.

**Tech Stack:** Next.js 16 (App Router, React Server Components + server actions), Supabase JS client, Vitest, TypeScript, Tailwind.

## Global Constraints

- UI copy is in **Spanish**, matching existing admin strings.
- **No new dependencies.**
- **No database migration** — RLS policy `admin_all on product_categories for all to authenticated` and the `delete` grant already permit category deletion (see `supabase/migrations/0010_catalog_taxonomy.sql:30,34`).
- "Live product" = a `products` row with `deleted_at IS NULL`. Archived products (`deleted_at` set) are ignored by the guard but still trip the database FK.
- Tests use Vitest with `globals: false` — import `{ describe, it, expect }` from `vitest` explicitly. Test files are `src/**/*.test.ts`.
- Repos and UI components are **not** unit-tested in this codebase (no Supabase/component mock infra); their tasks are verified by typecheck + build, with the testable logic extracted into the pure domain module.

---

### Task 1: Pure domain helpers (`tallyByCategory`, `isForeignKeyViolation`)

**Files:**
- Create: `src/domain/category-usage.ts`
- Test: `src/domain/category-usage.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `tallyByCategory(rows: { category_id: string }[]): Record<string, number>`
  - `isForeignKeyViolation(e: unknown): boolean`

- [ ] **Step 1: Write the failing test**

Create `src/domain/category-usage.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { tallyByCategory, isForeignKeyViolation } from "@/domain/category-usage";

describe("tallyByCategory", () => {
  it("counts rows per category id", () => {
    const rows = [{ category_id: "a" }, { category_id: "b" }, { category_id: "a" }];
    expect(tallyByCategory(rows)).toEqual({ a: 2, b: 1 });
  });

  it("returns an empty map for no rows", () => {
    expect(tallyByCategory([])).toEqual({});
  });
});

describe("isForeignKeyViolation", () => {
  it("is true for a Postgres 23503 error object", () => {
    expect(isForeignKeyViolation({ code: "23503", message: "violates foreign key" })).toBe(true);
  });

  it("is false for other error codes", () => {
    expect(isForeignKeyViolation({ code: "23505" })).toBe(false);
  });

  it("is false for non-object / code-less values", () => {
    expect(isForeignKeyViolation(new Error("boom"))).toBe(false);
    expect(isForeignKeyViolation(null)).toBe(false);
    expect(isForeignKeyViolation("23503")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/domain/category-usage.test.ts`
Expected: FAIL — cannot resolve `@/domain/category-usage` (module not found).

- [ ] **Step 3: Write minimal implementation**

Create `src/domain/category-usage.ts`:

```ts
// src/domain/category-usage.ts

/** Tally product rows into a categoryId → count map. Each row must carry category_id. */
export function tallyByCategory(rows: { category_id: string }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    out[r.category_id] = (out[r.category_id] ?? 0) + 1;
  }
  return out;
}

/** True when an error is a Postgres foreign-key violation (SQLSTATE 23503): a row in
 *  another table still references the one we tried to delete. Supabase surfaces this as
 *  a plain object with a `code` field. */
export function isForeignKeyViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: unknown }).code === "23503";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/domain/category-usage.test.ts`
Expected: PASS — 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/domain/category-usage.ts src/domain/category-usage.test.ts
git commit -m "feat(categories): pure helpers to tally products and detect FK violations"
```

---

### Task 2: Repo layer — counts + delete

**Files:**
- Modify: `src/lib/repos/categories.ts`

**Interfaces:**
- Consumes: `tallyByCategory` from `@/domain/category-usage` (Task 1).
- Produces:
  - `countLiveProductsByCategory(): Promise<Record<string, number>>`
  - `countLiveProductsInCategory(id: string): Promise<number>`
  - `deleteCategory(id: string): Promise<void>` — throws on a Supabase error (incl. FK violation).

- [ ] **Step 1: Add the import**

At the top of `src/lib/repos/categories.ts`, after the existing imports, add:

```ts
import { tallyByCategory } from "@/domain/category-usage";
```

- [ ] **Step 2: Append the three functions**

Add to the end of `src/lib/repos/categories.ts`:

```ts
/** categoryId → number of live (non-archived) products, for the list page guard. */
export async function countLiveProductsByCategory(): Promise<Record<string, number>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products").select("category_id").is("deleted_at", null);
  if (error) throw error;
  return tallyByCategory((data ?? []) as { category_id: string }[]);
}

/** Number of live (non-archived) products in one category, for the editor guard. */
export async function countLiveProductsInCategory(id: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("category_id", id)
    .is("deleted_at", null);
  if (error) throw error;
  return count ?? 0;
}

/** Hard-delete a category. Throws (Postgres 23503) if any product still references it. */
export async function deleteCategory(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("product_categories").delete().eq("id", id);
  if (error) throw error;
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/repos/categories.ts
git commit -m "feat(categories): repo counts and delete for unused-category removal"
```

---

### Task 3: Delete server action

**Files:**
- Modify: `src/app/admin/categories/[id]/actions.ts`

**Interfaces:**
- Consumes: `deleteCategory` (repo, Task 2), `isForeignKeyViolation` (Task 1), `setFlash` (existing).
- Produces: `deleteCategory(id: string): Promise<void>` (server action) — note: same name as the repo function, imported under an alias to avoid collision.

- [ ] **Step 1: Update imports**

In `src/app/admin/categories/[id]/actions.ts`, change the repo import line:

```ts
import { createCategory, updateCategory } from "@/lib/repos/categories";
```

to:

```ts
import { createCategory, updateCategory, deleteCategory as deleteCategoryRow } from "@/lib/repos/categories";
```

and add, alongside the other imports:

```ts
import { isForeignKeyViolation } from "@/domain/category-usage";
```

Ensure `setFlash` is imported (the file already imports `setFlash, withFlash` from `@/lib/flash`).

- [ ] **Step 2: Append the action**

Add to the end of `src/app/admin/categories/[id]/actions.ts`:

```ts
export async function deleteCategory(id: string): Promise<void> {
  try {
    await deleteCategoryRow(id);
    await setFlash("Categoría eliminada");
  } catch (e) {
    if (isForeignKeyViolation(e)) {
      await setFlash(
        "No se puede eliminar: la categoría está asociada a productos archivados.",
        "error",
      );
    } else {
      throw e;
    }
  }
  // redirect() throws internally, so it must stay outside the try/catch above.
  revalidatePath("/admin/categories");
  redirect("/admin/categories");
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/categories/[id]/actions.ts
git commit -m "feat(categories): deleteCategory action with archived-products fallback"
```

---

### Task 4: DeleteCategoryButton component + wire into editor page

This task delivers a working end-to-end deletion from the category editor.

**Files:**
- Create: `src/app/admin/categories/DeleteCategoryButton.tsx`
- Modify: `src/app/admin/categories/[id]/page.tsx`

**Interfaces:**
- Consumes: `deleteCategory` action (Task 3), `countLiveProductsInCategory` (Task 2).
- Produces: `DeleteCategoryButton({ action, count, variant }: { action: () => void | Promise<void>; count: number; variant: "link" | "icon" })`.

- [ ] **Step 1: Create the component**

Create `src/app/admin/categories/DeleteCategoryButton.tsx`:

```tsx
"use client";

/** Delete control for a category. When the category still has live products it renders
 *  disabled (greyed) with a count note + tooltip; otherwise a confirm-guarded submit that
 *  posts the bound server action. `variant` picks the editor link vs. the compact list cell.
 *  stopPropagation keeps clicks from bubbling to a parent click-to-edit LinkRow. */
export function DeleteCategoryButton({
  action,
  count,
  variant,
}: {
  action: () => void | Promise<void>;
  count: number;
  variant: "link" | "icon";
}) {
  const note = `${count} ${count === 1 ? "producto" : "productos"}`;

  if (count > 0) {
    return (
      <span
        title={`No se puede eliminar: ${note} asociado${count === 1 ? "" : "s"}`}
        onClick={(e) => e.stopPropagation()}
        className="cursor-not-allowed text-xs text-ink-3"
      >
        {variant === "icon" ? note : `Eliminar categoría (${note})`}
      </span>
    );
  }

  return (
    <form
      action={action}
      onClick={(e) => e.stopPropagation()}
      onSubmit={(e) => {
        if (!confirm("¿Eliminar esta categoría? Esta acción no se puede deshacer.")) {
          e.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className={
          variant === "icon"
            ? "text-xs font-medium text-red-600 hover:underline"
            : "text-sm font-medium text-red-600 hover:underline"
        }
      >
        {variant === "icon" ? "Eliminar" : "Eliminar categoría"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Wire it into the editor page**

Replace the entire contents of `src/app/admin/categories/[id]/page.tsx` with:

```tsx
// src/app/admin/categories/[id]/page.tsx
import { notFound } from "next/navigation";
import { getCategory, countLiveProductsInCategory } from "@/lib/repos/categories";
import { saveCategory, deleteCategory } from "./actions";
import CategoryForm from "../CategoryForm";
import { DeleteCategoryButton } from "../DeleteCategoryButton";

export default async function CategoryEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = id === "new" ? null : await getCategory(id);
  if (id !== "new" && !existing) notFound();
  const liveCount = id === "new" ? 0 : await countLiveProductsInCategory(id);
  return (
    <div className="p-6">
      <CategoryForm category={existing} action={saveCategory.bind(null, id)} />
      {id !== "new" && (
        <div className="mt-6 max-w-md border-t border-line pt-4">
          <DeleteCategoryButton action={deleteCategory.bind(null, id)} count={liveCount} variant="link" />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 4: Manual verification**

Start the app (`npm run dev`), sign in to `/admin`, open a category with no live products via `/admin/categories` → its editor. Confirm:
- A category with 0 live products shows an enabled red "Eliminar categoría"; clicking it asks for confirmation, then deletes and returns to the list with a "Categoría eliminada" toast.
- A category with ≥1 live product shows greyed "Eliminar categoría (N productos)" with a tooltip and cannot be submitted.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/categories/DeleteCategoryButton.tsx src/app/admin/categories/[id]/page.tsx
git commit -m "feat(categories): delete control on the category editor page"
```

---

### Task 5: Wire delete into the categories list

**Files:**
- Modify: `src/app/admin/categories/page.tsx`

**Interfaces:**
- Consumes: `countLiveProductsByCategory` (Task 2), `deleteCategory` action (Task 3), `DeleteCategoryButton` (Task 4).
- Produces: nothing (terminal UI wiring).

- [ ] **Step 1: Wire the list page**

Replace the entire contents of `src/app/admin/categories/page.tsx` with:

```tsx
// src/app/admin/categories/page.tsx
import Link from "next/link";
import { listCategories, countLiveProductsByCategory } from "@/lib/repos/categories";
import { deleteCategory } from "./[id]/actions";
import { DeleteCategoryButton } from "./DeleteCategoryButton";
import { buttonClass, PageHeader, Table, THead, Th, Td, Tr, LinkRow, ChevronCell } from "@/components/ui";

export default async function CategoriesPage() {
  const [categories, counts] = await Promise.all([
    listCategories(),
    countLiveProductsByCategory(),
  ]);
  return (
    <div className="p-6">
      <PageHeader title="Categorías">
        <Link href="/admin/categories/new" className={buttonClass("primary", "sm")}>+ Nueva categoría</Link>
      </PageHeader>
      <Table>
        <THead>
          <Th>Nombre</Th>
          <Th>Slug</Th>
          <Th>Orden</Th>
          <Th className="w-28" />
          <Th className="w-8" />
        </THead>
        <tbody>
          {categories.map((c) => (
            <LinkRow key={c.id} href={`/admin/categories/${c.id}`}>
              <Td className="font-medium">{c.name}</Td>
              <Td className="text-ink-2">{c.slug}</Td>
              <Td className="text-ink-2">{c.sort_order}</Td>
              <Td className="text-right">
                <DeleteCategoryButton
                  action={deleteCategory.bind(null, c.id)}
                  count={counts[c.id] ?? 0}
                  variant="icon"
                />
              </Td>
              <ChevronCell />
            </LinkRow>
          ))}
          {categories.length === 0 && (
            <Tr><Td colSpan={5} className="py-8 text-center text-ink-3">Aún no hay categorías.</Td></Tr>
          )}
        </tbody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 3: Manual verification**

On `/admin/categories` confirm:
- Each row shows either an enabled "Eliminar" (0 live products) or a greyed "N productos" note (≥1).
- Clicking "Eliminar" on a row asks for confirmation and does NOT navigate into the editor (stopPropagation working); on confirm the category is deleted and the toast appears.
- Clicking the greyed note neither navigates nor deletes.
- Clicking anywhere else on the row still opens the editor.

- [ ] **Step 4: Full build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/categories/page.tsx
git commit -m "feat(categories): inline delete control on the categories list"
```

---

## Notes for the implementer

- The repo function and the server action are both named `deleteCategory`. To avoid a name collision inside the action file, the action imports the repo function under the alias `deleteCategoryRow`.
- The list page imports the action from `./[id]/actions` — this is intentional; the action lives with `saveCategory` in the `[id]` route folder, mirroring how product actions are co-located.
- `setFlash(message, "error")` renders an error-toned toast; the existing `Toaster` consumes the `admin_flash` cookie.
