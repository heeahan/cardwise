import type { CardSearchInput, CardSearchResult, ExternalBenefit, ExternalCardDetail, ProviderMetadata, SyncInput, SyncResult } from "../types";
import { CatalogProviderError, type KoreanCardCatalogProvider } from "./provider";

export interface PublicDataDatasetClient {
  searchCards(input: CardSearchInput): Promise<unknown>;
  getCardDetail(externalCardId: string): Promise<unknown>;
  getCardBenefits(externalCardId: string): Promise<unknown>;
  syncCards?(input: SyncInput): Promise<unknown>;
}

export class PublicDataProvider implements KoreanCardCatalogProvider {
  readonly providerId = "public-data" as const;
  constructor(private readonly client?: PublicDataDatasetClient, private readonly hasServiceKey = false, private readonly datasetName?: string) {}
  getMetadata(): ProviderMetadata {
    if (!this.hasServiceKey) return { providerId: this.providerId, status: "not_configured", displayName: "韩国公共数据 API", coverage: "取决于选择的 data.go.kr 数据集", containsCompleteBenefits: false, contractVersion: "dataset-not-selected", message: "尚未配置 DATA_GO_KR_SERVICE_KEY" };
    if (!this.datasetName || !this.client) return { providerId: this.providerId, status: "contract_required", displayName: "韩国公共数据 API", coverage: "尚未选择具有合法开放许可的数据集", containsCompleteBenefits: false, contractVersion: "dataset-contract-not-installed", message: "需要先确认具体数据集、许可、端点和字段合同；系统不会假设其覆盖韩国全部信用卡" };
    return { providerId: this.providerId, status: "partial", displayName: this.datasetName, coverage: "仅覆盖该公共数据集明确列出的机构和字段", containsCompleteBenefits: false, contractVersion: process.env.DATA_GO_KR_CONTRACT_VERSION ?? "contract-version-not-declared", message: "公共数据可能不包含完整优惠条件" };
  }
  private requireClient() {
    const meta = this.getMetadata();
    if (!this.client) throw new CatalogProviderError(meta.status === "not_configured" ? "not_configured" : "contract_required", meta.message ?? "公共数据 Provider 不可用");
    return this.client;
  }
  async searchCards(input: CardSearchInput): Promise<CardSearchResult> { return this.requireClient().searchCards(input) as Promise<CardSearchResult>; }
  async getCardDetail(id: string): Promise<ExternalCardDetail> { return this.requireClient().getCardDetail(id) as Promise<ExternalCardDetail>; }
  async getCardBenefits(id: string): Promise<ExternalBenefit[]> { return this.requireClient().getCardBenefits(id) as Promise<ExternalBenefit[]>; }
  async syncCards(input: SyncInput): Promise<SyncResult> {
    const client = this.requireClient();
    if (!client.syncCards) throw new CatalogProviderError("contract_required", "选定的公共数据集未提供增量同步合同");
    return client.syncCards(input) as Promise<SyncResult>;
  }
}

export function createPublicDataProvider(client?: PublicDataDatasetClient) {
  return new PublicDataProvider(client, Boolean(process.env.DATA_GO_KR_SERVICE_KEY), process.env.DATA_GO_KR_DATASET_NAME);
}
