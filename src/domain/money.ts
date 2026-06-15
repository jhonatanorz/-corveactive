/** Money in this app is an integer number of centavos (1 peso = 100 centavos). */
export type Centavos = number;

/** Convert whole pesos to centavos. */
export function pesos(whole: number): Centavos {
  return Math.round(whole * 100);
}

const mxn = new Intl.NumberFormat("es-MX", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Format centavos as "$1,040.00" (no currency code; caller appends " MXN" if desired). */
export function formatMXN(centavos: Centavos): string {
  return "$" + mxn.format(centavos / 100);
}

/**
 * Parse a user-entered peso amount ("690", "690.50", "$1,040.00") into centavos.
 * Returns null for empty, non-numeric, or negative input. More than two decimals
 * are rounded to the nearest centavo.
 */
export function parsePesosInput(input: string): Centavos | null {
  const cleaned = input.trim().replace(/[$,\s]/g, "");
  if (cleaned === "") return null;
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  const centavos = Number(whole) * 100 + Number((frac + "00").slice(0, 2));
  const thirdDecimal = frac.charCodeAt(2) - 48; // digit at index 2, or NaN if absent
  return thirdDecimal >= 5 ? centavos + 1 : centavos;
}
