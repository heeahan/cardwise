import type { CardSearchInput, CardSearchResult, ExternalCardDetail, ProviderMetadata, SyncInput, SyncResult } from "../types";
import type { KoreanCardCatalogProvider } from "./provider";

const TEST_CARD: ExternalCardDetail = {
  providerId: "mock", externalCardId: "TEST-ONLY-001", issuerNameKo: "테스트 카드사", issuerNameEn: "TEST ONLY Issuer", nameKo: "테스트 전용 카드", nameEn: "TEST ONLY Card",
  cardType: "credit", brand: "Visa", annualFeeDomestic: 10000, currency: "KRW", officialUrl: "https://example.invalid/test-only", productStatus: "active",
  sourceUrl: "https://example.invalid/test-only", sourceName: "AUTOMATED TEST DATA — NOT A REAL KOREAN CARD", benefits: [{ providerBenefitId: "TEST-BENEFIT-1", name: "TEST ONLY 10%", description: "自动测试专用，非真实优惠", category: "test", sourceText: "TEST ONLY", candidateRule: { benefitType: "percentage", discountRate: 10, resetPeriod: "monthly" } }],
};

export class MockCatalogProvider implements KoreanCardCatalogProvider {
  readonly providerId = "mock" as const;
  getMetadata(): ProviderMetadata { return { providerId: this.providerId, status: "test_only", displayName: "Mock Provider — TEST ONLY", coverage: "仅自动测试", containsCompleteBenefits: false, contractVersion: "test-fixture-v1", message: "不是韩国真实信用卡数据" }; }
  async searchCards(input: CardSearchInput): Promise<CardSearchResult> {
    const match = !input.query || `${TEST_CARD.nameKo}${TEST_CARD.nameEn}`.toLowerCase().includes(input.query.toLowerCase());
    return { items: match ? [TEST_CARD] : [], total: match ? 1 : 0, page: input.page, pageSize: input.pageSize, provider: this.getMetadata() };
  }
  async getCardDetail(id: string) { if (id !== TEST_CARD.externalCardId) throw new Error("TEST_CARD_NOT_FOUND"); return TEST_CARD; }
  async getCardBenefits(id: string) { return (await this.getCardDetail(id)).benefits ?? []; }
  async syncCards(input: SyncInput): Promise<SyncResult> { return { cards: [TEST_CARD], hasMore: false, provider: this.getMetadata(), nextCursor: input.cursor }; }
}
