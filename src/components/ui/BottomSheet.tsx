// src/components/ui/BottomSheet.tsx
"use client";

import { useEffect } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
};

/** Bottom sheet: dimmed backdrop + slide-up panel. Always mounted so it can animate;
 *  the backdrop ignores pointer events while closed. Esc closes. */
export function BottomSheet({ open, onClose, title, children }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <div
        className={`fixed inset-0 z-50 bg-ink/30 backdrop-blur-sm transition-opacity duration-200 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-label={title}
        className={`fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-2xl border-t border-line bg-white transition-transform duration-200 ease-out ${open ? "translate-y-0" : "translate-y-full"}`}
      >
        <div className="flex items-center justify-between border-b border-line p-4">
          <span className="font-display text-lg font-bold text-ink">{title}</span>
          <button type="button" aria-label="Cerrar" onClick={onClose} className="text-ink-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto p-4">{children}</div>
      </div>
    </>
  );
}
