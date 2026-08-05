import { describe, expect, it } from "vitest";
import { materialBenefitChanges, normalizeExternalBenefit } from "../../lib/card-catalog/mapping";
import { normalizeExternalCards, normalizeIssuer, normalizeSearchText } from "../../lib/card-catalog/normalizer";
import { CooconProvider } from "../../lib/card-catalog/providers/coocon";
import { MockCatalogProvider } from "../../lib/card-catalog/providers/mock";
import { withProviderTimeout } from "../../lib/card-catalog/providers/provider";
import { buildCatalogSyncPlan, catalogFingerprint } from "../../lib/card-catalog/service";
import type { ExternalCardDetail } from "../../lib/card-catalog/types";

const externalCard: ExternalCardDetail = {
  providerId: "manual", externalCardId: "official-doc-001", issuerNameKo: "신한카드", nameKo: "공식 자료 테스트 카드", nameEn: "Official Document Test Card",
  cardType: "credit", brand: "Visa", annualFeeDomestic: 15000, annualFeeOverseas: 18000, currency: "KRW", officialUrl: "https://example.com/official-card",
  productStatus: "active", sourceUrl: "https://example.com/product-guide.pdf", sourceName: "TEST FIXTURE — LICENSED OFFICIAL DOCUMENT", sourceUpdatedAt: "2026-08-05T00:00:00+09:00",
  benefits: [{ providerBenefitId: "coffee-1", name: "커피 10%", description: "테스트용 공식 문서 후보", category: "咖啡", sourceText: "前月消费 300,000 韩元，单笔至少 10,000 韩元，每月上限 10,000 韩元", candidateRule: { benefitType: "percentage", discountRate: 10, minimumTransactionAmount: 10000, monthlyDiscountCap: 10000, previousMonthSpendRequirement: 300000, merchantKeywords: ["커피"], resetPeriod: "monthly" } }],
};

describe("Korean card catalog validation and normalization", () => {
  it("rejects provider payloads without an official URL", () => expect(() => normalizeExternalCards([{ ...externalCard, officialUrl: "not-a-url" }])).toThrow());
  it("normalizes Korean card names for search", () => expect(normalizeSearchText("  신한—카드 Mr.Life ")).toBe("신한카드mrlife"));
  it("standardizes known issuer names without claiming product coverage", () => expect(normalizeIssuer({ nameKo: "신한카드" })).toMatchObject({ code: "SHINHAN", nameEn: "Shinhan Card" }));
  it("deduplicates the same provider and external ID", () => expect(normalizeExternalCards([externalCard, { ...externalCard, nameKo: "重复记录" }])).toHaveLength(1));
  it("keeps every imported card in needs_review until an administrator publishes it", () => expect(normalizeExternalCards([externalCard])[0].verificationStatus).toBe("needs_review"));
});

describe("external benefit conversion", () => {
  it("converts supported limits and previous-month spend without guessing", () => {
    const benefit = normalizeExternalBenefit(externalCard.benefits![0]);
    expect(benefit.rule).toMatchObject({ discountRate: 10, minimumTransactionAmount: 10000, monthlyDiscountCap: 10000, previousMonthSpendRequirement: 300000 });
    expect(benefit.verificationStatus).toBe("needs_review");
  });
  it("marks incomplete rules as reviewRequired and non-deterministic", () => {
    const benefit = normalizeExternalBenefit({ ...externalCard.benefits![0], candidateRule: { benefitType: "percentage", resetPeriod: "monthly" } });
    expect(benefit.rule).toMatchObject({ benefitType: "custom", reviewRequired: true });
    expect(benefit.reviewReasons.length).toBeGreaterThan(0);
  });
  it("flags material amount, cap, spend and validity changes", () => {
    const changes = materialBenefitChanges({ benefitType: "percentage", discountRate: 10, monthlyDiscountCap: 10000, resetPeriod: "monthly" }, { benefitType: "percentage", discountRate: 15, monthlyDiscountCap: 20000, previousMonthSpendRequirement: 300000, endsAt: "2027-01-01", resetPeriod: "monthly" });
    expect(changes).toEqual(expect.arrayContaining(["discountRate", "monthlyDiscountCap", "previousMonthSpendRequirement", "endsAt"]));
  });
});

describe("incremental catalog sync", () => {
  it("is idempotent when the normalized fingerprint is unchanged", () => {
    const card = normalizeExternalCards([externalCard])[0];
    const plan = buildCatalogSyncPlan([{ providerId: card.providerId, externalCardId: card.externalCardId, fingerprint: catalogFingerprint(card), productStatus: "active" }], [externalCard]);
    expect(plan).toMatchObject({ created: 0, updated: 0, unchanged: 1, discontinued: 0 });
  });
  it("creates a review candidate for a new card", () => expect(buildCatalogSyncPlan([], [externalCard])).toMatchObject({ created: 1, updated: 0 }));
  it("marks missing active products discontinued instead of deleting user cards", () => {
    const plan = buildCatalogSyncPlan([{ providerId: "manual", externalCardId: externalCard.externalCardId, fingerprint: "old", productStatus: "active" }], []);
    expect(plan.items[0]).toMatchObject({ action: "discontinue", materialFields: ["productStatus"] });
  });
  it("does not mutate the incoming provider snapshot while planning versions", () => {
    const before = structuredClone(externalCard);
    buildCatalogSyncPlan([], [externalCard]);
    expect(externalCard).toEqual(before);
  });
});

describe("provider safety states", () => {
  it("reports Coocon not_configured without credentials", () => expect(new CooconProvider(undefined, false).getMetadata().status).toBe("not_configured"));
  it("requires a signed contract client even when credentials exist", async () => {
    const provider = new CooconProvider(undefined, true);
    expect(provider.getMetadata().status).toBe("contract_required");
    await expect(provider.getCardDetail("card")).rejects.toMatchObject({ code: "contract_required" });
  });
  it("labels the Mock Provider as test-only data", async () => {
    const result = await new MockCatalogProvider().searchCards({ query: "TEST", page: 1, pageSize: 20 });
    expect(result.provider.status).toBe("test_only");
    expect(result.items[0].sourceName).toContain("NOT A REAL KOREAN CARD");
  });
  it("maps aborted provider calls to a stable timeout error", async () => {
    const promise = withProviderTimeout<never>((signal) => new Promise((_, reject) => signal.addEventListener("abort", () => reject(new Error("aborted")))), 1000);
    await expect(promise).rejects.toEqual(expect.objectContaining({ code: "timeout", retryable: true }));
  });
});
