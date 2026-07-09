import { LLMParseRequest, LLMParseResponse, LLMProvider } from "../base";
export declare class OpenAIProvider implements LLMProvider {
    readonly name = "openai";
    private client;
    constructor();
    parse(req: LLMParseRequest, model?: string): Promise<LLMParseResponse>;
}
