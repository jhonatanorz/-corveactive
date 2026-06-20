import Link from "next/link";
import { listProducts, imagesByProducts } from "@/lib/repos/products";
import { listLines } from "@/lib/repos/lines";
import { listCategories } from "@/lib/repos/categories";
import { pickProductImage } from "@/domain/product-image";
import { buttonClass, PageHeader } from "@/components/ui";
import ProductsTable, { type ProductTableRow } from "./ProductsTable";

export default async function ProductsPage() {
  const products = await listProducts();
  const [imgByProduct, lines, categories] = await Promise.all([
    imagesByProducts(products.map((p) => p.id)),
    listLines(),
    listCategories(),
  ]);

  const rows: ProductTableRow[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    lineSlug: p.lineSlug,
    categorySlug: p.categorySlug,
    categoryName: p.categoryName,
    price: p.price,
    status: p.status,
    imageUrl: pickProductImage(imgByProduct[p.id] ?? [], null),
  }));

  const lineOptions = lines.map((l) => ({ value: l.slug, label: l.name }));
  const categoryOptions = categories.map((c) => ({ value: c.slug, label: c.name }));

  return (
    <div className="p-6">
      <PageHeader title="Productos">
        <Link href="/admin/products/import" className={buttonClass("soft", "sm")}>
          Importar CSV
        </Link>
        <Link href="/admin/products/new" className={buttonClass("primary", "sm")}>
          + Nuevo producto
        </Link>
      </PageHeader>
      <ProductsTable rows={rows} lineOptions={lineOptions} categoryOptions={categoryOptions} />
    </div>
  );
}
