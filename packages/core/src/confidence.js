"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateConfidence = calculateConfidence;
function calculateConfidence(email, providerMatched, normalized, validationSuccess) {
    let score = 0;
    // 1. Provider detection certainty (20%)
    if (providerMatched)
        score += 0.20;
    // 2. Extracted amount validity (20%)
    if (typeof normalized.amount === "number" && normalized.amount > 0) {
        score += 0.20;
    }
    // 3. Valid Transaction Type (10%)
    if (normalized.transactionType === "transfer_received") {
        score += 0.10;
    }
    // 4. Sender details present and normalized (15%)
    if (normalized.senderName && normalized.senderName.length > 2) {
        score += 0.10;
    }
    if (normalized.senderAccount && normalized.senderAccount.length > 3) {
        score += 0.05;
    }
    // 5. Reference/ID extracted (10%)
    if (normalized.reference && normalized.reference.length > 2) {
        score += 0.10;
    }
    // 6. Validation success (25%)
    if (validationSuccess) {
        score += 0.25;
    }
    return Math.min(1.0, score);
}
//# sourceMappingURL=confidence.js.map