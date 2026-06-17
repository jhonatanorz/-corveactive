import { notFound } from "next/navigation";
import { getOrder } from "@/lib/repos/orders";
import { formatMXN } from "@/domain/money";
import { buildWhatsAppLink } from "@/domain/whatsapp";
import { changeStatus, cancel } from "./actions";
import { Button } from "@/components/ui";

const FLOW = ["nuevo", "confirmado", "pagado", "enviado", "entregado"];

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getOrder(id);
  if (!data) notFound();
  const { order, items } = data;
  const wa = buildWhatsAppLink(order.customer_whatsapp, `Hola ${order.customer_name}, sobre tu pedido CORVE #${id.slice(0, 8)}…`);

  return (
    <div className="p-6 max-w-lg text-sm">
      <h1 className="text-lg font-bold text-ink">Pedido #{id.slice(0, 8)}</h1>
      <p className="mt-1 text-ink">{order.customer_name} · <a className="underline" href={wa} target="_blank" rel="noopener noreferrer">{order.customer_whatsapp}</a></p>
      {order.delivery_note && <p className="opacity-70 text-ink-2">{order.delivery_note}</p>}
      <ul className="my-3">
        {items.map((i) => (
          <li key={i.id} className="flex justify-between border-b border-line py-1 text-ink">
            <span>{i.product_name} · {i.color}/{i.size} ×{i.qty}</span>
            <span>{formatMXN(i.unit_price * i.qty)}</span>
          </li>
        ))}
      </ul>
      <div className="flex justify-between font-semibold text-ink"><span>Total</span><span>{formatMXN(order.total)}</span></div>
      <p className="mt-3 text-ink">Estado: <b>{order.status}</b></p>

      {order.status !== "cancelado" && (
        <>
          <form action={changeStatus.bind(null, id)} className="mt-3 flex gap-2">
            <select name="status" defaultValue={order.status} className="rounded-sm border border-line bg-white p-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-royal/40">
              {FLOW.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <Button type="submit" variant="primary">Actualizar</Button>
          </form>
          <form action={cancel.bind(null, id)} className="mt-3">
            <Button type="submit" variant="ghost">Cancelar pedido (devuelve stock)</Button>
          </form>
        </>
      )}
    </div>
  );
}
