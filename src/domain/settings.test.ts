import { describe, it, expect } from "vitest";
import { validateStoreSettings } from "@/domain/settings";

describe("validateStoreSettings", () => {
  const ok = {
    whatsapp: "52 (55) 1234-5678",
    instagram_url: "https://instagram.com/corveactive/",
    tiktok_url: "https://www.tiktok.com/@corveactive",
  };

  it("accepts and normalizes valid settings (whatsapp → digits, urls trimmed)", () => {
    const r = validateStoreSettings({ ...ok, tiktok_url: "  https://www.tiktok.com/@corveactive  " });
    expect(r).toEqual({
      ok: true,
      values: {
        whatsapp: "525512345678",
        instagram_url: "https://instagram.com/corveactive/",
        tiktok_url: "https://www.tiktok.com/@corveactive",
      },
    });
  });

  it("allows all fields empty (everything hidden)", () => {
    const r = validateStoreSettings({ whatsapp: "", instagram_url: "", tiktok_url: "  " });
    expect(r).toEqual({ ok: true, values: { whatsapp: "", instagram_url: "", tiktok_url: "" } });
  });

  it("rejects a whatsapp with fewer than 10 digits when non-empty", () => {
    const r = validateStoreSettings({ ...ok, whatsapp: "55-1234" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.whatsapp).toBeDefined();
  });

  it("rejects a url without http(s) scheme when non-empty", () => {
    const r = validateStoreSettings({ ...ok, instagram_url: "instagram.com/corve" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.instagram_url).toBeDefined();
  });
});
