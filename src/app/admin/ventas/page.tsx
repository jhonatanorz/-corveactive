import Link from "next/link";
import { getSalesSummary } from "@/lib/repos/sales";
import { listLines } from "@/lib/repos/lines";
import { formatMXN } from "@/domain/money";
import { Button, KpiCard, PageHeader, buttonClass } from "@/components/ui";

const dateInput = "block rounded-sm border border-line bg-white p-2 text-sm text-ink";

export default async function VentasPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; line?: string }> }) {
  const sp = await searchParams;
  const filter = { from: sp.from, to: sp.to, line: sp.line || undefined };
  const [summary, lines] = await Promise.all([getSalesSummary(filter), listLines()]);

  const link = (q: Record<string, string>) => "/admin/ventas?" + new URLSearchParams(q).toString();

  return (
    <div className="p-6 text-sm">
      <PageHeader title="Ventas" />

      {/* Toolbar: line filter (left) · date range (right) */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/ventas" className={`${buttonClass("primary", "sm")} ${!sp.line ? "" : "opacity-50"} rounded-pill`}>Todo</Link>
          {lines.map((l) => (
            <Link key={l.slug} href={link({ line: l.slug })}
              className={`${buttonClass("primary", "sm")} ${sp.line === l.slug ? "" : "opacity-50"} rounded-pill`}>
              {l.slug.toUpperCase()}
            </Link>
          ))}
        </div>
        <form className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-ink-2">Desde<input name="from" type="date" defaultValue={sp.from} className={dateInput} /></label>
          <label className="text-xs text-ink-2">Hasta<input name="to" type="date" defaultValue={sp.to} className={dateInput} /></label>
          {sp.line && <input type="hidden" name="line" value={sp.line} />}
          <Button type="submit" variant="primary" size="sm">Filtrar</Button>
        </form>
      </div>

      <div className="grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Ingresos"
          value={formatMXN(summary.revenue)}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          }
        />
        <KpiCard
          label="Unidades"
          value={summary.units}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
          }
        />
        <KpiCard
          label="Ganancia"
          value={formatMXN(summary.profit)}
          valueClassName="text-green-700"
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
              <polyline points="17 6 23 6 23 12" />
            </svg>
          }
        />
      </div>
    </div>
  );
}
