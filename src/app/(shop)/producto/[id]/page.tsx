import { notFound } from "next/navigation";
import { getActiveProduct } from "@/lib/repos/catalog";
import { productColors } from "@/domain/product-colors";
import ProductDetailClient from "./ProductDetailClient";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getActiveProduct(id);
  if (!detail) notFound();
  const { product, variants } = detail;
  const images = product.product_images.map((i) => ({ url: i.url, color: i.color }));

  return (
    <ProductDetailClient
      productId={product.id}
      productName={product.name}
      price={product.price}
      line={product.line}
      description={product.description}
      variants={variants.map((v) => ({ id: v.id, color: v.color, size: v.size, stock: v.stock }))}
      images={images}
      colors={productColors(variants, images)}
    />
  );
}
