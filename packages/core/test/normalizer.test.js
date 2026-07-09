"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const normalizer_1 = require("../src/normalizer");
(0, vitest_1.describe)("Data Normalizer", () => {
    (0, vitest_1.it)("should normalize amounts correctly", () => {
        (0, vitest_1.expect)((0, normalizer_1.normalizeLLMOutput)({ amount: "$ 120.000" }).amount).toBe(120000);
        (0, vitest_1.expect)((0, normalizer_1.normalizeLLMOutput)({ amount: "$120.000,50" }).amount).toBe(120000.50);
        (0, vitest_1.expect)((0, normalizer_1.normalizeLLMOutput)({ amount: "CLP 1.500" }).amount).toBe(1500);
        (0, vitest_1.expect)((0, normalizer_1.normalizeLLMOutput)({ amount: "1.000.000" }).amount).toBe(1000000);
        (0, vitest_1.expect)((0, normalizer_1.normalizeLLMOutput)({ amount: 15000 }).amount).toBe(15000);
    });
    (0, vitest_1.it)("should normalize currencies to uppercase", () => {
        (0, vitest_1.expect)((0, normalizer_1.normalizeLLMOutput)({ currency: "clp" }).currency).toBe("CLP");
        (0, vitest_1.expect)((0, normalizer_1.normalizeLLMOutput)({ currency: "usd " }).currency).toBe("USD");
    });
    (0, vitest_1.it)("should format senderName to uppercase trim", () => {
        (0, vitest_1.expect)((0, normalizer_1.normalizeLLMOutput)({ senderName: "  Juan Perez  " }).senderName).toBe("JUAN PEREZ");
    });
    (0, vitest_1.it)("should clean account numbers of spaces and hyphens", () => {
        (0, vitest_1.expect)((0, normalizer_1.normalizeLLMOutput)({ senderAccount: "12-345 6789-0" }).senderAccount).toBe("1234567890");
        (0, vitest_1.expect)((0, normalizer_1.normalizeLLMOutput)({ receiverAccount: " 98 765 4321 " }).receiverAccount).toBe("987654321");
    });
});
//# sourceMappingURL=normalizer.test.js.map