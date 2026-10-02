import "server-only";
import { extractText, getDocumentProxy } from "unpdf";

export class ExtractionError extends Error {
  constructor(
    public code: "empty_pdf" | "unreadable" | "ocr_failed",
    message: string,
  ) {
    super(message);
  }
}

export async function textFromPdf(data: Buffer): Promise<string> {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(data));
    if (pdf.numPages > 30) throw new ExtractionError("unreadable", "The PDF has more than 30 pages.");
    const { text } = await extractText(pdf, { mergePages: true });
    const t = (Array.isArray(text) ? text.join("\n") : text).trim();
    if (t.length < 20) throw new ExtractionError("empty_pdf", "This PDF has no text layer (it looks scanned). Upload it as a PNG or JPEG for OCR, or enter the values manually.");
    return t;
  } catch (e) {
    if (e instanceof ExtractionError) throw e;
    throw new ExtractionError("unreadable", "The PDF could not be read. It may be corrupt or password protected.");
  }
}

export async function textFromImage(data: Buffer): Promise<string> {
  try {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng");
    try {
      const { data: result } = await worker.recognize(data);
      const t = result.text.trim();
      if (t.length < 20) throw new ExtractionError("ocr_failed", "No readable text was found in the image. Enter the values manually.");
      return t;
    } finally {
      await worker.terminate();
    }
  } catch (e) {
    if (e instanceof ExtractionError) throw e;
    throw new ExtractionError("ocr_failed", "OCR failed. Enter the values manually or upload a clearer image.");
  }
}

/** Identify the real file type from magic bytes rather than trusting the browser-supplied MIME type. */
export function sniffMime(buf: Buffer): "application/pdf" | "image/png" | "image/jpeg" | null {
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  return null;
}
