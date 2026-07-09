import { BankEmailData, BankProvider, DetectionResult } from "./base";
export declare class BancoChileProvider extends BankProvider {
    readonly name = "Banco de Chile";
    readonly version = "v1";
    detect(email: BankEmailData): DetectionResult;
    cleanHtml(html: string): string;
    getPromptInstructions(): string;
}
