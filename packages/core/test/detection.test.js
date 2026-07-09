"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const providers_1 = require("@ledgermail/providers");
(0, vitest_1.describe)("Bank Provider Detection", () => {
    (0, vitest_1.it)("should detect Banco de Chile from email domain and markers", () => {
        const email = {
            from: "bancochile-informa@bancochile.cl",
            subject: "Aviso de Transferencia Recibida",
            bodyHtml: "<html><body>Notificación de Banco de Chile para usted.</body></html>",
            headers: {}
        };
        const provider = (0, providers_1.detectProvider)(email);
        (0, vitest_1.expect)(provider).not.toBeNull();
        (0, vitest_1.expect)(provider?.name).toBe("Banco de Chile");
    });
    (0, vitest_1.it)("should not match Santander for the MVP", () => {
        const email = {
            from: "personas@santander.cl",
            subject: "Aviso de Transferencia",
            bodyHtml: "<html><body>Banco Santander de Chile.</body></html>",
            headers: {}
        };
        const provider = (0, providers_1.detectProvider)(email);
        (0, vitest_1.expect)(provider).toBeNull();
    });
});
//# sourceMappingURL=detection.test.js.map