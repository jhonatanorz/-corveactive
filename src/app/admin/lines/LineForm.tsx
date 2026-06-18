// src/app/admin/lines/LineForm.tsx
"use client";

import { useActionState } from "react";
import type { ProductLineRow } from "@/lib/db-types";
import { Button, inputClass } from "@/components/ui";

type Props = {
  line: Pick<ProductLineRow, "name" | "slug" | "hero_title" | "hero_message" | "sort_order" | "active"> | null;
  action: (prev: unknown, formData: FormData) => Promise<{ errors: Record<string, string> } | void>;
};

export default function LineForm({ line, action }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const e = state?.errors ?? {};
  return (
    <form action={formAction} className="max-w-md space-y-4 text-sm">
      <h1 className="text-lg font-bold text-ink">{line ? "Editar línea" : "Nueva línea"}</h1>

      <label className="block text-ink-2">Nombre
        <input name="name" defaultValue={line?.name ?? ""} className={inputClass} placeholder="CORVE FLOW" />
        {e.name && <span className="text-xs text-red-600">{e.name}</span>}
      </label>

      <label className="block text-ink-2">Slug (opcional, se genera del nombre)
        <input name="slug" defaultValue={line?.slug ?? ""} className={inputClass} placeholder="flow" />
        {e.slug && <span className="text-xs text-red-600">{e.slug}</span>}
      </label>

      <label className="block text-ink-2">Título del hero
        <input name="hero_title" defaultValue={line?.hero_title ?? ""} className={inputClass} />
      </label>

      <label className="block text-ink-2">Mensaje del hero
        <input name="hero_message" defaultValue={line?.hero_message ?? ""} className={inputClass} />
      </label>

      <label className="block text-ink-2">Orden
        <input name="sort_order" type="number" defaultValue={line?.sort_order ?? 0} className={inputClass} />
        {e.sort_order && <span className="text-xs text-red-600">{e.sort_order}</span>}
      </label>

      <label className="flex items-center gap-2 text-ink-2">
        <input name="active" type="checkbox" defaultChecked={line?.active ?? true} />
        Activa (visible en la tienda)
      </label>

      <Button type="submit" disabled={pending} variant="primary" size="md">
        {pending ? "Guardando…" : "Guardar"}
      </Button>
    </form>
  );
}
