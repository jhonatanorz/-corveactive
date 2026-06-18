// src/app/(shop)/LineHero.tsx
import { Eyebrow, Blob } from "@/components/ui";
import type { BrowserLine } from "./CatalogBrowser";

export default function LineHero({ line }: { line: BrowserLine }) {
  return (
    <div className="relative h-[42vh] flex flex-col justify-end p-6 overflow-hidden bg-royal text-ink-on-royal">
      <Blob fill="periwinkle" className="absolute -top-16 -right-10 w-72 h-72 opacity-80" />
      <div className="relative">
        <Eyebrow className="text-periwinkle-2 mb-2">CORVE {line.slug}</Eyebrow>
        <h2 className="font-display font-bold text-5xl leading-none text-lime">{line.hero_title}</h2>
        <p className="italic opacity-80 mt-2">{line.hero_message}</p>
      </div>
    </div>
  );
}
