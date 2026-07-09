import { BankEmailData, BankProvider, DetectionResult } from "./base";

export class SantanderProvider extends BankProvider {
  readonly name = "Santander";
  readonly version = "v1";
  detect(email: BankEmailData): DetectionResult {
    const matched = email.from.toLowerCase().includes("santander.cl") || email.bodyHtml.toLowerCase().includes("banco santander");
    return { score: matched ? 100 : 0, isMatched: false }; // Not active for MVP
  }
  cleanHtml(html: string): string { return html; }
  getPromptInstructions(): string { return ""; }
}

export class BancoEstadoProvider extends BankProvider {
  readonly name = "BancoEstado";
  readonly version = "v1";
  detect(email: BankEmailData): DetectionResult {
    const matched = email.from.toLowerCase().includes("bancoestado.cl") || email.bodyHtml.toLowerCase().includes("banco estado");
    return { score: matched ? 100 : 0, isMatched: false }; // Not active for MVP
  }
  cleanHtml(html: string): string { return html; }
  getPromptInstructions(): string { return ""; }
}

export class BCIProvider extends BankProvider {
  readonly name = "BCI";
  readonly version = "v1";
  detect(email: BankEmailData): DetectionResult {
    const matched = email.from.toLowerCase().includes("bci.cl") || email.bodyHtml.toLowerCase().includes("banco de credito e inversiones");
    return { score: matched ? 100 : 0, isMatched: false }; // Not active for MVP
  }
  cleanHtml(html: string): string { return html; }
  getPromptInstructions(): string { return ""; }
}

export class ScotiabankProvider extends BankProvider {
  readonly name = "Scotiabank";
  readonly version = "v1";
  detect(email: BankEmailData): DetectionResult {
    const matched = email.from.toLowerCase().includes("scotiabank.cl") || email.bodyHtml.toLowerCase().includes("scotiabank");
    return { score: matched ? 100 : 0, isMatched: false }; // Not active for MVP
  }
  cleanHtml(html: string): string { return html; }
  getPromptInstructions(): string { return ""; }
}

export class ItauProvider extends BankProvider {
  readonly name = "Itaú";
  readonly version = "v1";
  detect(email: BankEmailData): DetectionResult {
    const matched = email.from.toLowerCase().includes("itau.cl") || email.bodyHtml.toLowerCase().includes("banco itaú");
    return { score: matched ? 100 : 0, isMatched: false }; // Not active for MVP
  }
  cleanHtml(html: string): string { return html; }
  getPromptInstructions(): string { return ""; }
}
