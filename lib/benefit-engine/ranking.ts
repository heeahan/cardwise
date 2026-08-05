import type { Benefit, BenefitUsage, CreditCard, PurchaseScenario, Recommendation } from "./types";
import { calculateBenefit } from "./calculator";

export function rankCards(cards: CreditCard[], benefits: Benefit[], usages: BenefitUsage[], scenario: PurchaseScenario, now = new Date()): Recommendation[] {
  const candidates = benefits.flatMap((benefit) => {
    const card = cards.find((item) => item.id === benefit.cardId);
    if (!card) return [];
    const result = calculateBenefit(card, benefit, scenario, usages, now);
    let score = result.estimatedValue * 100 + result.pointsEarned + result.milesEarned + (result.eligible ? 10_000 : 0);
    if (benefit.status === "expiring") score += 500;
    if (card.isFavorite) score += 120;
    if (card.annualFee > 100_000) score += 20;
    const value = result.estimatedValue ? `预计可省 ₩${result.estimatedValue.toLocaleString("ko-KR")}` : result.pointsEarned ? `预计可得 ${result.pointsEarned.toLocaleString()} 积分` : result.milesEarned ? `预计可得 ${result.milesEarned.toLocaleString()} 里程` : "当前没有可量化收益";
    return [{ ...result, card, benefit, score, explanation: result.eligible ? `${benefit.name}${value}，且当前条件满足。` : result.reasons.join("；") }];
  });
  const bestByCard = new Map<string, Recommendation>();
  for (const candidate of candidates) {
    const current = bestByCard.get(candidate.card.id);
    if (!current || candidate.score > current.score) bestByCard.set(candidate.card.id, candidate);
  }
  return [...bestByCard.values()].sort((a, b) => b.score - a.score || b.estimatedValue - a.estimatedValue).map((item, index) => index === 0 || !item.eligible ? item : { ...item, explanation: `${item.explanation} 排名低于首选，是因为本次可量化收益较少。` });
}
