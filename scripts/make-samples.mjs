// Generates synthetic sample invoices (fictional vendors, no real data) into public/samples.
// Each sample is designed to trigger a specific set of checks against the seeded demo history — see DEMO.md.
// Layout note: label and value are drawn on the same baseline so the text layer reads "Label: value" for the parser,
// and the vendor name is the first text drawn so it is the first line of the extracted text.
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { writeFile } from "node:fs/promises";

const fmt = (n) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const hex = (h) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);

const BILL_TO = ["Stixor Demo Industries (Pvt) Ltd", "Finance Department, Payables Desk", "14-C, Main Boulevard, Gulberg III", "Lahore 54660, Pakistan"];

const samples = [
  {
    // Story: the baseline. Registered vendor, registered account, normal amount, arithmetic adds up.
    file: "01-legitimate-apex-supplies.pdf",
    vendor: "Apex Supplies Ltd.", color: "#0F6E8C",
    address: ["Plot 14, Sector 12-A, Korangi Industrial Area", "Karachi 74900, Pakistan"],
    contact: "billing@apexsupplies.example  ·  +92 21 3512 8800", ntn: "NTN 4410293-6  ·  STRN 32-77-8761-442-19",
    number: "INV-2026-1042", date: "25 Sep 2026", due: "25 Oct 2026", po: "PO-STX-2291", terms: "Net 30",
    items: [["Ergonomic office chair, mesh back, model EC-400", 30, 9000], ["Electric standing desk, 140 x 70 cm", 6, 25000]],
    bank: "Standard Chartered Bank (Pakistan)", account: "PK36 SCBL 0000 0011 2345 4421",
    note: "Thank you for your business. Goods delivered against GRN-8812 on 23 Sep 2026.",
  },
  {
    // Story: the accidental (or opportunistic) re-send. Same vendor, same number, same total as an invoice already on file.
    file: "02-duplicate-crescent-logistics.pdf",
    vendor: "Crescent Logistics (Pvt) Ltd", color: "#B4531A",
    address: ["Warehouse 7, Port Qasim Road", "Bin Qasim Town, Karachi 75020, Pakistan"],
    contact: "billing@crescentlogistics.example  ·  +92 21 3472 0090", ntn: "NTN 7729104-2  ·  STRN 32-77-9120-031-55",
    number: "INV-2026-0988", date: "02 Oct 2026", due: "01 Nov 2026", po: "PO-STX-2207", terms: "Net 30",
    items: [["Freight Karachi to Lahore, August consignment (40ft FCL)", 1, 185000]],
    bank: "Habib Bank Limited", account: "PK24 HABB 0000 0022 3344 7783",
    note: "Reminder: this invoice remains unpaid. Kindly process at the earliest.",
  },
  {
    // Story: the quiet bank change. Real vendor, but the IBAN is new and the amount is well above the usual range.
    file: "03-account-and-amount-meridian.pdf",
    vendor: "Meridian IT Services", color: "#4338CA",
    address: ["7th Floor, Arfa Software Technology Park", "Ferozepur Road, Lahore 54600, Pakistan"],
    contact: "finance@meridianit.example  ·  +92 42 3588 1200", ntn: "NTN 5510837-4  ·  PRA 3125508",
    number: "MIT-5231", date: "28 Sep 2026", due: "28 Oct 2026", po: "PO-STX-2264", terms: "Net 30",
    items: [["Managed infrastructure services, Q4 2026 (retainer)", 1, 1800000], ["Security audit and remediation", 1, 200000]],
    bank: "Meezan Bank Limited", account: "PK71 MEZN 0000 0099 8877 8810",
    note: "Please note our updated banking details below, effective this billing cycle.",
  },
  {
    // Story: the impostor. One letter off a registered vendor's name, and the total quietly inflated by PKR 20,000.
    file: "04-lookalike-and-arithmetic.pdf",
    vendor: "Apex Suplies Limited", color: "#0E7490",
    address: ["Office 3, Block 5, Clifton", "Karachi 75600, Pakistan"],
    contact: "billing@apex-suplies.example  ·  +92 300 812 4477", ntn: "NTN 9918820-1",
    number: "AS-7731", date: "30 Sep 2026", due: "30 Oct 2026", po: "PO-STX-2290", terms: "Due on receipt",
    items: [["Printer toner cartridge, black, HP 89A compatible", 60, 1500], ["A4 copier paper, 80 gsm, ream of 500", 600, 100]],
    bank: "United Bank Limited", account: "PK55 UNIL 0000 0044 5566 3090", totalOverride: 195500,
    note: "Urgent: kindly release payment today to avoid supply interruption.",
  },
  {
    // Story: the perfect storm. A previously paid invoice number replayed with new bank details and a tripled amount.
    file: "05-replayed-invoice-summit.pdf",
    vendor: "Summit Facility Management", color: "#15803D",
    address: ["Suite 402, Business Centre, Shahrah-e-Faisal", "Karachi 75350, Pakistan"],
    contact: "summitfm.billing@mail.example  ·  +92 331 220 9184", ntn: "NTN 3317705-9  ·  STRN 32-77-6610-552-08",
    number: "SFM-0933", date: "01 Oct 2026", due: "03 Oct 2026", po: "PO-STX-2150", terms: "Due in 2 days",
    items: [["Integrated facility management, Q3 2026", 1, 980000], ["Emergency HVAC overhaul, Floors 2-5", 1, 260000]],
    bank: "Bank Alfalah Limited", account: "PK18 ALFH 0000 0077 1029 6620",
    notice: "IMPORTANT: Our banking details have changed. Remit only to the new bank details below.",
    note: "Our previous bank relationship is closed. Payments sent there will be returned.",
  },
];

