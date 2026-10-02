import { parseAmount, toMinor } from "./money";
import type { InvoiceFields } from "./types";

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

const pad = (n: number) => String(n).padStart(2, "0");

function valid(y: number, m: number, d: number): string | null {
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCMonth() === m - 1 ? `${y}-${pad(m)}-${pad(d)}` : null;
}

/** Parse the common invoice date formats into YYYY-MM-DD. Day-first is assumed for numeric dates. */
export function parseDate(raw: string): string | null {
  const s = raw.trim();
  let m = s.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = s.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (m) return valid(+m[3], +m[2], +m[1]);
  m = s.match(/(\d{1,2})(?:st|nd|rd|th)?[\s-]+([A-Za-z]{3,9})\.?,?[\s-]+(\d{4})/);
  if (m) return valid(+m[3], MONTHS[m[2].slice(0, 4).toLowerCase()] ?? MONTHS[m[2].slice(0, 3).toLowerCase()] ?? 0, +m[1]);
  m = s.match(/([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/);
  if (m) return valid(+m[3], MONTHS[m[1].slice(0, 4).toLowerCase()] ?? MONTHS[m[1].slice(0, 3).toLowerCase()] ?? 0, +m[2]);
  return null;
}

function detectCurrency(text: string): string | null {
  const code = text.match(/\b(PKR|USD|EUR|GBP|AED|SAR|INR|CAD|AUD)\b/);
  if (code) return code[1];
  if (/\bRs\.?\s*\d|\bRupees\b/i.test(text)) return "PKR";
  if (/\$\s*\d/.test(text)) return "USD";
  if (/€\s*\d/.test(text)) return "EUR";
  if (/£\s*\d/.test(text)) return "GBP";
  return null;
}

const AMOUNT = String.raw`(?:[A-Z]{3}|Rs\.?|[$€£])?\s*(-?[\d][\d.,]*)`;

function amountAfter(text: string, label: RegExp): number | null {
  const re = new RegExp(label.source + String.raw`[^\S\n]*[:\-]?[^\S\n]*` + AMOUNT, "gi");
  let last: number | null = null;
  for (const m of text.matchAll(re)) {
    const v = parseAmount(m[m.length - 1]);
    if (v != null) last = v;
  }
  return last;
}

export interface HeuristicResult {
  fields: InvoiceFields;
  uncertainFields: (keyof InvoiceFields)[];
}

/** Rule-based fallback extractor. Deterministic and offline; used when no model is available. */
export function heuristicExtract(rawText: string): HeuristicResult {
  const text = rawText.replace(/\r/g, "").replace(/[ \t]+/g, " ");
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const currency = detectCurrency(text);

  // Vendor
  let vendorName: string | null = null;
  const labelled = text.match(/(?:^|\n)\s*(?:vendor|supplier|bill(?:ed)?\s*from|from|issued\s*by)\s*[:\-]\s*([^\n]+)/i);
  if (labelled) vendorName = labelled[1].trim();
  if (!vendorName) {
    vendorName =
      lines.find((l) => l.length > 2 && l.length < 80 && !/^(tax\s+)?invoice\b/i.test(l) && !/^\d/.test(l) && !/:/.test(l)) ?? null;
  }
  if (vendorName) vendorName = vendorName.replace(/\s{2,}.*$/, "").trim();

  // Invoice number
  let invoiceNumber: string | null = null;
  const numMatch = text.match(/invoice\s*(?:no\.?|number|num\.?|#|id)\s*[:#\-]?\s*([A-Z0-9][A-Z0-9\-/_.]{2,})/i);
  if (numMatch) invoiceNumber = numMatch[1].replace(/[.,;]+$/, "");

  // Date
  let invoiceDate: string | null = null;
  const dateLabel = text.match(/(?:invoice\s*date|date\s*of\s*issue|issue\s*date|date)\s*[:\-]?\s*([^\n]{6,30})/i);
  if (dateLabel) invoiceDate = parseDate(dateLabel[1]);
  if (!invoiceDate) invoiceDate = parseDate(text);

  // Amounts
  const subtotal = amountAfter(text, /sub\s*-?\s*total/);
  const tax = amountAfter(text, /(?:sales\s*tax|gst|vat|tax)(?:[^\S\n]*\(?[\d.]+%\)?)?/);
  const totalLabelled =
    amountAfter(text, /(?:grand\s*total|total\s*(?:amount\s*)?due|amount\s*due|total\s*payable|invoice\s*total)/) ??
    amountAfter(text, /(?<!sub\s?)(?<!sub-)\btotal/);
  const total = totalLabelled;

  // Payment account — only the last four digits are retained
  let paymentAccountLast4: string | null = null;
  const acct = text.match(/(?:account(?:\s*(?:no|number|#))?|a\/c|acct|iban)[^\n\d]{0,12}([A-Z0-9*•Xx\- ]{4,34})/i);
  if (acct) {
    const digits = acct[1].replace(/\D/g, "");
    if (digits.length >= 4) paymentAccountLast4 = digits.slice(-4);
  }

  const fields: InvoiceFields = {
    vendorName,
    invoiceNumber,
    invoiceDate,
    currency,
    subtotalMinor: subtotal != null ? toMinor(subtotal, currency) : null,
    taxMinor: tax != null ? toMinor(tax, currency) : null,
    totalMinor: total != null ? toMinor(total, currency) : null,
    paymentAccountLast4,
  };
  const uncertainFields = (Object.keys(fields) as (keyof InvoiceFields)[]).filter((k) => fields[k] == null);
  return { fields, uncertainFields };
}
