"use client";

import { use, useEffect, useState } from "react";
import { buildWhatsAppLink } from "@/domain/whatsapp";
import { formatMXN } from "@/domain/money";

// The store's WhatsApp number — replace with the real one at deploy time.
const STORE_WHATSAPP = "5215500000000";

interface LastOrder {
  id: string;
  name: string;
  items: { productName: string; color: string; size: string; qty: number; unitPrice: number }[];
  total: number;
}

export default function OrderConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [order, setOrder] = useState<LastOrder | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("corve-last-order");
      if (raw) {
        const o = JSON.parse(raw) as LastOrder;
        if (o.id === id) setOrder(o);
      }
    } catch {
      // ignore
    }
  }, [id]);

  const short = id.slice(0, 8);

  if (!order) {
    const wa = buildWhatsAppLink(STORE_WHATSAPP, `Hola CORVE, mi pedido #${short}`);
    return (
      <main className="p-6 max-w-md mx-auto text-center">
        <h1 className="text-2xl font-bold mb-2">¡Pedido recibido!</h1>
        <p className="opacity-70 text-sm mb-4">Tu pedido #{short} fue recibido. Te contactamos por WhatsApp.</p>
        <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-block rounded-xl bg-[#25D366] text-white px-5 py-3 text-sm">Continuar por WhatsApp</a>
      </main>
    );
  }

  const lines = order.items.map((i) => `• ${i.productName} ${i.color}/${i.size} x${i.qty}`).join("\n");
  const message = `Hola CORVE 💛 Soy ${order.name}. Mi pedido #${short}:\n${lines}\nTotal: ${formatMXN(order.total)} MXN`;
  const wa = buildWhatsAppLink(STORE_WHATSAPP, message);

  return (
    <main className="p-6 max-w-md mx-auto text-center">
      <h1 className="text-2xl font-bold mb-2">¡Gracias, {order.name}!</h1>
      <p className="opacity-70 text-sm mb-4">Tu pedido #{short} fue recibido. Te contactamos por WhatsApp para confirmar pago y envío.</p>
      <ul className="text-sm text-left mb-4">
        {order.items.map((i, idx) => (
          <li key={idx} className="flex justify-between border-b border-white/10 py-1">
            <span>{i.productName} · {i.color}/{i.size} ×{i.qty}</span>
            <span>{formatMXN(i.unitPrice * i.qty)}</span>
          </li>
        ))}
      </ul>
      <div className="flex justify-between text-sm mb-5"><span>Total</span><span>{formatMXN(order.total)} MXN</span></div>
      <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-block rounded-xl bg-[#25D366] text-white px-5 py-3 text-sm">Continuar por WhatsApp</a>
    </main>
  );
}
