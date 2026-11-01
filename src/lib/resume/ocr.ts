import "server-only";

import { tmpdir } from "node:os";
import { join } from "node:path";

import { createCanvas } from "@napi-rs/canvas";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { createWorker } from "tesseract.js";

export const MAX_OCR_PAGES = 3;

/**
 * Read a scanned PDF by rendering its pages and running English OCR.
 *
 * Only used when the text layer is empty. Results are best-effort: the review
 * step exists precisely because OCR can misread characters.
 */
export async function ocrPdf(bytes: Uint8Array, maxPages = MAX_OCR_PAGES): Promise<{ text: string; pages: number }> {
  const document = await pdfjs.getDocument({
    data: bytes,
    useSystemFonts: true,
    isEvalSupported: false,
  }).promise;

  const pageCount = Math.min(document.numPages, maxPages);
  const worker = await createWorker("eng", 1, { cachePath: join(tmpdir(), "jobautomation-tesseract") });

  try {
    const parts: string[] = [];

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));

      await page.render({
        canvas: canvas as never,
        canvasContext: canvas.getContext("2d") as never,
        viewport,
      }).promise;
      const { data } = await worker.recognize(canvas.toBuffer("image/png"));

      const text = data.text.trim();
      if (text) parts.push(text);
    }

    return { text: parts.join("\n\n"), pages: pageCount };
  } finally {
    await worker.terminate();
  }
}
