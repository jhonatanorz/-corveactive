import { describe, it, expect } from "vitest";
import { validateProductInput } from "@/lib/admin/product-input";

const valid = {
  name: "Legging Aurora",
  line_id: "some-line-uuid",
  category_id: "some-category-uuid",
  description: "Te abraza sin apretar.",
  price: "690",
  status: "active",
};

describe("validateProductInput", () => {
  it("accepts valid input and converts money to centavos", () => {
    const r = validateProductInput(valid);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toEqual({
        name: "Legging Aurora",
        line_id: "some-line-uuid",
        category_id: "some-category-uuid",
        description: "Te abraza sin apretar.",
        price: 69000,
        status: "active",
      });
    }
  });

  it("trims the name and rejects when empty", () => {
    const r = validateProductInput({ ...valid, name: "   " });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.name).toBeDefined();
  });

  it("rejects when line_id is empty", () => {
    const r = validateProductInput({ ...valid, line_id: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.line_id).toBeDefined();
  });

  it("rejects when category_id is empty", () => {
    const r = validateProductInput({ ...valid, category_id: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.category_id).toBeDefined();
  });

  it("rejects an invalid status", () => {
    const r = validateProductInput({ ...valid, status: "live" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.status).toBeDefined();
  });

  it("rejects an unparseable price", () => {
    const r = validateProductInput({ ...valid, price: "abc" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.price).toBeDefined();
  });
});
