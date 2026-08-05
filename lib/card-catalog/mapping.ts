import { benefitRuleSchema } from "../benefit-engine/schemas";
import type { BenefitRule } from "../benefit-engine/types";
import type { ExternalBenefit, NormalizedCatalogBenefit } from "./types";

const reviewRule = (): BenefitRule => ({ benefitType: "custom", resetPeriod: "none", reviewRequired: true });

export function normalizeExternalBenefit(input: ExternalBenefit): NormalizedCatalogBenefit {
  if (!input.candidateRule || typeof input.candidateRule !== "object") {
    return { ...input, rule: reviewRule(), verificationStatus: "needs_review", reviewReasons: ["供应商未提供可验证的结构化规则"] };
  }
  const candidate = input.candidateRule as Record<string, unknown>;
  const parsed = benefitRuleSchema.safeParse({ resetPeriod: "none", ...candidate });
  if (!parsed.success) {
    return {
      ...input,
      rule: reviewRule(),
      verificationStatus: "needs_review",
      reviewReasons: parsed.error.issues.map((issue) => `${issue.path.join(".") || "rule"}: ${issue.message}`),
    };
  }
  return { ...input, rule: { ...parsed.data, reviewRequired: false }, verificationStatus: "needs_review", reviewReasons: ["结构化候选规则需要管理员对照官方资料确认"] };
}

export function isDeterministicCatalogRule(rule: BenefitRule) {
  return !rule.reviewRequired && rule.benefitType !== "custom";
}

export function materialBenefitChanges(before: BenefitRule, after: BenefitRule) {
  const important: Array<keyof BenefitRule> = [
    "benefitType", "discountRate", "fixedAmount", "pointsMultiplier", "pointsUnitAmount", "fixedPoints", "milesPerUnit",
    "perTransactionCap", "dailyDiscountCap", "monthlyDiscountCap", "annualDiscountCap", "monthlyUsageLimit", "annualUsageLimit",
    "minimumTransactionAmount", "previousMonthSpendRequirement", "startsAt", "endsAt",
  ];
  return important.filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key])).map(String);
}
