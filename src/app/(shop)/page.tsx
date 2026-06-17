import { listActiveByLine } from "@/lib/repos/catalog";
import { productColors } from "@/domain/product-colors";
import { Eyebrow, Blob } from "@/components/ui";
import ProductCard from "./ProductCard";
import type { Line } from "@/domain/types";

const LINES: { line: Line; title: string; message: string }[] = [
  { line: "MOVE", title: "Muévete desde el amor", message: "Confianza en cada movimiento" },
  { line: "HIM", title: "Una rutina que respeta tu ritmo", message: "Confianza en cada movimiento" },
];

export default async function CatalogPage() {
  const sections = await Promise.all(
    LINES.map(async (l) => ({ ...l, products: await listActiveByLine(l.line) })),
  );
  return (
    <main>
      {sections.map((s) => (
        <section key={s.line} className="mb-10">
          <div className="relative h-[60vh] flex flex-col justify-end p-6 overflow-hidden bg-royal text-ink-on-royal">
            <Blob fill="periwinkle" className="absolute -top-16 -right-10 w-72 h-72 opacity-80" />
            <div className="relative">
              <Eyebrow className="text-periwinkle-2 mb-2">CORVE {s.line}</Eyebrow>
              <h2 className="font-display text-5xl leading-none text-lime">{s.title}</h2>
              <p className="italic opacity-80 mt-2">{s.message}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4 p-4">
            {s.products.map((p) => {
              const imgs = p.product_images.map((i) => ({ url: i.url, color: i.color }));
              return (
                <ProductCard
                  key={p.id}
                  id={p.id}
                  name={p.name}
                  price={p.price}
                  images={imgs}
                  colors={productColors(p.variants, imgs)}
                />
              );
            })}
            {s.products.length === 0 && <p className="text-ink-3 text-sm">Pronto.</p>}
          </div>
        </section>
      ))}
    </main>
  );
}
