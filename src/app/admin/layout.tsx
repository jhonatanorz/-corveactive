import Link from "next/link";
import { signOut } from "./login/actions";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-[#fbf8f4] text-[#211d1a]">
      <aside className="w-44 bg-[#211d1a] text-[#d9cfc3] p-4 text-sm flex flex-col">
        <div className="tracking-[0.28em] text-white pb-4">C O R V E</div>
        <nav className="space-y-1 flex-1">
          <Link href="/admin/pedidos" className="block py-2">Pedidos</Link>
          <Link href="/admin/products" className="block py-2">Productos</Link>
          <Link href="/admin/inventory" className="block py-2">Inventario</Link>
        </nav>
        <form action={signOut}>
          <button className="text-left py-2 text-[#a89c8e]">Cerrar sesión</button>
        </form>
      </aside>
      <main className="flex-1">{children}</main>
    </div>
  );
}
