import Link from "next/link";
import { listProducts } from "@/lib/repos/products";
import { formatMXN } from "@/domain/money";
import type { ProductStatus } from "@/domain/types";
import { buttonClass, PageHeader, Table, THead, Th, Td, Tr, LinkRow, ChevronCell, Pill, type PillTone } from "@/components/ui";

const STATUS_TONE: Record<ProductStatus, PillTone> = {
  active: "success",
  draft: "neutral",
  hidden: "muted",
};

export default async function ProductsPage() {
  const products = await listProducts();
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
      <Table>
        <THead>
          <Th>Nombre</Th>
          <Th>Línea</Th>
          <Th>Precio</Th>
          <Th>Estado</Th>
          <Th className="w-8" />
        </THead>
        <tbody>
          {products.map((p) => (
            <LinkRow key={p.id} href={`/admin/products/${p.id}`}>
              <Td className="font-medium">{p.name}</Td>
              <Td className="text-ink-2">{p.lineSlug}</Td>
              <Td>{formatMXN(p.price)}</Td>
              <Td><Pill tone={STATUS_TONE[p.status]}>{p.status}</Pill></Td>
              <ChevronCell />
            </LinkRow>
          ))}
          {products.length === 0 && (
            <Tr><Td colSpan={5} className="py-8 text-center text-ink-3">Aún no hay productos.</Td></Tr>
          )}
        </tbody>
      </Table>
    </div>
  );
}
