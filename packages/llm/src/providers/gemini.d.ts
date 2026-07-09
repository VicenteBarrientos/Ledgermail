import { LLMParseRequest, LLMParseResponse, LLMProvider } from "../base";
export declare class GeminiProvider implements LLMProvider {
    readonly name = "gemini";
    private apiKey;
    constructor();
    parse(req: LLMParseRequest, model?: string): Promise<LLMParseResponse>;
    private convertSchemaToGemini;
}
