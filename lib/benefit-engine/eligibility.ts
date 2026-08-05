import type { Benefit, CreditCard, EligibilityResult, PurchaseScenario, UsageSummary } from "./types";
export const normalizeMerchant = (value: string) => value.normalize("NFKC").toLocaleLowerCase().replace(/[\p{P}\p{S}\s]+/gu, "");
export function matchesMerchant(name: string, keywords: string[] = []): boolean { const target = normalizeMerchant(name); return !keywords.length || keywords.some((keyword) => target.includes(normalizeMerchant(keyword))); }

const seoulClock = (date: Date) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return { weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday), minutes: Number(parts.hour) * 60 + Number(parts.minute) };
};
const parseTime = (value: string) => { const [hour, minute] = value.split(":").map(Number); return hour * 60 + minute; };
const inTimeRange = (minutes: number, start: string, end: string) => { const from = parseTime(start); const to = parseTime(end); return from <= to ? minutes >= from && minutes <= to : minutes >= from || minutes <= to; };

export function checkEligibility(card: CreditCard, benefit: Benefit, scenario: PurchaseScenario, usage: UsageSummary): EligibilityResult {
  const rule = benefit.rule;
  const reasons: string[] = [];
  const warnings = ["根据你已录入的消费记录计算，实际额度请以发卡机构为准。"];
  const when = new Date(scenario.occurredAt);
  const local = seoulClock(when);
  if (!card.isActive) reasons.push("卡片已停用");
  if (benefit.status === "expired" || (rule.endsAt && when > new Date(rule.endsAt))) reasons.push("权益已过期");
  if (rule.startsAt && when < new Date(rule.startsAt)) reasons.push("权益尚未开始");
  if (scenario.amount < (rule.minimumTransactionAmount ?? 0)) reasons.push("未达到最低消费金额");
  if (card.previousMonthSpend < (rule.previousMonthSpendRequirement ?? 0)) reasons.push("上月消费未达到门槛");
  if (rule.monthlyDiscountCap !== undefined && usage.monthlyDiscountUsed >= rule.monthlyDiscountCap) reasons.push("本月优惠额度已用完");
  if (rule.dailyDiscountCap !== undefined && usage.dailyDiscountUsed >= rule.dailyDiscountCap) reasons.push("今日优惠额度已用完");
  if (rule.annualDiscountCap !== undefined && usage.annualDiscountUsed >= rule.annualDiscountCap) reasons.push("本年优惠额度已用完");
  if (rule.monthlyUsageLimit !== undefined && usage.monthlyUsageCount >= rule.monthlyUsageLimit) reasons.push("本月使用次数已用完");
  if (rule.annualUsageLimit !== undefined && usage.annualUsageCount >= rule.annualUsageLimit) reasons.push("本年使用次数已用完");
  if (rule.channel && rule.channel !== "both" && rule.channel !== scenario.channel) reasons.push(`仅限${rule.channel === "online" ? "线上" : "线下"}消费`);
  if (rule.geography && rule.geography !== "both" && rule.geography !== scenario.geography) reasons.push(`仅限${rule.geography === "domestic" ? "境内" : "境外"}消费`);
  if (rule.weekdays?.length && !rule.weekdays.includes(local.weekday)) reasons.push("消费日期不在适用星期内");
  if (rule.timeRanges?.length && !rule.timeRanges.some((range) => inTimeRange(local.minutes, range.start, range.end))) reasons.push("消费时间不在适用时段内");
  if (rule.paymentMethods?.length && (!scenario.paymentMethod || !rule.paymentMethods.some((method) => method.toLocaleLowerCase() === scenario.paymentMethod?.toLocaleLowerCase()))) reasons.push("支付方式不符合权益规则");
  if (rule.enrollmentRequired && !rule.enrolled) reasons.push("需要先报名该权益");
  if (rule.couponRequired && !scenario.couponApplied) reasons.push("需要先领取或使用指定优惠券");
  if (rule.reservationRequired && !scenario.reservationMade) reasons.push("需要提前预约");
  if (!matchesMerchant(scenario.merchantName, rule.merchantKeywords)) reasons.push("商户不在适用范围");
  if (rule.participatingMerchants?.length && !matchesMerchant(scenario.merchantName, rule.participatingMerchants)) reasons.push("商户不在参与门店名单");
  if (rule.excludedMerchantKeywords?.length && matchesMerchant(scenario.merchantName, rule.excludedMerchantKeywords)) reasons.push("商户命中排除条件");
  if (card.currency && scenario.currency && card.currency !== scenario.currency) warnings.unshift(`卡片币种为 ${card.currency}，当前消费为 ${scenario.currency}，未估算汇率与境外手续费`);
  if (!benefit.verifiedByUser) warnings.unshift("权益规则尚未由用户确认");
  return { eligible: reasons.length === 0, reasons, warnings };
}
