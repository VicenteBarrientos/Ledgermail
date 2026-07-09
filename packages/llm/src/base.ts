export interface LLMParseRequest {
  systemPrompt: string;
  userPrompt: string;
  jsonSchema: Record<string, any>;
}

export interface LLMParseResponse {
  rawText: string;
  parsedJson: Record<string, any> | null;
  usage: {
    promptTokens: number;
    completionTokens: number;
  };
}

export interface LLMProvider {
  name: string;
  parse(req: LLMParseRequest, model?: string): Promise<LLMParseResponse>;
}
