import { describe, it, expect } from "vitest";
import { computeCorrection } from "@/lib/admin/correction";

describe("computeCorrection", () => {
  it("computes a positive delta", () => {
    expect(computeCorrection(6, 10)).toEqual({ ok: true, delta: 4, newStock: 10 });
  });
  it("computes a negative delta", () => {
    expect(computeCorrection(6, 2)).toEqual({ ok: true, delta: -4, newStock: 2 });
  });
  it("rejects a no-op (no movement to log)", () => {
    expect(computeCorrection(6, 6)).toEqual({ ok: false, reason: "no_change" });
  });
  it("rejects a negative target", () => {
    expect(computeCorrection(6, -1)).toEqual({ ok: false, reason: "negative_target" });
  });
  it("rejects a non-integer target", () => {
    expect(computeCorrection(6, 2.5)).toEqual({ ok: false, reason: "non_integer" });
  });
});
