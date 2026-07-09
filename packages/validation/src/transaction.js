"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionValidationSchema = void 0;
const zod_1 = require("zod");
exports.TransactionValidationSchema = zod_1.z.object({
    bank: zod_1.z.string().min(1, "Bank name is required"),
    transactionType: zod_1.z.string().min(1, "Transaction type is required"),
    amount: zod_1.z.number().positive("Amount must be greater than 0"),
    currency: zod_1.z.string().length(3, "Currency must be a 3-letter ISO code"),
    senderName: zod_1.z.string().nullable().optional().transform(val => val || null),
    senderAccount: zod_1.z.string().nullable().optional().transform(val => val || null),
    receiverAccount: zod_1.z.string().nullable().optional().transform(val => val || null),
    reference: zod_1.z.string().nullable().optional().transform(val => val || null),
    description: zod_1.z.string().nullable().optional().transform(val => val || null)
});
//# sourceMappingURL=transaction.js.map