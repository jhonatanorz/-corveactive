import { describe, it, expect } from "vitest";
import { pickProductImage, type ImageChoice } from "@/domain/product-image";

const imgs: ImageChoice[] = [
  { url: "default.jpg", color: null },
  { url: "negro.jpg", color: "Negro" },
];

describe("pickProductImage", () => {
  it("returns the image matching the selected color", () => {
    expect(pickProductImage(imgs, "Negro")).toBe("negro.jpg");
  });
  it("falls back to the default when the color has no image", () => {
    expect(pickProductImage(imgs, "Arena")).toBe("default.jpg");
  });
  it("returns the default when color is null (grid)", () => {
    expect(pickProductImage(imgs, null)).toBe("default.jpg");
  });
  it("returns null when there are no images", () => {
    expect(pickProductImage([], "Negro")).toBeNull();
  });
  it("returns null when no default and the color has no image", () => {
    expect(pickProductImage([{ url: "negro.jpg", color: "Negro" }], "Arena")).toBeNull();
  });
  it("prefers the color image over the default", () => {
    expect(pickProductImage(imgs, "Negro")).toBe("negro.jpg");
  });
});
