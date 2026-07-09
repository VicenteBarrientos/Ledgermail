export declare const TransactionJsonSchema: {
    type: string;
    properties: {
        transactionType: {
            type: string;
            description: string;
        };
        amount: {
            type: string;
            description: string;
        };
        currency: {
            type: string;
            description: string;
        };
        senderName: {
            type: string[];
            description: string;
        };
        senderAccount: {
            type: string[];
            description: string;
        };
        receiverAccount: {
            type: string[];
            description: string;
        };
        reference: {
            type: string[];
            description: string;
        };
        description: {
            type: string[];
            description: string;
        };
    };
    required: string[];
    additionalProperties: boolean;
};
export declare function computeSHA256(text: string): string;
export declare function loadPrompt(bankName: string, version: string): string;
export interface ParseInput {
    mailboxSourceId: string;
    messageId?: string;
    from: string;
    subject: string;
    bodyHtml: string;
    headers?: Record<string, string>;
    hasAttachments?: boolean;
}
export declare function parseEmailPipeline(input: ParseInput, forceReparse?: boolean): Promise<any>;
