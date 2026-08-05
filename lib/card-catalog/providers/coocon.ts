import type { CardSearchInput, CardSearchResult, ExternalBenefit, ExternalCardDetail, ProviderMetadata, SyncInput, SyncResult } from "../types";
import { CatalogProviderError, type KoreanCardCatalogProvider } from "./provider";

export interface CooconContractClient {
  searchCards(input: CardSearchInput): Promise<unknown>;
  getCardDetail(externalCardId: string): Promise<unknown>;
  getCardBenefits(externalCardId: string): Promise<unknown>;
  syncCards?(input: SyncInput): Promise<unknown>;
}

export class CooconProvider implements KoreanCardCatalogProvider {
  readonly providerId = "coocon" as const;
  constructor(private readonly client?: CooconContractClient, private readonly configured = false) {}
  getMetadata(): ProviderMetadata {
    if (!this.configured) return { providerId: this.providerId, status: "not_configured", displayName: "쿠콘 / Coocon", coverage: "需签约后以正式合同为准", containsCompleteBenefits: false, contractVersion: "skeleton", message: "尚未配置 Coocon 商业信用卡数据供应商" };
    if (!this.client) return { providerId: this.providerId, status: "contract_required", displayName: "쿠콘 / Coocon", coverage: "等待正式 API 文档和响应字段合同", containsCompleteBenefits: false, contractVersion: "skeleton", message: "凭据已设置，但尚未安装签约接口合同，系统不会猜测接口路径" };
    return { providerId: this.providerId, status: "ready", displayName: "쿠콘 / Coocon", coverage: "以当前商业合同为准", containsCompleteBenefits: true, contractVersion: process.env.COOCON_CONTRACT_VERSION ?? "contract-version-not-declared" };
  }
  private requireClient() {
    const meta = this.getMetadata();
    if (!this.client) throw new CatalogProviderError(meta.status === "not_configured" ? "not_configured" : "contract_required", meta.message ?? "Coocon Provider 不可用");
    return this.client;
  }
  async searchCards(input: CardSearchInput): Promise<CardSearchResult> { return this.requireClient().searchCards(input) as Promise<CardSearchResult>; }
  async getCardDetail(id: string): Promise<ExternalCardDetail> { return this.requireClient().getCardDetail(id) as Promise<ExternalCardDetail>; }
  async getCardBenefits(id: string): Promise<ExternalBenefit[]> { return this.requireClient().getCardBenefits(id) as Promise<ExternalBenefit[]>; }
  async syncCards(input: SyncInput): Promise<SyncResult> {
    const client = this.requireClient();
    if (!client.syncCards) throw new CatalogProviderError("contract_required", "当前 Coocon 合同未定义增量同步能力");
    return client.syncCards(input) as Promise<SyncResult>;
  }
}

export function createCooconProvider(client?: CooconContractClient) {
  const configured = Boolean(process.env.COOCON_API_BASE_URL && process.env.COOCON_API_KEY && process.env.COOCON_CLIENT_ID && process.env.COOCON_CLIENT_SECRET);
  return new CooconProvider(client, configured);
}
