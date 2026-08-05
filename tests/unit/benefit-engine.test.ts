import { describe, expect, it } from "vitest";
import { calculateBenefit, summarizeUsage } from "../../lib/benefit-engine/calculator";
import { matchesMerchant } from "../../lib/benefit-engine/eligibility";
import { rankCards } from "../../lib/benefit-engine/ranking";
import { isSameSeoulDay, isSameSeoulMonth, nextResetDate } from "../../lib/benefit-engine/reset";
import type { Benefit, CreditCard, PurchaseScenario } from "../../lib/benefit-engine/types";
import { normalizeImportDate, parseCsvDocument } from "../../lib/csv";

const card: CreditCard = { id: "c1", issuer: "演示", name: "A", nickname: "A卡", network: "Visa", color: "#000", isFavorite: true, isActive: true, annualFee: 10000, annualFeeMonth: 1, openedAt: "2025-01-01", previousMonthSpend: 300000, currentQualifyingSpend: 0 };
const benefit: Benefit = { id: "b1", cardId: "c1", name: "星巴克20%", category: "咖啡", description: "演示", rule: { benefitType: "percentage", discountRate: 20, monthlyDiscountCap: 10000, minimumTransactionAmount: 1000, previousMonthSpendRequirement: 300000, merchantKeywords: ["星巴克", "Starbucks", "스타벅스"], channel: "offline", geography: "domestic", resetPeriod: "monthly" }, status: "active", sourceName: "演示", lastVerifiedAt: "2026-08-01", verifiedByUser: true, confidence: "example" };
const when = new Date("2026-08-04T03:00:00.000Z");
const scenario: PurchaseScenario = { merchantName: "스타벅스 강남", category: "咖啡", amount: 30000, occurredAt: when.toISOString(), channel: "offline", geography: "domestic" };
const usage = (discountAmount: number, occurredAt = "2026-08-02T03:00:00.000Z", usageCount = 1) => ({ id: crypto.randomUUID(), benefitId: "b1", cardId: "c1", occurredAt, merchantName: "Starbucks", category: "咖啡", originalAmount: 30000, discountAmount, usageCount, ruleSnapshot: benefit.rule });

describe("benefit calculator", () => {
  it("calculates a 20% integer discount", () => expect(calculateBenefit(card, benefit, scenario, [], when).estimatedValue).toBe(6000));
  it("caps discount by remaining monthly allowance", () => expect(calculateBenefit(card, benefit, scenario, [usage(6000)], when).estimatedValue).toBe(4000));
  it("uses null to represent unlimited allowance", () => { const unlimited = { ...benefit, rule: { ...benefit.rule, monthlyDiscountCap: undefined } }; expect(calculateBenefit(card, unlimited, scenario, [], when).remainingMonthlyAmount).toBeNull(); });
  it("blocks a card below the prior-month threshold", () => { const result = calculateBenefit({ ...card, previousMonthSpend: 299999 }, benefit, scenario, [], when); expect(result.eligible).toBe(false); expect(result.reasons).toContain("上月消费未达到门槛"); });
  it("blocks a transaction below the minimum", () => expect(calculateBenefit(card, benefit, { ...scenario, amount: 999 }, [], when).reasons).toContain("未达到最低消费金额"));
  it("blocks an expired benefit", () => expect(calculateBenefit(card, { ...benefit, status: "expired" }, scenario, [], when).eligible).toBe(false));
  it("honors weekday rules", () => { const saturdayOnly = { ...benefit, rule: { ...benefit.rule, weekdays: [6] } }; expect(calculateBenefit(card, saturdayOnly, scenario, [], when).reasons).toContain("消费日期不在适用星期内"); });
  it("honors channel restrictions", () => expect(calculateBenefit(card, benefit, { ...scenario, channel: "online" }, [], when).reasons).toContain("仅限线下消费"));
  it("matches Chinese, Korean and English merchant aliases", () => { expect(matchesMerchant("星巴克首尔店", benefit.rule.merchantKeywords)).toBe(true); expect(matchesMerchant("STARBUCKS Reserve", benefit.rule.merchantKeywords)).toBe(true); expect(matchesMerchant("스타벅스 강남", benefit.rule.merchantKeywords)).toBe(true); });
  it("normalizes punctuation, symbols and whitespace in merchant names", () => expect(matchesMerchant("ＳＴＡＲＢＵＣＫＳ—Reserve (Gangnam)", ["starbucks reserve"])).toBe(true));
  it("honors participating and excluded merchant lists", () => { const listed = { ...benefit, rule: { ...benefit.rule, participatingMerchants: ["Starbucks Reserve"], excludedMerchantKeywords: ["airport"] } }; expect(calculateBenefit(card, listed, { ...scenario, merchantName: "Starbucks Reserve Gangnam" }, [], when).eligible).toBe(true); expect(calculateBenefit(card, listed, { ...scenario, merchantName: "Starbucks Airport" }, [], when).eligible).toBe(false); });
  it("honors Seoul time windows including overnight ranges", () => { const timed = { ...benefit, rule: { ...benefit.rule, timeRanges: [{ start: "11:00", end: "13:00" }] } }; expect(calculateBenefit(card, timed, scenario, [], when).eligible).toBe(true); expect(calculateBenefit(card, timed, { ...scenario, occurredAt: "2026-08-04T14:30:00Z" }, [], when).eligible).toBe(false); });
  it("requires configured payment, coupon and reservation conditions", () => { const gated = { ...benefit, rule: { ...benefit.rule, paymentMethods: ["Samsung Pay"], couponRequired: true, reservationRequired: true } }; expect(calculateBenefit(card, gated, scenario, [], when).eligible).toBe(false); expect(calculateBenefit(card, gated, { ...scenario, paymentMethod: "samsung pay", couponApplied: true, reservationMade: true }, [], when).eligible).toBe(true); });
  it("caps a benefit by its remaining daily allowance", () => { const capped = { ...benefit, rule: { ...benefit.rule, dailyDiscountCap: 7000 } }; expect(calculateBenefit(card, capped, scenario, [usage(3000, scenario.occurredAt)], when).estimatedValue).toBe(4000); });
  it("calculates points without pretending they are cash", () => { const points = { ...benefit, rule: { ...benefit.rule, benefitType: "points_multiplier" as const, pointsMultiplier: 2, pointsUnitAmount: 1000, discountRate: undefined } }; const result = calculateBenefit(card, points, scenario, [], when); expect(result.pointsEarned).toBe(60); expect(result.estimatedValue).toBe(0); });
  it("uses integer arithmetic without floating residue", () => { const odd = { ...benefit, rule: { ...benefit.rule, discountRate: 7 } }; expect(calculateBenefit(card, odd, { ...scenario, amount: 1001 }, [], when).estimatedValue).toBe(70); });
  it("restores allowance when a usage is deleted", () => { expect(calculateBenefit(card, benefit, scenario, [usage(6000)], when).remainingMonthlyAmount).toBe(4000); expect(calculateBenefit(card, benefit, scenario, [], when).remainingMonthlyAmount).toBe(10000); });
  it("recalculates after a usage amount changes", () => { expect(calculateBenefit(card, benefit, scenario, [usage(2000)], when).remainingMonthlyAmount).toBe(8000); expect(calculateBenefit(card, benefit, scenario, [usage(3500)], when).remainingMonthlyAmount).toBe(6500); });
});

