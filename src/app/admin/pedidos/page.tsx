import Link from "next/link";
import { listOrders } from "@/lib/repos/orders";
import { formatMXN } from "@/domain/money";
import { Eyebrow } from "@/components/ui";

export default async function PedidosPage() {
  const orders = await listOrders();
  return (
    <div className="p-6">
      <h1 className="text-lg font-bold mb-4 text-ink">Pedidos</h1>
      <table className="w-full text-sm">
        <thead className="text-left text-xs">
          <tr>
            <th className="py-2"><Eyebrow>#</Eyebrow></th>
            <th><Eyebrow>Cliente</Eyebrow></th>
            <th><Eyebrow>Total</Eyebrow></th>
            <th><Eyebrow>Estado</Eyebrow></th>
            <th><Eyebrow>Fecha</Eyebrow></th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className={`border-t border-line ${o.status === "nuevo" ? "bg-mist" : ""}`}>
              <td className="py-2 text-ink"><Link href={`/admin/pedidos/${o.id}`}>#{o.id.slice(0, 8)}</Link></td>
              <td className="text-ink">{o.customer_name}</td>
              <td className="text-ink">{formatMXN(o.total)}</td>
              <td>
                {o.status === "nuevo" && <span className="bg-mist text-ink-2 rounded-pill px-2 py-0.5 text-xs">{o.status}</span>}
                {o.status === "confirmado" && <span className="bg-periwinkle-2 text-royal rounded-pill px-2 py-0.5 text-xs">{o.status}</span>}
                {(o.status === "pagado" || o.status === "enviado" || o.status === "entregado") && <span className="bg-lime text-ink rounded-pill px-2 py-0.5 text-xs">{o.status}</span>}
                {o.status === "cancelado" && <span className="bg-mist text-ink-3 line-through rounded-pill px-2 py-0.5 text-xs">{o.status}</span>}
              </td>
              <td className="text-ink-2">{o.created_at.slice(0, 10)}</td>
            </tr>
          ))}
          {orders.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-ink-3">Sin pedidos aún.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
