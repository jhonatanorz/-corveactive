// src/app/(shop)/linea/[slug]/page.tsx
import { notFound } from "next/navigation";
import { getActiveLineBySlug, listActiveLines } from "@/lib/repos/lines";
import { listCategories } from "@/lib/repos/categories";
import { listActiveCatalogByLine } from "@/lib/repos/catalog";
import CatalogBrowser from "../../CatalogBrowser";
import LineHero from "../../LineHero";

export default async function LinePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const line = await getActiveLineBySlug(slug);
  if (!line) notFound();

  const [lines, categories, items] = await Promise.all([
    listActiveLines(),
    listCategories(),
    listActiveCatalogByLine(line.id),
  ]);

  const heroLine = { slug: line.slug, hero_title: line.hero_title, hero_message: line.hero_message };

  return (
    <>
      <LineHero line={heroLine} />
      <CatalogBrowser
        items={items}
        lines={lines.map((l) => ({ slug: l.slug, hero_title: l.hero_title, hero_message: l.hero_message }))}
        categories={categories.map((c) => ({ slug: c.slug, name: c.name }))}
        showSections={false}
      />
    </>
  );
}
