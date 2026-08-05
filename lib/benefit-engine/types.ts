export type Money = number;
export type BenefitType = "percentage" | "fixed_discount" | "cashback" | "points_multiplier" | "fixed_points" | "free_service" | "buy_one_get_one" | "miles" | "installment" | "custom";
export type ResetPeriod = "monthly" | "yearly" | "none";

export interface CreditCard {
  id: string;
  issuer: string;
  name: string;
  nickname: string;
  network: "Visa" | "Mastercard" | "AMEX" | "UnionPay" | "JCB" | "Local";
  lastFour?: string;
  color: string;
  isFavorite: boolean;
  isActive: boolean;
  annualFee: Money;
  annualFeeMonth: number;
  openedAt: string;
  previousMonthSpend: Money;
  currentQualifyingSpend: Money;
  currency?: string;
  statementCycleDay?: number;
  sortOrder?: number;
  notes?: string;
}

export interface BenefitRule {
  benefitType: BenefitType;
  discountRate?: number;
  fixedAmount?: Money;
  pointsMultiplier?: number;
  pointsUnitAmount?: Money;
  fixedPoints?: number;
  milesPerUnit?: number;
  perTransactionCap?: Money;
  dailyDiscountCap?: Money;
  monthlyDiscountCap?: Money;
  annualDiscountCap?: Money;
  monthlyUsageLimit?: number;
  annualUsageLimit?: number;
  minimumTransactionAmount?: Money;
  maximumEligibleAmount?: Money;
  previousMonthSpendRequirement?: Money;
  merchantKeywords?: string[];
  participatingMerchants?: string[];
  excludedMerchantKeywords?: string[];
  weekdays?: number[];
  timeRanges?: Array<{ start: string; end: string }>;
  channel?: "online" | "offline" | "both";
  geography?: "domestic" | "overseas" | "both";
  paymentMethods?: string[];
  startsAt?: string;
  endsAt?: string;
  resetPeriod: ResetPeriod;
  enrollmentRequired?: boolean;
  enrolled?: boolean;
  couponRequired?: boolean;
  reservationRequired?: boolean;
  exclusions?: string[];
}

export interface Benefit {
  id: string;
  cardId: string;
  name: string;
  category: string;
  subcategory?: string;
  description: string;
  rule: BenefitRule;
  status: "active" | "upcoming" | "expiring" | "expired" | "unverified";
  sourceName: string;
  sourceUrl?: string;
  lastVerifiedAt: string;
  verifiedByUser: boolean;
  confidence: "confirmed" | "needs_review" | "example";
}

export interface BenefitUsage {
  id: string;
  transactionId?: string;
  benefitId: string;
  cardId: string;
  occurredAt: string;
  merchantName: string;
  category: string;
  originalAmount: Money;
  discountAmount: Money;
  usageCount: number;
  pointsEarned?: number;
  ruleSnapshot: BenefitRule;
  note?: string;
}

export interface PurchaseScenario {
  merchantName: string;
  category: string;
  amount: Money;
  occurredAt: string;
  channel: "online" | "offline";
  geography: "domestic" | "overseas";
  paymentMethod?: string;
  currency?: string;
  couponApplied?: boolean;
  reservationMade?: boolean;
}

export interface UsageSummary { dailyDiscountUsed: Money; monthlyDiscountUsed: Money; annualDiscountUsed: Money; dailyUsageCount: number; monthlyUsageCount: number; annualUsageCount: number }
export interface EligibilityResult { eligible: boolean; reasons: string[]; warnings: string[] }
export interface CalculationResult extends EligibilityResult {
  theoreticalValue: Money;
  estimatedValue: Money;
  remainingMonthlyAmount: Money | null;
  remainingAnnualAmount: Money | null;
  remainingMonthlyUses: number | null;
  remainingAnnualUses: number | null;
  nextResetAt: string | null;
  pointsEarned: number;
  milesEarned: number;
}
export interface Recommendation extends CalculationResult { card: CreditCard; benefit: Benefit; score: number; explanation: string }
