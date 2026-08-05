import { z } from "zod";
import { benefitRuleSchema } from "../benefit-engine/schemas";

const optionalUrl = z.string().url().max(2048).optional();
const dateTime = z.string().datetime({ offset: true }).optional();
const money = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

export const cardSearchSchema = z.object({
  query: z.string().trim().max(100).optional(),
  issuer: z.string().trim().max(80).optional(),
  cardType: z.enum(["credit", "debit"]).optional(),
  brand: z.enum(["Visa", "Mastercard", "AMEX", "UnionPay", "JCB", "Local"]).optional(),
  benefitCategory: z.string().trim().max(80).optional(),
  annualFeeMin: money.optional(),
  annualFeeMax: money.optional(),
  productStatus: z.enum(["active", "suspended", "discontinued", "unknown"]).optional(),
  page: z.number().int().min(1).max(1000).default(1),
  pageSize: z.number().int().min(1).max(40).default(20),
}).superRefine((value, ctx) => {
  if (value.annualFeeMin !== undefined && value.annualFeeMax !== undefined && value.annualFeeMin > value.annualFeeMax) {
    ctx.addIssue({ code: "custom", path: ["annualFeeMax"], message: "年费上限不能小于下限" });
  }
});

export const externalBenefitSchema = z.object({
  providerBenefitId: z.string().trim().min(1).max(200),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(5000),
  category: z.string().trim().min(1).max(100),
  sourceText: z.string().trim().min(1).max(20000),
  sourceUrl: optionalUrl,
  effectiveFrom: z.string().date().optional(),
  effectiveTo: z.string().date().optional(),
  sourceUpdatedAt: dateTime,
  candidateRule: z.unknown().optional(),
  rawData: z.unknown().optional(),
});

export const externalCardSchema = z.object({
  providerId: z.enum(["coocon", "public-data", "manual", "mock"]),
  externalCardId: z.string().trim().min(1).max(200),
  issuerCode: z.string().trim().max(80).optional(),
  issuerNameKo: z.string().trim().min(1).max(120),
  issuerNameEn: z.string().trim().max(120).optional(),
  issuerNameZh: z.string().trim().max(120).optional(),
  nameKo: z.string().trim().min(1).max(200),
  nameEn: z.string().trim().max(200).optional(),
  nameZh: z.string().trim().max(200).optional(),
  cardType: z.enum(["credit", "debit"]),
  brand: z.enum(["Visa", "Mastercard", "AMEX", "UnionPay", "JCB", "Local"]),
  annualFeeDomestic: money,
  annualFeeOverseas: money.optional(),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  imageUrl: optionalUrl,
  officialUrl: z.string().url().max(2048),
  applicationUrl: optionalUrl,
  productStatus: z.enum(["active", "suspended", "discontinued", "unknown"]),
  sourceUrl: z.string().url().max(2048),
  sourceName: z.string().trim().min(1).max(200),
  sourceUpdatedAt: dateTime,
  coverageNote: z.string().trim().max(1000).optional(),
  benefits: z.array(externalBenefitSchema).max(500).optional(),
  rawData: z.unknown().optional(),
});

export const externalCardListSchema = z.array(externalCardSchema).max(5000);

export const catalogAddSchema = z.object({
  nickname: z.string().trim().min(1).max(60),
  network: z.enum(["Visa", "Mastercard", "AMEX", "UnionPay", "JCB", "Local"]),
  lastFour: z.string().regex(/^\d{4}$/).optional().or(z.literal("")),
  isFavorite: z.boolean().default(false),
  statementCycleDay: z.number().int().min(1).max(31).optional(),
  autoSyncEnabled: z.boolean().default(true),
});

export const catalogSyncSchema = z.object({
  providerId: z.enum(["coocon", "public-data", "manual"]),
  cursor: z.string().trim().max(500).optional(),
  pageSize: z.number().int().min(1).max(500).default(100),
  idempotencyKey: z.string().trim().min(12).max(200),
});

export const catalogReviewSchema = z.object({
  action: z.enum(["publish", "reject", "hide", "mark_discontinued"]),
  note: z.string().trim().max(2000).optional(),
  benefits: z.array(z.object({ id: z.string().uuid(), rule: benefitRuleSchema, verificationStatus: z.enum(["verified", "needs_review", "conflicted"]) })).max(500).optional(),
});

export function parseCardSearchParams(params: URLSearchParams) {
  const numeric = (key: string) => {
    const value = params.get(key);
    return value === null || value === "" ? undefined : Number(value);
  };
  return cardSearchSchema.safeParse({
    query: params.get("q") || undefined,
    issuer: params.get("issuer") || undefined,
    cardType: params.get("cardType") || undefined,
    brand: params.get("brand") || undefined,
    benefitCategory: params.get("category") || undefined,
    annualFeeMin: numeric("annualFeeMin"),
    annualFeeMax: numeric("annualFeeMax"),
    productStatus: params.get("status") || undefined,
    page: numeric("page") ?? 1,
    pageSize: numeric("pageSize") ?? 20,
  });
}
