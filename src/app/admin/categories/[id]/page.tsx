// src/app/admin/categories/[id]/page.tsx
import { notFound } from "next/navigation";
import { getCategory } from "@/lib/repos/categories";
import { saveCategory } from "./actions";
import CategoryForm from "../CategoryForm";

export default async function CategoryEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = id === "new" ? null : await getCategory(id);
  if (id !== "new" && !existing) notFound();
  return (
    <div className="p-6">
      <CategoryForm category={existing} action={saveCategory.bind(null, id)} />
    </div>
  );
}
