"use server";

import { placeOrder } from "@/lib/repos/orders";

export async function submitOrder(input: {
  name: string; whatsapp: string; note: string;
  items: { variant_id: string; qty: number }[];
}): Promise<{ ok: true; id: string } | { ok: false; reason: string }> {
  return placeOrder(input);
}
