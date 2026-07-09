import { OpenAI } from "openai";
import { config, logger } from "@ledgermail/shared";
import { LLMParseRequest, LLMParseResponse, LLMProvider } from "../base";

export class OpenAIProvider implements LLMProvider {
  readonly name = "openai";
  private client: OpenAI | null = null;

  constructor() {
    if (config.llm.openaiApiKey) {
      this.client = new OpenAI({ apiKey: config.llm.openaiApiKey });
    } else {
      logger.warn("OpenAI API key not set.");
    }
  }

  async parse(req: LLMParseRequest, model = "gpt-4o-mini"): Promise<LLMParseResponse> {
    if (!this.client) {
      throw new Error("OpenAI client not initialized (missing API key)");
    }

    try {
      const response = await this.client.chat.completions.create({
        model: model,
        messages: [
          { role: "system", content: req.systemPrompt },
          { role: "user", content: req.userPrompt }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "transaction_extraction",
            strict: true,
            schema: req.jsonSchema
          }
        }
      });

      const choice = response.choices[0];
      const rawText = choice.message?.content || "";
      let parsedJson: Record<string, any> | null = null;
      try {
        parsedJson = JSON.parse(rawText);
      } catch (err) {
        logger.error("Failed to parse OpenAI JSON output:", err, "Raw response was:", rawText);
      }

      return {
        rawText,
        parsedJson,
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0
        }
      };
    } catch (error: any) {
      logger.error("OpenAI parse error:", error);
      throw error;
    }
  }
}
