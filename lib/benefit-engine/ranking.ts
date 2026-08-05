import type { Benefit, BenefitUsage, CreditCard, PurchaseScenario, Recommendation } from "./types";
import { calculateBenefit } from "./calculator";

export function rankCards(cards: CreditCard[], benefits: Benefit[], usages: BenefitUsage[], scenario: PurchaseScenario, now = new Date()): Recommendation[] {
  return benefits.flatMap((benefit) => {
    const card = cards.find((item) => item.id === benefit.cardId);
    if (!card) return [];
    const result = calculateBenefit(card, benefit, scenario, usages, now);
    let score = result.estimatedValue * 100 + (result.eligible ? 10_000 : 0);
    if (benefit.status === "expiring") score += 500;
    if (card.isFavorite) score += 120;
    if (card.annualFee > 100_000) score += 20;
    return [{ ...result, card, benefit, score, explanation: result.eligible ? `${benefit.name}预计可省 ₩${result.estimatedValue.toLocaleString("ko-KR")}，且当前条件满足。` : result.reasons.join("；") }];
  }).sort((a, b) => b.score - a.score || b.estimatedValue - a.estimatedValue);
}
