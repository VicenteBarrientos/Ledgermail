import { OpenAIProvider } from "./providers/openai";
import { GeminiProvider } from "./providers/gemini";
import { AnthropicProvider } from "./providers/anthropic";
import { LLMProvider } from "./base";

export * from "./base";
export * from "./providers/openai";
export * from "./providers/gemini";
export * from "./providers/anthropic";

export const LLM_PROVIDERS: Record<string, LLMProvider> = {
  openai: new OpenAIProvider(),
  gemini: new GeminiProvider(),
  anthropic: new AnthropicProvider()
};

export function getLLMProvider(name: string): LLMProvider {
  const provider = LLM_PROVIDERS[name.toLowerCase()];
  if (!provider) {
    throw new Error(`Unsupported LLM provider: ${name}`);
  }
  return provider;
}
