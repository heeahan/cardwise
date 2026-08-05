import type { Benefit, BenefitUsage, CreditCard } from "../benefit-engine/types";

const now = new Date();
const iso = (monthOffset: number, day: number) => new Date(now.getFullYear(), now.getMonth() + monthOffset, day, 12).toISOString();
const yearIso = (month: number, day: number) => new Date(now.getFullYear(), month - 1, day, 12).toISOString();

export const demoCards: CreditCard[] = [
  { id: "card-a", issuer: "演示银行", name: "Daily Coffee", nickname: "A信用卡", network: "Visa", lastFour: "2486", color: "linear-gradient(135deg,#4e39f3,#8a7cff)", isFavorite: true, isActive: true, annualFee: 120000, annualFeeMonth: 11, openedAt: "2025-02-12", previousMonthSpend: 420000, currentQualifyingSpend: 268000 },
  { id: "card-b", issuer: "演示金融", name: "Signature Stay", nickname: "B信用卡", network: "Mastercard", lastFour: "8132", color: "linear-gradient(135deg,#172233,#3b5068)", isFavorite: false, isActive: true, annualFee: 180000, annualFeeMonth: 9, openedAt: "2024-10-21", previousMonthSpend: 680000, currentQualifyingSpend: 521000 },
  { id: "card-c", issuer: "演示卡社", name: "Airport One", nickname: "C信用卡", network: "AMEX", lastFour: "5041", color: "linear-gradient(135deg,#008c77,#20c49a)", isFavorite: false, isActive: true, annualFee: 250000, annualFeeMonth: 12, openedAt: "2024-01-08", previousMonthSpend: 720000, currentQualifyingSpend: 604000 },
  { id: "card-d", issuer: "演示银行", name: "Drive Plus", nickname: "D信用卡", network: "Visa", lastFour: "7715", color: "linear-gradient(135deg,#ea5b2a,#ff9c5c)", isFavorite: false, isActive: true, annualFee: 30000, annualFeeMonth: 6, openedAt: "2025-06-18", previousMonthSpend: 340000, currentQualifyingSpend: 198000 },
  { id: "card-e", issuer: "演示支付", name: "Online Five", nickname: "E信用卡", network: "Local", lastFour: "9027", color: "linear-gradient(135deg,#b22f70,#ee6eac)", isFavorite: false, isActive: true, annualFee: 15000, annualFeeMonth: 4, openedAt: "2025-09-01", previousMonthSpend: 210000, currentQualifyingSpend: 172000 },
];

