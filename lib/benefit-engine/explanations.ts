import type { CalculationResult } from "./types";
export const formatLimit = (value: number | null, suffix = "") => value === null ? "无限额" : `${value.toLocaleString("ko-KR")}${suffix}`;
export function explainCalculation(result: CalculationResult): string[] {
  if (!result.eligible) return result.reasons;
  const details = [`理论优惠 ₩${result.theoreticalValue.toLocaleString("ko-KR")}`];
  if (result.estimatedValue < result.theoreticalValue) details.push("预计优惠已按剩余额度截断");
  details.push(`本月剩余 ${result.remainingMonthlyAmount === null ? "无限额" : `₩${result.remainingMonthlyAmount.toLocaleString("ko-KR")}`}`);
  return details;
}
