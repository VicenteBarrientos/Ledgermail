import { describe, it, expect } from "vitest";
import { detectProvider } from "@ledgermail/providers";

describe("Bank Provider Detection", () => {
  it("should detect Banco de Chile from email domain and markers", () => {
    const email = {
      from: "bancochile-informa@bancochile.cl",
      subject: "Aviso de Transferencia Recibida",
      bodyHtml: "<html><body>Notificación de Banco de Chile para usted.</body></html>",
      headers: {}
    };
    const provider = detectProvider(email);
    expect(provider).not.toBeNull();
    expect(provider?.name).toBe("Banco de Chile");
  });

  it("should not match Santander for the MVP", () => {
    const email = {
      from: "personas@santander.cl",
      subject: "Aviso de Transferencia",
      bodyHtml: "<html><body>Banco Santander de Chile.</body></html>",
      headers: {}
    };
    const provider = detectProvider(email);
    expect(provider).toBeNull();
  });
});
