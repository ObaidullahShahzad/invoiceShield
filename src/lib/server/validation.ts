import { z } from "zod";

export const fieldsPatchSchema = z
  .object({
    vendorName: z.string().trim().min(1).max(160).nullable(),
    invoiceNumber: z.string().trim().min(1).max(60).nullable(),
    invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").nullable(),
    currency: z.string().trim().length(3).toUpperCase().nullable(),
    subtotalMinor: z.number().int().min(0).max(1e13).nullable(),
    taxMinor: z.number().int().min(0).max(1e13).nullable(),
    totalMinor: z.number().int().min(0).max(1e13).nullable(),
    paymentAccountLast4: z.string().regex(/^\d{4}$/, "Four digits").nullable(),
  })
  .partial();

export const reviewSchema = z.object({
  action: z.enum(["mark_reviewed", "flag", "clear", "reopen"]),
  note: z.string().trim().max(1000).optional(),
});

export const vendorSchema = z.object({
  name: z.string().trim().min(2).max(160),
  approved: z.boolean().default(true),
  taxId: z.string().trim().max(40).nullable().optional(),
  registeredBankAccountLast4: z.string().regex(/^\d{4}$/, "Four digits").nullable().optional(),
  typicalAmountMinMinor: z.number().int().min(0).nullable().optional(),
  typicalAmountMaxMinor: z.number().int().min(0).nullable().optional(),
  currency: z.string().trim().length(3).toUpperCase().default("PKR"),
});
