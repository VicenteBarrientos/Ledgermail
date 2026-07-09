import { BankEmailData, BankProvider, DetectionResult } from "./base";
export declare class SantanderProvider extends BankProvider {
    readonly name = "Santander";
    readonly version = "v1";
    detect(email: BankEmailData): DetectionResult;
    cleanHtml(html: string): string;
    getPromptInstructions(): string;
}
export declare class BancoEstadoProvider extends BankProvider {
    readonly name = "BancoEstado";
    readonly version = "v1";
    detect(email: BankEmailData): DetectionResult;
    cleanHtml(html: string): string;
    getPromptInstructions(): string;
}
export declare class BCIProvider extends BankProvider {
    readonly name = "BCI";
    readonly version = "v1";
    detect(email: BankEmailData): DetectionResult;
    cleanHtml(html: string): string;
    getPromptInstructions(): string;
}
export declare class ScotiabankProvider extends BankProvider {
    readonly name = "Scotiabank";
    readonly version = "v1";
    detect(email: BankEmailData): DetectionResult;
    cleanHtml(html: string): string;
    getPromptInstructions(): string;
}
export declare class ItauProvider extends BankProvider {
    readonly name = "Ita\u00FA";
    readonly version = "v1";
    detect(email: BankEmailData): DetectionResult;
    cleanHtml(html: string): string;
    getPromptInstructions(): string;
}
