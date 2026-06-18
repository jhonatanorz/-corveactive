// src/app/admin/categories/[id]/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { validateCategoryInput } from "@/lib/admin/category-input";
import { createCategory, updateCategory } from "@/lib/repos/categories";
import { setFlash, withFlash } from "@/lib/flash";

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
