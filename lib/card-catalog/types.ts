import type { BenefitRule } from "../benefit-engine/types";

export type CatalogProviderId = "coocon" | "public-data" | "manual" | "mock";
export type CatalogProviderStatus = "ready" | "not_configured" | "contract_required" | "partial" | "unavailable" | "test_only";
export type CardType = "credit" | "debit";
export type CardNetwork = "Visa" | "Mastercard" | "AMEX" | "UnionPay" | "JCB" | "Local";
export type ProductStatus = "active" | "suspended" | "discontinued" | "unknown";
export type VerificationStatus = "unverified" | "needs_review" | "verified" | "outdated" | "conflicted";

export interface CardSearchInput {
  query?: string;
  issuer?: string;
  cardType?: CardType;
  brand?: CardNetwork;
  benefitCategory?: string;
  annualFeeMin?: number;
  annualFeeMax?: number;
  productStatus?: ProductStatus;
  page: number;
  pageSize: number;
}

export interface ProviderMetadata {
  providerId: CatalogProviderId;
  status: CatalogProviderStatus;
  displayName: string;
  coverage: string;
  containsCompleteBenefits: boolean;
  message?: string;
}

export interface ExternalBenefit {
  providerBenefitId: string;
  name: string;
  description: string;
  category: string;
  sourceText: string;
  sourceUrl?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  sourceUpdatedAt?: string;
  candidateRule?: unknown;
  rawData?: unknown;
}

export interface ExternalCardDetail {
  providerId: CatalogProviderId;
  externalCardId: string;
  issuerCode?: string;
  issuerNameKo: string;
  issuerNameEn?: string;
  issuerNameZh?: string;
  nameKo: string;
  nameEn?: string;
  nameZh?: string;
  cardType: CardType;
  brand: CardNetwork;
  annualFeeDomestic: number;
  annualFeeOverseas?: number;
  currency: string;
  imageUrl?: string;
  officialUrl: string;
  applicationUrl?: string;
  productStatus: ProductStatus;
  sourceUrl: string;
  sourceName: string;
  sourceUpdatedAt?: string;
  coverageNote?: string;
  benefits?: ExternalBenefit[];
  rawData?: unknown;
}

export interface CardSearchResult {
  items: ExternalCardDetail[];
  total: number;
  page: number;
  pageSize: number;
  provider: ProviderMetadata;
}

export interface SyncInput {
  cursor?: string;
  pageSize?: number;
  idempotencyKey: string;
}

export interface SyncResult {
  cards: ExternalCardDetail[];
  nextCursor?: string;
  hasMore: boolean;
  provider: ProviderMetadata;
}

export interface NormalizedCatalogBenefit {
  providerBenefitId: string;
  name: string;
  description: string;
  category: string;
  rule: BenefitRule;
  sourceText: string;
  sourceUrl?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  sourceUpdatedAt?: string;
  verificationStatus: VerificationStatus;
  reviewReasons: string[];
  rawData?: unknown;
}

export interface NormalizedCatalogCard extends Omit<ExternalCardDetail, "benefits"> {
  normalizedName: string;
  verificationStatus: VerificationStatus;
  benefits: NormalizedCatalogBenefit[];
}

export interface CatalogSyncComparable {
  providerId: CatalogProviderId;
  externalCardId: string;
  fingerprint: string;
  productStatus: ProductStatus;
}

export interface CatalogSyncPlanItem {
  action: "create" | "update" | "unchanged" | "discontinue";
  card: NormalizedCatalogCard;
  previous?: CatalogSyncComparable;
  materialFields: string[];
}

export interface CatalogSyncPlan {
  items: CatalogSyncPlanItem[];
  created: number;
  updated: number;
  unchanged: number;
  discontinued: number;
}
