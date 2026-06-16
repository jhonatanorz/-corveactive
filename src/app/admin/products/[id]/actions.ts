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
