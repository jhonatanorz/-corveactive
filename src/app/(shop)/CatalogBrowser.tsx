// src/app/(shop)/CatalogBrowser.tsx
"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import ProductCard from "./ProductCard";
import LineHero from "./LineHero";
import CatalogSideMenu from "./CatalogSideMenu";
import CatalogFilterBar from "./CatalogFilterBar";
import { matchesFilters } from "@/domain/catalog-filter";
import { aggregateColors } from "@/domain/catalog-colors";
import { productColors } from "@/domain/product-colors";
import type { CatalogItem } from "@/lib/repos/catalog";

export interface BrowserLine {
  slug: string;
  hero_title: string;
  hero_message: string;
}
export interface BrowserCategory {
  slug: string;
  name: string;
}

type Props = {
  items: CatalogItem[];
  lines: BrowserLine[];
  categories: BrowserCategory[];
  showSections: boolean;
};

function parseList(v: string | null): string[] {
  return v ? v.split(",").filter(Boolean) : [];
}

export default function CatalogBrowser({ items, lines, categories, showSections }: Props) {
  const sp = useSearchParams();
  const [query, setQuery] = useState(sp.get("q") ?? "");
  const [cats, setCats] = useState<string[]>(parseList(sp.get("cat")));
  const [colors, setColors] = useState<string[]>(parseList(sp.get("color")));
  const [menuOpen, setMenuOpen] = useState(false);

  const swatches = useMemo(() => aggregateColors(items.flatMap((i) => i.colors)), [items]);
  const active = query.trim() !== "" || cats.length > 0 || colors.length > 0;
  const filtered = useMemo(
    () => items.filter((i) => matchesFilters(i, { query, categorySlugs: cats, colorKeys: colors })),
    [items, query, cats, colors],
  );

  function sync(next: { q?: string; cat?: string[]; color?: string[] }) {
    const params = new URLSearchParams();
    const q = next.q ?? query;
    const c = next.cat ?? cats;
    const col = next.color ?? colors;
    if (q.trim()) params.set("q", q.trim());
    if (c.length) params.set("cat", c.join(","));
    if (col.length) params.set("color", col.join(","));
    const qs = params.toString();
    window.history.replaceState({}, "", qs ? `?${qs}` : window.location.pathname);
  }

  function onQuery(v: string) { setQuery(v); sync({ q: v }); }
  function toggleCat(slug: string) {
    const next = cats.includes(slug) ? cats.filter((s) => s !== slug) : [...cats, slug];
    setCats(next); sync({ cat: next });
  }
  function toggleColor(key: string) {
    const next = colors.includes(key) ? colors.filter((s) => s !== key) : [...colors, key];
    setColors(next); sync({ color: next });
  }
  function clearAll() { setQuery(""); setCats([]); setColors([]); sync({ q: "", cat: [], color: [] }); }

  const grid = (list: CatalogItem[]) => (
    <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
      {list.map((p) => (
        <ProductCard key={p.id} id={p.id} name={p.name} price={p.price}
          images={p.images} colors={productColors(p.colors, p.images)} />
      ))}
      {list.length === 0 && <p className="text-sm text-ink-3">Sin resultados.</p>}
    </div>
  );

  return (
    <div className="md:flex">
      <CatalogSideMenu
        lines={lines}
        categories={categories}
        activeCats={cats}
        onToggleCategory={toggleCat}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
      />
      <main className="min-w-0 flex-1">
        <CatalogFilterBar
          query={query}
          onQuery={onQuery}
          categories={categories}
          activeCats={cats}
          onToggleCategory={toggleCat}
          swatches={swatches}
          activeColors={colors}
          onToggleColor={toggleColor}
          active={active}
          onClear={clearAll}
          onOpenMenu={() => setMenuOpen(true)}
        />
        {showSections && !active
          ? lines.map((l) => (
              <section key={l.slug} className="mb-10">
                <LineHero line={l} />
                {grid(items.filter((i) => i.lineSlug === l.slug))}
              </section>
            ))
          : grid(filtered)}
      </main>
    </div>
  );
}
