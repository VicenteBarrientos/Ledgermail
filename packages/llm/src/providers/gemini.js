"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiProvider = void 0;
const shared_1 = require("@ledgermail/shared");
class GeminiProvider {
    name = "gemini";
    apiKey;
    constructor() {
        this.apiKey = shared_1.config.llm.geminiApiKey;
        if (!this.apiKey) {
            shared_1.logger.warn("Gemini API key not set.");
        }
    }
    async parse(req, model = "gemini-1.5-flash") {
        if (!this.apiKey) {
            throw new Error("Gemini client not initialized (missing API key)");
        }
        try {
            const geminiSchema = this.convertSchemaToGemini(req.jsonSchema);
            const payload = {
                systemInstruction: {
                    parts: [{ text: req.systemPrompt }]
                },
                contents: [
                    {
                        role: "user",
                        parts: [{ text: req.userPrompt }]
                    }
                ],
                generationConfig: {
                    responseMimeType: "application/json",
                    responseSchema: geminiSchema
                }
            };
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Gemini API error (Status ${response.status}): ${errorText}`);
            }
            const data = await response.json();
            const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
            let parsedJson = null;
            try {
                parsedJson = JSON.parse(rawText);
            }
            catch (err) {
                shared_1.logger.error("Failed to parse Gemini JSON output:", err, "Raw response was:", rawText);
            }
            return {
                rawText,
                parsedJson,
                usage: {
                    promptTokens: data.usageMetadata?.promptTokenCount || 0,
                    completionTokens: data.usageMetadata?.candidatesTokenCount || 0
                }
            };
        }
        catch (error) {
            shared_1.logger.error("Gemini parse error:", error);
            throw error;
        }
    }
    convertSchemaToGemini(schema) {
        if (!schema)
            return schema;
        const copy = { ...schema };
        if (Array.isArray(copy.type)) {
            // Find non-null type (Gemini schema requires single string type + nullable flag)
            const hasNull = copy.type.includes("null");
            const nonNullType = copy.type.find((t) => t !== "null");
            copy.type = nonNullType ? nonNullType.toUpperCase() : "STRING";
            if (hasNull) {
                copy.nullable = true;
            }
        }
        else if (typeof copy.type === "string") {
            copy.type = copy.type.toUpperCase();
        }
        if (copy.properties) {
            const newProps = {};
            for (const [key, prop] of Object.entries(copy.properties)) {
                newProps[key] = this.convertSchemaToGemini(prop);
            }
            copy.properties = newProps;
        }
        if (copy.items) {
            copy.items = this.convertSchemaToGemini(copy.items);
        }
        // Gemini API does not support standard Zod schema description field in some older schemas or strict types,
        // but works fine if we keep it. We'll leave it as is or strip if required.
        return copy;
    }
}
exports.GeminiProvider = GeminiProvider;
//# sourceMappingURL=gemini.js.map