import { LLMProvider } from "./base";
export * from "./base";
export * from "./providers/openai";
export * from "./providers/gemini";
export * from "./providers/anthropic";
export declare const LLM_PROVIDERS: Record<string, LLMProvider>;
export declare function getLLMProvider(name: string): LLMProvider;
