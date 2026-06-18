// src/app/admin/lines/[id]/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { validateLineInput } from "@/lib/admin/line-input";
import { createLine, updateLine } from "@/lib/repos/lines";
import { setFlash, withFlash } from "@/lib/flash";

export async function saveLine(
  id: string,
  _prev: unknown,
  formData: FormData,
): Promise<{ errors: Record<string, string> } | void> {
  const raw = Object.fromEntries(
    ["name", "slug", "hero_title", "hero_message", "sort_order", "active"].map((k) => [
      k, String(formData.get(k) ?? ""),
    ]),
  );
  const result = validateLineInput(raw);
  if (!result.ok) return { errors: result.errors };

  if (id === "new") {
    await createLine(result.value);
    await setFlash("Línea creada");
    redirect("/admin/lines");
  } else {
    await withFlash("Línea guardada", () => updateLine(id, result.value));
    revalidatePath("/admin/lines");
    revalidatePath("/");
    redirect("/admin/lines");
  }
}
