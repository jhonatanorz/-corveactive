// src/app/(shop)/CatalogBrowser.tsx
"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import ProductGrid from "./ProductGrid";
import LineHero from "./LineHero";
import { matchesFilters } from "@/domain/catalog-filter";
import type { CatalogItem } from "@/lib/repos/catalog";

export interface BrowserLine {
  slug: string;
  name: string;
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
  showSections: boolean;
};

function parseList(v: string | null): string[] {
  return v ? v.split(",").filter(Boolean) : [];
}

export default function CatalogBrowser({ items, lines, showSections }: Props) {
  const sp = useSearchParams();
  const catParam = sp.get("cat") ?? "";
  const cats = useMemo(() => parseList(catParam), [catParam]);
  const active = cats.length > 0;
  const filtered = useMemo(
    () => items.filter((i) => matchesFilters(i, { categorySlugs: cats })),
    [items, cats],
  );

  return (
    <main className="min-w-0">
      {showSections && !active
        ? lines
            .filter((l) => items.some((i) => i.lineSlug === l.slug))
            .map((l) => (
              <section key={l.slug} className="mb-10">
                <LineHero line={l} />
                <ProductGrid items={items.filter((i) => i.lineSlug === l.slug)} />
              </section>
            ))
        : <ProductGrid items={filtered} />}
    </main>
  );
}
