import { parseAmount, toMinor } from "./money";
import { normalizeVendorName } from "./normalize";

/** Shared by the browser (preview) and the server (authoritative validation), so both always agree. */

export const VENDOR_IMPORT_MAX_ROWS = 2000;
export const VENDOR_IMPORT_MAX_BYTES = 1024 * 1024;

export interface VendorImportRow {
  line: number;
  name: string;
  normalizedName: string;
  approved: boolean;
  registeredBankAccountLast4: string | null;
  typicalAmountMinMinor: number | null;
  typicalAmountMaxMinor: number | null;
  currency: string;
  taxId: string | null;
}

export interface VendorImportIssue {
  line: number;
  name: string | null;
  errors: string[];
}

export interface VendorImportParse {
  rows: VendorImportRow[];
  issues: VendorImportIssue[];
  /** Header problems that make the whole file unusable. */
  fatal: string | null;
  totalLines: number;
}

/** RFC 4180-style CSV: quoted fields, escaped quotes, CRLF, BOM. Comma or semicolon delimiter (auto-detected). */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.slice(0, src.search(/\r?\n|$/));
  const delim = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === "") quoted = true;
    else if (c === delim) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

const HEADER_ALIASES: Record<keyof Omit<VendorImportRow, "line" | "normalizedName">, string[]> = {
  name: ["name", "vendor", "vendor name", "vendor_name", "legal name", "supplier", "supplier name", "company"],
  approved: ["approved", "status", "is approved", "approved vendor"],
  registeredBankAccountLast4: ["bank account", "bank_account", "account", "account number", "account_number", "iban", "bank account last4", "bank_account_last4", "account last4", "account_last4", "last4"],
  typicalAmountMinMinor: ["min amount", "min_amount", "minimum", "typical min", "typical_min", "typical minimum", "min"],
  typicalAmountMaxMinor: ["max amount", "max_amount", "maximum", "typical max", "typical_max", "typical maximum", "max"],
  currency: ["currency", "ccy"],
  taxId: ["tax id", "tax_id", "ntn", "vat", "vat number", "tax number", "strn"],
};

const norm = (h: string) => h.trim().toLowerCase().replace(/[\s_-]+/g, " ");

function parseApproved(v: string): boolean | null {
  const s = v.trim().toLowerCase();
  if (s === "") return true;
  if (["yes", "y", "true", "1", "approved", "active"].includes(s)) return true;
  if (["no", "n", "false", "0", "unapproved", "not approved", "pending", "inactive", "suspended"].includes(s)) return false;
  return null;
}

export function parseVendorCsv(text: string): VendorImportParse {
  if (text.length > VENDOR_IMPORT_MAX_BYTES) return { rows: [], issues: [], fatal: "The file is larger than 1 MB.", totalLines: 0 };
  const table = parseCsv(text);
  if (table.length < 2) return { rows: [], issues: [], fatal: "The file needs a header row and at least one vendor.", totalLines: Math.max(0, table.length - 1) };

  const headers = table[0].map(norm);
  const col: Partial<Record<keyof typeof HEADER_ALIASES, number>> = {};
  for (const [key, aliases] of Object.entries(HEADER_ALIASES) as [keyof typeof HEADER_ALIASES, string[]][]) {
    const idx = headers.findIndex((h) => aliases.map(norm).includes(h));
    if (idx >= 0) col[key] = idx;
  }
  if (col.name === undefined) return { rows: [], issues: [], fatal: 'No vendor name column found. Add a header named "name".', totalLines: table.length - 1 };
  const body = table.slice(1);
  if (body.length > VENDOR_IMPORT_MAX_ROWS) return { rows: [], issues: [], fatal: `The file has ${body.length} rows; the limit is ${VENDOR_IMPORT_MAX_ROWS}.`, totalLines: body.length };

  const rows: VendorImportRow[] = [];
  const issues: VendorImportIssue[] = [];
  const seen = new Map<string, number>();
  body.forEach((cells, i) => {
    const line = i + 2; // 1-based, after the header
    const get = (k: keyof typeof HEADER_ALIASES) => (col[k] !== undefined ? (cells[col[k]!] ?? "").trim() : "");
    const errors: string[] = [];

    const name = get("name").replace(/\s+/g, " ");
    if (name.length < 2) errors.push("Vendor name is missing");
    else if (name.length > 160) errors.push("Vendor name is longer than 160 characters");
    const normalizedName = normalizeVendorName(name);
    if (normalizedName && seen.has(normalizedName)) errors.push(`Duplicate of line ${seen.get(normalizedName)}`);

    const approved = parseApproved(get("approved"));
    if (approved === null) errors.push(`Approved must be yes or no (got "${get("approved")}")`);

    // Accept a full account number or IBAN, but keep only the last four digits.
    const acct = get("registeredBankAccountLast4").replace(/\D/g, "");
    if (get("registeredBankAccountLast4") && acct.length < 4) errors.push("Bank account needs at least 4 digits");

    const currency = (get("currency") || "PKR").toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) errors.push(`Currency must be a 3-letter code (got "${get("currency")}")`);

    const amount = (k: "typicalAmountMinMinor" | "typicalAmountMaxMinor", label: string) => {
      const raw = get(k);
      if (!raw) return null;
      const n = parseAmount(raw);
      if (n == null || n < 0) {
        errors.push(`${label} is not a valid amount (got "${raw}")`);
        return null;
      }
      return toMinor(n, currency);
    };
    const min = amount("typicalAmountMinMinor", "Minimum");
    const max = amount("typicalAmountMaxMinor", "Maximum");
    if (min != null && max != null && min > max) errors.push("Minimum is above maximum");

    const taxId = get("taxId").slice(0, 40) || null;

    if (errors.length) {
      issues.push({ line, name: name || null, errors });
      return;
    }
    seen.set(normalizedName, line);
    rows.push({
      line,
      name,
      normalizedName,
      approved: approved ?? true,
      registeredBankAccountLast4: acct.length >= 4 ? acct.slice(-4) : null,
      typicalAmountMinMinor: min,
      typicalAmountMaxMinor: max,
      currency,
      taxId,
    });
  });
  return { rows, issues, fatal: null, totalLines: body.length };
}
