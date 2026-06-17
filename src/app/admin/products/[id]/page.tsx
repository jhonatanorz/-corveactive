import { notFound } from "next/navigation";
import { getProduct, listImages } from "@/lib/repos/products";
import { listVariantLots } from "@/lib/repos/inventory";
import { currentCost } from "@/domain/inventory";
import { calcMargin } from "@/domain/margin";
import { formatMXN } from "@/domain/money";
import { saveProduct, addVariant, correctVariant, uploadImage, deleteImage } from "./actions";
import ProductForm from "./ProductForm";
import { Button, Eyebrow, inputClass } from "@/components/ui";

export default async function ProductEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const existing = id === "new" ? null : await getProduct(id);
  if (id !== "new" && !existing) notFound();
  const images = id === "new" ? [] : await listImages(id);

  const action = saveProduct.bind(null, id);
  const variants = existing?.variants ?? [];
  const colors = [...new Set(variants.map((v) => v.color))];
  const lots = id === "new" ? {} : await listVariantLots(id);
  const price = existing?.product.price ?? 0;
  return (
    <div>
      <ProductForm product={existing?.product ?? null} action={action} />
      {id !== "new" && (
        <section className="max-w-md px-6 pb-8 text-sm">
          {/* Images */}
          <div className="flex gap-3 mb-3 flex-wrap">
            {images.map((img) => (
              <div key={img.id} className="text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt="" className="h-20 w-16 object-cover rounded" />
                <div className="text-[10px] text-ink-2">{img.color ?? "Default"}</div>
                <form action={deleteImage.bind(null, id)}>
                  <input type="hidden" name="imageId" value={img.id} />
                  <button className="text-[10px] text-red-600">eliminar</button>
                </form>
              </div>
            ))}
          </div>

          {/* Upload form */}
          <form action={uploadImage.bind(null, id)} className="mb-4 flex flex-wrap gap-2 items-center">
            <input type="file" name="image" accept="image/*" className="text-xs" />
            <select name="color" className={inputClass + " !w-auto text-xs py-1 px-2"}>
              <option value="">Default (todas)</option>
              {colors.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <Button type="submit" variant="primary" size="sm">Subir foto</Button>
          </form>

          {/* Variants */}
          <Eyebrow className="mb-2">Variantes (color × talla)</Eyebrow>
          <ul className="space-y-1">
            {variants.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-2">
                <span className="flex-1 text-ink">{v.color} · {v.size}</span>
                <span className="text-ink-2">stock {v.stock}</span>
                {(() => {
                  const cc = currentCost(lots[v.id] ?? []);
                  if (cc === null) return <span className="text-ink-3">sin costo</span>;
                  const m = calcMargin(price, cc);
                  return <span className="text-ink-3">costo {formatMXN(cc)} · margen {m.pct}%</span>;
                })()}
                <form action={correctVariant.bind(null, id)} className="flex gap-1">
                  <input type="hidden" name="variantId" value={v.id} />
                  <input name="target" type="number" min="0" defaultValue={v.stock}
                    className="w-16 rounded-sm border border-line bg-white p-1 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-royal/40" />
                  <input name="reason" placeholder="motivo"
                    className="w-24 rounded-sm border border-line bg-white p-1 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-royal/40" />
                  <input name="cost" type="text" inputMode="decimal" placeholder="costo (si sube)"
                    className="w-24 rounded-sm border border-line bg-white p-1 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-royal/40" />
                  <Button type="submit" variant="ghost" size="sm">Corregir</Button>
                </form>
              </li>
            ))}
            {variants.length === 0 && <li className="text-ink-3">Sin variantes aún.</li>}
          </ul>

          {/* Add variant form */}
          <form action={addVariant.bind(null, id)} className="mt-3 flex gap-2 items-end flex-wrap">
            <input name="color" placeholder="Color"
              className="w-24 rounded-sm border border-line bg-white p-1 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-royal/40" />
            <input name="color_hex" type="color" defaultValue="#000000" className="h-8 w-10" />
            <input name="size" placeholder="Talla"
              className="w-16 rounded-sm border border-line bg-white p-1 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-royal/40" />
            <input name="stock" type="number" min="0" defaultValue="0"
              className="w-16 rounded-sm border border-line bg-white p-1 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-royal/40" />
            <Button type="submit" variant="ghost" size="sm">+ Variante</Button>
          </form>
        </section>
      )}
    </div>
  );
}
