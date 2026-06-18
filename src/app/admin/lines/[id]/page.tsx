// src/app/admin/lines/[id]/page.tsx
import { notFound } from "next/navigation";
import { getLine } from "@/lib/repos/lines";
import { saveLine } from "./actions";
import LineForm from "../LineForm";

export default async function LineEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = id === "new" ? null : await getLine(id);
  if (id !== "new" && !existing) notFound();
  return (
    <div className="p-6">
      <LineForm line={existing} action={saveLine.bind(null, id)} />
    </div>
  );
}
