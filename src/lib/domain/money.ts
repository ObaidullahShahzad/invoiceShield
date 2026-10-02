const EXPONENTS: Record<string, number> = { JPY: 0, KRW: 0, KWD: 3, BHD: 3, OMR: 3 };

export const DEFAULT_CURRENCY = "PKR";

export function currencyExponent(currency: string | null | undefined): number {
  return EXPONENTS[(currency ?? DEFAULT_CURRENCY).toUpperCase()] ?? 2;
}

/** Convert a decimal amount in major units (e.g. 485000.5) to integer minor units. */
export function toMinor(major: number, currency: string | null | undefined): number {
  return Math.round(major * 10 ** currencyExponent(currency));
}

export function toMajor(minor: number, currency: string | null | undefined): number {
  return minor / 10 ** currencyExponent(currency);
}

export function formatMoney(
  minor: number | null | undefined,
  currency: string | null | undefined,
  opts: { compact?: boolean } = {},
): string {
  if (minor == null) return "—";
  const code = (currency ?? DEFAULT_CURRENCY).toUpperCase();
  const exp = currencyExponent(code);
  try {
    return new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency: code,
      currencyDisplay: code === "PKR" ? "code" : "symbol",
      notation: opts.compact ? "compact" : "standard",
      minimumFractionDigits: opts.compact ? 0 : Math.min(exp, 2),
      maximumFractionDigits: opts.compact ? 1 : exp,
    })
      .format(toMajor(minor, code))
      .replace(/ /g, " ");
  } catch {
    return `${code} ${toMajor(minor, code).toFixed(exp)}`;
  }
}

/** Parse a human amount string such as "PKR 485,000.00" or "1.234,50". Returns major units or null. */
export function parseAmount(raw: string | null | undefined): number | null {
  if (!raw) return null;
  let s = raw.replace(/[^\d.,-]/g, "");
  if (!/\d/.test(s)) return null;
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    // The later separator is the decimal separator.
    s = lastDot > lastComma ? s.replace(/,/g, "") : s.replace(/\./g, "").replace(",", ".");
  } else if (lastComma >= 0) {
    // "1,234" (thousands) vs "12,50" (decimal)
    s = /,\d{2}$/.test(s) && (s.match(/,/g) ?? []).length === 1 ? s.replace(",", ".") : s.replace(/,/g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
