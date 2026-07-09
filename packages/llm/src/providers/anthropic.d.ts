import { LLMParseRequest, LLMParseResponse, LLMProvider } from "../base";
export declare class AnthropicProvider implements LLMProvider {
    readonly name = "anthropic";
    private client;
    constructor();
    parse(req: LLMParseRequest, model?: string): Promise<LLMParseResponse>;
}
