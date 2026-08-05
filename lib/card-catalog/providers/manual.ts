import type { CardSearchInput, CardSearchResult, ExternalBenefit, ExternalCardDetail, ProviderMetadata } from "../types";
import type { KoreanCardCatalogProvider } from "./provider";

export interface ManualCatalogRepository {
  search(input: CardSearchInput): Promise<CardSearchResult>;
  detail(externalCardId: string): Promise<ExternalCardDetail>;
  benefits(externalCardId: string): Promise<ExternalBenefit[]>;
}

export class ManualProvider implements KoreanCardCatalogProvider {
  readonly providerId = "manual" as const;
  constructor(private readonly repository: ManualCatalogRepository) {}
  getMetadata(): ProviderMetadata { return { providerId: this.providerId, status: "ready", displayName: "官方资料人工维护", coverage: "仅包含管理员已审核发布的官方资料", containsCompleteBenefits: false, message: "PDF/CSV/JSON 提取结果在人工确认前不会成为已验证权益" }; }
  searchCards(input: CardSearchInput) { return this.repository.search(input); }
  getCardDetail(id: string) { return this.repository.detail(id); }
  getCardBenefits(id: string) { return this.repository.benefits(id); }
}
