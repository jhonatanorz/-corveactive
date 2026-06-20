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
        Sube un archivo CSV con columnas: <code>name, line, category, price, color, size, description</code>.
        Cada fila es una variante; las filas con el mismo <code>name</code> se agrupan en un producto.
      </p>
      <ImportClient />
    </div>
  );
}
