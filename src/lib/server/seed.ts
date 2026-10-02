import "server-only";
import { Timestamp } from "firebase-admin/firestore";
import { normalizeVendorName } from "@/lib/domain/normalize";
import { runRules } from "@/lib/domain/rules";
import { scoreFindings, REVIEW_LABEL } from "@/lib/domain/scoring";
import type { Finding, HistoryInvoice, ReviewStatus, Vendor } from "@/lib/domain/types";
import { templateExplanation } from "./ai/ai";
import { db } from "./firebase-admin";
import { auditCol, invoices, vendorsCol, writeAudit } from "./repo";

/** Deterministic PRNG so the demo data is identical on every run. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PKR = (n: number) => Math.round(n * 100);

const VENDORS = [
  { name: "Apex Supplies Ltd.", last4: "4421", min: 100_000, max: 900_000, prefix: "INV-2026", start: 1000 },
  { name: "Crescent Logistics (Pvt) Ltd", last4: "7783", min: 50_000, max: 400_000, prefix: "INV-2026", start: 940 },
  { name: "Northgate Office Solutions", last4: "1290", min: 20_000, max: 250_000, prefix: "NG", start: 300 },
  { name: "Meridian IT Services", last4: "5532", min: 200_000, max: 1_500_000, prefix: "MIT", start: 5080 },
  { name: "Karachi Industrial Packaging", last4: "9046", min: 80_000, max: 600_000, prefix: "KIP", start: 2100 },
  { name: "Summit Facility Management", last4: "3317", min: 120_000, max: 500_000, prefix: "SFM", start: 710 },
  { name: "Bluewater Catering Co.", last4: "6608", min: 30_000, max: 180_000, prefix: "BW", start: 88 },
  { name: "Indus Print & Media", last4: "2275", min: 15_000, max: 140_000, prefix: "IPM", start: 4400 },
] as const;

interface Plan {
  vendor: number;
  daysAgo: number;
  number?: string;
  subtotal?: number;
  taxFactor?: number;
  account?: string;
  nameOverride?: string;
}

export async function seedDemoData(user: { uid: string; name: string }): Promise<{ vendors: number; invoices: number }> {
  const uid = user.uid;
  const [existingV, existingI] = await Promise.all([vendorsCol().where("ownerUid", "==", uid).limit(1).get(), invoices().where("ownerUid", "==", uid).limit(1).get()]);
  if (!existingV.empty || !existingI.empty) throw new Error("exists");

  const rand = mulberry32(2026);
  const now = Date.now();
  const DAY = 86_400_000;

  // Vendors
  const vendorDocs: Vendor[] = [];
  const vb = db().batch();
  for (const v of VENDORS) {
    const ref = vendorsCol().doc();
    const doc = {
      name: v.name, normalizedName: normalizeVendorName(v.name), approved: true, taxId: null, registeredBankAccountLast4: v.last4,
      typicalAmountMinMinor: PKR(v.min), typicalAmountMaxMinor: PKR(v.max), currency: "PKR",
    };
    vb.set(ref, { ...doc, ownerUid: uid, createdAt: Timestamp.fromMillis(now - 90 * DAY), updatedAt: Timestamp.fromMillis(now - 90 * DAY) });
    vendorDocs.push({ id: ref.id, ...doc });
  }
  const falcon = vendorsCol().doc();
  vb.set(falcon, {
    name: "Falcon Trading Co.", normalizedName: normalizeVendorName("Falcon Trading Co."), approved: false, taxId: null, registeredBankAccountLast4: "8154",
    typicalAmountMinMinor: null, typicalAmountMaxMinor: null, currency: "PKR", ownerUid: uid, createdAt: Timestamp.fromMillis(now - 20 * DAY), updatedAt: Timestamp.fromMillis(now - 20 * DAY),
  });
  vendorDocs.push({ id: falcon.id, name: "Falcon Trading Co.", normalizedName: normalizeVendorName("Falcon Trading Co."), approved: false, registeredBankAccountLast4: "8154", currency: "PKR" });
  await vb.commit();

  // Invoice plans — 34 regular invoices plus deliberate anomalies for the demo.
  const plans: Plan[] = [];
  const counters = VENDORS.map((v) => v.start);
  for (let d = 84; d >= 1; d -= 1) {
    // Uneven cadence with a busier recent period, like a real payables queue.
    const perDay = rand() < (d < 30 ? 0.75 : 0.45) ? 1 + (rand() < 0.3 ? 1 : 0) : 0;
    for (let n = 0; n < perDay; n++) {
      const vi = Math.floor(rand() * VENDORS.length);
      counters[vi] += 1 + Math.floor(rand() * 3);
      plans.push({ vendor: vi, daysAgo: d, number: `${VENDORS[vi].prefix}-${String(counters[vi]).padStart(4, "0")}` });
    }
  }
  // Fixed invoice that the "duplicate" sample PDF collides with.
  plans.push({ vendor: 1, daysAgo: 16, number: "INV-2026-0988", subtotal: 185_000 });
  // Anomalies
  plans.push({ vendor: 0, daysAgo: 9, number: "INV-2026-1017", account: "9921" }); // account mismatch
  plans.push({ vendor: 3, daysAgo: 6, number: "MIT-5199", subtotal: 3_100_000 }); // outside range
  plans.push({ vendor: 2, daysAgo: 4, number: "NG-0391", taxFactor: 1.4 }); // arithmetic
  plans.push({ vendor: 5, daysAgo: 24, number: "SFM-0933", account: "5150" }); // older account mismatch; sample 05 replays this number
  plans.push({ vendor: 6, daysAgo: 33, number: "BW-0151", subtotal: 640_000 }); // older outlier
  plans.push({ vendor: 1, daysAgo: 2, number: "INV-2026-0988" }); // exact duplicate of the fixed invoice above
  plans.push({ vendor: 4, daysAgo: 3, number: "KIP-2188", nameOverride: "Karachi Industrial Packging" }); // look-alike
  plans.push({ vendor: 7, daysAgo: 2, number: "IPM-4421", nameOverride: "Zenith Traders" }); // unknown
  plans.sort((a, b) => b.daysAgo - a.daysAgo);

  const history: HistoryInvoice[] = [];
  let count = 0;
  let batch = db().batch();
  let ops = 0;
  const flush = async () => {
    if (ops) await batch.commit();
    batch = db().batch();
    ops = 0;
  };
  const queue = async (fn: () => void, n: number) => {
    if (ops + n > 400) await flush();
    fn();
    ops += n;
  };

  for (const p of plans) {
    const v = VENDORS[p.vendor];
    const vendor = vendorDocs[p.vendor];
    const createdMs = now - p.daysAgo * DAY - Math.floor(rand() * 8) * 3_600_000;
    const subtotal = PKR(p.subtotal ?? Math.round((v.min + rand() * (v.max - v.min) * 0.7) / 100) * 100);
    const tax = Math.round(subtotal * 0.17 * (p.taxFactor ?? 1));
    const total = subtotal + Math.round(subtotal * 0.17);
    const invoiceDate = new Date(createdMs - (1 + Math.floor(rand() * 4)) * DAY).toISOString().slice(0, 10);
    const fields = {
      vendorName: p.nameOverride ?? v.name,
      invoiceNumber: p.number ?? `${v.prefix}-0000`,
      invoiceDate,
      currency: "PKR",
      subtotalMinor: subtotal,
      taxMinor: tax,
      totalMinor: total,
      paymentAccountLast4: p.account ?? v.last4,
    };
    const ref = invoices().doc();
    const findings: Finding[] = runRules({ invoice: { ...fields, id: ref.id, contentHash: null }, vendors: vendorDocs, history });
    const { score, level } = scoreFindings(findings);
    const explanation = templateExplanation(fields, findings);

    let status: ReviewStatus = "needs_review";
    let note: string | null = null;
    if (p.daysAgo > 5) {
      const r = rand();
      if (findings.length === 0) status = r < 0.85 ? "reviewed" : "needs_review";
      else if (level === "low") status = r < 0.5 ? "cleared" : "reviewed";
      else status = r < 0.5 ? "flagged" : "cleared";
      if (status === "flagged") note = "Escalated to accounts payable lead for vendor confirmation.";
      if (status === "cleared") note = "Confirmed with the vendor by phone; documents match the purchase order.";
    } else if (p.daysAgo <= 3 && findings.some((f) => f.severity === "high")) status = "needs_review";

    const created = Timestamp.fromMillis(createdMs);
    await queue(() => {
      batch.set(ref, {
        ownerUid: uid, storagePath: null, originalFileName: `${fields.invoiceNumber}.pdf`, mimeType: "application/pdf", fileSize: 48_000 + Math.floor(rand() * 40_000),
        contentHash: null, vendorId: vendor.id === falcon.id ? null : p.nameOverride ? null : vendor.id, ...fields,
        analysisStatus: "completed", analysisError: null, riskScore: score, riskLevel: level, reviewStatus: status,
        findingCount: findings.length, ruleIds: [...new Set(findings.map((f) => f.ruleId))],
        summary: explanation.summary, verificationSteps: explanation.verificationSteps, summarySource: "template",
        extractionSource: "heuristic", uncertainFields: [], fieldsEdited: false,
        createdAt: created, updatedAt: created, analyzedAt: Timestamp.fromMillis(createdMs + 60_000),
      });
      for (const f of findings) batch.set(ref.collection("findings").doc(), { ...f, createdAt: created });
      batch.set(auditCol().doc(), {
        ownerUid: uid, actorUid: uid, actorName: user.name, invoiceId: ref.id, invoiceLabel: fields.invoiceNumber, action: "invoice.uploaded",
        previousValue: null, newValue: `${fields.invoiceNumber}.pdf`, note: null, createdAt: created,
      });
      batch.set(auditCol().doc(), {
        ownerUid: uid, actorUid: uid, actorName: user.name, invoiceId: ref.id, invoiceLabel: fields.invoiceNumber, action: "invoice.analyzed",
        previousValue: null, newValue: `${level} risk (${score}), ${findings.length} finding${findings.length === 1 ? "" : "s"}`, note: null, createdAt: Timestamp.fromMillis(createdMs + 60_000),
      });
      if (status !== "needs_review") {
        const action = status === "reviewed" ? "mark_reviewed" : status === "flagged" ? "flag" : "clear";
        batch.set(auditCol().doc(), {
          ownerUid: uid, actorUid: uid, actorName: user.name, invoiceId: ref.id, invoiceLabel: fields.invoiceNumber, action: `review.${action}`,
          previousValue: REVIEW_LABEL.needs_review, newValue: REVIEW_LABEL[status], note, createdAt: Timestamp.fromMillis(createdMs + 3_600_000 * (2 + Math.floor(rand() * 20))),
        });
      }
    }, 3 + findings.length + (status !== "needs_review" ? 1 : 0));

    history.push({ id: ref.id, vendorId: vendor.id, contentHash: null, createdAt: created.toDate().toISOString(), ...fields });
    count++;
  }
  await flush();
  await writeAudit({ ownerUid: uid, actorUid: uid, actorName: user.name, action: "demo.seeded", newValue: `${vendorDocs.length} vendors, ${count} invoices` });
  return { vendors: vendorDocs.length, invoices: count };
}
