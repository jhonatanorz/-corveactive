"use client";

import { useState } from "react";
import type { ProductImageRow } from "@/lib/db-types";
import { reorderImages, deleteImage } from "./actions";

type Group = { color: string | null; label: string; images: ProductImageRow[] };

function groupByColor(images: ProductImageRow[]): Group[] {
  const map = new Map<string | null, ProductImageRow[]>();
  for (const img of images) {
    const arr = map.get(img.color) ?? [];
    arr.push(img);
    map.set(img.color, arr);
  }
  const groups: Group[] = [];
  for (const [color, imgs] of map) {
    groups.push({
      color,
      label: color ?? "Default",
      images: [...imgs].sort((a, b) => a.sort_order - b.sort_order),
    });
  }
  // named colors first (alphabetical), Default group last
  groups.sort((a, b) => {
    if (a.color === null) return 1;
    if (b.color === null) return -1;
    return a.color.localeCompare(b.color);
  });
  return groups;
}

export default function ImageGallery({
  productId,
  images,
}: {
  productId: string;
  images: ProductImageRow[];
}) {
  const [groups, setGroups] = useState<Group[]>(() => groupByColor(images));
  const [drag, setDrag] = useState<{ color: string | null; index: number } | null>(null);

  function moveWithinGroup(color: string | null, from: number, to: number) {
    const g = groups.find((x) => x.color === color);
    if (!g || from === to) return;
    const imgs = [...g.images];
    const [moved] = imgs.splice(from, 1);
    imgs.splice(to, 0, moved);
    setGroups((gs) => gs.map((x) => (x.color === color ? { ...x, images: imgs } : x)));
    void reorderImages(productId, color, imgs.map((i) => i.id));
  }

  if (images.length === 0) return null;

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.label} className="space-y-1.5">
          <div className="text-[11px] font-medium text-ink-2">{g.label}</div>
          <div className="flex flex-wrap gap-3">
            {g.images.map((img, index) => (
              <div
                key={img.id}
                draggable
                onDragStart={() => setDrag({ color: g.color, index })}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (drag && drag.color === g.color) moveWithinGroup(g.color, drag.index, index);
                  setDrag(null);
                }}
                className="w-16 cursor-grab text-center active:cursor-grabbing"
              >
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt="" className="h-20 w-16 rounded object-cover" />
                  {index === 0 && (
                    <span className="absolute left-0 top-0 rounded-br rounded-tl bg-royal px-1 text-[9px] font-medium text-white">
                      Principal
                    </span>
                  )}
                </div>
                <form action={deleteImage.bind(null, productId)}>
                  <input type="hidden" name="imageId" value={img.id} />
                  <button className="text-[10px] text-red-600">eliminar</button>
                </form>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
