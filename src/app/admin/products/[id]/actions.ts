"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { validateProductInput } from "@/lib/admin/product-input";
import { createProduct, updateProduct, saveVariants, addProductImage, deleteProductImage } from "@/lib/repos/products";
import { correctStock } from "@/lib/repos/inventory";

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

export async function uploadImage(productId: string, formData: FormData): Promise<void> {
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return;
  const color = String(formData.get("color") ?? "").trim() || null;
  await addProductImage(productId, file, color);
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/");
  revalidatePath(`/producto/${productId}`);
}

export async function deleteImage(productId: string, formData: FormData): Promise<void> {
  const imageId = String(formData.get("imageId") ?? "");
  if (!imageId) return;
  await deleteProductImage(imageId);
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/");
  revalidatePath(`/producto/${productId}`);
}