export const demoBenefits: Benefit[] = [
  { id: "benefit-coffee", cardId: "card-a", name: "星巴克 20% 优惠", category: "咖啡", description: "指定咖啡门店消费享20%折扣，每月最高优惠₩10,000。", rule: { benefitType: "percentage", discountRate: 20, monthlyDiscountCap: 10000, minimumTransactionAmount: 1000, previousMonthSpendRequirement: 300000, merchantKeywords: ["星巴克", "Starbucks", "스타벅스"], channel: "both", geography: "domestic", resetPeriod: "monthly" }, status: "active", sourceName: "演示模板（非银行官方数据）", lastVerifiedAt: "2026-07-22", verifiedByUser: true, confidence: "example" },
  { id: "benefit-valet", cardId: "card-b", name: "酒店免费代客泊车", category: "酒店代客泊车", description: "指定酒店每月免费代客泊车1次。", rule: { benefitType: "free_service", fixedAmount: 20000, monthlyUsageLimit: 1, annualUsageLimit: 12, previousMonthSpendRequirement: 500000, participatingMerchants: ["演示酒店"], channel: "offline", geography: "domestic", resetPeriod: "monthly" }, status: "active", sourceName: "演示模板（非银行官方数据）", lastVerifiedAt: "2026-07-18", verifiedByUser: true, confidence: "example" },
  { id: "benefit-lounge", cardId: "card-c", name: "机场贵宾厅", category: "机场贵宾厅", description: "指定机场贵宾厅每年免费使用3次。", rule: { benefitType: "free_service", fixedAmount: 45000, annualUsageLimit: 3, previousMonthSpendRequirement: 500000, channel: "offline", geography: "both", resetPeriod: "yearly" }, status: "active", sourceName: "演示模板（非银行官方数据）", lastVerifiedAt: "2026-06-30", verifiedByUser: true, confidence: "example" },
  { id: "benefit-fuel", cardId: "card-d", name: "加油固定优惠", category: "加油", description: "指定加油站单笔优惠₩3,000，每月最高₩12,000。", rule: { benefitType: "fixed_discount", fixedAmount: 3000, monthlyDiscountCap: 12000, minimumTransactionAmount: 40000, merchantKeywords: ["加油", "Oil", "주유"], channel: "offline", geography: "domestic", resetPeriod: "monthly" }, status: "active", sourceName: "演示模板（非银行官方数据）", lastVerifiedAt: "2026-07-04", verifiedByUser: true, confidence: "example" },
  { id: "benefit-online", cardId: "card-e", name: "网购 5% 返现", category: "网购", description: "线上消费返现5%，单笔最高₩5,000，每月最高₩20,000。", rule: { benefitType: "cashback", discountRate: 5, perTransactionCap: 5000, monthlyDiscountCap: 20000, channel: "online", geography: "both", resetPeriod: "monthly" }, status: "expiring", sourceName: "演示模板（非银行官方数据）", lastVerifiedAt: "2026-07-11", verifiedByUser: true, confidence: "example" },
  { id: "benefit-dining", cardId: "card-a", name: "周末餐饮 10%", category: "餐饮", description: "周末指定餐厅享10%优惠。", rule: { benefitType: "percentage", discountRate: 10, perTransactionCap: 6000, monthlyDiscountCap: 18000, minimumTransactionAmount: 20000, weekdays: [0, 6], merchantKeywords: ["餐厅", "Restaurant", "레스토랑"], channel: "offline", geography: "domestic", resetPeriod: "monthly" }, status: "active", sourceName: "演示模板（非银行官方数据）", lastVerifiedAt: "2026-07-29", verifiedByUser: true, confidence: "example" },
];

export const demoUsages: BenefitUsage[] = [
  { id: "usage-a1", benefitId: "benefit-coffee", cardId: "card-a", occurredAt: iso(0, 2), merchantName: "Starbucks 江南店", category: "咖啡", originalAmount: 18000, discountAmount: 3600, usageCount: 1, ruleSnapshot: demoBenefits[0].rule },
  { id: "usage-a2", benefitId: "benefit-coffee", cardId: "card-a", occurredAt: iso(0, 3), merchantName: "스타벅스 光化门店", category: "咖啡", originalAmount: 12000, discountAmount: 2400, usageCount: 1, ruleSnapshot: demoBenefits[0].rule },
  { id: "usage-c1", benefitId: "benefit-lounge", cardId: "card-c", occurredAt: yearIso(2, 16), merchantName: "仁川机场演示贵宾厅", category: "机场贵宾厅", originalAmount: 0, discountAmount: 45000, usageCount: 1, ruleSnapshot: demoBenefits[2].rule },
  { id: "usage-c2", benefitId: "benefit-lounge", cardId: "card-c", occurredAt: yearIso(6, 7), merchantName: "金浦机场演示贵宾厅", category: "机场贵宾厅", originalAmount: 0, discountAmount: 45000, usageCount: 1, ruleSnapshot: demoBenefits[2].rule },
  { id: "usage-d1", benefitId: "benefit-fuel", cardId: "card-d", occurredAt: iso(0, 1), merchantName: "演示加油站", category: "加油", originalAmount: 62000, discountAmount: 3000, usageCount: 1, ruleSnapshot: demoBenefits[3].rule },
  { id: "usage-e1", benefitId: "benefit-online", cardId: "card-e", occurredAt: iso(0, 2), merchantName: "Demo Mall", category: "网购", originalAmount: 86000, discountAmount: 4300, usageCount: 1, ruleSnapshot: demoBenefits[4].rule },
];

export const categories = ["咖啡", "餐饮", "便利店", "超市", "外卖", "网购", "百货商店", "交通", "公共交通", "出租车", "加油", "通信费", "水电煤", "流媒体", "电影", "文化娱乐", "健身", "美容", "医疗", "药店", "教育", "旅行", "航空", "机场贵宾厅", "酒店", "酒店代客泊车", "停车", "租车", "免税店", "海外消费", "分期", "保险", "其他"];
