"use client";

import Link from "next/link";
import { useState } from "react";
import { Wordmark } from "@/components/ui";
import { signOut } from "./login/actions";

const LINKS = [
  { href: "/admin/pedidos", label: "Pedidos" },
  { href: "/admin/products", label: "Productos" },
  { href: "/admin/inventory", label: "Inventario" },
  { href: "/admin/compras", label: "Compras" },
  { href: "/admin/ventas", label: "Ventas" },
  { href: "/admin/proveedores", label: "Proveedores" },
  { href: "/admin/ajustes", label: "Ajustes" },
];

export default function AdminNav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between p-4 border-b border-line bg-snow">
        <button type="button" aria-label="Abrir menú" onClick={() => setOpen(true)} className="text-ink">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <Wordmark href="/admin/pedidos" className="text-xl" />
        <span className="w-[22px]" />
      </header>

      {/* Backdrop (mobile, when open) */}
      {open && <div className="fixed inset-0 z-30 bg-ink/30 md:hidden" onClick={() => setOpen(false)} aria-hidden />}

      {/* Sidebar (desktop) / drawer (mobile) */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-60 bg-mist text-ink-2 p-4 text-sm flex flex-col border-r border-line transition-transform duration-200 ease-out md:sticky md:top-0 md:h-screen md:z-auto md:w-44 md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between md:block">
          <Wordmark href="/admin/pedidos" className="text-xl pb-4" />
          <button type="button" aria-label="Cerrar menú" onClick={() => setOpen(false)} className="md:hidden text-ink-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>
        <nav className="space-y-1 flex-1">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="block py-2 hover:text-royal">
              {l.label}
            </Link>
          ))}
        </nav>
        <form action={signOut}>
          <button className="text-left py-2 text-ink-3 hover:text-royal">Cerrar sesión</button>
        </form>
      </aside>
    </>
  );
}
