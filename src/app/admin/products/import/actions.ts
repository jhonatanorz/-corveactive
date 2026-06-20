"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { validateImport, type ValidateResult, type ImportLookups } from "@/lib/admin/product-csv";
import { importProducts } from "@/lib/repos/products";
import { setFlash, friendlyError } from "@/lib/flash";

export type PreviewState = ValidateResult | { fileError: string } | undefined;

async function loadLookups(): Promise<ImportLookups> {
  const supabase = await createClient();
  const [lines, categories, products] = await Promise.all([
    supabase.from("product_lines").select("id,slug,name"),
    supabase.from("product_categories").select("id,slug,name"),
    supabase.from("products").select("name,line_id,category_id").is("deleted_at", null),
  ]);
  const err = lines.error ?? categories.error ?? products.error;
  if (err) throw err;
  return {
    lines: (lines.data ?? []) as ImportLookups["lines"],
    categories: (categories.data ?? []) as ImportLookups["categories"],
    existingProducts: (products.data ?? []) as ImportLookups["existingProducts"],
  };
}

async function readCsv(formData: FormData): Promise<{ text: string } | { fileError: string }> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { fileError: "Selecciona un archivo CSV." };
  }
  return { text: await file.text() };
}

/** Dry run: validate the file and return a summary + errors. Writes nothing. */
export async function previewImport(_prev: unknown, formData: FormData): Promise<PreviewState> {
  const read = await readCsv(formData);
  if ("fileError" in read) return read;
  const lookups = await loadLookups();
  return validateImport(read.text, lookups);
}

/** Re-validate the same file on the server, then commit via the atomic RPC. */
export async function commitImport(_prev: unknown, formData: FormData): Promise<PreviewState> {
  const read = await readCsv(formData);
  if ("fileError" in read) return read;
  const lookups = await loadLookups();
  const result = validateImport(read.text, lookups);
  if (!result.ok) return result; // still has errors — refuse to write

  try {
    const n = await importProducts(result.plan);
    await setFlash(`${n} productos importados`);
  } catch (e) {
    await setFlash(friendlyError(e), "error");
    return result;
  }

  revalidatePath("/admin/products");
  revalidatePath("/");
  redirect("/admin/products");
}
