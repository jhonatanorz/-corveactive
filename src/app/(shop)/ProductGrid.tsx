// src/app/(shop)/ProductGrid.tsx
import ProductCard from "./ProductCard";
import { productColors } from "@/domain/product-colors";
import type { CatalogItem } from "@/lib/repos/catalog";

export default function ProductGrid({ items }: { items: CatalogItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
      {items.map((p) => (
        <ProductCard key={p.id} id={p.id} name={p.name} price={p.price}
          images={p.images} colors={productColors(p.colors, p.images)} />
      ))}
      {items.length === 0 && <p className="text-sm text-ink-3">Sin resultados.</p>}
    </div>
  );
}
