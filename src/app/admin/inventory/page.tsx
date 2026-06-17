import { createClient } from "@/lib/supabase/server";
import { listMovements, totalInventoryValue } from "@/lib/repos/inventory";
import { formatMXN } from "@/domain/money";
import { Card, Eyebrow } from "@/components/ui";
import type { VariantRow } from "@/lib/db-types";

export default async function InventoryPage() {
  const supabase = await createClient();
  const { data: variants, error } = await supabase
    .from("variants").select("*, products(name)").order("stock", { ascending: true });
  if (error) throw error;
  const movements = await listMovements(50);
  const invValue = await totalInventoryValue();
  const rows = (variants ?? []) as (VariantRow & { products: { name: string } | null })[];

  return (
    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
      <div className="md:col-span-2">
        <Card>
          <Eyebrow>Valor de inventario</Eyebrow>
          <div className="text-2xl font-bold text-ink">{formatMXN(invValue)}</div>
        </Card>
      </div>
      <div>
        <h1 className="text-lg font-bold mb-3 text-ink">Inventario</h1>
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="text-left"><tr><th><Eyebrow>Variante</Eyebrow></th><th><Eyebrow>Stock</Eyebrow></th></tr></thead>
          <tbody>
            {rows.map((v) => (
              <tr key={v.id} className="border-t border-line">
                <td className="py-1 text-ink">{v.products?.name ?? "—"} · {v.color} · {v.size}</td>
                <td className={v.stock <= 1 ? "text-red-600" : "text-ink"}>{v.stock}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={2} className="py-4 text-ink-3">Sin variantes.</td></tr>}
          </tbody>
        </table>
        </div>
      </div>
      <div>
        <h2 className="text-lg font-bold mb-3 text-ink">Movimientos</h2>
        <ul className="space-y-1">
          {movements.map((m) => (
            <li key={m.id} className="flex justify-between border-b border-line py-1 text-ink">
              <span>{m.type}{m.reference ? ` · ${m.reference}` : ""}{m.reason ? ` · ${m.reason}` : ""}</span>
              <span className={m.delta >= 0 ? "text-green-700" : "text-orange-700"}>
                {m.delta >= 0 ? "+" : ""}{m.delta}
              </span>
            </li>
          ))}
          {movements.length === 0 && <li className="text-ink-3">Sin movimientos aún.</li>}
        </ul>
      </div>
    </div>
  );
}
