import type { CardSearchInput, CardSearchResult, ExternalBenefit, ExternalCardDetail, ProviderMetadata, SyncInput, SyncResult } from "../types";

export type ProviderErrorCode = "not_configured" | "contract_required" | "timeout" | "rate_limited" | "invalid_response" | "unauthorized" | "unavailable";

export class CatalogProviderError extends Error {
  constructor(public readonly code: ProviderErrorCode, message: string, public readonly retryable = false) {
    super(message);
    this.name = "CatalogProviderError";
  }
}

export interface KoreanCardCatalogProvider {
  providerId: "coocon" | "public-data" | "manual" | "mock";
  getMetadata(): ProviderMetadata;
  searchCards(input: CardSearchInput): Promise<CardSearchResult>;
  getCardDetail(externalCardId: string): Promise<ExternalCardDetail>;
  getCardBenefits(externalCardId: string): Promise<ExternalBenefit[]>;
  syncCards?(input: SyncInput): Promise<SyncResult>;
}

export async function withProviderTimeout<T>(operation: (signal: AbortSignal) => Promise<T>, timeoutMs = 8000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(Math.max(timeoutMs, 1000), 30000));
  try {
    return await operation(controller.signal);
  } catch (error) {
    if (controller.signal.aborted) throw new CatalogProviderError("timeout", "信用卡数据供应商响应超时", true);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function withLimitedRetry<T>(operation: () => Promise<T>, attempts = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < Math.min(Math.max(attempts, 1), 3); attempt += 1) {
    try { return await operation(); } catch (error) {
      lastError = error;
      if (!(error instanceof CatalogProviderError) || !error.retryable || attempt + 1 >= attempts) throw error;
    }
  }
  throw lastError;
}
