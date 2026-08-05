import type { BenefitRule } from "../benefit-engine/types";
import { benefitRuleSchema } from "../benefit-engine/schemas";

export interface RuleCandidate { summary: string; rule: BenefitRule; uncertainties: string[]; requiresUserConfirmation: true }
export interface BenefitExtractionAdapter { extract(input: { text: string; sourceName: string }): Promise<RuleCandidate[]> }

export class MockBenefitExtractionAdapter implements BenefitExtractionAdapter {
  async extract(input: { text: string; sourceName: string }): Promise<RuleCandidate[]> {
    if (!input.text.trim()) return [];
    const candidate = benefitRuleSchema.parse({ benefitType: "custom", resetPeriod: "none", exclusions: ["演示提取结果不得直接用于计算"] });
    return [{ summary: `已收到来自“${input.sourceName}”的候选文本，等待逐项确认。`, rule: candidate, uncertainties: ["优惠数值、限额、适用商户和排除条件尚未确认"], requiresUserConfirmation: true }];
  }
}

export function createBenefitExtractionAdapter(): BenefitExtractionAdapter { return new MockBenefitExtractionAdapter(); }
