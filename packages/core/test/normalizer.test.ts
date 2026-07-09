import { describe, it, expect } from "vitest";
import { normalizeLLMOutput } from "../src/normalizer";

describe("Data Normalizer", () => {
  it("should normalize amounts correctly", () => {
    expect(normalizeLLMOutput({ amount: "$ 120.000" }).amount).toBe(120000);
    expect(normalizeLLMOutput({ amount: "$120.000,50" }).amount).toBe(120000.50);
    expect(normalizeLLMOutput({ amount: "CLP 1.500" }).amount).toBe(1500);
    expect(normalizeLLMOutput({ amount: "1.000.000" }).amount).toBe(1000000);
    expect(normalizeLLMOutput({ amount: 15000 }).amount).toBe(15000);
  });

  it("should normalize currencies to uppercase", () => {
    expect(normalizeLLMOutput({ currency: "clp" }).currency).toBe("CLP");
    expect(normalizeLLMOutput({ currency: "usd " }).currency).toBe("USD");
  });

  it("should format senderName to uppercase trim", () => {
    expect(normalizeLLMOutput({ senderName: "  Juan Perez  " }).senderName).toBe("JUAN PEREZ");
  });

  it("should clean account numbers of spaces and hyphens", () => {
    expect(normalizeLLMOutput({ senderAccount: "12-345 6789-0" }).senderAccount).toBe("1234567890");
    expect(normalizeLLMOutput({ receiverAccount: " 98 765 4321 " }).receiverAccount).toBe("987654321");
  });
});
