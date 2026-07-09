export declare function calculateConfidence(email: {
    subject: string;
    from: string;
}, providerMatched: boolean, normalized: Record<string, any>, validationSuccess: boolean): number;
