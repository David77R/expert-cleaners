import { PDFArray, PDFDocument, PDFStream, decodePDFRawStream, type PDFRawStream } from "pdf-lib";

export function loadPdf(bytes: Uint8Array) {
  return PDFDocument.load(bytes, { updateMetadata: false });
}

export async function pageText(bytes: Uint8Array, pageIndex = 0): Promise<string> {
  const pdf = await loadPdf(bytes);
  const contents = pdf.getPage(pageIndex).node.Contents();
  const streams =
    contents instanceof PDFArray
      ? Array.from({ length: contents.size() }, (_, index) => contents.lookup(index, PDFStream))
      : contents
        ? [contents]
        : [];
  return streams
    .map((stream) => Buffer.from(decodePDFRawStream(stream as PDFRawStream).decode()).toString("latin1"))
    .join("\n");
}

export function hexOf(text: string): string {
  return Buffer.from(text, "latin1").toString("hex").toUpperCase();
}
