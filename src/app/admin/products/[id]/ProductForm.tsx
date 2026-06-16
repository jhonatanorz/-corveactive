"use client";

import { useActionState } from "react";
import type { ProductRow } from "@/lib/db-types";

type Props = {
  product: Pick<ProductRow, "name" | "line" | "type" | "description" | "price" | "cost" | "status"> | null;
  action: (prev: unknown, formData: FormData) => Promise<{ errors: Record<string, string> } | void>;
};

const peso = (centavos: number) => (centavos / 100).toString();

export default function ProductForm({ product, action }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const e = state?.errors ?? {};
  return (
    <form action={formAction} className="max-w-md space-y-3 p-6 text-sm">
      <h1 className="text-lg font-bold">{product ? "Editar producto" : "Nuevo producto"}</h1>

      <label className="block">Nombre
        <input name="name" defaultValue={product?.name ?? ""} className="w-full rounded border border-[#d8cdc0] p-2" />
        {e.name && <span className="text-red-600 text-xs">{e.name}</span>}
      </label>

      <label className="block">Línea
        <select name="line" defaultValue={product?.line ?? "MOVE"} className="w-full rounded border border-[#d8cdc0] p-2">
          <option value="MOVE">CORVE MOVE</option>
          <option value="HIM">CORVE HIM</option>
        </select>
        {e.line && <span className="text-red-600 text-xs">{e.line}</span>}
      </label>

      <label className="block">Tipo
        <input name="type" defaultValue={product?.type ?? ""} className="w-full rounded border border-[#d8cdc0] p-2" />
        {e.type && <span className="text-red-600 text-xs">{e.type}</span>}
      </label>

      <label className="block">Descripción
        <textarea name="description" defaultValue={product?.description ?? ""} className="w-full rounded border border-[#d8cdc0] p-2" />
      </label>

      <div className="flex gap-3">
        <label className="block flex-1">Precio (MXN)
          <input name="price" defaultValue={product ? peso(product.price) : ""} className="w-full rounded border border-[#d8cdc0] p-2" />
          {e.price && <span className="text-red-600 text-xs">{e.price}</span>}
        </label>
        <label className="block flex-1">Costo (MXN)
          <input name="cost" defaultValue={product ? peso(product.cost) : ""} className="w-full rounded border border-[#d8cdc0] p-2" />
          {e.cost && <span className="text-red-600 text-xs">{e.cost}</span>}
        </label>
      </div>

      <label className="block">Estado
        <select name="status" defaultValue={product?.status ?? "draft"} className="w-full rounded border border-[#d8cdc0] p-2">
          <option value="draft">Borrador</option>
          <option value="active">Activa</option>
          <option value="hidden">Oculta</option>
        </select>
        {e.status && <span className="text-red-600 text-xs">{e.status}</span>}
      </label>

      <button type="submit" disabled={pending} className="rounded bg-[#211d1a] text-white px-4 py-2 disabled:opacity-60">
        {pending ? "Guardando…" : "Guardar"}
      </button>
    </form>
  );
}
