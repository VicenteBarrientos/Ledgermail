import { describe, it, expect } from "vitest";
import { extractTextFromPdf } from "@ledgermail/gmail/src/pdf";
import fs from "fs";
import path from "path";

describe("PDF Text Extraction", () => {
  it("should successfully extract text from a real PDF file", async () => {
    const condoSyncPdfPath = "c:\\Users\\hp\\OneDrive\\Desktop\\CondoSync\\colilla-test.pdf";
    
    // Fallback search path in fixtures
    const localPdfPath = path.resolve(__dirname, "../../../fixtures/colilla-test.pdf");
    
    let targetPath = condoSyncPdfPath;
    if (!fs.existsSync(targetPath)) {
      targetPath = localPdfPath;
    }
    
    // Skip test gracefully if PDF is missing in both locations
    if (!fs.existsSync(targetPath)) {
      console.warn("Skipping PDF test: colilla-test.pdf not found in either repository.");
      return;
    }

    const buffer = fs.readFileSync(targetPath);
    const text = await extractTextFromPdf(buffer);
    
    // We expect the extracted text to have contents (e.g. resident name or building info)
    expect(text.length).toBeGreaterThan(10);
    console.log("Extracted PDF content successfully! Text preview:", text.substring(0, 150));
  });
});
