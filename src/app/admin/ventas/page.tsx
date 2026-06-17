import Link from "next/link";
import { getSalesSummary } from "@/lib/repos/sales";
import { formatMXN } from "@/domain/money";
import type { Line } from "@/domain/types";
import { Button, Card, Eyebrow, buttonClass } from "@/components/ui";

export default async function VentasPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; line?: string }> }) {
  const sp = await searchParams;
  const filter = { from: sp.from, to: sp.to, line: (sp.line as Line | undefined) || undefined };
  const summary = await getSalesSummary(filter);

  const link = (q: Record<string, string>) => "/admin/ventas?" + new URLSearchParams(q).toString();

  return (
    <div className="p-6 max-w-2xl text-sm">
      <h1 className="text-lg font-bold mb-3 text-ink">Ventas</h1>
      <div className="flex gap-2 mb-4">
        <Link href="/admin/ventas" className={`${buttonClass("primary", "sm")} ${!sp.line ? "" : "opacity-50"} rounded-pill`}>Todo</Link>
        <Link href={link({ line: "MOVE" })} className={`${buttonClass("primary", "sm")} ${sp.line === "MOVE" ? "" : "opacity-50"} rounded-pill`}>MOVE</Link>
        <Link href={link({ line: "HIM" })} className={`${buttonClass("primary", "sm")} ${sp.line === "HIM" ? "" : "opacity-50"} rounded-pill`}>HIM</Link>
      </div>
      <form className="flex gap-2 mb-4 items-end">
        <label className="text-xs text-ink-2">Desde<input name="from" type="date" defaultValue={sp.from} className="block rounded-sm border border-line bg-white p-2 text-sm text-ink" /></label>
        <label className="text-xs text-ink-2">Hasta<input name="to" type="date" defaultValue={sp.to} className="block rounded-sm border border-line bg-white p-2 text-sm text-ink" /></label>
        {sp.line && <input type="hidden" name="line" value={sp.line} />}
        <Button type="submit" variant="primary" size="sm">Filtrar</Button>
      </form>
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <Eyebrow>Ingresos</Eyebrow>
          <div className="text-2xl font-bold text-ink">{formatMXN(summary.revenue)}</div>
        </Card>
        <Card className="p-4">
          <Eyebrow>Unidades</Eyebrow>
          <div className="text-2xl font-bold text-ink">{summary.units}</div>
        </Card>
        <Card className="p-4">
          <Eyebrow>Ganancia</Eyebrow>
          <div className="text-2xl font-bold text-green-700">{formatMXN(summary.profit)}</div>
        </Card>
      </div>
    </div>
  );
}
