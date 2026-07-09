import Anthropic from "@anthropic-ai/sdk";
import { config, logger } from "@ledgermail/shared";
import { LLMParseRequest, LLMParseResponse, LLMProvider } from "../base";

export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic";
  private client: Anthropic | null = null;

  constructor() {
    if (config.llm.anthropicApiKey) {
      this.client = new Anthropic({ apiKey: config.llm.anthropicApiKey });
    } else {
      logger.warn("Anthropic API key not set.");
    }
  }

  async parse(req: LLMParseRequest, model = "claude-3-5-sonnet-20241022"): Promise<LLMParseResponse> {
    if (!this.client) {
      throw new Error("Anthropic client not initialized (missing API key)");
    }

    try {
      const response = await this.client.messages.create({
        model: model,
        max_tokens: 4096,
        system: req.systemPrompt,
        messages: [{ role: "user", content: req.userPrompt }],
        tools: [
          {
            name: "parse_transaction",
            description: "Extract structured transaction data from the bank email.",
            input_schema: req.jsonSchema as any
          }
        ],
        tool_choice: { type: "tool", name: "parse_transaction" }
      } as any);

      const toolUseBlock = response.content.find((block: any) => block.type === "tool_use") as any;
      const parsedJson = toolUseBlock?.input || null;
      const rawText = JSON.stringify(parsedJson || {});

      return {
        rawText,
        parsedJson,
        usage: {
          promptTokens: response.usage?.input_tokens || 0,
          completionTokens: response.usage?.output_tokens || 0
        }
      };
    } catch (error: any) {
      logger.error("Anthropic parse error:", error);
      throw error;
    }
  }
}
