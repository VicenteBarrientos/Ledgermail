import { describe, it, expect } from "vitest";
import { calculateConfidence } from "../src/confidence";

describe("Confidence Calculator", () => {
  const mockEmail = {
    subject: "Aviso de Transferencia",
    from: "bancochile-informa@bancochile.cl"
  };

  it("should calculate 1.0 confidence for fully valid and complete transactions", () => {
    const score = calculateConfidence(
      mockEmail,
      true, // providerMatched
      {
        amount: 150000,
        transactionType: "transfer_received",
        senderName: "JUAN PEREZ",
        senderAccount: "123456",
        reference: "987654"
      },
      true // validationSuccess
    );
    expect(score).toBe(1.0);
  });

  it("should reduce score for missing optional metadata", () => {
    const score = calculateConfidence(
      mockEmail,
      true,
      {
        amount: 150000,
        transactionType: "transfer_received",
        senderName: "JUAN PEREZ",
        senderAccount: null, // missing account (-0.05)
        reference: null // missing reference (-0.10)
      },
      true
    );
    expect(score).toBe(0.85);
  });

  it("should penalize heavily if validationSuccess is false", () => {
    const score = calculateConfidence(
      mockEmail,
      true,
      {
        amount: 0, // invalid amount (0 instead of > 0)
        transactionType: "transfer_received",
        senderName: "JUAN PEREZ",
        senderAccount: "123456",
        reference: "987654"
      },
      false // validationSuccess (-0.25)
    );
    expect(score).toBeLessThan(0.70);
  });
});
