"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAIProvider = void 0;
const openai_1 = require("openai");
const shared_1 = require("@ledgermail/shared");
class OpenAIProvider {
    name = "openai";
    client = null;
    constructor() {
        if (shared_1.config.llm.openaiApiKey) {
            this.client = new openai_1.OpenAI({ apiKey: shared_1.config.llm.openaiApiKey });
        }
        else {
            shared_1.logger.warn("OpenAI API key not set.");
        }
    }
    async parse(req, model = "gpt-4o-mini") {
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
            let parsedJson = null;
            try {
                parsedJson = JSON.parse(rawText);
            }
            catch (err) {
                shared_1.logger.error("Failed to parse OpenAI JSON output:", err, "Raw response was:", rawText);
            }
            return {
                rawText,
                parsedJson,
                usage: {
                    promptTokens: response.usage?.prompt_tokens || 0,
                    completionTokens: response.usage?.completion_tokens || 0
                }
            };
        }
        catch (error) {
            shared_1.logger.error("OpenAI parse error:", error);
            throw error;
        }
    }
}
exports.OpenAIProvider = OpenAIProvider;
//# sourceMappingURL=openai.js.map