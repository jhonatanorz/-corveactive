"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart/CartContext";
import { availableByColor, type AvailVariant } from "@/domain/availability";
import { pickProductImage, type ImageChoice } from "@/domain/product-image";
import { formatMXN } from "@/domain/money";
import { Button, Eyebrow } from "@/components/ui";

interface VariantLite extends AvailVariant { id: string }

type Props = {
  productId: string;
  productName: string;
  price: number;
  line: string;
  description: string;
  variants: VariantLite[];
  images: ImageChoice[];
};

export default function ProductDetailClient({ productId, productName, price, line, description, variants, images }: Props) {
  const router = useRouter();
  const { add } = useCart();
  const colors = availableByColor(variants);
  const [color, setColor] = useState(colors[0]?.color ?? "");
  const [size, setSize] = useState("");

  const sizes = colors.find((c) => c.color === color)?.sizes ?? [];
  const chosen = variants.find((v) => v.color === color && v.size === size);
  const heroUrl = pickProductImage(images, color || null);

  return (
    <main>
      <div className="relative h-72 bg-mist">
        {heroUrl && <Image src={heroUrl} alt={productName} fill sizes="100vw" className="object-cover" />}
      </div>
      <div className="p-4">
        <h1 className="text-2xl font-semibold text-ink">{productName}</h1>
        <div className="text-ink-2 mb-2">{formatMXN(price)} · CORVE {line}</div>
        {description && <p className="italic text-sm text-ink-2">{description}</p>}
      </div>
      <div className="p-4 space-y-3">
        <Eyebrow>Color</Eyebrow>
        <div className="flex gap-2">
          {colors.map((c) => (
            <button key={c.color} onClick={() => { setColor(c.color); setSize(""); }}
              className={`px-3 py-1 rounded-pill border text-sm transition ${c.color === color ? "bg-periwinkle-2 text-royal border-transparent" : "border-line-strong text-ink"}`}>
              {c.color}
            </button>
          ))}
        </div>
        <Eyebrow>Talla</Eyebrow>
        <div className="flex gap-2">
          {sizes.map((s) => (
            <button key={s.size} disabled={!s.inStock} onClick={() => setSize(s.size)}
              className={`px-3 py-1 rounded-pill border text-sm transition ${s.size === size ? "bg-periwinkle-2 text-royal border-transparent" : "border-line-strong text-ink"} ${!s.inStock ? "opacity-30 line-through" : ""}`}>
              {s.size}
            </button>
          ))}
        </div>
        <Button variant="primary" disabled={!chosen} className="w-full"
          onClick={() => {
            if (!chosen) return;
            add({ variantId: chosen.id, productId, productName, color, size, unitPrice: price, qty: 1 });
            router.push("/carrito");
          }}>
          Agregar · {formatMXN(price)}
        </Button>
      </div>
    </main>
  );
}
