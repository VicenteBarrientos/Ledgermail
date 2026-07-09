import { z } from "zod";

export const TransactionValidationSchema = z.object({
  bank: z.string().min(1, "Bank name is required"),
  transactionType: z.string().min(1, "Transaction type is required"),
  amount: z.number().positive("Amount must be greater than 0"),
  currency: z.string().length(3, "Currency must be a 3-letter ISO code"),
  senderName: z.string().nullable().optional().transform(val => val || null),
  senderAccount: z.string().nullable().optional().transform(val => val || null),
  receiverAccount: z.string().nullable().optional().transform(val => val || null),
  reference: z.string().nullable().optional().transform(val => val || null),
  description: z.string().nullable().optional().transform(val => val || null)
});

export type ValidatedTransaction = z.infer<typeof TransactionValidationSchema>;
