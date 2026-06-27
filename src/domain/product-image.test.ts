import { describe, it, expect } from "vitest";
import { pickProductImage, imagesForColor, type ImageChoice } from "@/domain/product-image";

const imgs: ImageChoice[] = [
  { url: "default-a.jpg", color: null, sortOrder: 0 },
  { url: "negro-2.jpg", color: "Negro", sortOrder: 1 },
  { url: "negro-1.jpg", color: "Negro", sortOrder: 0 },
];

describe("imagesForColor", () => {
  it("returns the color's own images ordered by sortOrder", () => {
    expect(imagesForColor(imgs, "Negro").map((i) => i.url)).toEqual(["negro-1.jpg", "negro-2.jpg"]);
  });
  it("falls back to the default group when the color has no images", () => {
    expect(imagesForColor(imgs, "Arena").map((i) => i.url)).toEqual(["default-a.jpg"]);
  });
  it("returns the default group (ordered) when color is null", () => {
    const two: ImageChoice[] = [
      { url: "d2.jpg", color: null, sortOrder: 1 },
      { url: "d1.jpg", color: null, sortOrder: 0 },
    ];
    expect(imagesForColor(two, null).map((i) => i.url)).toEqual(["d1.jpg", "d2.jpg"]);
  });
  it("returns [] when there are no images at all", () => {
    expect(imagesForColor([], "Negro")).toEqual([]);
  });
  it("returns [] when the color has no images and there is no default", () => {
    expect(imagesForColor([{ url: "n.jpg", color: "Negro", sortOrder: 0 }], "Arena")).toEqual([]);
  });
});

describe("pickProductImage", () => {
  it("returns the primary (lowest sortOrder) image of the color", () => {
    expect(pickProductImage(imgs, "Negro")).toBe("negro-1.jpg");
  });
  it("falls back to the default primary when the color has no image", () => {
    expect(pickProductImage(imgs, "Arena")).toBe("default-a.jpg");
  });
  it("returns the default primary when color is null (grid)", () => {
    expect(pickProductImage(imgs, null)).toBe("default-a.jpg");
  });
  it("returns null when there are no images", () => {
    expect(pickProductImage([], "Negro")).toBeNull();
  });
  it("falls back to the first image when no default and the color has no image", () => {
    expect(pickProductImage([{ url: "negro.jpg", color: "Negro", sortOrder: 0 }], "Arena")).toBe("negro.jpg");
  });
  it("falls back to the first variant image (by sortOrder) for the grid when there is no default", () => {
    const variantOnly: ImageChoice[] = [
      { url: "negro.jpg", color: "Negro", sortOrder: 1 },
      { url: "blanco.jpg", color: "Blanco", sortOrder: 0 },
    ];
    expect(pickProductImage(variantOnly, null)).toBe("blanco.jpg");
  });
  it("still prefers the default over a variant image for the grid", () => {
    expect(pickProductImage(imgs, null)).toBe("default-a.jpg");
  });
});
