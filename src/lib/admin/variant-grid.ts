export interface GridVariant {
  color: string;
  size: string;
  stock: number;
}

export interface VariantGrid {
  colors: string[];
  sizes: string[];
  cell(color: string, size: string): number | null;
}

const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL"];

/** Build an ordered color×size grid with a per-cell stock lookup. */
export function buildVariantGrid(variants: GridVariant[]): VariantGrid {
  const colors: string[] = [];
  const sizesSeen: string[] = [];
  const stockByKey = new Map<string, number>();

  for (const v of variants) {
    if (!colors.includes(v.color)) colors.push(v.color);
    if (!sizesSeen.includes(v.size)) sizesSeen.push(v.size);
    stockByKey.set(`${v.color}__${v.size}`, v.stock);
  }

  const known = SIZE_ORDER.filter((s) => sizesSeen.includes(s));
  const unknown = sizesSeen.filter((s) => !SIZE_ORDER.includes(s));
  const sizes = [...known, ...unknown];

  return {
    colors,
    sizes,
    cell(color, size) {
      const value = stockByKey.get(`${color}__${size}`);
      return value === undefined ? null : value;
    },
  };
}