for (const s of samples) {
  const doc = await PDFDocument.create();
  doc.setTitle(`${s.vendor} — Invoice ${s.number}`);
  doc.setAuthor(s.vendor);
  doc.setSubject("Synthetic sample invoice for the InvoiceShield demo (fictional)");
  doc.setCreator("InvoiceShield sample generator");
  const page = doc.addPage([595, 842]);
  const { width: W } = page.getSize();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const brand = hex(s.color);
  const ink = hex("#111827");
  const muted = hex("#6B7280");
  const line = hex("#E5E7EB");
  const tint = rgb(0.97, 0.98, 0.99);
  const L = 48;
  const R = W - 48;

  const t = (str, x, y, o = {}) => page.drawText(str, { x, y, size: o.size ?? 9.5, font: o.font ?? font, color: o.color ?? ink });
  const tr = (str, x, y, o = {}) => t(str, x - (o.font ?? font).widthOfTextAtSize(str, o.size ?? 9.5), y, o);
  const rule = (y, x1 = L, x2 = R, c = line, th = 0.8) => page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: th, color: c });

  // Header — vendor name first in the content stream (the parser reads it as the vendor).
  t(s.vendor, L + 52, 774, { size: 17, font: bold });
  page.drawRectangle({ x: 0, y: 826, width: W, height: 16, color: brand });
  page.drawRectangle({ x: L, y: 752, width: 42, height: 42, color: brand });
  // Logo mark is drawn as shapes, not text, so it never merges into the vendor line of the text layer.
  page.drawRectangle({ x: L + 9, y: 761, width: 10, height: 24, color: rgb(1, 1, 1), opacity: 0.9 });
  page.drawRectangle({ x: L + 23, y: 761, width: 10, height: 15, color: rgb(1, 1, 1), opacity: 0.6 });
  s.address.forEach((a, i) => t(a, L + 52, 756 - i * 11, { size: 8.5, color: muted }));
  t(s.contact, L + 52, 734, { size: 8.5, color: muted });
  t(s.ntn, L + 52, 723, { size: 8.5, color: muted });
  tr("TAX INVOICE", R, 776, { size: 20, font: bold, color: brand });

  // Invoice meta block
  const meta = [["Invoice No", s.number], ["Invoice Date", s.date], ["Due Date", s.due], ["PO Number", s.po], ["Terms", s.terms]];
  page.drawRectangle({ x: 352, y: 640, width: R - 352, height: 72, color: tint, borderColor: line, borderWidth: 0.8 });
  meta.forEach(([k, v], i) => {
    const y = 698 - i * 13;
    t(`${k}:`, 362, y, { size: 8.5, color: muted });
    tr(v, R - 10, y, { size: 8.5, font: bold });
  });

  // Bill to
  t("BILL TO", L, 698, { size: 7.5, font: bold, color: brand });
  BILL_TO.forEach((b, i) => t(b, L, 684 - i * 12, { size: i === 0 ? 10 : 9, font: i === 0 ? bold : font, color: i === 0 ? ink : muted }));

  let y = 612;
  if (s.notice) {
    page.drawRectangle({ x: L, y: y - 8, width: R - L, height: 24, color: hex("#FEF3C7"), borderColor: hex("#F59E0B"), borderWidth: 0.8 });
    t(s.notice, L + 10, y, { size: 9, font: bold, color: hex("#92400E") });
    y -= 34;
  }

  // Line items table
  const cols = { no: L + 8, desc: L + 32, qty: 380, unit: 465, amt: R - 8 };
  page.drawRectangle({ x: L, y: y - 6, width: R - L, height: 20, color: brand });
  const white = rgb(1, 1, 1);
  t("#", cols.no, y, { size: 8, font: bold, color: white });
  t("DESCRIPTION", cols.desc, y, { size: 8, font: bold, color: white });
  tr("QTY", cols.qty, y, { size: 8, font: bold, color: white });
  tr("UNIT PRICE", cols.unit, y, { size: 8, font: bold, color: white });
  tr("LINE TOTAL", cols.amt, y, { size: 8, font: bold, color: white });
  y -= 24;
  let subtotal = 0;
  s.items.forEach(([d, q, u], i) => {
    const amt = q * u;
    subtotal += amt;
    if (i % 2 === 1) page.drawRectangle({ x: L, y: y - 7, width: R - L, height: 22, color: tint });
    t(String(i + 1), cols.no, y, { color: muted });
    t(d, cols.desc, y);
    tr(String(q), cols.qty, y);
    tr(fmt(u), cols.unit, y);
    tr(fmt(amt), cols.amt, y);
    y -= 22;
  });
  rule(y + 8);

  // Totals
  const tax = Math.round(subtotal * 0.17);
  const total = s.totalOverride ?? subtotal + tax;
  y -= 14;
  const totalsX = 352;
  for (const [k, v] of [["Subtotal", subtotal], ["GST (17%)", tax]]) {
    t(`${k}:`, totalsX, y, { color: muted });
    tr(`PKR ${fmt(v)}`, R - 8, y);
    y -= 16;
  }
  y -= 8;
  page.drawRectangle({ x: totalsX - 8, y: y - 9, width: R - totalsX + 8, height: 26, color: brand });
  t("Total Due:", totalsX, y, { size: 11, font: bold, color: white });
  tr(`PKR ${fmt(total)}`, R - 8, y, { size: 11, font: bold, color: white });
  y -= 44;

  // Payment details
  t("PAYMENT DETAILS", L, y, { size: 7.5, font: bold, color: brand });
  y -= 16;
  for (const [k, v] of [["Beneficiary", s.vendor], ["Bank", s.bank], ["IBAN", s.account]]) {
    t(`${k}:`, L, y, { color: muted });
    t(v, L + 70, y, { font: k === "IBAN" ? bold : font });
    y -= 14;
  }
  y -= 12;
  t("NOTES", L, y, { size: 7.5, font: bold, color: brand });
  y -= 14;
  t(s.note, L, y, { size: 9, color: muted });
  y -= 12;
  t("Please quote the invoice number as the payment reference.", L, y, { size: 9, color: muted });

  // Terms
  y -= 34;
  t("TERMS", L, y, { size: 7.5, font: bold, color: brand });
  y -= 14;
  for (const term of [
    `Payment is due by ${s.due}. Late payments may attract a 1.5% monthly charge.`,
    "Withholding tax, where applicable, will be deducted as per the Income Tax Ordinance, 2001.",
    "Discrepancies must be reported within 7 days of receipt of this invoice.",
  ]) {
    t(`•  ${term}`, L, y, { size: 8.5, color: muted });
    y -= 12;
  }

  // Footer
  rule(70);
  t("This is a computer-generated invoice and does not require a signature.", L, 56, { size: 7.5, color: muted });
  t("SYNTHETIC DEMO DOCUMENT — fictional vendor, not a real invoice.", L, 45, { size: 7.5, font: bold, color: muted });
  tr("Page 1 of 1", R, 56, { size: 7.5, color: muted });

  await writeFile(new URL(`../public/samples/${s.file}`, import.meta.url), await doc.save());
  console.log("wrote", s.file, `total PKR ${fmt(total)}`);
}
