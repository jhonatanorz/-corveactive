// src/app/(shop)/SortSheet.tsx
"use client";

import { BottomSheet } from "@/components/ui";
import type { SortKey } from "@/domain/catalog-sort";

const OPTIONS: { value: SortKey; label: string }[] = [
  { value: "default", label: "Predeterminado" },
  { value: "price_asc", label: "Precio: menor a mayor" },
  { value: "price_desc", label: "Precio: mayor a menor" },
];

type Props = { open: boolean; onClose: () => void; value: SortKey; onChange: (v: SortKey) => void };

export default function SortSheet({ open, onClose, value, onChange }: Props) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Ordenar">
      <ul className="space-y-1">
        {OPTIONS.map((o) => {
          const on = o.value === value;
          return (
            <li key={o.value}>
              <button type="button" onClick={() => { onChange(o.value); onClose(); }} aria-pressed={on}
                className={`flex w-full items-center justify-between rounded-md px-3 py-3 text-left text-sm transition ${on ? "bg-mist text-ink" : "text-ink-2 hover:bg-mist hover:text-ink"}`}>
                {o.label}
                {on && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </BottomSheet>
  );
}
