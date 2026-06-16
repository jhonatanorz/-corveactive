export type CorrectionResult =
  | { ok: true; delta: number; newStock: number }
  | { ok: false; reason: "no_change" | "negative_target" | "non_integer" };

/** Compute the signed delta to set `current` stock to an absolute `target` count. */
export function computeCorrection(current: number, target: number): CorrectionResult {
  if (!Number.isInteger(target)) return { ok: false, reason: "non_integer" };
  if (target < 0) return { ok: false, reason: "negative_target" };
  const delta = target - current;
  if (delta === 0) return { ok: false, reason: "no_change" };
  return { ok: true, delta, newStock: target };
}
