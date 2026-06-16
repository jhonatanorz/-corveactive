import { listSuppliers } from "@/lib/repos/suppliers";
import { addSupplier } from "./actions";

export default async function ProveedoresPage() {
  const suppliers = await listSuppliers();
  return (
    <div className="p-6 max-w-lg text-sm">
      <h1 className="text-lg font-bold mb-4">Proveedores</h1>
      <ul className="mb-4">
        {suppliers.map((s) => (
          <li key={s.id} className="flex justify-between border-b border-[#f3efe9] py-1">
            <span>{s.name}</span><span className="opacity-60">{s.contact}</span>
          </li>
        ))}
        {suppliers.length === 0 && <li className="text-[#9a8b7d]">Sin proveedores aún.</li>}
      </ul>
      <form action={addSupplier} className="flex gap-2">
        <input name="name" placeholder="Nombre" className="flex-1 rounded border border-[#d8cdc0] p-2" />
        <input name="contact" placeholder="Contacto" className="flex-1 rounded border border-[#d8cdc0] p-2" />
        <button className="rounded bg-[#211d1a] text-white px-3">Agregar</button>
      </form>
    </div>
  );
}
