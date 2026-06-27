import { describe, it, expect } from "vitest";
import { productColors } from "@/domain/product-colors";
import type { ImageChoice } from "@/domain/product-image";

const imgs: ImageChoice[] = [
  { url: "default.jpg", color: null, sortOrder: 0 },
  { url: "negro.jpg", color: "Negro", sortOrder: 1 },
];

describe("productColors", () => {
  it("dedupes by color, preserves first-seen order, takes hex from first occurrence", () => {
    const r = productColors(
      [{ color: "Negro", color_hex: "#111" }, { color: "Arena", color_hex: "#caa" }, { color: "Negro", color_hex: "#999" }],
      imgs,
    );
    expect(r.map((c) => c.color)).toEqual(["Negro", "Arena"]);
    expect(r[0].hex).toBe("#111");
  });
  it("resolves each color's image, falling back to the default", () => {
    const r = productColors([{ color: "Negro", color_hex: "#111" }, { color: "Arena", color_hex: "#caa" }], imgs);
    expect(r.find((c) => c.color === "Negro")!.url).toBe("negro.jpg");
    expect(r.find((c) => c.color === "Arena")!.url).toBe("default.jpg");
  });
  it("url is null when the color has no image and there is no default", () => {
    const r = productColors([{ color: "Arena", color_hex: "#caa" }], [{ url: "negro.jpg", color: "Negro", sortOrder: 0 }]);
    expect(r[0].url).toBeNull();
  });
  it("returns [] for no variants", () => {
    expect(productColors([], imgs)).toEqual([]);
  });
});
