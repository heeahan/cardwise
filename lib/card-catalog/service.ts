import { createHash } from "node:crypto";
import { normalizeExternalCards } from "./normalizer";
import { createCooconProvider } from "./providers/coocon";
import { MockCatalogProvider } from "./providers/mock";
import type { KoreanCardCatalogProvider } from "./providers/provider";
import { createPublicDataProvider } from "./providers/public-data";
import type { CatalogProviderId, CatalogSyncComparable, CatalogSyncPlan, CatalogSyncPlanItem, NormalizedCatalogCard } from "./types";

export function resolveCatalogProvider(providerId = process.env.CARD_CATALOG_PROVIDER): KoreanCardCatalogProvider {
  if (providerId === "coocon") return createCooconProvider();
  if (providerId === "public-data") return createPublicDataProvider();
  if (providerId === "mock" && process.env.NODE_ENV === "test") return new MockCatalogProvider();
  return createCooconProvider();
}

export function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => `${JSON.stringify(key)}:${stableSerialize(child)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}

export function catalogFingerprint(card: NormalizedCatalogCard) {
  const safe = { ...card, rawData: undefined, benefits: card.benefits.map((benefit) => ({ ...benefit, rawData: undefined })) };
  return createHash("sha256").update(stableSerialize(safe)).digest("hex");
}

export function buildCatalogSyncPlan(existing: CatalogSyncComparable[], incomingPayload: unknown): CatalogSyncPlan {
  const incoming = normalizeExternalCards(incomingPayload);
  const prior = new Map(existing.map((card) => [`${card.providerId}:${card.externalCardId}`, card]));
  const seen = new Set<string>();
  const items: CatalogSyncPlanItem[] = incoming.map((card) => {
    const key = `${card.providerId}:${card.externalCardId}`;
    seen.add(key);
    const previous = prior.get(key);
    const fingerprint = catalogFingerprint(card);
    if (!previous) return { action: "create", card, materialFields: [] };
    if (previous.fingerprint === fingerprint) return { action: "unchanged", card, previous, materialFields: [] };
    return { action: "update", card, previous, materialFields: ["catalog_payload"] };
  });
  for (const previous of existing) {
    const key = `${previous.providerId}:${previous.externalCardId}`;
    if (!seen.has(key) && previous.productStatus === "active") {
      const placeholder: NormalizedCatalogCard = {
        providerId: previous.providerId, externalCardId: previous.externalCardId, issuerNameKo: "동기화 확인 필요", nameKo: "동기화에서 누락된 상품", cardType: "credit", brand: "Local", annualFeeDomestic: 0, currency: "KRW", officialUrl: "https://example.invalid/not-exposed", productStatus: "discontinued", sourceUrl: "https://example.invalid/not-exposed", sourceName: "同步状态检查", normalizedName: previous.externalCardId, verificationStatus: "outdated", benefits: [],
      };
      items.push({ action: "discontinue", card: placeholder, previous, materialFields: ["productStatus"] });
    }
  }
  return {
    items,
    created: items.filter((item) => item.action === "create").length,
    updated: items.filter((item) => item.action === "update").length,
    unchanged: items.filter((item) => item.action === "unchanged").length,
    discontinued: items.filter((item) => item.action === "discontinue").length,
  };
}

export function providerIdFromEnvironment(): CatalogProviderId | undefined {
  const value = process.env.CARD_CATALOG_PROVIDER;
  return value === "coocon" || value === "public-data" || (value === "mock" && process.env.NODE_ENV === "test") ? value : undefined;
}
