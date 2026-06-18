// src/app/(shop)/CatalogSideMenu.tsx
"use client";

import Link from "next/link";
import type { BrowserLine, BrowserCategory } from "./CatalogBrowser";

type Props = {
  lines: BrowserLine[];
  categories: BrowserCategory[];
  activeCats: string[];
  onToggleCategory: (slug: string) => void;
  open: boolean;
  onClose: () => void;
};

export default function CatalogSideMenu({ lines, categories, activeCats, onToggleCategory, open, onClose }: Props) {
  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-ink/30 backdrop-blur-sm md:hidden" onClick={onClose} aria-hidden />}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-white p-5 text-sm transition-transform duration-200 ease-out md:sticky md:top-[64px] md:z-auto md:h-[calc(100vh-64px)] md:w-56 md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="mb-6 flex items-center justify-between md:hidden">
          <span className="font-display text-lg font-bold text-ink">Menú</span>
          <button type="button" aria-label="Cerrar menú" onClick={onClose} className="text-ink-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>

        <nav className="space-y-6 overflow-y-auto">
          <div>
            <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-ink-3">Líneas</div>
            <ul className="space-y-1">
              {lines.map((l) => (
                <li key={l.slug}>
                  <Link href={`/linea/${l.slug}`} onClick={onClose}
                    className="block rounded-md px-3 py-2 text-ink-2 transition-colors hover:bg-mist hover:text-ink">
                    CORVE {l.slug}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-ink-3">Categorías</div>
            <ul className="space-y-1">
              {categories.map((c) => {
                const on = activeCats.includes(c.slug);
                return (
                  <li key={c.slug}>
                    <button type="button" onClick={() => onToggleCategory(c.slug)} aria-pressed={on}
                      className={`block w-full rounded-md px-3 py-2 text-left transition-colors ${on ? "bg-royal text-ink-on-royal" : "text-ink-2 hover:bg-mist hover:text-ink"}`}>
                      {c.name}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>
      </aside>
    </>
  );
}
