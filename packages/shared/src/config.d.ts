export declare const config: {
    db: {
        url: string;
    };
    llm: {
        openaiApiKey: string;
        geminiApiKey: string;
        anthropicApiKey: string;
    };
    gmail: {
        clientId: string;
        clientSecret: string;
        redirectUri: string;
    };
    auth: {
        nextauthSecret: string;
    };
    api: {
        port: number;
        cronSecret: string;
    };
    flags: {
        enableAggressiveSanitizer: boolean;
        enableCache: boolean;
        enableRetry: boolean;
        defaultLlmProvider: "openai" | "gemini" | "anthropic";
        defaultModelName: string;
        enablePdfExtraction: boolean;
    };
};
