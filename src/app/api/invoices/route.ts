import { createHash, randomUUID } from "node:crypto";
import { after } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { analyzeInvoice } from "@/lib/server/analyze";
import { ApiError, handle, ok } from "@/lib/server/api";
import { requireApiUser } from "@/lib/server/auth";
import { env } from "@/lib/server/env";
import { invoices, listInvoices, writeAudit } from "@/lib/server/repo";
import { putFile } from "@/lib/server/storage";
import { detectFileType } from "@/lib/server/text";

export const runtime = "nodejs";
export const maxDuration = 60;

export const GET = handle(async (req: Request) => {
  const user = await requireApiUser(req);
  return ok(await listInvoices(user.uid));
});

const safeName = (n: string) =>
  n
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "")
    .replace(/\s+/g, "_")
    .slice(-80) || "invoice";

export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(req);
  const maxBytes = env().MAX_UPLOAD_MB * 1024 * 1024;
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > maxBytes + 64 * 1024) throw new ApiError("file_too_large", `Files must be ${env().MAX_UPLOAD_MB} MB or smaller.`, 413);

  const form = await req.formData().catch(() => {
    throw new ApiError("validation_failed", "Expected a multipart file upload.", 422);
  });
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) throw new ApiError("validation_failed", "Choose a PDF, PNG, JPEG or DOCX file to upload.", 422);
  if (file.size > maxBytes) throw new ApiError("file_too_large", `Files must be ${env().MAX_UPLOAD_MB} MB or smaller.`, 413);

  const buf = Buffer.from(await file.arrayBuffer());
  const mime = await detectFileType(buf);
  if (!mime) throw new ApiError("unsupported_file", "Only PDF, PNG, JPEG and DOCX files are supported. Legacy .doc and macro-enabled files are not accepted.", 415);

  const id = randomUUID();
  const storagePath = `invoices/${user.uid}/${id}/${safeName(file.name)}`;
  const contentHash = createHash("sha256").update(buf).digest("hex");
  await putFile(storagePath, buf, mime);

  await invoices().doc(id).set({
    ownerUid: user.uid,
    storagePath,
    originalFileName: file.name.slice(0, 200),
    mimeType: mime,
    fileSize: buf.length,
    contentHash,
    vendorId: null,
    vendorName: null,
    invoiceNumber: null,
    invoiceDate: null,
    currency: null,
    subtotalMinor: null,
    taxMinor: null,
    totalMinor: null,
    paymentAccountLast4: null,
    analysisStatus: "uploaded",
    analysisError: null,
    riskScore: 0,
    riskLevel: "low",
    reviewStatus: "pending_analysis",
    findingCount: 0,
    ruleIds: [],
    summary: null,
    verificationSteps: [],
    summarySource: null,
    extractionSource: null,
    uncertainFields: [],
    fieldsEdited: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    analyzedAt: null,
  });
  await writeAudit({ ownerUid: user.uid, actorUid: user.uid, actorName: user.name, invoiceId: id, invoiceLabel: file.name, action: "invoice.uploaded", newValue: file.name });

  after(() => analyzeInvoice({ ownerUid: user.uid, actor: { uid: user.uid, name: user.name }, invoiceId: id, mode: "full" }));
  return ok({ invoiceId: id, status: "uploaded" }, 201);
});
