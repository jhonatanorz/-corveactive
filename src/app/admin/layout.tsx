import Link from "next/link";
import { Wordmark } from "@/components/ui";
import { signOut } from "./login/actions";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-snow text-ink">
      <aside className="w-44 bg-mist text-ink-2 p-4 text-sm flex flex-col border-r border-line">
        <Wordmark href="/admin/pedidos" className="text-xl pb-4" />
        <nav className="space-y-1 flex-1">
          <Link href="/admin/pedidos" className="block py-2 hover:text-royal">Pedidos</Link>
          <Link href="/admin/products" className="block py-2 hover:text-royal">Productos</Link>
          <Link href="/admin/inventory" className="block py-2 hover:text-royal">Inventario</Link>
          <Link href="/admin/compras" className="block py-2 hover:text-royal">Compras</Link>
          <Link href="/admin/ventas" className="block py-2 hover:text-royal">Ventas</Link>
          <Link href="/admin/proveedores" className="block py-2 hover:text-royal">Proveedores</Link>
        </nav>
        <form action={signOut}>
          <button className="text-left py-2 text-ink-3 hover:text-royal">Cerrar sesión</button>
        </form>
      </aside>
      <main className="flex-1">{children}</main>
    </div>
  );
}
