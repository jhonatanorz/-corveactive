export interface StoreSettings {
  whatsapp: string;
  instagram_url: string;
  tiktok_url: string;
}

export type SettingsValidation =
  | { ok: true; values: StoreSettings }
  | { ok: false; errors: Record<string, string> };

/**
 * Validate + normalize the contact settings form.
 * - whatsapp: stripped to digits; if non-empty must be >=10 digits.
 * - instagram_url / tiktok_url: trimmed; if non-empty must start with http(s)://.
 * Empty values are allowed and mean "hide that channel".
 */
export function validateStoreSettings(input: StoreSettings): SettingsValidation {
  const errors: Record<string, string> = {};

  const whatsapp = input.whatsapp.replace(/\D/g, "");
  if (whatsapp !== "" && whatsapp.length < 10) {
    errors.whatsapp = "WhatsApp inválido (incluye lada)";
  }

  const instagram_url = input.instagram_url.trim();
  if (instagram_url !== "" && !/^https?:\/\//.test(instagram_url)) {
    errors.instagram_url = "Debe iniciar con http:// o https://";
  }

  const tiktok_url = input.tiktok_url.trim();
  if (tiktok_url !== "" && !/^https?:\/\//.test(tiktok_url)) {
    errors.tiktok_url = "Debe iniciar con http:// o https://";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, values: { whatsapp, instagram_url, tiktok_url } };
}
