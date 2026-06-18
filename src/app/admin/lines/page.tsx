// src/app/admin/lines/page.tsx
import Link from "next/link";
import { listLines } from "@/lib/repos/lines";
import { buttonClass, PageHeader, Table, THead, Th, Td, Tr, LinkRow, ChevronCell, Pill } from "@/components/ui";

export default async function LinesPage() {
  const lines = await listLines();
  return (
    <div className="p-6">
      <PageHeader title="Líneas">
        <Link href="/admin/lines/new" className={buttonClass("primary", "sm")}>+ Nueva línea</Link>
      </PageHeader>
      <Table>
        <THead>
          <Th>Nombre</Th>
          <Th>Slug</Th>
          <Th>Orden</Th>
          <Th>Estado</Th>
          <Th className="w-8" />
        </THead>
        <tbody>
          {lines.map((l) => (
            <LinkRow key={l.id} href={`/admin/lines/${l.id}`}>
              <Td className="font-medium">{l.name}</Td>
              <Td className="text-ink-2">{l.slug}</Td>
              <Td className="text-ink-2">{l.sort_order}</Td>
              <Td><Pill tone={l.active ? "success" : "muted"}>{l.active ? "Activa" : "Oculta"}</Pill></Td>
              <ChevronCell />
            </LinkRow>
          ))}
          {lines.length === 0 && (
            <Tr><Td colSpan={5} className="py-8 text-center text-ink-3">Aún no hay líneas.</Td></Tr>
          )}
        </tbody>
      </Table>
    </div>
  );
}
