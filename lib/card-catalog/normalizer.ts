import { externalCardListSchema } from "./schemas";
import type { ExternalCardDetail, NormalizedCatalogCard } from "./types";
import { normalizeExternalBenefit } from "./mapping";

const issuerAliases: Record<string, { code: string; ko: string; en: string; zh: string }> = {
  "신한카드": { code: "SHINHAN", ko: "신한카드", en: "Shinhan Card", zh: "新韩卡" },
  "삼성카드": { code: "SAMSUNG", ko: "삼성카드", en: "Samsung Card", zh: "三星卡" },
  "현대카드": { code: "HYUNDAI", ko: "현대카드", en: "Hyundai Card", zh: "现代卡" },
  "kb국민카드": { code: "KB", ko: "KB국민카드", en: "KB Kookmin Card", zh: "KB国民卡" },
  "롯데카드": { code: "LOTTE", ko: "롯데카드", en: "Lotte Card", zh: "乐天卡" },
  "우리카드": { code: "WOORI", ko: "우리카드", en: "Woori Card", zh: "友利卡" },
  "하나카드": { code: "HANA", ko: "하나카드", en: "Hana Card", zh: "韩亚卡" },
  "nh농협카드": { code: "NH", ko: "NH농협카드", en: "NH Card", zh: "NH农协卡" },
  "bc카드": { code: "BC", ko: "BC카드", en: "BC Card", zh: "BC卡" },
};

export function normalizeSearchText(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("ko-KR").replace(/[\p{P}\p{S}\s]+/gu, "");
}

export function normalizeIssuer(input: { nameKo: string; code?: string; nameEn?: string; nameZh?: string }) {
  const key = normalizeSearchText(input.nameKo);
  const alias = Object.entries(issuerAliases).find(([name]) => normalizeSearchText(name) === key)?.[1];
  return {
    code: input.code?.trim().toUpperCase() || alias?.code,
    nameKo: alias?.ko ?? input.nameKo.trim(),
    nameEn: input.nameEn?.trim() || alias?.en,
    nameZh: input.nameZh?.trim() || alias?.zh,
  };
}

export function normalizeExternalCards(payload: unknown): NormalizedCatalogCard[] {
  const cards = externalCardListSchema.parse(payload);
  const deduped = new Map<string, ExternalCardDetail>();
  for (const card of cards) {
    const identity = `${card.providerId}:${card.externalCardId}`;
    if (!deduped.has(identity)) deduped.set(identity, card);
  }
  return [...deduped.values()].map((card) => {
    const issuer = normalizeIssuer({ nameKo: card.issuerNameKo, code: card.issuerCode, nameEn: card.issuerNameEn, nameZh: card.issuerNameZh });
    const benefits = (card.benefits ?? []).map(normalizeExternalBenefit);
    return {
      ...card,
      issuerCode: issuer.code,
      issuerNameKo: issuer.nameKo,
      issuerNameEn: issuer.nameEn,
      issuerNameZh: issuer.nameZh,
      normalizedName: normalizeSearchText(`${issuer.nameKo}${card.nameKo}`),
      verificationStatus: "needs_review",
      benefits,
    };
  });
}
