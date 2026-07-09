import { BankEmailData, BankProvider, DetectionResult } from "./base";

export class SantanderProvider extends BankProvider {
  readonly name = "Santander";
  readonly version = "v1";
  detect(email: BankEmailData): DetectionResult {
    let score = 0;
    const fromLower = email.from.toLowerCase();
    const subjectLower = email.subject.toLowerCase();
    const bodyLower = email.bodyHtml.toLowerCase();

    // 1. Domain Match (40 pts)
    if (fromLower.includes("santander.cl") || fromLower.includes("santander-informa.cl")) {
      score += 40;
    }

    // 2. Identity Markers (20 pts)
    const identityMarkers = ["banco santander", "santander net", "superclave", "santander click", "santander"];
    if (identityMarkers.some(m => bodyLower.includes(m))) {
      score += 20;
    }

    // 3. Subject Pattern (15 pts)
    const subjectMarkers = ["transferencia", "aviso", "comprobante", "notificación"];
    if (subjectMarkers.some(m => subjectLower.includes(m))) {
      score += 15;
    }

    // 4. URL Patterns (15 pts)
    if (bodyLower.includes("santander.cl/wps") || bodyLower.includes("personas.santander.cl")) {
      score += 15;
    }

    // 5. Footer legal text (10 pts)
    if (bodyLower.includes("garantía estatal") || bodyLower.includes("infórmese sobre la garantía estatal")) {
      score += 10;
    }

    return {
      score,
      isMatched: score >= 60
    };
  }
  cleanHtml(html: string): string { return html; }
  getPromptInstructions(): string { return ""; }
}

export class BancoEstadoProvider extends BankProvider {
  readonly name = "BancoEstado";
  readonly version = "v1";
  detect(email: BankEmailData): DetectionResult {
    let score = 0;
    const fromLower = email.from.toLowerCase();
    const subjectLower = email.subject.toLowerCase();
    const bodyLower = email.bodyHtml.toLowerCase();

    // 1. Domain Match (40 pts)
    if (fromLower.includes("bancoestado.cl") || fromLower.includes("banco-estado.cl")) {
      score += 40;
    }

    // 2. Identity Markers (20 pts)
    const identityMarkers = ["bancoestado", "banco estado", "cuentadetalle", "cuenta rut", "cuentarut"];
    if (identityMarkers.some(m => bodyLower.includes(m))) {
      score += 20;
    }

    // 3. Subject Pattern (15 pts)
    const subjectMarkers = ["transferencia", "aviso", "comprobante", "notificación"];
    if (subjectMarkers.some(m => subjectLower.includes(m))) {
      score += 15;
    }

    // 4. URL Patterns (15 pts)
    if (bodyLower.includes("bancoestado.cl/wps") || bodyLower.includes("personas.bancoestado.cl")) {
      score += 15;
    }

    // 5. Footer legal text (10 pts)
    if (bodyLower.includes("garantía estatal") || bodyLower.includes("infórmese sobre la garantía estatal")) {
      score += 10;
    }

    return {
      score,
      isMatched: score >= 60
    };
  }
  cleanHtml(html: string): string { return html; }
  getPromptInstructions(): string { return ""; }
}

