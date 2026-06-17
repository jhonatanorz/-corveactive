"use client";

import Link from "next/link";
import { useState } from "react";
import { formatMXN } from "@/domain/money";
import { pickProductImage, type ImageChoice } from "@/domain/product-image";
import type { ColorOption } from "@/domain/product-colors";
import { Card, FadeImage } from "@/components/ui";

type Props = {
  id: string;
  name: string;
  price: number;
  images: ImageChoice[];
  colors: ColorOption[];
};

export default function ProductCard({ id, name, price, images, colors }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const url = pickProductImage(images, selected);

  return (
    <div>
      <Link href={`/producto/${id}`} className="block">
        <Card className="relative h-44 overflow-hidden bg-mist">
          <FadeImage src={url} alt={name} sizes="50vw" />
        </Card>
      </Link>
      {colors.length > 0 && (
        <div className="flex gap-1.5 mt-2">
          {colors.map((c) => (
            <button
              key={c.color}
              type="button"
              aria-label={c.color}
              onClick={() => setSelected((s) => (s === c.color ? null : c.color))}
              className={`w-4 h-4 rounded-pill border border-line transition ${selected === c.color ? "ring-2 ring-royal ring-offset-1" : ""}`}
              style={{ background: c.hex }}
            />
          ))}
        </div>
      )}
      <Link href={`/producto/${id}`} className="block">
        <div className="text-sm mt-2 text-ink">{name}</div>
        <div className="text-sm text-ink-2">{formatMXN(price)}</div>
      </Link>
    </div>
  );
}
