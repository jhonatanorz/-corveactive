"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart/CartContext";
import { cartSubtotal } from "@/domain/cart";
import { formatMXN } from "@/domain/money";
import { validateCheckout } from "@/domain/checkout";
import { Button, Card, inputClass } from "@/components/ui";
import { submitOrder } from "./actions";

export default function CartPage() {
  const router = useRouter();
  const { items, setQty, remove, clear, count } = useCart();
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  const subtotal = cartSubtotal(items.map((i) => ({ variantId: i.variantId, unitPrice: i.unitPrice, qty: i.qty })));

  async function onSubmit() {
    const v = validateCheckout({ name, whatsapp, itemCount: count });
    if (!v.ok) { setErrors(v.errors); return; }
    setErrors({}); setPending(true);
    const res = await submitOrder({
      name, whatsapp, note,
      items: items.map((i) => ({ variant_id: i.variantId, qty: i.qty })),
    });
    setPending(false);
    if (!res.ok) {
      setErrors({ cart: res.reason === "insufficient_stock" ? "Una prenda se agotó. Ajusta tu carrito." : "No se pudo enviar el pedido." });
      return;
    }
    sessionStorage.setItem("corve-last-order", JSON.stringify({
      id: res.id, name,
      items: items.map((i) => ({ productName: i.productName, color: i.color, size: i.size, qty: i.qty, unitPrice: i.unitPrice })),
      total: subtotal,
    }));
    clear();
    router.push(`/pedido/${res.id}`);
  }

  return (
    <main className="p-4 max-w-md mx-auto">
      <h1 className="text-xl font-semibold mb-3 text-ink">Tu pedido</h1>
      {items.length === 0 && <p className="text-ink-3">Tu carrito está vacío.</p>}
      <ul className="space-y-2">
        {items.map((i) => (
          <Card key={i.variantId} className="flex items-center gap-2 text-sm p-3">
            <div className="flex-1">
              <div className="text-ink">{i.productName}</div>
              <div className="text-ink-3">{i.color} · {i.size}</div>
            </div>
            <input type="number" min={1} value={i.qty}
              onChange={(e) => setQty(i.variantId, Number(e.target.value))}
              className="w-14 rounded-sm border border-line p-1 text-center text-ink" />
            <button onClick={() => remove(i.variantId)} className="text-ink-3 hover:text-ink">✕</button>
          </Card>
        ))}
      </ul>
      {items.length > 0 && (
        <>
          <div className="flex justify-between border-t border-line mt-3 pt-3 text-sm text-ink">
            <span>Subtotal</span><span>{formatMXN(subtotal)} MXN</span>
          </div>
          <div className="space-y-2 mt-4">
            <input placeholder="Tu nombre" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
            {errors.name && <p className="text-red-600 text-xs">{errors.name}</p>}
            <input placeholder="WhatsApp (con lada)" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className={inputClass} />
            {errors.whatsapp && <p className="text-red-600 text-xs">{errors.whatsapp}</p>}
            <textarea placeholder="Nota / zona de entrega (opcional)" value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
            {errors.cart && <p className="text-red-600 text-xs">{errors.cart}</p>}
            <Button variant="primary" onClick={onSubmit} disabled={pending} className="w-full">
              {pending ? "Enviando…" : "Enviar pedido"}
            </Button>
          </div>
        </>
      )}
    </main>
  );
}
