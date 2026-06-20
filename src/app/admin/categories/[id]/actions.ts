// src/app/admin/categories/[id]/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { validateCategoryInput } from "@/lib/admin/category-input";
import { createCategory, updateCategory, deleteCategory as deleteCategoryRow } from "@/lib/repos/categories";
import { setFlash, withFlash } from "@/lib/flash";
import { isForeignKeyViolation } from "@/domain/category-usage";

export async function saveCategory(
  id: string,
  _prev: unknown,
  formData: FormData,
): Promise<{ errors: Record<string, string> } | void> {
  const raw = Object.fromEntries(
    ["name", "slug", "sort_order"].map((k) => [k, String(formData.get(k) ?? "")]),
  );
  const result = validateCategoryInput(raw);
  if (!result.ok) return { errors: result.errors };

  if (id === "new") {
    await createCategory(result.value);
    await setFlash("Categoría creada");
    redirect("/admin/categories");
  } else {
    await withFlash("Categoría guardada", () => updateCategory(id, result.value));
    revalidatePath("/admin/categories");
    redirect("/admin/categories");
  }
}

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
