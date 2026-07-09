import { BankProvider } from "./base";
import { BancoChileProvider } from "./banco-chile";
import { SantanderProvider, BancoEstadoProvider, BCIProvider, ScotiabankProvider, ItauProvider } from "./skeletons";

export const PROVIDERS: BankProvider[] = [
  new BancoChileProvider(),
  new SantanderProvider(),
  new BancoEstadoProvider(),
  new BCIProvider(),
  new ScotiabankProvider(),
  new ItauProvider()
];

export function detectProvider(email: {
  from: string;
  subject: string;
  bodyHtml: string;
  headers: Record<string, string>;
}): BankProvider | null {
  let bestProvider: BankProvider | null = null;
  let bestScore = 0;

  for (const provider of PROVIDERS) {
    const result = provider.detect(email);
    // Only route to providers that match (isMatched = true) and choose the highest score
    if (result.isMatched && result.score > bestScore) {
      bestScore = result.score;
      bestProvider = provider;
    }
  }

  return bestProvider;
}
