// src/app/(shop)/linea/[slug]/page.tsx
import { notFound } from "next/navigation";
import { getActiveLineBySlug } from "@/lib/repos/lines";
import { listCategories } from "@/lib/repos/categories";
import { listActiveCatalogByLine } from "@/lib/repos/catalog";
import ProductBrowser from "../../ProductBrowser";
import LineHero from "../../LineHero";

export default async function LinePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const line = await getActiveLineBySlug(slug);
  if (!line) notFound();

  const [categories, items] = await Promise.all([
    listCategories(),
    listActiveCatalogByLine(line.id),
  ]);

  const heroLine = { slug: line.slug, name: line.name, hero_title: line.hero_title, hero_message: line.hero_message };

  return (
    <>
      <LineHero line={heroLine} />
      <main className="min-w-0">
        <ProductBrowser
          items={items}
          facets={["category", "color"]}
          categoryOptions={categories.map((c) => ({ slug: c.slug, name: c.name }))}
        />
      </main>
    </>
  );
}
