// src/app/admin/categories/page.tsx
import Link from "next/link";
import { listCategories } from "@/lib/repos/categories";
import { buttonClass, PageHeader, Table, THead, Th, Td, Tr, LinkRow, ChevronCell } from "@/components/ui";

export default async function CategoriesPage() {
  const categories = await listCategories();
  return (
    <div className="p-6">
      <PageHeader title="Categorías">
        <Link href="/admin/categories/new" className={buttonClass("primary", "sm")}>+ Nueva categoría</Link>
      </PageHeader>
      <Table>
        <THead>
          <Th>Nombre</Th>
          <Th>Slug</Th>
          <Th>Orden</Th>
          <Th className="w-8" />
        </THead>
        <tbody>
          {categories.map((c) => (
            <LinkRow key={c.id} href={`/admin/categories/${c.id}`}>
              <Td className="font-medium">{c.name}</Td>
              <Td className="text-ink-2">{c.slug}</Td>
              <Td className="text-ink-2">{c.sort_order}</Td>
              <ChevronCell />
            </LinkRow>
          ))}
          {categories.length === 0 && (
            <Tr><Td colSpan={4} className="py-8 text-center text-ink-3">Aún no hay categorías.</Td></Tr>
          )}
        </tbody>
      </Table>
    </div>
  );
}
