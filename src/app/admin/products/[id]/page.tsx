import { notFound } from "next/navigation";
import { getProduct } from "@/lib/repos/products";
import { saveProduct } from "./actions";
import ProductForm from "./ProductForm";

export default async function ProductEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const existing = id === "new" ? null : await getProduct(id);
  if (id !== "new" && !existing) notFound();

  const action = saveProduct.bind(null, id);
  return <ProductForm product={existing?.product ?? null} action={action} />;
}
