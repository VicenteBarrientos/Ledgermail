"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ItauProvider = exports.ScotiabankProvider = exports.BCIProvider = exports.BancoEstadoProvider = exports.SantanderProvider = void 0;
const base_1 = require("./base");
class SantanderProvider extends base_1.BankProvider {
    name = "Santander";
    version = "v1";
    detect(email) {
        const matched = email.from.toLowerCase().includes("santander.cl") || email.bodyHtml.toLowerCase().includes("banco santander");
        return { score: matched ? 100 : 0, isMatched: false }; // Not active for MVP
    }
    cleanHtml(html) { return html; }
    getPromptInstructions() { return ""; }
}
exports.SantanderProvider = SantanderProvider;
class BancoEstadoProvider extends base_1.BankProvider {
    name = "BancoEstado";
    version = "v1";
    detect(email) {
        const matched = email.from.toLowerCase().includes("bancoestado.cl") || email.bodyHtml.toLowerCase().includes("banco estado");
        return { score: matched ? 100 : 0, isMatched: false }; // Not active for MVP
    }
    cleanHtml(html) { return html; }
    getPromptInstructions() { return ""; }
}
exports.BancoEstadoProvider = BancoEstadoProvider;
class BCIProvider extends base_1.BankProvider {
    name = "BCI";
    version = "v1";
    detect(email) {
        const matched = email.from.toLowerCase().includes("bci.cl") || email.bodyHtml.toLowerCase().includes("banco de credito e inversiones");
        return { score: matched ? 100 : 0, isMatched: false }; // Not active for MVP
    }
    cleanHtml(html) { return html; }
    getPromptInstructions() { return ""; }
}
exports.BCIProvider = BCIProvider;
class ScotiabankProvider extends base_1.BankProvider {
    name = "Scotiabank";
    version = "v1";
    detect(email) {
        const matched = email.from.toLowerCase().includes("scotiabank.cl") || email.bodyHtml.toLowerCase().includes("scotiabank");
        return { score: matched ? 100 : 0, isMatched: false }; // Not active for MVP
    }
    cleanHtml(html) { return html; }
    getPromptInstructions() { return ""; }
}
exports.ScotiabankProvider = ScotiabankProvider;
class ItauProvider extends base_1.BankProvider {
    name = "Itaú";
    version = "v1";
    detect(email) {
        const matched = email.from.toLowerCase().includes("itau.cl") || email.bodyHtml.toLowerCase().includes("banco itaú");
        return { score: matched ? 100 : 0, isMatched: false }; // Not active for MVP
    }
    cleanHtml(html) { return html; }
    getPromptInstructions() { return ""; }
}
exports.ItauProvider = ItauProvider;
//# sourceMappingURL=skeletons.js.map