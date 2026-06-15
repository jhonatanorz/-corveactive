import type { Line, ProductStatus, MovementType } from "@/domain/types";

export interface ProductRow {
  id: string;
  name: string;
  line: Line;
  type: string;
  description: string;
  price: number; // centavos
  cost: number; // centavos
  status: ProductStatus;
  created_at: string;
  updated_at: string;
}

export interface VariantRow {
  id: string;
  product_id: string;
  color: string;
  color_hex: string;
  size: string;
  stock: number;
  sku: string | null;
}

export interface ProductImageRow {
  id: string;
  product_id: string;
  url: string;
  sort_order: number;
}

export interface StockMovementRow {
  id: string;
  variant_id: string;
  delta: number;
  type: MovementType;
  reference: string | null;
  reason: string | null;
  created_at: string;
}