export class BCIProvider extends BankProvider {
  readonly name = "BCI";
  readonly version = "v1";
  detect(email: BankEmailData): DetectionResult {
    let score = 0;
    const fromLower = email.from.toLowerCase();
    const subjectLower = email.subject.toLowerCase();
    const bodyLower = email.bodyHtml.toLowerCase();

    // 1. Domain Match (40 pts)
    if (fromLower.includes("bci.cl") || fromLower.includes("bci-informa.cl")) {
      score += 40;
    }

    // 2. Identity Markers (20 pts)
    const identityMarkers = ["banco de credito e inversiones", "bci net", "multipass", "banco bci", "bci"];
    if (identityMarkers.some(m => bodyLower.includes(m))) {
      score += 20;
    }

    // 3. Subject Pattern (15 pts)
    const subjectMarkers = ["transferencia", "aviso", "comprobante", "notificación"];
    if (subjectMarkers.some(m => subjectLower.includes(m))) {
      score += 15;
    }

    // 4. URL Patterns (15 pts)
    if (bodyLower.includes("bci.cl/wps") || bodyLower.includes("personas.bci.cl")) {
      score += 15;
    }

    // 5. Footer legal text (10 pts)
    if (bodyLower.includes("garantía estatal") || bodyLower.includes("infórmese sobre la garantía estatal")) {
      score += 10;
    }

    return {
      score,
      isMatched: score >= 60
    };
  }
  cleanHtml(html: string): string { return html; }
  getPromptInstructions(): string { return ""; }
}

export class ScotiabankProvider extends BankProvider {
  readonly name = "Scotiabank";
  readonly version = "v1";
  detect(email: BankEmailData): DetectionResult {
    let score = 0;
    const fromLower = email.from.toLowerCase();
    const subjectLower = email.subject.toLowerCase();
    const bodyLower = email.bodyHtml.toLowerCase();

    // 1. Domain Match (40 pts)
    if (fromLower.includes("scotiabank.cl") || fromLower.includes("scotiabank-informa.cl")) {
      score += 40;
    }

    // 2. Identity Markers (20 pts)
    const identityMarkers = ["scotiabank", "scotiaclub", "keypass", "scotiabank azul"];
    if (identityMarkers.some(m => bodyLower.includes(m))) {
      score += 20;
    }

    // 3. Subject Pattern (15 pts)
    const subjectMarkers = ["transferencia", "aviso", "comprobante", "notificación"];
    if (subjectMarkers.some(m => subjectLower.includes(m))) {
      score += 15;
    }

    // 4. URL Patterns (15 pts)
    if (bodyLower.includes("scotiabank.cl/wps") || bodyLower.includes("personas.scotiabank.cl")) {
      score += 15;
    }

    // 5. Footer legal text (10 pts)
    if (bodyLower.includes("garantía estatal") || bodyLower.includes("infórmese sobre la garantía estatal")) {
      score += 10;
    }

    return {
      score,
      isMatched: score >= 60
    };
  }
  cleanHtml(html: string): string { return html; }
  getPromptInstructions(): string { return ""; }
}

export class ItauProvider extends BankProvider {
  readonly name = "Itaú";
  readonly version = "v1";
  detect(email: BankEmailData): DetectionResult {
    let score = 0;
    const fromLower = email.from.toLowerCase();
    const subjectLower = email.subject.toLowerCase();
    const bodyLower = email.bodyHtml.toLowerCase();

    // 1. Domain Match (40 pts)
    if (fromLower.includes("itau.cl") || fromLower.includes("itau-informa.cl")) {
      score += 40;
    }

    // 2. Identity Markers (20 pts)
    const identityMarkers = ["banco itau", "itau link", "itaú", "itau click", "itau"];
    if (identityMarkers.some(m => bodyLower.includes(m))) {
      score += 20;
    }

    // 3. Subject Pattern (15 pts)
    const subjectMarkers = ["transferencia", "aviso", "comprobante", "notificación"];
    if (subjectMarkers.some(m => subjectLower.includes(m))) {
      score += 15;
    }

    // 4. URL Patterns (15 pts)
    if (bodyLower.includes("itau.cl/wps") || bodyLower.includes("personas.itau.cl")) {
      score += 15;
    }

    // 5. Footer legal text (10 pts)
    if (bodyLower.includes("garantía estatal") || bodyLower.includes("infórmese sobre la garantía estatal")) {
      score += 10;
    }

    return {
      score,
      isMatched: score >= 60
    };
  }
  cleanHtml(html: string): string { return html; }
  getPromptInstructions(): string { return ""; }
}
