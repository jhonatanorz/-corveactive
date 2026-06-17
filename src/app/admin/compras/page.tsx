import Link from "next/link";
import { listPOs } from "@/lib/repos/purchasing";
import { formatMXN } from "@/domain/money";
import { newOrder } from "./actions";
import { Button, Eyebrow } from "@/components/ui";

export default async function ComprasPage() {
  const pos = await listPOs();
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold text-ink">Órdenes de compra</h1>
        <form action={newOrder}><Button type="submit" variant="primary" size="sm">+ Nueva orden</Button></form>
      </div>
      <table className="w-full text-sm">
        <thead className="text-left text-xs">
          <tr>
            <th className="py-2"><Eyebrow>#</Eyebrow></th>
            <th><Eyebrow>Proveedor</Eyebrow></th>
            <th><Eyebrow>Costo</Eyebrow></th>
            <th><Eyebrow>Estado</Eyebrow></th>
            <th><Eyebrow>Fecha</Eyebrow></th>
          </tr>
        </thead>
        <tbody>
          {pos.map((p) => (
            <tr key={p.id} className="border-t border-line">
              <td className="py-2 text-ink"><Link href={`/admin/compras/${p.id}`}>OC-{p.id.slice(0, 8)}</Link></td>
              <td className="text-ink">{p.suppliers?.name ?? "—"}</td>
              <td className="text-ink">{formatMXN(p.total_cost)}</td>
              <td>
                {(p.status === "borrador" || p.status === "pedida") && <span className="bg-mist text-ink-2 rounded-pill px-2 py-0.5 text-xs">{p.status}</span>}
                {p.status === "parcial" && <span className="bg-periwinkle-2 text-royal rounded-pill px-2 py-0.5 text-xs">{p.status}</span>}
                {p.status === "recibida" && <span className="bg-lime text-ink rounded-pill px-2 py-0.5 text-xs">{p.status}</span>}
                {p.status === "cancelada" && <span className="bg-mist text-ink-3 line-through rounded-pill px-2 py-0.5 text-xs">{p.status}</span>}
              </td>
              <td className="text-ink-2">{p.created_at.slice(0, 10)}</td>
            </tr>
          ))}
          {pos.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-ink-3">Sin órdenes aún.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
