// src/app/(shop)/page.tsx
import { listActiveLines } from "@/lib/repos/lines";
import { listCategories } from "@/lib/repos/categories";
import { listActiveCatalog } from "@/lib/repos/catalog";
import CatalogBrowser from "./CatalogBrowser";

export default async function CatalogPage() {
  const [lines, categories, items] = await Promise.all([
    listActiveLines(),
    listCategories(),
    listActiveCatalog(),
  ]);
  return (
    <CatalogBrowser
      items={items}
      lines={lines.map((l) => ({ slug: l.slug, hero_title: l.hero_title, hero_message: l.hero_message }))}
      categories={categories.map((c) => ({ slug: c.slug, name: c.name }))}
      showSections
    />
  );
}
