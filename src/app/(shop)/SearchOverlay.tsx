// src/app/(shop)/SearchOverlay.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { formatMXN } from "@/domain/money";

type Suggestion = { id: string; name: string; price: number; thumbnailUrl: string | null };

export default function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const seqRef = useRef(0);

  // focus on open; reset on close
  useEffect(() => {
    if (open) inputRef.current?.focus();
    /* eslint-disable react-hooks/set-state-in-effect -- reset overlay state synchronously on close */
    else { setQ(""); setItems([]); setLoading(false); }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open]);

  // debounced, cancelable fetch
  useEffect(() => {
    const term = q.trim();
    /* eslint-disable react-hooks/set-state-in-effect -- synchronously reset/initialize loading state before debounce timer */
    if (term === "") { setItems([]); setLoading(false); return; }
    setLoading(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    const t = setTimeout(() => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      const seq = ++seqRef.current;
      fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ac.signal })
        .then((r) => r.json())
        .then((d) => { if (seq === seqRef.current) setItems(d.items ?? []); })
        .catch((e) => { if ((e as Error).name !== "AbortError" && seq === seqRef.current) setItems([]); })
        .finally(() => { if (seq === seqRef.current) setLoading(false); });
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  // Esc closes
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function goAll() {
    const term = q.trim();
    if (term) { router.push(`/buscar?q=${encodeURIComponent(term)}`); onClose(); }
  }
  function onSubmit(e: React.FormEvent) { e.preventDefault(); goAll(); }
  function pick(id: string) { router.push(`/producto/${id}`); onClose(); }

  return (
    <div className="fixed inset-0 z-50 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-full max-w-2xl flex-col p-4">
        <form onSubmit={onSubmit} className="flex items-center gap-2">
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar productos…" aria-label="Buscar productos"
            className="w-full rounded-pill border border-line bg-white px-4 py-3 text-base text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-royal/40" />
          <button type="button" onClick={onClose} aria-label="Cerrar búsqueda" className="shrink-0 text-ink-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </form>

        <div className="mt-4 flex-1 overflow-y-auto">
          {q.trim() !== "" && !loading && items.length === 0 && (
            <p className="text-sm text-ink-3">Sin resultados.</p>
          )}
          <ul className="space-y-1">
            {items.map((it) => (
              <li key={it.id}>
                <button type="button" onClick={() => pick(it.id)}
                  className="flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-mist">
                  <span className="relative h-14 w-12 shrink-0 overflow-hidden rounded bg-mist">
                    {it.thumbnailUrl && <Image src={it.thumbnailUrl} alt={it.name} fill sizes="48px" className="object-cover" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink">{it.name}</span>
                    <span className="block text-sm text-ink-2">{formatMXN(it.price)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {q.trim() !== "" && (
            <button type="button" onClick={goAll} className="mt-3 text-sm text-royal hover:underline">
              Ver todos los resultados →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
