"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const confidence_1 = require("../src/confidence");
(0, vitest_1.describe)("Confidence Calculator", () => {
    const mockEmail = {
        subject: "Aviso de Transferencia",
        from: "bancochile-informa@bancochile.cl"
    };
    (0, vitest_1.it)("should calculate 1.0 confidence for fully valid and complete transactions", () => {
        const score = (0, confidence_1.calculateConfidence)(mockEmail, true, // providerMatched
        {
            amount: 150000,
            transactionType: "transfer_received",
            senderName: "JUAN PEREZ",
            senderAccount: "123456",
            reference: "987654"
        }, true // validationSuccess
        );
        (0, vitest_1.expect)(score).toBe(1.0);
    });
    (0, vitest_1.it)("should reduce score for missing optional metadata", () => {
        const score = (0, confidence_1.calculateConfidence)(mockEmail, true, {
            amount: 150000,
            transactionType: "transfer_received",
            senderName: "JUAN PEREZ",
            senderAccount: null, // missing account (-0.05)
            reference: null // missing reference (-0.10)
        }, true);
        (0, vitest_1.expect)(score).toBe(0.85);
    });
    (0, vitest_1.it)("should penalize heavily if validationSuccess is false", () => {
        const score = (0, confidence_1.calculateConfidence)(mockEmail, true, {
            amount: 0, // invalid amount (0 instead of > 0)
            transactionType: "transfer_received",
            senderName: "JUAN PEREZ",
            senderAccount: "123456",
            reference: "987654"
        }, false // validationSuccess (-0.25)
        );
        (0, vitest_1.expect)(score).toBeLessThan(0.70);
    });
});
//# sourceMappingURL=confidence.test.js.map