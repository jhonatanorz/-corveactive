import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { StoreSettings } from "@/domain/settings";

const DEFAULTS: StoreSettings = { whatsapp: "", instagram_url: "", tiktok_url: "" };

/** Read all settings rows into a typed object, filling missing keys with "". */
export async function getStoreSettings(): Promise<StoreSettings> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("store_settings").select("key, value");
  if (error) throw error;
  const map = new Map((data ?? []).map((r) => [r.key as string, r.value as string]));
  return {
    whatsapp: map.get("whatsapp") ?? DEFAULTS.whatsapp,
    instagram_url: map.get("instagram_url") ?? DEFAULTS.instagram_url,
    tiktok_url: map.get("tiktok_url") ?? DEFAULTS.tiktok_url,
  };
}

/** Upsert the three known settings keys. */
export async function updateStoreSettings(values: StoreSettings): Promise<void> {
  const supabase = await createClient();
  const updated_at = new Date().toISOString();
  const rows = [
    { key: "whatsapp", value: values.whatsapp, updated_at },
    { key: "instagram_url", value: values.instagram_url, updated_at },
    { key: "tiktok_url", value: values.tiktok_url, updated_at },
  ];
  const { error } = await supabase.from("store_settings").upsert(rows, { onConflict: "key" });
  if (error) throw error;
}
