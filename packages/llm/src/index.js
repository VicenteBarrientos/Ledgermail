"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLM_PROVIDERS = void 0;
exports.getLLMProvider = getLLMProvider;
const openai_1 = require("./providers/openai");
const gemini_1 = require("./providers/gemini");
const anthropic_1 = require("./providers/anthropic");
__exportStar(require("./base"), exports);
__exportStar(require("./providers/openai"), exports);
__exportStar(require("./providers/gemini"), exports);
__exportStar(require("./providers/anthropic"), exports);
exports.LLM_PROVIDERS = {
    openai: new openai_1.OpenAIProvider(),
    gemini: new gemini_1.GeminiProvider(),
    anthropic: new anthropic_1.AnthropicProvider()
};
function getLLMProvider(name) {
    const provider = exports.LLM_PROVIDERS[name.toLowerCase()];
    if (!provider) {
        throw new Error(`Unsupported LLM provider: ${name}`);
    }
    return provider;
}
//# sourceMappingURL=index.js.map