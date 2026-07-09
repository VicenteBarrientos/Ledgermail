"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROVIDERS = void 0;
exports.detectProvider = detectProvider;
const banco_chile_1 = require("./banco-chile");
const skeletons_1 = require("./skeletons");
exports.PROVIDERS = [
    new banco_chile_1.BancoChileProvider(),
    new skeletons_1.SantanderProvider(),
    new skeletons_1.BancoEstadoProvider(),
    new skeletons_1.BCIProvider(),
    new skeletons_1.ScotiabankProvider(),
    new skeletons_1.ItauProvider()
];
function detectProvider(email) {
    let bestProvider = null;
    let bestScore = 0;
    for (const provider of exports.PROVIDERS) {
        const result = provider.detect(email);
        // Only route to providers that match (isMatched = true) and choose the highest score
        if (result.isMatched && result.score > bestScore) {
            bestScore = result.score;
            bestProvider = provider;
        }
    }
    return bestProvider;
}
//# sourceMappingURL=registry.js.map