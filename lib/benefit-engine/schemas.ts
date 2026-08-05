import { z } from "zod";
const money = z.number().int().nonnegative();

export const benefitRuleSchema = z.object({
  benefitType: z.enum(["percentage", "fixed_discount", "cashback", "points_multiplier", "fixed_points", "free_service", "buy_one_get_one", "miles", "installment", "custom"]),
  discountRate: z.number().min(0).max(100).optional(), fixedAmount: money.optional(), pointsMultiplier: z.number().positive().optional(),
  perTransactionCap: money.optional(), dailyDiscountCap: money.optional(), monthlyDiscountCap: money.optional(), annualDiscountCap: money.optional(),
  monthlyUsageLimit: z.number().int().positive().optional(), annualUsageLimit: z.number().int().positive().optional(),
  minimumTransactionAmount: money.optional(), maximumEligibleAmount: money.optional(), previousMonthSpendRequirement: money.optional(),
  merchantKeywords: z.array(z.string().trim().min(1)).optional(), participatingMerchants: z.array(z.string().trim().min(1)).optional(), excludedMerchantKeywords: z.array(z.string().trim().min(1)).optional(),
  weekdays: z.array(z.number().int().min(0).max(6)).optional(), timeRanges: z.array(z.object({ start: z.string(), end: z.string() })).optional(),
  channel: z.enum(["online", "offline", "both"]).optional(), geography: z.enum(["domestic", "overseas", "both"]).optional(), paymentMethods: z.array(z.string()).optional(),
  startsAt: z.string().optional(), endsAt: z.string().optional(), resetPeriod: z.enum(["monthly", "yearly", "none"]),
  enrollmentRequired: z.boolean().optional(), enrolled: z.boolean().optional(), couponRequired: z.boolean().optional(), reservationRequired: z.boolean().optional(), exclusions: z.array(z.string()).optional(),
}).superRefine((rule, ctx) => {
  if (rule.benefitType === "percentage" && rule.discountRate === undefined) ctx.addIssue({ code: "custom", path: ["discountRate"], message: "百分比权益需要折扣比例" });
});

export const creditCardInputSchema = z.object({
  issuer: z.string().trim().min(1, "请填写发卡机构").max(80), name: z.string().trim().min(1, "请填写信用卡名称").max(120), nickname: z.string().trim().min(1, "请填写卡片昵称").max(60),
  network: z.enum(["Visa", "Mastercard", "AMEX", "UnionPay", "JCB", "Local"]), lastFour: z.string().regex(/^\d{4}$/, "末四位必须为4位数字").optional().or(z.literal("")),
  annualFee: money, annualFeeMonth: z.number().int().min(1).max(12), previousMonthSpend: money,
});
export const transactionInputSchema = z.object({
  cardId: z.string().min(1), benefitId: z.string().min(1), occurredAt: z.string().min(1), merchantName: z.string().trim().min(1, "请填写商户名称"), category: z.string().trim().min(1),
  originalAmount: money, discountAmount: money, usageCount: z.number().int().min(0).default(1), note: z.string().max(500).optional(),
});
export const benefitInputSchema = z.object({
  cardId: z.string().uuid().or(z.string().startsWith("card-")),
  name: z.string().trim().min(1).max(160), category: z.string().trim().min(1).max(80),
  subcategory: z.string().trim().max(80).optional(), description: z.string().trim().min(1).max(2000),
  rule: benefitRuleSchema,
  status: z.enum(["active", "upcoming", "expiring", "expired", "unverified"]),
  sourceName: z.string().trim().min(1).max(200), sourceUrl: z.string().url().optional().or(z.literal("")),
  lastVerifiedAt: z.string(), verifiedByUser: z.boolean(), confidence: z.enum(["confirmed", "needs_review", "example"]),
});
export type CreditCardInput = z.infer<typeof creditCardInputSchema>;
export type TransactionInput = z.infer<typeof transactionInputSchema>;
export type BenefitInput = z.infer<typeof benefitInputSchema>;
