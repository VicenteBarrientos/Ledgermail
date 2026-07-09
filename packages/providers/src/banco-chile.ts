import { BankEmailData, BankProvider, DetectionResult } from "./base";

export class BancoChileProvider extends BankProvider {
  readonly name = "Banco de Chile";
  readonly version = "v1";

  detect(email: BankEmailData): DetectionResult {
    let score = 0;
    const fromLower = email.from.toLowerCase();
    const subjectLower = email.subject.toLowerCase();
    const bodyLower = email.bodyHtml.toLowerCase();

    // 1. Domain Match (40 pts)
    const validDomains = [
      "bancochile.cl",
      "bancochile-net.cl",
      "bancochile-informa.cl",
      "bancoedwards.cl",
      "edwards.cl"
    ];
    if (validDomains.some(domain => fromLower.includes(domain))) {
      score += 40;
    }

    // 2. HTML Structure / Identity Markers (20 pts)
    const identityMarkers = [
      "banco de chile",
      "banco edwards",
      "mi banconexión",
      "banco de a. edwards",
      "chilexpress" // sometimes in Chile notifications, but keep to bank
    ];
    if (identityMarkers.some(marker => bodyLower.includes(marker))) {
      score += 20;
    }

    // 3. Subject Pattern Match (15 pts)
    const subjectMarkers = [
      "transferencia",
      "recibida",
      "abono",
      "depósito",
      "notificación",
      "aviso de transferencia"
    ];
    if (subjectMarkers.some(marker => subjectLower.includes(marker))) {
      score += 15;
    }

    // 4. Logo / URL patterns (15 pts)
    const urlPatterns = [
      "bancochile.cl/wps/wcm",
      "personas.bancochile.cl",
      "empresas.bancochile.cl",
      "images/logos"
    ];
    if (urlPatterns.some(pattern => bodyLower.includes(pattern))) {
      score += 15;
    }

    // 5. Footer legal text (10 pts)
    const footerMarkers = [
      "garantía estatal",
      "infórmese sobre la garantía estatal",
      "ley n° 19.396",
      "aviso de confidencialidad"
    ];
    if (footerMarkers.some(marker => bodyLower.includes(marker))) {
      score += 10;
    }

    return {
      score,
      isMatched: score >= 60
    };
  }

  cleanHtml(html: string): string {
    // Basic cleaning: replace repetitive newlines or tabs.
    // Core sanitizer will do the heavy lifting of stripping CSS and tags.
    // Here we can strip Banco de Chile specific header menus if any.
    let clean = html;
    
    // Strip header nav placeholders if present
    clean = clean.replace(/<tr[^>]*>\s*<td[^>]*>\s*Ver en su navegador[\s\S]*?<\/tr>/gi, "");
    
    return clean;
  }

  getPromptInstructions(): string {
    return `
Specific notes for Banco de Chile transfer notifications:
- Amounts: Typically formatted as "$XX.YYY" or "$ XX.YYY" (CLP, Chilean Pesos). E.g. "$150.000" or "$ 12.500".
- Sender details: Often found in a table cell next to labels like "Nombre Ordenante", "Remitente", "De:", or "Cliente:".
- Accounts: "Cuenta de Origen" indicates sender's account. "Cuenta de Destino" indicates receiver's account.
- Reference ID: Look for "Número de Transacción", "Folio", or "Código de Autorización".
- Comments/Description: Look for fields labeled "Mensaje", "Comentario", "Motivo", or "Asunto".
`;
  }
}
