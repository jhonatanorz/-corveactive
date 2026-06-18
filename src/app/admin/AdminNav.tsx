"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Wordmark } from "@/components/ui";
import { signOut } from "./login/actions";

const I = {
  bag: (
    <><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></>
  ),
  tag: (
    <><path d="M20.59 13.41 13.42 20.6a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z" /><line x1="7" y1="7" x2="7.01" y2="7" /></>
  ),
  box: (
    <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></>
  ),
  truck: (
    <><path d="M1 3h15v13H1z" /><path d="M16 8h4l3 3v5h-7V8Z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></>
  ),
  chart: (
    <><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>
  ),
  users: (
    <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>
  ),
  layers: (
    <><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></>
  ),
  grid: (
    <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>
  ),
  gear: (
    <><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" /><circle cx="12" cy="12" r="3" /></>
  ),
};

const LINKS: { href: string; label: string; icon: ReactNode }[] = [
  { href: "/admin/pedidos", label: "Pedidos", icon: I.bag },
  { href: "/admin/products", label: "Productos", icon: I.tag },
  { href: "/admin/lines", label: "Líneas", icon: I.layers },
  { href: "/admin/categories", label: "Categorías", icon: I.grid },
  { href: "/admin/inventory", label: "Inventario", icon: I.box },
  { href: "/admin/compras", label: "Compras", icon: I.truck },
  { href: "/admin/ventas", label: "Ventas", icon: I.chart },
  { href: "/admin/proveedores", label: "Proveedores", icon: I.users },
  { href: "/admin/ajustes", label: "Ajustes", icon: I.gear },
];

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

export default function AdminNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between p-4 border-b border-line bg-white">
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
      {open && <div className="fixed inset-0 z-30 bg-ink/30 backdrop-blur-sm md:hidden" onClick={() => setOpen(false)} aria-hidden />}

      {/* Sidebar (desktop) / drawer (mobile) */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-white p-4 text-sm transition-transform duration-200 ease-out md:sticky md:top-0 md:z-auto md:h-screen md:w-60 md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="mb-6 flex items-center justify-between md:block">
          <Wordmark href="/admin/pedidos" className="text-2xl" />
          <button type="button" aria-label="Cerrar menú" onClick={() => setOpen(false)} className="md:hidden text-ink-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 space-y-1">
          {LINKS.map((l) => {
            const active = isActive(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-md px-3 py-2 transition-colors ${
                  active
                    ? "bg-royal text-ink-on-royal shadow-1"
                    : "text-ink-2 hover:bg-mist hover:text-ink"
                }`}
              >
                <span className={active ? "text-ink-on-royal" : "text-ink-3"}>
                  <Icon>{l.icon}</Icon>
                </span>
                <span className="font-medium">{l.label}</span>
              </Link>
            );
          })}
        </nav>

        <form action={signOut} className="border-t border-line pt-3">
          <button className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-ink-3 transition-colors hover:bg-mist hover:text-ink">
            <Icon>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </Icon>
            <span className="font-medium">Cerrar sesión</span>
          </button>
        </form>
      </aside>
    </>
  );
}
