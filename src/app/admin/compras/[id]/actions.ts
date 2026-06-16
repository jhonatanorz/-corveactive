"use server";
import { revalidatePath } from "next/cache";
import { setPOSupplier, addPOLine, receivePO } from "@/lib/repos/purchasing";
import { parsePesosInput } from "@/domain/money";

export async function chooseSupplier(poId: string, formData: FormData): Promise<void> {
  await setPOSupplier(poId, String(formData.get("supplier_id") ?? ""));
  revalidatePath(`/admin/compras/${poId}`);
}

export async function addLine(poId: string, formData: FormData): Promise<void> {
  const variantId = String(formData.get("variant_id") ?? "");
  const qty = Number(formData.get("qty") ?? 0);
  const unitCost = parsePesosInput(String(formData.get("unit_cost") ?? ""));
  if (!variantId || !Number.isInteger(qty) || qty <= 0 || unitCost === null) return;
  await addPOLine(poId, variantId, qty, unitCost);
  revalidatePath(`/admin/compras/${poId}`);
}

export async function receive(poId: string, formData: FormData): Promise<void> {
  const receipts: { variant_id: string; qty: number }[] = [];
  for (const [k, v] of formData.entries()) {
    if (k.startsWith("received_")) {
      const qty = Number(v);
      if (Number.isInteger(qty) && qty > 0) receipts.push({ variant_id: k.slice("received_".length), qty });
    }
  }
  if (receipts.length > 0) await receivePO(poId, receipts);
  revalidatePath(`/admin/compras/${poId}`);
  revalidatePath("/admin/inventory");
}
