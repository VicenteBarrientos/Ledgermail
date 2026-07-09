export interface BankEmailData {
  from: string;
  subject: string;
  bodyHtml: string;
  headers: Record<string, string>;
}

export interface DetectionResult {
  score: number;       // Score out of 100
  isMatched: boolean;  // True if score >= threshold (e.g. 60)
}

export abstract class BankProvider {
  abstract readonly name: string;
  abstract readonly version: string; // E.g., "v1" or "v2"
  
  /**
   * Evaluates the email using weighted criteria:
   * - Domain match (e.g. 40 points)
   * - HTML structure elements (e.g. 20 points)
   * - Subject pattern match (e.g. 15 points)
   * - Logo / URL patterns (e.g. 15 points)
   * - Footer legal clauses (e.g. 10 points)
   */
  abstract detect(email: BankEmailData): DetectionResult;

  /**
   * Cleans the HTML content of the email to strip CSS, images, disclaimers, etc.
   */
  abstract cleanHtml(html: string): string;

  /**
   * Specific extraction guidelines for this provider version.
   */
  abstract getPromptInstructions(): string;
}
