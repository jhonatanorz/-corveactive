// src/app/(shop)/pedido/[id]/page.tsx
import { getStoreSettings } from "@/lib/repos/settings";
import OrderConfirmation from "./OrderConfirmation";

export default async function OrderConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { whatsapp } = await getStoreSettings();
  return <OrderConfirmation id={id} storeWhatsapp={whatsapp} />;
}
