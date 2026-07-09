"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const vitest_1 = require("vitest");
const parser_1 = require("../src/parser");
// Mock database and LLM calls since we don't have active keys / real DB in unit test context
vitest_1.vi.mock("@ledgermail/database", () => {
    return {
        EmailStatus: {
            PENDING: "PENDING",
            PARSED: "PARSED",
            NEEDS_REVIEW: "NEEDS_REVIEW",
            FAILED: "FAILED"
        },
        db: {
            email: {
                upsert: vitest_1.vi.fn().mockImplementation((args) => Promise.resolve({ id: "mock-email-id", ...args.create })),
                findUnique: vitest_1.vi.fn().mockResolvedValue(null),
                update: vitest_1.vi.fn().mockResolvedValue({})
            },
            transaction: {
                deleteMany: vitest_1.vi.fn().mockResolvedValue({}),
                create: vitest_1.vi.fn().mockImplementation((args) => Promise.resolve({ id: "mock-txn-id", ...args.data }))
            },
            parseAttempt: {
                create: vitest_1.vi.fn().mockResolvedValue({})
            }
        }
    };
});
vitest_1.vi.mock("@ledgermail/llm", () => {
    return {
        getLLMProvider: vitest_1.vi.fn().mockReturnValue({
            name: "mock-openai",
            parse: vitest_1.vi.fn().mockResolvedValue({
                rawText: JSON.stringify({
                    transactionType: "transfer_received",
                    amount: 150000,
                    currency: "CLP",
                    senderName: "JUAN PEREZ GONZALEZ",
                    senderAccount: "12-345-6789-0",
                    receiverAccount: "98-765-4321-0",
                    reference: "987654321",
                    description: "Pago de arriendo julio"
                }),
                parsedJson: {
                    transactionType: "transfer_received",
                    amount: 150000,
                    currency: "CLP",
                    senderName: "JUAN PEREZ GONZALEZ",
                    senderAccount: "12-345-6789-0",
                    receiverAccount: "98-765-4321-0",
                    reference: "987654321",
                    description: "Pago de arriendo julio"
                },
                usage: { promptTokens: 100, completionTokens: 50 }
            })
        })
    };
});
(0, vitest_1.describe)("Banco de Chile Fixture Tests", () => {
    (0, vitest_1.it)("should parse HTML fixtures and match expected JSON specifications", async () => {
        const bankDir = path_1.default.resolve(__dirname, "../../../fixtures/banco-chile");
        const files = fs_1.default.readdirSync(bankDir);
        const htmlFiles = files.filter(f => f.endsWith(".html"));
        for (const htmlFile of htmlFiles) {
            const rawHtml = fs_1.default.readFileSync(path_1.default.join(bankDir, htmlFile), "utf-8");
            const expectedJsonPath = path_1.default.join(bankDir, htmlFile.replace(".html", ".expected.json"));
            const expectedJson = JSON.parse(fs_1.default.readFileSync(expectedJsonPath, "utf-8"));
            const result = await (0, parser_1.parseEmailPipeline)({
                mailboxSourceId: "mock-mailbox-source",
                from: "bancochile-informa@bancochile.cl",
                subject: "Aviso de Transferencia Recibida",
                bodyHtml: rawHtml
            }, true); // force reparse
            (0, vitest_1.expect)(result.success).toBe(true);
            const txn = result.transactions[0];
            (0, vitest_1.expect)(txn.amount).toBe(expectedJson.amount);
            (0, vitest_1.expect)(txn.currency).toBe(expectedJson.currency);
            (0, vitest_1.expect)(txn.senderName).toBe(expectedJson.senderName);
            (0, vitest_1.expect)(txn.senderAccount).toBe(expectedJson.senderAccount);
            (0, vitest_1.expect)(txn.receiverAccount).toBe(expectedJson.receiverAccount);
            (0, vitest_1.expect)(txn.reference).toBe(expectedJson.reference);
            (0, vitest_1.expect)(txn.description).toBe(expectedJson.description);
        }
    });
});
//# sourceMappingURL=fixtures.test.js.map