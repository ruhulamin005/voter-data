/**
 * Client-side PDF text extraction using pdfjs-dist.
 * Processes each page and returns an array of page text strings.
 */

import type { ParseResult } from "../types";
import { replaceCidArtifacts } from "./textNormalizer";
import { extractVoters } from "./voterExtractor";
import { patchPdfBinary } from "./pdfBinaryPatcher";

export type ProgressCallback = (current: number, total: number, stage: string) => void;

async function loadPdfJs() {
  const pdfjsLib = await import("pdfjs-dist");
  // Use local worker to avoid CDN dependency
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();
  return pdfjsLib;
}

export async function extractTextFromPdf(
  file: File,
  onProgress?: ProgressCallback
): Promise<string[]> {
  const pdfjsLib = await loadPdfJs();

  const rawBuffer = await file.arrayBuffer();
  // Patch incorrect ToUnicode CMap entries in the embedded Bengali font so
  // pdfjs maps CID 207 to ে (U+09C7) instead of ো (U+09CB). This fixes
  // standalone ে in names like বেগম → বেগম (previously: বিগম).
  const arrayBuffer = await patchPdfBinary(rawBuffer);
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  const totalPages = pdf.numPages;
  const pageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    onProgress?.(pageNum, totalPages, "Extracting text");

    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    // Concatenate text items, preserving line breaks based on Y position
    let lastY: number | null = null;
    let pageText = "";

    for (const item of textContent.items) {
      if ("str" in item) {
        const currentY = (item as { str: string; transform: number[] }).transform[5];
        if (lastY !== null && Math.abs(currentY - lastY) > 5) {
          pageText += "\n";
        }
        pageText += (item as { str: string }).str + " ";
        lastY = currentY;
      }
    }

    // Clean up the page text
    const cleaned = replaceCidArtifacts(pageText);
    pageTexts.push(cleaned);
  }

  return pageTexts;
}

export async function parsePdfFile(
  file: File,
  onProgress?: ProgressCallback
): Promise<ParseResult> {
  if (!file.type.includes("pdf") && !file.name.endsWith(".pdf")) {
    return {
      voters: [],
      totalFound: 0,
      errors: ["Invalid file type. Please upload a PDF file."],
      metadata: {},
    };
  }

  if (file.size > 50 * 1024 * 1024) {
    return {
      voters: [],
      totalFound: 0,
      errors: ["File too large. Maximum size is 50MB."],
      metadata: {},
    };
  }

  try {
    onProgress?.(0, 1, "Loading PDF");
    const pageTexts = await extractTextFromPdf(file, onProgress);

    if (pageTexts.every((t) => !t.trim())) {
      return {
        voters: [],
        totalFound: 0,
        errors: [
          "No text could be extracted from this PDF. It may be a scanned image PDF.",
        ],
        metadata: {},
      };
    }

    onProgress?.(1, 1, "Parsing voter records");
    const result = extractVoters(pageTexts);

    if (result.voters.length === 0) {
      result.errors.push(
        "No voter records were found. Make sure this is a Bangladesh Election Commission voter list PDF."
      );
    }

    return result;
  } catch (error) {
    return {
      voters: [],
      totalFound: 0,
      errors: [
        `Failed to parse PDF: ${error instanceof Error ? error.message : String(error)}`,
      ],
      metadata: {},
    };
  }
}
