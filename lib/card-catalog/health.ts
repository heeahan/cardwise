import "server-only";
import { CatalogProviderError, type KoreanCardCatalogProvider } from "./providers/provider";
import type { ProviderConnectionReport } from "./types";

export async function testProviderConnection(provider: KoreanCardCatalogProvider): Promise<ProviderConnectionReport> {
  const startedAt = performance.now();
  const metadata = provider.getMetadata();
  if (!metadata || !["ready", "partial"].includes(metadata.status)) {
    return { providerName: metadata.displayName, configurationStatus: metadata.status, connected: false, responseTimeMs: Math.round(performance.now() - startedAt), contractVersion: metadata.contractVersion, errorClassification: metadata.status };
  }
  try {
    await Promise.race([
      provider.searchCards({ page: 1, pageSize: 1 }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new CatalogProviderError("timeout", "Provider connection timed out", true)), 5000)),
    ]);
    return { providerName: metadata.displayName, configurationStatus: metadata.status, connected: true, responseTimeMs: Math.round(performance.now() - startedAt), contractVersion: metadata.contractVersion, errorClassification: null };
  } catch (error) {
    const classification = error instanceof CatalogProviderError ? error.code : "unavailable";
    return { providerName: metadata.displayName, configurationStatus: metadata.status, connected: false, responseTimeMs: Math.round(performance.now() - startedAt), contractVersion: metadata.contractVersion, errorClassification: classification };
  }
}
