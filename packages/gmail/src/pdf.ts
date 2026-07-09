/// <reference path="./types.d.ts" />
import pdf from "pdf-parse";
import { logger } from "@ledgermail/shared";

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    const data = await pdf(buffer);
    return data.text || "";
  } catch (error) {
    logger.error("Failed to parse PDF content:", error);
    return "";
  }
}
