"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractTextFromPdf = extractTextFromPdf;
const pdf_parse_1 = __importDefault(require("pdf-parse"));
const shared_1 = require("@ledgermail/shared");
async function extractTextFromPdf(buffer) {
    try {
        const data = await (0, pdf_parse_1.default)(buffer);
        return data.text || "";
    }
    catch (error) {
        shared_1.logger.error("Failed to parse PDF content:", error);
        return "";
    }
}
//# sourceMappingURL=pdf.js.map