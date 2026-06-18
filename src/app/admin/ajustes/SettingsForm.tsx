"use client";
import { useActionState } from "react";
import { Button, inputClass } from "@/components/ui";
import { saveSettings, type SaveState } from "./actions";
import type { StoreSettings } from "@/domain/settings";

const INITIAL: SaveState = { ok: true, errors: {}, saved: false };

export default function SettingsForm({ initial }: { initial: StoreSettings }) {
  const [state, formAction, pending] = useActionState(saveSettings, INITIAL);
  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label className="block mb-1 text-ink-2">WhatsApp (solo número, con lada)</label>
        <input name="whatsapp" defaultValue={initial.whatsapp} placeholder="5215512345678" className={inputClass} />
        {state.errors.whatsapp && <p className="text-red-600 text-xs mt-1">{state.errors.whatsapp}</p>}
      </div>
      <div>
        <label className="block mb-1 text-ink-2">Instagram (URL)</label>
        <input name="instagram_url" defaultValue={initial.instagram_url} placeholder="https://instagram.com/..." className={inputClass} />
        {state.errors.instagram_url && <p className="text-red-600 text-xs mt-1">{state.errors.instagram_url}</p>}
      </div>
      <div>
        <label className="block mb-1 text-ink-2">TikTok (URL)</label>
        <input name="tiktok_url" defaultValue={initial.tiktok_url} placeholder="https://tiktok.com/@..." className={inputClass} />
        {state.errors.tiktok_url && <p className="text-red-600 text-xs mt-1">{state.errors.tiktok_url}</p>}
      </div>
      <Button type="submit" variant="primary" disabled={pending}>{pending ? "Guardando…" : "Guardar"}</Button>
      {state.saved && <p className="text-green-700 text-xs">Guardado.</p>}
    </form>
  );
}
