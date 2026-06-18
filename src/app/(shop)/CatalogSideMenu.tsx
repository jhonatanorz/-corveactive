// src/app/(shop)/CatalogSideMenu.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { BrowserLine, BrowserCategory } from "./CatalogBrowser";

type Props = {
  lines: BrowserLine[];
  categories: BrowserCategory[];
  open: boolean;
  onClose: () => void;
};

function parseList(v: string | null): string[] {
  return v ? v.split(",").filter(Boolean) : [];
}

export default function CatalogSideMenu({ lines, categories, open, onClose }: Props) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const router = useRouter();
  const activeCats = parseList(sp.get("cat"));

  function toggleCategory(slug: string) {
    const next = activeCats.includes(slug) ? activeCats.filter((s) => s !== slug) : [...activeCats, slug];
    const qs = next.length ? `?cat=${next.join(",")}` : "";
    const onBrowse = pathname === "/" || pathname.startsWith("/linea/");
    if (onBrowse) router.replace(`${pathname}${qs}`, { scroll: false });
    else router.push(`/${qs}`);
    onClose();
  }

  return (
    <>
      {open && <div className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-sm" onClick={onClose} aria-hidden />}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-line bg-white p-5 text-sm transition-transform duration-200 ease-out ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="mb-6 flex items-center justify-between">
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
                    {l.name}
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
                    <button type="button" onClick={() => toggleCategory(c.slug)} aria-pressed={on}
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
