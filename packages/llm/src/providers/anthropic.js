"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnthropicProvider = void 0;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const shared_1 = require("@ledgermail/shared");
class AnthropicProvider {
    name = "anthropic";
    client = null;
    constructor() {
        if (shared_1.config.llm.anthropicApiKey) {
            this.client = new sdk_1.default({ apiKey: shared_1.config.llm.anthropicApiKey });
        }
        else {
            shared_1.logger.warn("Anthropic API key not set.");
        }
    }
    async parse(req, model = "claude-3-5-sonnet-20241022") {
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
                        input_schema: req.jsonSchema
                    }
                ],
                tool_choice: { type: "tool", name: "parse_transaction" }
            });
            const toolUseBlock = response.content.find((block) => block.type === "tool_use");
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
        }
        catch (error) {
            shared_1.logger.error("Anthropic parse error:", error);
            throw error;
        }
    }
}
exports.AnthropicProvider = AnthropicProvider;
//# sourceMappingURL=anthropic.js.map