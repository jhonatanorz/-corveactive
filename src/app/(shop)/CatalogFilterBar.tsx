// src/app/(shop)/CatalogFilterBar.tsx
"use client";

import type { BrowserCategory } from "./CatalogBrowser";
import type { ColorSwatch } from "@/domain/catalog-colors";

type Props = {
  query: string;
  onQuery: (v: string) => void;
  categories: BrowserCategory[];
  activeCats: string[];
  onToggleCategory: (slug: string) => void;
  swatches: ColorSwatch[];
  activeColors: string[];
  onToggleColor: (key: string) => void;
  active: boolean;
  onClear: () => void;
  onOpenMenu: () => void;
};

export default function CatalogFilterBar({
  query, onQuery, categories, activeCats, onToggleCategory,
  swatches, activeColors, onToggleColor, active, onClear, onOpenMenu,
}: Props) {
  return (
    <div className="sticky top-[64px] z-20 space-y-3 border-b border-line bg-white/95 p-4 backdrop-blur">
      <div className="flex items-center gap-2">
        <button type="button" aria-label="Abrir menú" onClick={onOpenMenu} className="text-ink md:hidden">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <input value={query} onChange={(e) => onQuery(e.target.value)} placeholder="Buscar…" aria-label="Buscar"
          className="w-full rounded-pill border border-line bg-white px-4 py-2 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-royal/40" />
        {active && <button type="button" onClick={onClear} className="shrink-0 text-xs text-royal hover:underline">Limpiar</button>}
      </div>

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {categories.map((c) => {
            const on = activeCats.includes(c.slug);
            return (
              <button key={c.slug} type="button" onClick={() => onToggleCategory(c.slug)} aria-pressed={on}
                className={`rounded-pill border px-3 py-1 text-xs transition ${on ? "border-transparent bg-royal text-ink-on-royal" : "border-line-strong text-ink-2 hover:text-ink"}`}>
                {c.name}
              </button>
            );
          })}
        </div>
      )}

      {swatches.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {swatches.map((s) => {
            const on = activeColors.includes(s.key);
            return (
              <button key={s.key} type="button" onClick={() => onToggleColor(s.key)} aria-label={s.label} title={s.label} aria-pressed={on}
                className={`h-6 w-6 rounded-pill border border-line transition ${on ? "ring-2 ring-royal ring-offset-1" : ""}`}
                style={{ background: s.hex }} />
            );
          })}
        </div>
      )}
    </div>
  );
}
