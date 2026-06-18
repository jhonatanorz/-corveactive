"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import ProductCard from "./ProductCard";
import { matchesFilters } from "@/domain/catalog-filter";
import { aggregateColors } from "@/domain/catalog-colors";
import { productColors } from "@/domain/product-colors";
import type { CatalogItem } from "@/lib/repos/catalog";

type Line = { slug: string; name: string };

function parseList(v: string | null): string[] {
  return v ? v.split(",").filter(Boolean) : [];
}

export default function SearchResults({
  query,
  items,
  lines,
}: {
  query: string;
  items: CatalogItem[];
  lines: Line[];
}) {
  const sp = useSearchParams();
  const [lineSlugs, setLineSlugs] = useState<string[]>(parseList(sp.get("line")));
  const [colors, setColors] = useState<string[]>(parseList(sp.get("color")));

  const swatches = useMemo(() => aggregateColors(items.flatMap((i) => i.colors)), [items]);
  const filtered = useMemo(
    () => items.filter((i) => matchesFilters(i, { lineSlugs, colorKeys: colors })),
    [items, lineSlugs, colors],
  );
  const active = lineSlugs.length > 0 || colors.length > 0;

  function sync(next: { line?: string[]; color?: string[] }) {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    const ls = next.line ?? lineSlugs;
    const cs = next.color ?? colors;
    if (ls.length) params.set("line", ls.join(","));
    if (cs.length) params.set("color", cs.join(","));
    window.history.replaceState({}, "", `?${params.toString()}`);
  }
  function toggleLine(slug: string) {
    const n = lineSlugs.includes(slug) ? lineSlugs.filter((s) => s !== slug) : [...lineSlugs, slug];
    setLineSlugs(n); sync({ line: n });
  }
  function toggleColor(key: string) {
    const n = colors.includes(key) ? colors.filter((s) => s !== key) : [...colors, key];
    setColors(n); sync({ color: n });
  }
  function clearAll() { setLineSlugs([]); setColors([]); sync({ line: [], color: [] }); }

  return (
    <main className="p-4">
      <h1 className="mb-4 text-lg text-ink">Resultados para “{query}”</h1>

      <div className="mb-4 space-y-3">
        {lines.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {lines.map((l) => {
              const on = lineSlugs.includes(l.slug);
              return (
                <button key={l.slug} type="button" onClick={() => toggleLine(l.slug)} aria-pressed={on}
                  className={`rounded-pill border px-3 py-1 text-xs transition ${on ? "border-transparent bg-royal text-ink-on-royal" : "border-line-strong text-ink-2 hover:text-ink"}`}>
                  {l.name}
                </button>
              );
            })}
          </div>
        )}
        {swatches.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {swatches.map((s) => {
              const on = colors.includes(s.key);
              return (
                <button key={s.key} type="button" onClick={() => toggleColor(s.key)} aria-label={s.label} title={s.label} aria-pressed={on}
                  className={`h-6 w-6 rounded-pill border border-line transition ${on ? "ring-2 ring-royal ring-offset-1" : ""}`}
                  style={{ background: s.hex }} />
              );
            })}
          </div>
        )}
        {active && <button type="button" onClick={clearAll} className="text-xs text-royal hover:underline">Limpiar</button>}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
        {filtered.map((p) => (
          <ProductCard key={p.id} id={p.id} name={p.name} price={p.price}
            images={p.images} colors={productColors(p.colors, p.images)} />
        ))}
        {filtered.length === 0 && <p className="text-sm text-ink-3">Sin resultados.</p>}
      </div>
    </main>
  );
}
