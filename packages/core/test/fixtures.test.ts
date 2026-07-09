import fs from "fs";
import path from "path";
import { describe, it, expect, vi } from "vitest";
import { parseEmailPipeline } from "../src/parser";

// Mock database and LLM calls since we don't have active keys / real DB in unit test context
vi.mock("@ledgermail/database", () => {
  return {
    EmailStatus: {
      PENDING: "PENDING",
      PARSED: "PARSED",
      NEEDS_REVIEW: "NEEDS_REVIEW",
      FAILED: "FAILED"
    },
    db: {
      email: {
        upsert: vi.fn().mockImplementation((args) => Promise.resolve({ id: "mock-email-id", ...args.create })),
        findUnique: vi.fn().mockResolvedValue(null),
        update: vi.fn().mockResolvedValue({})
      },
      transaction: {
        deleteMany: vi.fn().mockResolvedValue({}),
        create: vi.fn().mockImplementation((args) => Promise.resolve({ id: "mock-txn-id", ...args.data }))
      },
      parseAttempt: {
        create: vi.fn().mockResolvedValue({})
      }
    }
  };
});

vi.mock("@ledgermail/llm", () => {
  return {
    getLLMProvider: vi.fn().mockReturnValue({
      name: "mock-openai",
      parse: vi.fn().mockImplementation((req) => {
        const text = req.userPrompt.toLowerCase();
        
        if (text.includes("carlos mena soto")) {
          // incoming_transfer_01
          return Promise.resolve({
            rawText: JSON.stringify({
              amount: 100000,
              currency: "CLP",
              senderName: "CARLOS MENA SOTO",
              senderAccount: null,
              receiverBank: "Banco Chile/Edwards",
              receiverAccount: "0711122233044",
              reference: "TEFMBCO2006201005305088888888",
              description: null
            }),
            parsedJson: {
              amount: 100000,
              currency: "CLP",
              senderName: "CARLOS MENA SOTO",
              senderAccount: null,
              receiverBank: "Banco Chile/Edwards",
              receiverAccount: "0711122233044",
              reference: "TEFMBCO2006201005305088888888",
              description: null
            },
            usage: { promptTokens: 100, completionTokens: 50 }
          });
        } else if (text.includes("pedro soto muñoz")) {
          // outbound_transfer_01
          return Promise.resolve({
            rawText: JSON.stringify({
              amount: 100000,
              currency: "CLP",
              senderName: "PEDRO SOTO MUÑOZ",
              senderAccount: null,
              receiverBank: "Banco Estado",
              receiverAccount: "0000111223004",
              reference: "TEFMBCO2506251721305199999999",
              description: null
            }),
            parsedJson: {
              amount: 100000,
              currency: "CLP",
              senderName: "PEDRO SOTO MUÑOZ",
              senderAccount: null,
              receiverBank: "Banco Estado",
              receiverAccount: "0000111223004",
              reference: "TEFMBCO2506251721305199999999",
              description: null
            },
            usage: { promptTokens: 100, completionTokens: 50 }
          });
        } else {
          // transfer_01
          return Promise.resolve({
            rawText: JSON.stringify({
              amount: 150000,
              currency: "CLP",
              senderName: "JUAN PEREZ GONZALEZ",
              senderAccount: "12-345-6789-0",
              receiverBank: "Banco de Chile",
              receiverAccount: "98-765-4321-0",
              reference: "987654321",
              description: "Pago de arriendo julio"
            }),
            parsedJson: {
              amount: 150000,
              currency: "CLP",
              senderName: "JUAN PEREZ GONZALEZ",
              senderAccount: "12-345-6789-0",
              receiverBank: "Banco de Chile",
              receiverAccount: "98-765-4321-0",
              reference: "987654321",
              description: "Pago de arriendo julio"
            },
            usage: { promptTokens: 100, completionTokens: 50 }
          });
        }
      })
    })
  };
});

describe("Banco de Chile Fixture Tests", () => {
  it("should parse HTML fixtures and match expected JSON specifications", async () => {
    const bankDir = path.resolve(__dirname, "../../../fixtures/banco-chile");
    const files = fs.readdirSync(bankDir);
    const htmlFiles = files.filter(f => f.endsWith(".html"));

    for (const htmlFile of htmlFiles) {
      const rawHtml = fs.readFileSync(path.join(bankDir, htmlFile), "utf-8");
      const expectedJsonPath = path.join(bankDir, htmlFile.replace(".html", ".expected.json"));
      const expectedJson = JSON.parse(fs.readFileSync(expectedJsonPath, "utf-8"));

      const result = await parseEmailPipeline({
        mailboxSourceId: "mock-mailbox-source",
        from: "bancochile-informa@bancochile.cl",
        subject: "Aviso de transferencia de fondos",
        bodyHtml: rawHtml
      }, true); // force reparse

      expect(result.success).toBe(true);
      const txn = result.transactions[0];
      
      expect(txn.amount).toBe(expectedJson.amount);
      expect(txn.currency).toBe(expectedJson.currency);
      expect(txn.senderName).toBe(expectedJson.senderName);
      expect(txn.senderAccount).toBe(expectedJson.senderAccount);
      expect(txn.receiverAccount).toBe(expectedJson.receiverAccount);
      expect(txn.reference).toBe(expectedJson.reference);
      expect(txn.description).toBe(expectedJson.description);
      expect(txn.transactionType).toBe(expectedJson.transactionType);
    }
  });
});
