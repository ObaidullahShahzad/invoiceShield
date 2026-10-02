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
    const { tmpdir } = await import("node:os");
    // Cache the language model in the temp dir: serverless filesystems (e.g. Vercel) are read-only elsewhere.
    const worker = await createWorker("eng", 1, { cachePath: tmpdir() });
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

export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export type SupportedMime = "application/pdf" | "image/png" | "image/jpeg" | typeof DOCX_MIME;

/** Upper bound on the unpacked size of a DOCX, to reject zip bombs before parsing. */
const MAX_DOCX_UNPACKED = 50 * 1024 * 1024;

/**
 * Identify the real file type from its content rather than trusting the browser-supplied MIME type or extension.
 * A DOCX is a ZIP archive, so it is only accepted when it contains a Word document part and no macros.
 */
export async function detectFileType(buf: Buffer): Promise<SupportedMime | null> {
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) {
    try {
      const { default: JSZip } = await import("jszip");
      const zip = await JSZip.loadAsync(buf, { checkCRC32: false });
      if (!zip.file("word/document.xml") || !zip.file("[Content_Types].xml")) return null;
      if (zip.file(/vbaProject\.bin$/i).length) return null; // macro-enabled document
      let unpacked = 0;
      zip.forEach((_, entry) => {
        unpacked += (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0;
      });
      return unpacked <= MAX_DOCX_UNPACKED ? DOCX_MIME : null;
    } catch {
      return null;
    }
  }
  return null;
}

export async function textFromDocx(data: Buffer): Promise<string> {
  try {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer: data });
    // Mammoth separates paragraphs and table cells with blank lines; collapse them to one line each.
    const t = value.replace(/\r/g, "").replace(/\n{2,}/g, "\n").trim();
    if (t.length < 20) throw new ExtractionError("empty_pdf", "This Word document has no readable text (it may only contain an image). Enter the values manually.");
    return t;
  } catch (e) {
    if (e instanceof ExtractionError) throw e;
    throw new ExtractionError("unreadable", "The Word document could not be read. It may be corrupt or password protected.");
  }
}

/** Render a DOCX as simple HTML for preview. The result is served in a sandboxed, script-free frame. */
export async function docxToHtml(data: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const { value } = await mammoth.convertToHtml({ buffer: data });
  return value;
}

export async function textFromFile(data: Buffer, mime: string): Promise<string> {
  if (mime === "application/pdf") return textFromPdf(data);
  if (mime === DOCX_MIME) return textFromDocx(data);
  return textFromImage(data);
}
