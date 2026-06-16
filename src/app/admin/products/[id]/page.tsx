import { notFound } from "next/navigation";
import { getProduct, listImages } from "@/lib/repos/products";
import { saveProduct, addVariant, correctVariant, uploadImage, deleteImage } from "./actions";
import ProductForm from "./ProductForm";

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
  return (
    <div>
      <ProductForm product={existing?.product ?? null} action={action} />
      {id !== "new" && (
        <section className="max-w-md px-6 pb-8 text-sm">
          <div className="flex gap-3 mb-3 flex-wrap">
            {images.map((img) => (
              <div key={img.id} className="text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt="" className="h-20 w-16 object-cover rounded" />
                <div className="text-[10px] text-[#6b5d50]">{img.color ?? "Default"}</div>
                <form action={deleteImage.bind(null, id)}>
                  <input type="hidden" name="imageId" value={img.id} />
                  <button className="text-[10px] text-red-600">eliminar</button>
                </form>
              </div>
            ))}
          </div>
          <form action={uploadImage.bind(null, id)} className="mb-4 flex gap-2 items-center">
            <input type="file" name="image" accept="image/*" className="text-xs" />
            <select name="color" className="text-xs rounded border border-[#d8cdc0] p-1">
              <option value="">Default (todas)</option>
              {colors.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <button className="rounded bg-[#211d1a] text-white px-3 py-1 text-xs">Subir foto</button>
          </form>
          <h2 className="font-semibold mb-2">Variantes (color × talla)</h2>
          <ul className="space-y-1">
            {variants.map((v) => (
              <li key={v.id} className="flex items-center gap-2">
                <span className="flex-1">{v.color} · {v.size}</span>
                <span className="text-[#6b5d50]">stock {v.stock}</span>
                <form action={correctVariant.bind(null, id)} className="flex gap-1">
                  <input type="hidden" name="variantId" value={v.id} />
                  <input name="target" type="number" min="0" defaultValue={v.stock}
                    className="w-16 rounded border border-[#d8cdc0] p-1" />
                  <input name="reason" placeholder="motivo" className="w-24 rounded border border-[#d8cdc0] p-1" />
                  <button className="rounded bg-[#211d1a] text-white px-2">Corregir</button>
                </form>
              </li>
            ))}
            {variants.length === 0 && <li className="text-[#9a8b7d]">Sin variantes aún.</li>}
          </ul>
          <form action={addVariant.bind(null, id)} className="mt-3 flex gap-2 items-end flex-wrap">
            <input name="color" placeholder="Color" className="w-24 rounded border border-[#d8cdc0] p-1" />
            <input name="color_hex" type="color" defaultValue="#000000" className="h-8 w-10" />
            <input name="size" placeholder="Talla" className="w-16 rounded border border-[#d8cdc0] p-1" />
            <input name="stock" type="number" min="0" defaultValue="0" className="w-16 rounded border border-[#d8cdc0] p-1" />
            <button className="rounded bg-[#211d1a] text-white px-3 py-1">+ Variante</button>
          </form>
        </section>
      )}
    </div>
  );
}
