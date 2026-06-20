"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { previewImport, commitImport, type PreviewState } from "./actions";

export default function ImportClient() {
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<PreviewState>(undefined);
  const [pending, startTransition] = useTransition();

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
      <div className="flex items-center gap-3">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setState(undefined);
          }}
          className="text-ink-2"
        />
        <Button type="button" variant="ghost" size="md" disabled={pending || !file}
          onClick={() => run(previewImport)}>
          {pending ? "Validando…" : "Previsualizar"}
        </Button>
      </div>

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
