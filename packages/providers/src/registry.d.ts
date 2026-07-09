import { BankProvider } from "./base";
export declare const PROVIDERS: BankProvider[];
export declare function detectProvider(email: {
    from: string;
    subject: string;
    bodyHtml: string;
    headers: Record<string, string>;
}): BankProvider | null;
