"use server";
import { revalidatePath } from "next/cache";
import { validateStoreSettings } from "@/domain/settings";
import { updateStoreSettings } from "@/lib/repos/settings";

export type SaveState = { ok: boolean; errors: Record<string, string>; saved: boolean };

export async function saveSettings(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const v = validateStoreSettings({
    whatsapp: String(formData.get("whatsapp") ?? ""),
    instagram_url: String(formData.get("instagram_url") ?? ""),
    tiktok_url: String(formData.get("tiktok_url") ?? ""),
  });
  if (!v.ok) return { ok: false, errors: v.errors, saved: false };
  await updateStoreSettings(v.values);
  revalidatePath("/", "layout"); // shop footer + pedido pages
  revalidatePath("/admin/ajustes");
  return { ok: true, errors: {}, saved: true };
}
