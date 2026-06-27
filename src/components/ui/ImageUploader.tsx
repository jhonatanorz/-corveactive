"use client";

import { useRef, useState, type DragEvent } from "react";
import { Button, inputClass } from "@/components/ui";

/** Drag-and-drop (or click) image picker that submits through a bound server action.
 *  Shows a preview + filename and a clear drop target instead of a bare file input. */
export function ImageUploader({
  action,
  colors,
  multiple = false,
}: {
  action: (formData: FormData) => void | Promise<void>;
  colors: string[];
  multiple?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  function setFiles(files: FileList | File[] | null) {
    const list = files ? Array.from(files) : [];
    setFileName(
      list.length === 0
        ? null
        : list.length === 1
          ? list[0].name
          : `${list.length} imágenes seleccionadas`,
    );
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return list[0] ? URL.createObjectURL(list[0]) : null;
    });
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files ?? []);
    if (dropped.length > 0 && inputRef.current) {
      const dt = new DataTransfer();
      for (const f of dropped) dt.items.add(f);
      inputRef.current.files = dt.files;
      setFiles(dropped);
    }
  }

  return (
    <form action={action} className="space-y-3">
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
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="h-24 w-20 rounded-md object-cover shadow-sm" />
        ) : (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-royal">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        )}
        <span className="text-sm font-medium text-ink">
          {fileName ?? "Arrastra una imagen o haz clic para elegir"}
        </span>
        <span className="text-xs text-ink-3">PNG o JPG</span>
        <input
          ref={inputRef}
          type="file"
          name="image"
          accept="image/*"
          multiple={multiple}
          className="hidden"
          onChange={(e) => setFiles(e.target.files)}
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <select name="color" className={inputClass + " !w-auto py-1.5 text-xs"}>
          <option value="">Default (todas)</option>
          {colors.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <Button type="submit" variant="primary" size="sm" disabled={!fileName}>
          Subir foto
        </Button>
      </div>
    </form>
  );
}
