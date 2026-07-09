import { z } from "zod";
export declare const TransactionValidationSchema: z.ZodObject<{
    bank: z.ZodString;
    transactionType: z.ZodString;
    amount: z.ZodNumber;
    currency: z.ZodString;
    senderName: z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null, string | null | undefined>;
    senderAccount: z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null, string | null | undefined>;
    receiverAccount: z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null, string | null | undefined>;
    reference: z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null, string | null | undefined>;
    description: z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | null, string | null | undefined>;
}, "strip", z.ZodTypeAny, {
    amount: number;
    currency: string;
    senderName: string | null;
    senderAccount: string | null;
    receiverAccount: string | null;
    reference: string | null;
    description: string | null;
    transactionType: string;
    bank: string;
}, {
    amount: number;
    currency: string;
    transactionType: string;
    bank: string;
    senderName?: string | null | undefined;
    senderAccount?: string | null | undefined;
    receiverAccount?: string | null | undefined;
    reference?: string | null | undefined;
    description?: string | null | undefined;
}>;
export type ValidatedTransaction = z.infer<typeof TransactionValidationSchema>;