describe("CSV parser", () => {
  it("parses quoted commas, escaped quotes and embedded newlines", () => { const rows = parseCsvDocument('date,merchant,amount\n2026-08-01,"Cafe, \"\"Gangnam\"\"\n2F",12000'); expect(rows[1][1]).toBe('Cafe, "Gangnam"\n2F'); expect(rows[1][2]).toBe("12000"); });
  it("normalizes valid dates and rejects invalid dates", () => { expect(normalizeImportDate("2026-08-05")).toBe("2026-08-05"); expect(normalizeImportDate("not-a-date")).toBeNull(); });
});

describe("usage limits, periods and ranking", () => {
  it("tracks monthly and annual usage counts", () => { const result = summarizeUsage("b1", [usage(1000, "2026-08-01T00:00:00Z", 2), usage(1000, "2026-07-01T00:00:00Z", 1)], when); expect(result.monthlyUsageCount).toBe(2); expect(result.annualUsageCount).toBe(3); });
  it("handles the Seoul timezone month boundary", () => { expect(isSameSeoulMonth("2026-07-31T15:30:00.000Z", new Date("2026-08-01T01:00:00.000Z"))).toBe(true); });
  it("handles the Seoul timezone day boundary", () => { expect(isSameSeoulDay("2026-08-01T15:30:00.000Z", new Date("2026-08-02T02:00:00.000Z"))).toBe(true); });
  it("returns the next month boundary", () => expect(nextResetDate("monthly", when)).toBe("2026-09-01"));
  it("returns a Seoul-safe year boundary", () => expect(nextResetDate("yearly", new Date("2026-12-31T16:00:00Z"))).toBe("2028-01-01"));
  it("ranks eligible, valuable cards above ineligible cards", () => { const weak = { ...benefit, id: "b2", name: "低优惠", rule: { ...benefit.rule, discountRate: 2 } }; const blockedCard = { ...card, id: "c2", nickname: "未达门槛卡", previousMonthSpend: 0 }; const blocked = { ...benefit, id: "b3", cardId: "c2" }; const ranked = rankCards([card, blockedCard], [weak, benefit, blocked], [], scenario, when); expect(ranked[0].benefit.id).toBe("b1"); expect(ranked.at(-1)?.eligible).toBe(false); });
  it("returns at most one recommendation for each card", () => { const second = { ...benefit, id: "b2", name: "同卡低优惠", rule: { ...benefit.rule, discountRate: 2 } }; const ranked = rankCards([card], [second, benefit], [], scenario, when); expect(ranked).toHaveLength(1); expect(ranked[0].benefit.id).toBe("b1"); });
});
