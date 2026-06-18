// src/app/(shop)/pedido/[id]/OrderConfirmation.tsx
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { buildWhatsAppLink } from "@/domain/whatsapp";
import { formatMXN } from "@/domain/money";
import { Card, buttonClass, FloatingBar } from "@/components/ui";

interface LastOrder {
  id: string;
  name: string;
  items: { productName: string; color: string; size: string; qty: number; unitPrice: number; image?: string | null }[];
  total: number;
}

export default function OrderConfirmation({ id, storeWhatsapp }: { id: string; storeWhatsapp: string }) {
  const [order, setOrder] = useState<LastOrder | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("corve-last-order");
      if (raw) {
        const o = JSON.parse(raw) as LastOrder;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- load last order from sessionStorage after mount
        if (o.id === id) setOrder(o);
      }
    } catch {
      // ignore
    }
  }, [id]);

  const short = id.slice(0, 8);

  if (!order) {
    const wa = storeWhatsapp ? buildWhatsAppLink(storeWhatsapp, `Hola CORVE, mi pedido #${short}`) : null;
    return (
      <>
        <main className="p-6 max-w-md mx-auto text-center pb-28">
          <h1 className="text-2xl font-bold mb-2 text-ink">¡Pedido recibido!</h1>
          <p className="text-ink-2 text-sm mb-4">Tu pedido #{short} fue recibido. Te contactamos por WhatsApp.</p>
        </main>
        {wa && (
          <FloatingBar>
            <a href={wa} target="_blank" rel="noopener noreferrer" className={`${buttonClass("primary", "lg")} w-full`}>Continuar por WhatsApp</a>
          </FloatingBar>
        )}
      </>
    );
  }

  const lines = order.items.map((i) => `• ${i.productName} ${i.color}/${i.size} x${i.qty}`).join("\n");
  const message = `Hola CORVE 💛 Soy ${order.name}. Mi pedido #${short}:\n${lines}\nTotal: ${formatMXN(order.total)} MXN`;
  const wa = storeWhatsapp ? buildWhatsAppLink(storeWhatsapp, message) : null;

  return (
    <>
      <main className="p-6 max-w-md mx-auto text-center pb-28">
        <h1 className="text-2xl font-bold mb-2 text-ink">¡Gracias, {order.name}!</h1>
        <p className="text-ink-2 text-sm mb-4">Tu pedido #{short} fue recibido. Te contactamos por WhatsApp para confirmar pago y envío.</p>
        <Card className="p-4 mb-5 text-left">
          <ul>
            {order.items.map((i, idx) => (
              <li key={idx} className="flex items-center gap-2 border-b border-line py-2 text-sm">
                <div className="relative w-10 h-12 shrink-0 rounded-md overflow-hidden bg-mist">
                  {i.image && <Image src={i.image} alt={i.productName} fill sizes="40px" className="object-cover" />}
                </div>
                <span className="flex-1 text-ink">{i.productName} · {i.color}/{i.size} ×{i.qty}</span>
                <span className="text-ink">{formatMXN(i.unitPrice * i.qty)}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between text-sm pt-2 text-ink"><span>Total</span><span>{formatMXN(order.total)} MXN</span></div>
        </Card>
      </main>
      {wa && (
        <FloatingBar>
          <a href={wa} target="_blank" rel="noopener noreferrer" className={`${buttonClass("primary", "lg")} w-full`}>Continuar por WhatsApp</a>
        </FloatingBar>
      )}
    </>
  );
}
