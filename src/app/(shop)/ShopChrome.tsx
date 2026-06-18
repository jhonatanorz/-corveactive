// src/app/(shop)/ShopChrome.tsx
"use client";

import { useState } from "react";
import { Wordmark } from "@/components/ui";
import CartPill from "./CartPill";
import CatalogSideMenu from "./CatalogSideMenu";
import SearchOverlay from "./SearchOverlay";
import type { BrowserLine, BrowserCategory } from "./CatalogBrowser";

type Props = {
  lines: BrowserLine[];
  categories: BrowserCategory[];
  children: React.ReactNode;
};

export default function ShopChrome({ lines, categories, children }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-line bg-white/95 px-5 py-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Abrir menú" onClick={() => setMenuOpen(true)} className="text-ink">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <Wordmark className="text-2xl" />
        </div>
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Buscar" onClick={() => setSearchOpen(true)} className="text-ink">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
          <CartPill />
        </div>
      </header>

      <CatalogSideMenu lines={lines} categories={categories} open={menuOpen} onClose={() => setMenuOpen(false)} />
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />

      {children}
    </>
  );
}
