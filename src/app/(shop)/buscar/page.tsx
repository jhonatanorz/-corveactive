import { searchCatalog } from "@/lib/repos/catalog";
import { listActiveLines } from "@/lib/repos/lines";
import SearchResults from "../SearchResults";

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
    <SearchResults
      key={query}
      query={query}
      items={items}
      lines={lines.map((l) => ({ slug: l.slug, name: l.name }))}
    />
  );
}
