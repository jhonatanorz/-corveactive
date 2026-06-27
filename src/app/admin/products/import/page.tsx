import Link from "next/link";
import { buttonClass, PageHeader } from "@/components/ui";
import ImportClient from "./ImportClient";

export default function ImportProductsPage() {
  return (
    <div className="p-6 space-y-4">
      <PageHeader title="Importar productos (CSV)">
        <Link href="/admin/products" className={buttonClass("ghost", "sm")}>
          ← Productos
        </Link>
      </PageHeader>
      <p className="text-sm text-ink-2">
        Sube un archivo CSV. Columnas requeridas:{" "}
        <code>name, line, category, price, color, size</code>. Opcional: <code>description</code>.
      </p>
      <p className="text-sm text-ink-2">
        Cada fila es una variante (color + talla). Las filas se agrupan en un mismo producto
        cuando coinciden <strong>name + line + category</strong>; un mismo <code>name</code> en
        otra línea o categoría es un producto distinto. <code>price</code> y{" "}
        <code>description</code> deben ser iguales en todas las filas de un mismo producto.
        Se rechazan variantes (color/talla) duplicadas y productos que ya existen.
      </p>
      <ImportClient />
    </div>
  );
}
