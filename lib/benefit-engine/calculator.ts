import type { Benefit, BenefitUsage, CalculationResult, CreditCard, PurchaseScenario, UsageSummary } from "./types";
import { checkEligibility } from "./eligibility";
import { isSameSeoulMonth, isSameSeoulYear, nextResetDate } from "./reset";

export function summarizeUsage(benefitId: string, usages: BenefitUsage[], now: Date): UsageSummary {
  const matching = usages.filter((usage) => usage.benefitId === benefitId);
  const monthly = matching.filter((usage) => isSameSeoulMonth(usage.occurredAt, now));
  const annual = matching.filter((usage) => isSameSeoulYear(usage.occurredAt, now));
  return {
    monthlyDiscountUsed: monthly.reduce((sum, row) => sum + row.discountAmount, 0),
    annualDiscountUsed: annual.reduce((sum, row) => sum + row.discountAmount, 0),
    monthlyUsageCount: monthly.reduce((sum, row) => sum + row.usageCount, 0),
    annualUsageCount: annual.reduce((sum, row) => sum + row.usageCount, 0),
  };
}

export function calculateBenefit(card: CreditCard, benefit: Benefit, scenario: PurchaseScenario, usages: BenefitUsage[], now = new Date()): CalculationResult {
  const usage = summarizeUsage(benefit.id, usages, now);
  const eligibility = checkEligibility(card, benefit, scenario, usage);
  const rule = benefit.rule;
  const eligibleAmount = Math.min(scenario.amount, rule.maximumEligibleAmount ?? scenario.amount);
  let theoreticalValue = 0;
  if (rule.benefitType === "percentage" || rule.benefitType === "cashback") theoreticalValue = Math.floor((eligibleAmount * (rule.discountRate ?? 0)) / 100);
  else if (["fixed_discount", "free_service", "fixed_points"].includes(rule.benefitType)) theoreticalValue = rule.fixedAmount ?? 0;
  theoreticalValue = Math.min(theoreticalValue, rule.perTransactionCap ?? theoreticalValue);
  const remainingMonthlyAmount = rule.monthlyDiscountCap === undefined ? null : Math.max(0, rule.monthlyDiscountCap - usage.monthlyDiscountUsed);
  const remainingAnnualAmount = rule.annualDiscountCap === undefined ? null : Math.max(0, rule.annualDiscountCap - usage.annualDiscountUsed);
  const remainingMonthlyUses = rule.monthlyUsageLimit === undefined ? null : Math.max(0, rule.monthlyUsageLimit - usage.monthlyUsageCount);
  const remainingAnnualUses = rule.annualUsageLimit === undefined ? null : Math.max(0, rule.annualUsageLimit - usage.annualUsageCount);
  const estimatedValue = eligibility.eligible ? Math.max(0, Math.min(theoreticalValue, remainingMonthlyAmount ?? theoreticalValue, remainingAnnualAmount ?? theoreticalValue)) : 0;
  return { ...eligibility, theoreticalValue, estimatedValue, remainingMonthlyAmount, remainingAnnualAmount, remainingMonthlyUses, remainingAnnualUses, nextResetAt: nextResetDate(rule.resetPeriod, now) };
}
