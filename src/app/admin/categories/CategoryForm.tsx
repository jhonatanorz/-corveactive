// src/app/admin/categories/CategoryForm.tsx
"use client";

import { useActionState } from "react";
import type { ProductCategoryRow } from "@/lib/db-types";
import { Button, inputClass } from "@/components/ui";

type Props = {
  category: Pick<ProductCategoryRow, "name" | "slug" | "sort_order"> | null;
  action: (prev: unknown, formData: FormData) => Promise<{ errors: Record<string, string> } | void>;
};

export default function CategoryForm({ category, action }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const e = state?.errors ?? {};
  return (
    <form action={formAction} className="max-w-md space-y-4 text-sm">
      <h1 className="text-lg font-bold text-ink">{category ? "Editar categoría" : "Nueva categoría"}</h1>

      <label className="block text-ink-2">Nombre
        <input name="name" defaultValue={category?.name ?? ""} className={inputClass} />
        {e.name && <span className="text-xs text-red-600">{e.name}</span>}
      </label>

      <label className="block text-ink-2">Slug (opcional, se genera del nombre)
        <input name="slug" defaultValue={category?.slug ?? ""} className={inputClass} placeholder="leggings" />
        {e.slug && <span className="text-xs text-red-600">{e.slug}</span>}
      </label>

      <label className="block text-ink-2">Orden
        <input name="sort_order" type="number" defaultValue={category?.sort_order ?? 0} className={inputClass} />
        {e.sort_order && <span className="text-xs text-red-600">{e.sort_order}</span>}
      </label>

      <Button type="submit" disabled={pending} variant="primary" size="md">
        {pending ? "Guardando…" : "Guardar"}
      </Button>
    </form>
  );
}
