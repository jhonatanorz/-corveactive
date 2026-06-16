"use server";
import { revalidatePath } from "next/cache";
import { createSupplier } from "@/lib/repos/suppliers";

export async function addSupplier(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  const contact = String(formData.get("contact") ?? "").trim();
  if (!name) return;
  await createSupplier(name, contact);
  revalidatePath("/admin/proveedores");
}
