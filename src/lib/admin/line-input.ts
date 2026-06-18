// src/lib/admin/line-input.ts
import { slugify } from "@/domain/slugify";

export interface LinePayload {
  slug: string;
  name: string;
  hero_title: string;
  hero_message: string;
  sort_order: number;
  active: boolean;
}

export type LineValidation =
  | { ok: true; value: LinePayload }
  | { ok: false; errors: Record<string, string> };

export function validateLineInput(raw: Record<string, string>): LineValidation {
  const errors: Record<string, string> = {};
  const name = (raw.name ?? "").trim();
  if (name === "") errors.name = "El nombre es obligatorio";

  const slug = slugify((raw.slug ?? "").trim() || name);
  if (slug === "") errors.slug = "El slug es obligatorio";

  const sort_order = Number.parseInt(raw.sort_order ?? "0", 10);
  if (Number.isNaN(sort_order)) errors.sort_order = "Orden inválido";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      slug,
      name,
      hero_title: (raw.hero_title ?? "").trim(),
      hero_message: (raw.hero_message ?? "").trim(),
      sort_order,
      active: raw.active === "on" || raw.active === "true",
    },
  };
}
