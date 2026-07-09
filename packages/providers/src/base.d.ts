export interface BankEmailData {
    from: string;
    subject: string;
    bodyHtml: string;
    headers: Record<string, string>;
}
export interface DetectionResult {
    score: number;
    isMatched: boolean;
}
export declare abstract class BankProvider {
    abstract readonly name: string;
    abstract readonly version: string;
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
