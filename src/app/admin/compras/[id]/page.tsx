import { notFound } from "next/navigation";
import { getPO, listVariantOptions } from "@/lib/repos/purchasing";
import { listSuppliers } from "@/lib/repos/suppliers";
import { formatMXN } from "@/domain/money";
import { chooseSupplier, addLine, receive } from "./actions";

export default async function POEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getPO(id);
  if (!data) notFound();
  const { po, items } = data;
  const suppliers = await listSuppliers();
  const variantOptions = await listVariantOptions();
  const editable = po.status === "borrador" || po.status === "pedida";

  return (
    <div className="p-6 max-w-2xl text-sm">
      <h1 className="text-lg font-bold">OC-{id.slice(0, 8)} <span className="text-xs font-normal">· {po.status}</span></h1>

      <form action={chooseSupplier.bind(null, id)} className="flex gap-2 mt-3">
        <select name="supplier_id" defaultValue={po.supplier_id ?? ""} className="rounded border border-[#d8cdc0] p-2">
          <option value="">— Proveedor —</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button className="rounded bg-[#211d1a] text-white px-3">Guardar proveedor</button>
      </form>

      <table className="w-full mt-4">
        <thead className="text-left text-[#9a8b7d] text-xs"><tr><th>Variante</th><th>Costo u.</th><th>Pedidas</th><th>Recibidas</th></tr></thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id} className="border-t border-[#f3efe9]">
              <td className="py-1">{it.variants.products.name} · {it.variants.color} · {it.variants.size}</td>
              <td>{formatMXN(it.unit_cost)}</td>
              <td>{it.qty_ordered}</td>
              <td>{it.qty_received}</td>
            </tr>
          ))}
          {items.length === 0 && <tr><td colSpan={4} className="py-3 text-[#9a8b7d]">Sin líneas.</td></tr>}
        </tbody>
      </table>
      <div className="flex justify-between font-semibold mt-2"><span>Total</span><span>{formatMXN(po.total_cost)}</span></div>

      {editable && (
        <form action={addLine.bind(null, id)} className="flex gap-2 mt-4 flex-wrap items-end">
          <select name="variant_id" className="rounded border border-[#d8cdc0] p-2">
            <option value="">— Variante —</option>
            {variantOptions.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>
          <input name="qty" type="number" min="1" placeholder="Cant." className="w-20 rounded border border-[#d8cdc0] p-2" />
          <input name="unit_cost" placeholder="Costo u. (MXN)" className="w-28 rounded border border-[#d8cdc0] p-2" />
          <button className="rounded bg-[#211d1a] text-white px-3 py-2">+ Línea</button>
        </form>
      )}

      {items.length > 0 && po.status !== "recibida" && (
        <form action={receive.bind(null, id)} className="mt-6 border-t border-[#eadfd3] pt-4">
          <h2 className="font-semibold mb-2">Recibir</h2>
          {items.map((it) => (
            <div key={it.id} className="flex items-center gap-2 mb-1">
              <span className="flex-1">{it.variants.products.name} · {it.variants.color} · {it.variants.size} (faltan {it.qty_ordered - it.qty_received})</span>
              <input name={`received_${it.variant_id}`} type="number" min="0" max={it.qty_ordered - it.qty_received} defaultValue="0"
                className="w-20 rounded border border-[#d8cdc0] p-1" />
            </div>
          ))}
          <button className="rounded bg-[#2f6b3a] text-white px-4 py-2 mt-2">Recibir → sumar al stock</button>
        </form>
      )}
    </div>
  );
}
