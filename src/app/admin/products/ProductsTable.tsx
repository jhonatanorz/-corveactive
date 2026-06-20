"use client";

import { useMemo, useState } from "react";
import { Table, THead, Th, Td, Tr, LinkRow, ChevronCell, Pill, type PillTone, inputClass, Thumb } from "@/components/ui";
import { formatMXN } from "@/domain/money";
import { matchesProductFilters } from "@/domain/product-filter";
import type { ProductStatus } from "@/domain/types";

export type ProductTableRow = {
  id: string;
  name: string;
  lineSlug: string;
  categorySlug: string;
  categoryName: string;
  price: number;
  status: ProductStatus;
  imageUrl: string | null;
};

export type Option = { value: string; label: string };

const STATUS_TONE: Record<ProductStatus, PillTone> = {
  active: "success",
  draft: "neutral",
  hidden: "muted",
};

const selectClass = `${inputClass} w-44`;

export default function ProductsTable({
  rows,
  lineOptions,
  categoryOptions,
}: {
  rows: ProductTableRow[];
  lineOptions: Option[];
  categoryOptions: Option[];
}) {
  const [query, setQuery] = useState("");
  const [lineSlug, setLineSlug] = useState("");
  const [categorySlug, setCategorySlug] = useState("");
  const [status, setStatus] = useState("");

  const filtered = useMemo(
    () => rows.filter((r) => matchesProductFilters(r, { query, lineSlug, categorySlug, status })),
    [rows, query, lineSlug, categorySlug, status],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar producto…"
          aria-label="Buscar producto"
          className={`${inputClass} w-64`}
        />
        <select value={lineSlug} onChange={(e) => setLineSlug(e.target.value)} aria-label="Línea" className={selectClass}>
          <option value="">Todas las líneas</option>
          {lineOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select value={categorySlug} onChange={(e) => setCategorySlug(e.target.value)} aria-label="Categoría" className={selectClass}>
          <option value="">Todas las categorías</option>
          {categoryOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Estado" className={selectClass}>
          <option value="">Todos los estados</option>
          <option value="active">active</option>
          <option value="draft">draft</option>
          <option value="hidden">hidden</option>
        </select>
      </div>

      <Table>
        <THead>
          <Th className="w-12" />
          <Th>Nombre</Th>
          <Th>Línea</Th>
          <Th>Categoría</Th>
          <Th>Precio</Th>
          <Th>Estado</Th>
          <Th className="w-8" />
        </THead>
        <tbody>
          {filtered.map((p) => (
            <LinkRow key={p.id} href={`/admin/products/${p.id}`}>
              <Td><Thumb src={p.imageUrl} alt={p.name} className="h-9 w-7" /></Td>
              <Td className="font-medium">{p.name}</Td>
              <Td className="text-ink-2">{p.lineSlug}</Td>
              <Td className="text-ink-2">{p.categoryName}</Td>
              <Td>{formatMXN(p.price)}</Td>
              <Td><Pill tone={STATUS_TONE[p.status]}>{p.status}</Pill></Td>
              <ChevronCell />
            </LinkRow>
          ))}
          {filtered.length === 0 && (
            <Tr>
              <Td colSpan={7} className="py-8 text-center text-ink-3">
                {rows.length === 0 ? "Aún no hay productos." : "Sin resultados."}
              </Td>
            </Tr>
          )}
        </tbody>
      </Table>
    </div>
  );
}
