// src/app/(shop)/buscar/page.tsx
import { searchCatalog } from "@/lib/repos/catalog";
import { listActiveLines } from "@/lib/repos/lines";
import ProductBrowser from "../ProductBrowser";

export default async function BuscarPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const [items, lines] = await Promise.all([
    query ? searchCatalog(query) : Promise.resolve([]),
    listActiveLines(),
  ]);
  return (
    <main className="min-w-0">
      <h1 className="px-4 pt-4 text-lg text-ink">Resultados para &ldquo;{query}&rdquo;</h1>
      <ProductBrowser
        items={items}
        facets={["line", "color"]}
        lineOptions={lines.map((l) => ({ slug: l.slug, name: l.name }))}
      />
    </main>
  );
}
