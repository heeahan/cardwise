import type { Benefit, CreditCard, EligibilityResult, PurchaseScenario, UsageSummary } from "./types";
const normalize = (value: string) => value.normalize("NFKC").toLocaleLowerCase();
export function matchesMerchant(name: string, keywords: string[] = []): boolean { const target = normalize(name); return !keywords.length || keywords.some((keyword) => target.includes(normalize(keyword))); }

export function checkEligibility(card: CreditCard, benefit: Benefit, scenario: PurchaseScenario, usage: UsageSummary): EligibilityResult {
  const rule = benefit.rule;
  const reasons: string[] = [];
  const warnings = ["根据你已录入的消费记录计算，实际额度请以发卡机构为准。"];
  const when = new Date(scenario.occurredAt);
  if (!card.isActive) reasons.push("卡片已停用");
  if (benefit.status === "expired" || (rule.endsAt && when > new Date(rule.endsAt))) reasons.push("权益已过期");
  if (rule.startsAt && when < new Date(rule.startsAt)) reasons.push("权益尚未开始");
  if (scenario.amount < (rule.minimumTransactionAmount ?? 0)) reasons.push("未达到最低消费金额");
  if (card.previousMonthSpend < (rule.previousMonthSpendRequirement ?? 0)) reasons.push("上月消费未达到门槛");
  if (rule.monthlyDiscountCap !== undefined && usage.monthlyDiscountUsed >= rule.monthlyDiscountCap) reasons.push("本月优惠额度已用完");
  if (rule.annualDiscountCap !== undefined && usage.annualDiscountUsed >= rule.annualDiscountCap) reasons.push("本年优惠额度已用完");
  if (rule.monthlyUsageLimit !== undefined && usage.monthlyUsageCount >= rule.monthlyUsageLimit) reasons.push("本月使用次数已用完");
  if (rule.annualUsageLimit !== undefined && usage.annualUsageCount >= rule.annualUsageLimit) reasons.push("本年使用次数已用完");
  if (rule.channel && rule.channel !== "both" && rule.channel !== scenario.channel) reasons.push(`仅限${rule.channel === "online" ? "线上" : "线下"}消费`);
  if (rule.geography && rule.geography !== "both" && rule.geography !== scenario.geography) reasons.push(`仅限${rule.geography === "domestic" ? "境内" : "境外"}消费`);
  if (rule.weekdays?.length && !rule.weekdays.includes(when.getDay())) reasons.push("消费日期不在适用星期内");
  if (rule.enrollmentRequired && !rule.enrolled) reasons.push("需要先报名该权益");
  if (!matchesMerchant(scenario.merchantName, rule.merchantKeywords)) reasons.push("商户不在适用范围");
  if (rule.excludedMerchantKeywords?.length && matchesMerchant(scenario.merchantName, rule.excludedMerchantKeywords)) reasons.push("商户命中排除条件");
  if (!benefit.verifiedByUser) warnings.unshift("权益规则尚未由用户确认");
  return { eligible: reasons.length === 0, reasons, warnings };
}
