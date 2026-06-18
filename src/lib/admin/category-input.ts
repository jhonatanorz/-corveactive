// src/lib/admin/category-input.ts
import { slugify } from "@/domain/slugify";

export interface CategoryPayload {
  slug: string;
  name: string;
  sort_order: number;
}

export type CategoryValidation =
  | { ok: true; value: CategoryPayload }
  | { ok: false; errors: Record<string, string> };

export function validateCategoryInput(raw: Record<string, string>): CategoryValidation {
  const errors: Record<string, string> = {};
  const name = (raw.name ?? "").trim();
  if (name === "") errors.name = "El nombre es obligatorio";

  const slug = slugify((raw.slug ?? "").trim() || name);
  if (slug === "") errors.slug = "El slug es obligatorio";

  const sort_order = Number.parseInt(raw.sort_order ?? "0", 10);
  if (Number.isNaN(sort_order)) errors.sort_order = "Orden inválido";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { slug, name, sort_order } };
}
