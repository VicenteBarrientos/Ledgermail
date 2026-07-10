import { OpenAIProvider } from "./providers/openai";
import { GeminiProvider } from "./providers/gemini";
import { AnthropicProvider } from "./providers/anthropic";
import { LLMProvider, LLMParseRequest, LLMParseResponse } from "./base";

export * from "./base";
export * from "./providers/openai";
export * from "./providers/gemini";
export * from "./providers/anthropic";

export class MockProvider implements LLMProvider {
  readonly name = "mock";
  async parse(req: LLMParseRequest, model?: string): Promise<LLMParseResponse> {
    const mockJson = {
      amount: 50000,
      currency: "CLP",
      senderName: "Vicente Barrientos",
      senderAccount: "123-456-789",
      receiverBank: "Banco de Chile",
      receiverAccount: "123-456-789",
      reference: "12345678",
      description: "Transferencia de Fondos mock"
    };
    return {
      rawText: JSON.stringify(mockJson),
      parsedJson: mockJson,
      usage: {
        promptTokens: 10,
        completionTokens: 20
      }
    };
  }
}

export const LLM_PROVIDERS: Record<string, LLMProvider> = {
  openai: new OpenAIProvider(),
  gemini: new GeminiProvider(),
  anthropic: new AnthropicProvider(),
  mock: new MockProvider()
};

export function getLLMProvider(name: string): LLMProvider {
  const provider = LLM_PROVIDERS[name.toLowerCase()];
  if (!provider) {
    throw new Error(`Unsupported LLM provider: ${name}`);
  }
  return provider;
}
