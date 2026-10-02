import { describe, expect, it } from "vitest";
import { parseCsv, parseVendorCsv } from "./vendor-import";

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, CRLF and BOM", () => {
    expect(parseCsv('﻿name,note\r\n"Apex, Ltd.","say ""hi"""\r\n')).toEqual([
      ["name", "note"],
      ["Apex, Ltd.", 'say "hi"'],
    ]);
  });
  it("detects semicolon-delimited files", () => {
    expect(parseCsv("name;currency\nApex;PKR")).toEqual([
      ["name", "currency"],
      ["Apex", "PKR"],
    ]);
  });
});

describe("parseVendorCsv", () => {
  it("maps aliased headers and keeps only the last four account digits", () => {
    const r = parseVendorCsv("Vendor Name,IBAN,Min Amount,Max Amount,Approved\nApex Supplies Ltd.,PK36 SCBL 0000 0011 2345 4421,\"100,000\",900000,yes");
    expect(r.fatal).toBeNull();
    expect(r.rows[0]).toMatchObject({ name: "Apex Supplies Ltd.", registeredBankAccountLast4: "4421", typicalAmountMinMinor: 100_000_00, typicalAmountMaxMinor: 900_000_00, approved: true, currency: "PKR" });
  });
  it("reports row errors with line numbers and skips duplicates", () => {
    const r = parseVendorCsv("name,approved,min,max,bank account\nApex,maybe,,,\n,yes,,,\nNorthgate,no,500,100,\nApex Ltd,yes,,,12\nCrescent,yes,,,7783");
    expect(r.rows.map((x) => x.name)).toEqual(["Crescent"]);
    expect(r.issues.map((i) => i.line)).toEqual([2, 3, 4, 5]);
    expect(r.issues[0].errors[0]).toMatch(/Approved/);
    expect(r.issues[2].errors).toContain("Minimum is above maximum");
    expect(r.issues[3].errors).toContain("Bank account needs at least 4 digits");
  });
  it("flags a second row for the same vendor as a duplicate", () => {
    const r = parseVendorCsv("name\nApex Supplies Ltd.\nAPEX SUPPLIES LIMITED");
    expect(r.rows).toHaveLength(1);
    expect(r.issues[0].errors[0]).toBe("Duplicate of line 2");
  });
  it("rejects files without a name column", () => {
    expect(parseVendorCsv("company_code,amount\nX,1").fatal).toMatch(/name/);
  });
});
