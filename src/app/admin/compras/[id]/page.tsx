import { notFound } from "next/navigation";
import { getPO, listVariantOptions } from "@/lib/repos/purchasing";
import { listSuppliers } from "@/lib/repos/suppliers";
import { formatMXN } from "@/domain/money";
import { chooseSupplier, addLine, receive } from "./actions";
import { Button, Eyebrow } from "@/components/ui";

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
      <h1 className="text-lg font-bold text-ink">OC-{id.slice(0, 8)} <span className="text-xs font-normal text-ink-2">· {po.status}</span></h1>

      <form action={chooseSupplier.bind(null, id)} className="flex gap-2 mt-3">
        <select name="supplier_id" defaultValue={po.supplier_id ?? ""} className="rounded-sm border border-line bg-white p-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-royal/40">
          <option value="">— Proveedor —</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <Button type="submit" variant="primary">Guardar proveedor</Button>
      </form>

      <table className="w-full mt-4">
        <thead className="text-left text-xs">
          <tr>
            <th><Eyebrow>Variante</Eyebrow></th>
            <th><Eyebrow>Costo u.</Eyebrow></th>
            <th><Eyebrow>Pedidas</Eyebrow></th>
            <th><Eyebrow>Recibidas</Eyebrow></th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id} className="border-t border-line">
              <td className="py-1 text-ink">{it.variants.products.name} · {it.variants.color} · {it.variants.size}</td>
              <td className="text-ink">{formatMXN(it.unit_cost)}</td>
              <td className="text-ink">{it.qty_ordered}</td>
              <td className="text-ink">{it.qty_received}</td>
            </tr>
          ))}
          {items.length === 0 && <tr><td colSpan={4} className="py-3 text-ink-3">Sin líneas.</td></tr>}
        </tbody>
      </table>
      <div className="flex justify-between font-semibold mt-2 text-ink"><span>Total</span><span>{formatMXN(po.total_cost)}</span></div>

      {editable && (
        <form action={addLine.bind(null, id)} className="flex gap-2 mt-4 flex-wrap items-end">
          <select name="variant_id" className="rounded-sm border border-line bg-white p-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-royal/40">
            <option value="">— Variante —</option>
            {variantOptions.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>
          <input name="qty" type="number" min="1" placeholder="Cant." className="w-20 rounded-sm border border-line bg-white p-2 text-sm text-ink" />
          <input name="unit_cost" placeholder="Costo u. (MXN)" className="w-28 rounded-sm border border-line bg-white p-2 text-sm text-ink" />
          <Button type="submit" variant="primary" size="sm">+ Línea</Button>
        </form>
      )}

      {items.length > 0 && po.status !== "recibida" && (
        <form action={receive.bind(null, id)} className="mt-6 border-t border-line pt-4">
          <h2 className="font-semibold mb-2 text-ink">Recibir</h2>
          {items.map((it) => (
            <div key={it.id} className="flex items-center gap-2 mb-1">
              <span className="flex-1 text-ink">{it.variants.products.name} · {it.variants.color} · {it.variants.size} (faltan {it.qty_ordered - it.qty_received})</span>
              <input name={`received_${it.variant_id}`} type="number" min="0" max={it.qty_ordered - it.qty_received} defaultValue="0"
                className="w-20 rounded-sm border border-line bg-white p-1 text-sm text-ink" />
            </div>
          ))}
          <Button type="submit" variant="primary" className="mt-2">Recibir → sumar al stock</Button>
        </form>
      )}
    </div>
  );
}
