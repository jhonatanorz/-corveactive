import Link from "next/link";
import { listPOs } from "@/lib/repos/purchasing";
import { formatMXN } from "@/domain/money";
import { newOrder } from "./actions";

export default async function ComprasPage() {
  const pos = await listPOs();
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold">Órdenes de compra</h1>
        <form action={newOrder}><button className="rounded-md bg-[#211d1a] text-white text-sm px-3 py-2">+ Nueva orden</button></form>
      </div>
      <table className="w-full text-sm">
        <thead className="text-left text-[#9a8b7d] text-xs"><tr><th className="py-2">#</th><th>Proveedor</th><th>Costo</th><th>Estado</th><th>Fecha</th></tr></thead>
        <tbody>
          {pos.map((p) => (
            <tr key={p.id} className="border-t border-[#eadfd3]">
              <td className="py-2"><Link href={`/admin/compras/${p.id}`}>OC-{p.id.slice(0, 8)}</Link></td>
              <td>{p.suppliers?.name ?? "—"}</td>
              <td>{formatMXN(p.total_cost)}</td>
              <td>{p.status}</td>
              <td>{p.created_at.slice(0, 10)}</td>
            </tr>
          ))}
          {pos.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-[#9a8b7d]">Sin órdenes aún.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
