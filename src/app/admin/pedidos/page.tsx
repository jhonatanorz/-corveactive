import Link from "next/link";
import { listOrders } from "@/lib/repos/orders";
import { formatMXN } from "@/domain/money";

export default async function PedidosPage() {
  const orders = await listOrders();
  return (
    <div className="p-6">
      <h1 className="text-lg font-bold mb-4">Pedidos</h1>
      <table className="w-full text-sm">
        <thead className="text-left text-[#9a8b7d] text-xs">
          <tr><th className="py-2">#</th><th>Cliente</th><th>Total</th><th>Estado</th><th>Fecha</th></tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className={`border-t border-[#eadfd3] ${o.status === "nuevo" ? "bg-[#fbf4ec]" : ""}`}>
              <td className="py-2"><Link href={`/admin/pedidos/${o.id}`}>#{o.id.slice(0, 8)}</Link></td>
              <td>{o.customer_name}</td>
              <td>{formatMXN(o.total)}</td>
              <td>{o.status}</td>
              <td>{o.created_at.slice(0, 10)}</td>
            </tr>
          ))}
          {orders.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-[#9a8b7d]">Sin pedidos aún.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
