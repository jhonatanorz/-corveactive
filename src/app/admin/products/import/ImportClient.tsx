"use client";

import { useState, useTransition, type DragEvent } from "react";
import { Button } from "@/components/ui";
import { previewImport, commitImport, type PreviewState } from "./actions";

export default function ImportClient() {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [state, setState] = useState<PreviewState>(undefined);
  const [pending, startTransition] = useTransition();

  // Choosing/dropping a new file clears any prior preview/confirm result.
  function chooseFile(f: File | null) {
    setFile(f);
    setState(undefined);
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragging(false);
    chooseFile(e.dataTransfer.files?.[0] ?? null);
  }

  function run(action: typeof previewImport) {
    if (!file) {
      setState({ fileError: "Selecciona un archivo CSV." });
      return;
    }
    const fd = new FormData();
    fd.set("file", file);
    startTransition(async () => {
      const next = await action(undefined, fd);
      if (next) setState(next); // commit success redirects and never returns
    });
  }

  const fileError = state && "fileError" in state ? state.fileError : null;
  const result = state && "ok" in state ? state : null;

  return (
    <div className="space-y-4 text-sm">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition ${
          dragging
            ? "border-royal bg-periwinkle-2/40"
            : "border-line bg-mist/30 hover:border-royal/60 hover:bg-mist/50"
        }`}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-royal">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <span className="text-sm font-medium text-ink">
          {file ? file.name : "Arrastra tu CSV o haz clic para elegir"}
        </span>
        <span className="text-xs text-ink-3">Archivo .csv</span>
        <input
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => chooseFile(e.target.files?.[0] ?? null)}
        />
      </label>

      <Button type="button" variant="ghost" size="md" disabled={pending || !file}
        onClick={() => run(previewImport)}>
        {pending ? "Validando…" : "Previsualizar"}
      </Button>

      {fileError && <p className="text-red-600">{fileError}</p>}

      {result && (
        <div className="space-y-3">
          <p className="text-ink">
            {result.counts.products} producto(s) y {result.counts.variants} variante(s) se crearán.
          </p>

          {!result.ok && (
            <div className="rounded border border-red-200 bg-red-50 p-3">
              <p className="font-medium text-red-700">
                {result.errors.length} error(es) &mdash; corrige el archivo y vuelve a subirlo:
              </p>
              <ul className="mt-2 space-y-1">
                {result.errors.map((e, i) => (
                  <li key={i} className="text-red-700">
                    Fila {e.row}
                    {e.field ? ` · ${e.field}` : ""}: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.ok && (
            <Button type="button" variant="primary" size="md" disabled={pending}
              onClick={() => run(commitImport)}>
              {pending ? "Importando…" : "Confirmar importación"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
