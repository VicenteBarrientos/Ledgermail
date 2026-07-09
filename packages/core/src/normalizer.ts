export function normalizeLLMOutput(raw: Record<string, any>): Record<string, any> {
  const normalized = { ...raw };

  // 1. Amount Normalization: Remove currency signs, whitespace, and clean separators
  if (normalized.amount !== undefined && normalized.amount !== null) {
    if (typeof normalized.amount === "string") {
      let cleanAmount = normalized.amount.replace(/[^\d.,-]/g, "").trim();
      
      // Handle standard Chilean/Latin notation (dot is thousands, comma is decimal)
      // E.g., "120.000,50" -> 120000.50
      if (cleanAmount.includes(".") && cleanAmount.includes(",")) {
        if (cleanAmount.lastIndexOf(".") < cleanAmount.lastIndexOf(",")) {
          // Dot comes before comma -> "120.000,50"
          cleanAmount = cleanAmount.replace(/\./g, "").replace(",", ".");
        } else {
          // Comma comes before dot -> "120,000.50"
          cleanAmount = cleanAmount.replace(/,/g, "");
        }
      } else if (cleanAmount.includes(",")) {
        // Single separator comma: could be thousands or decimals
        const parts = cleanAmount.split(",");
        if (parts[1] && parts[1].length === 3) {
          cleanAmount = cleanAmount.replace(/,/g, "");
        } else {
          cleanAmount = cleanAmount.replace(",", ".");
        }
      } else if (cleanAmount.includes(".")) {
        // Single separator dot: could be thousands or decimals
        const parts = cleanAmount.split(".");
        if (parts[1] && parts[1].length === 3) {
          cleanAmount = cleanAmount.replace(/\./g, "");
        }
      }
      
      normalized.amount = parseFloat(cleanAmount) || 0.0;
    } else if (typeof normalized.amount === "number") {
      normalized.amount = normalized.amount;
    } else {
      normalized.amount = 0.0;
    }
  } else {
    normalized.amount = 0.0;
  }

  // 2. Currency
  if (typeof normalized.currency === "string") {
    normalized.currency = normalized.currency.toUpperCase().trim();
  } else {
    normalized.currency = "CLP"; // default
  }

  // 3. Sender Name
  if (typeof normalized.senderName === "string") {
    normalized.senderName = normalized.senderName.trim().toUpperCase() || null;
  }

  // 4. Accounts
  if (typeof normalized.senderAccount === "string") {
    normalized.senderAccount = normalized.senderAccount.replace(/[\s-]/g, "") || null;
  } else if (typeof normalized.senderAccount === "number") {
    normalized.senderAccount = String(normalized.senderAccount);
  }

  if (typeof normalized.receiverAccount === "string") {
    normalized.receiverAccount = normalized.receiverAccount.replace(/[\s-]/g, "") || null;
  } else if (typeof normalized.receiverAccount === "number") {
    normalized.receiverAccount = String(normalized.receiverAccount);
  }

  // 5. Reference
  if (normalized.reference !== undefined && normalized.reference !== null) {
    normalized.reference = String(normalized.reference).trim() || null;
  }

  // 6. Description
  if (typeof normalized.description === "string") {
    normalized.description = normalized.description.trim() || null;
  }

  return normalized;
}
