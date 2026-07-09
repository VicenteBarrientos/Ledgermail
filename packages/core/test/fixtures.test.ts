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
        } else if (text.includes("pedro aldunate silva")) {
          return Promise.resolve({
            rawText: JSON.stringify({
              amount: 75500,
              currency: "CLP",
              senderName: "PEDRO ALDUNATE SILVA",
              senderAccount: null,
              receiverBank: "Santander",
              receiverAccount: "0000889977011",
              reference: "77894523",
              description: null
            }),
            parsedJson: {
              amount: 75500,
              currency: "CLP",
              senderName: "PEDRO ALDUNATE SILVA",
              senderAccount: null,
              receiverBank: "Santander",
              receiverAccount: "0000889977011",
              reference: "77894523",
              description: null
            },
            usage: { promptTokens: 100, completionTokens: 50 }
          });
        } else if (text.includes("gabriela paz lopez")) {
          return Promise.resolve({
            rawText: JSON.stringify({
              amount: 230000,
              currency: "CLP",
              senderName: "GABRIELA PAZ LOPEZ",
              senderAccount: null,
              receiverBank: "BancoEstado",
              receiverAccount: "990011223",
              reference: "10459203",
              description: null
            }),
            parsedJson: {
              amount: 230000,
              currency: "CLP",
              senderName: "GABRIELA PAZ LOPEZ",
              senderAccount: null,
              receiverBank: "BancoEstado",
              receiverAccount: "990011223",
              reference: "10459203",
              description: null
            },
            usage: { promptTokens: 100, completionTokens: 50 }
          });
        } else if (text.includes("alberto muñoz rojas")) {
          return Promise.resolve({
            rawText: JSON.stringify({
              amount: 185000,
              currency: "CLP",
              senderName: "ALBERTO MUÑOZ ROJAS",
              senderAccount: null,
              receiverBank: "BCI",
              receiverAccount: "77665544",
              reference: "33492049",
              description: null
            }),
            parsedJson: {
              amount: 185000,
              currency: "CLP",
              senderName: "ALBERTO MUÑOZ ROJAS",
              senderAccount: null,
              receiverBank: "BCI",
              receiverAccount: "77665544",
              reference: "33492049",
              description: null
            },
            usage: { promptTokens: 100, completionTokens: 50 }
          });
        } else if (text.includes("claudia tapia soto")) {
          return Promise.resolve({
            rawText: JSON.stringify({
              amount: 98000,
              currency: "CLP",
              senderName: "CLAUDIA TAPIA SOTO",
              senderAccount: null,
              receiverBank: "Scotiabank",
              receiverAccount: "3344552211",
              reference: "88729302",
              description: null
            }),
            parsedJson: {
              amount: 98000,
              currency: "CLP",
              senderName: "CLAUDIA TAPIA SOTO",
              senderAccount: null,
              receiverBank: "Scotiabank",
              receiverAccount: "3344552211",
              reference: "88729302",
              description: null
            },
            usage: { promptTokens: 100, completionTokens: 50 }
          });
        } else if (text.includes("roberto valenzuela soto")) {
          return Promise.resolve({
            rawText: JSON.stringify({
              amount: 310000,
              currency: "CLP",
              senderName: "ROBERTO VALENZUELA SOTO",
              senderAccount: null,
              receiverBank: "Itaú",
              receiverAccount: "887766554",
              reference: "22940592",
              description: null
            }),
            parsedJson: {
              amount: 310000,
              currency: "CLP",
              senderName: "ROBERTO VALENZUELA SOTO",
              senderAccount: null,
              receiverBank: "Itaú",
              receiverAccount: "887766554",
              reference: "22940592",
              description: null
            },
            usage: { promptTokens: 100, completionTokens: 50 }
          });
        } else {
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

describe("Multi-Bank Fixture Tests", () => {
  it("should parse HTML fixtures for all bank providers and match expected JSON specifications", async () => {
    const fixturesDir = path.resolve(__dirname, "../../../fixtures");
    const dirs = fs.readdirSync(fixturesDir).filter(f => fs.statSync(path.join(fixturesDir, f)).isDirectory());

    for (const bankDirName of dirs) {
      const bankDir = path.join(fixturesDir, bankDirName);
      const files = fs.readdirSync(bankDir);
      const htmlFiles = files.filter(f => f.endsWith(".html"));

      for (const htmlFile of htmlFiles) {
        const rawHtml = fs.readFileSync(path.join(bankDir, htmlFile), "utf-8");
        const expectedJsonPath = path.join(bankDir, htmlFile.replace(".html", ".expected.json"));
        const expectedJson = JSON.parse(fs.readFileSync(expectedJsonPath, "utf-8"));

        let senderEmail = "bancochile-informa@bancochile.cl";
        if (bankDirName === "santander") senderEmail = "personas@santander.cl";
        else if (bankDirName === "banco-estado") senderEmail = "notificaciones@bancoestado.cl";
        else if (bankDirName === "bci") senderEmail = "notificaciones@bci.cl";
        else if (bankDirName === "scotiabank") senderEmail = "notificaciones@scotiabank.cl";
        else if (bankDirName === "itau") senderEmail = "informativo@itau.cl";

        const result = await parseEmailPipeline({
          mailboxSourceId: "mock-mailbox-source",
          from: senderEmail,
          subject: `Aviso transferencia de ${expectedJson.bank}`,
          bodyHtml: rawHtml
        }, true); // force reparse

        expect(result.success).toBe(true);
        const txn = result.transactions[0];

        expect(txn.bank.toLowerCase().replace(/[^a-z0-9]+/g, "")).toBe(expectedJson.bank.toLowerCase().replace(/[^a-z0-9]+/g, ""));
        expect(txn.amount).toBe(expectedJson.amount);
        expect(txn.currency).toBe(expectedJson.currency);
        expect(txn.senderName).toBe(expectedJson.senderName);
        expect(txn.senderAccount).toBe(expectedJson.senderAccount);
        expect(txn.receiverAccount).toBe(expectedJson.receiverAccount);
        expect(txn.reference).toBe(expectedJson.reference);
        expect(txn.description).toBe(expectedJson.description);
        expect(txn.transactionType).toBe(expectedJson.transactionType);
      }
    }
  });
});
