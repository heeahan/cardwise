import { NextResponse } from "next/server";
import { externalCardSchema } from "../../../../lib/card-catalog/schemas";
import { catalogFingerprint } from "../../../../lib/card-catalog/service";
import { normalizeExternalCards } from "../../../../lib/card-catalog/normalizer";
import { requireAdmin } from "../../../../lib/supabase/server";

const forbidden = (error: unknown) => NextResponse.json({ data: null, error: { code: error instanceof Error && error.message === "UNAUTHORIZED" ? "UNAUTHORIZED" : "FORBIDDEN", message: error instanceof Error && error.message === "UNAUTHORIZED" ? "请先登录" : "需要 CardWise 目录管理员权限" } }, { status: error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 403 });

export async function GET(request: Request) {
  try {
    const { supabase } = await requireAdmin();
    const status = new URL(request.url).searchParams.get("status") ?? "needs_review";
    const allowed = ["unverified", "needs_review", "verified", "outdated", "conflicted"];
    if (!allowed.includes(status)) return NextResponse.json({ data: null, error: { code: "VALIDATION_ERROR", message: "审核状态无效" } }, { status: 422 });
    const { data, error } = await supabase.from("card_catalog").select("id,provider_id,external_card_id,name_ko,name_en,name_zh,card_type,brand,product_status,source_name,source_url,source_updated_at,last_synced_at,verification_status,coverage_note,card_issuers(id,code,name_ko,name_en,name_zh),catalog_benefits(id,provider_benefit_id,name,description,category,rule,source_text,source_url,verification_status,review_reasons,version,is_current)").eq("verification_status", status).is("deleted_at", null).order("updated_at", { ascending: false }).limit(100);
    if (error) return NextResponse.json({ data: null, error: { code: "QUERY_FAILED", message: "无法读取审核队列" } }, { status: 400 });
    return NextResponse.json({ data: data ?? [], error: null, meta: { isAdmin: true } });
  } catch (error) { return forbidden(error); }
}

export async function POST(request: Request) {
  const parsed = externalCardSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.providerId !== "manual") return NextResponse.json({ data: null, error: { code: "VALIDATION_ERROR", message: "人工目录数据格式无效，providerId 必须为 manual", fields: parsed.success ? undefined : parsed.error.flatten().fieldErrors } }, { status: 422 });
  try {
    const { supabase } = await requireAdmin();
    const card = normalizeExternalCards([parsed.data])[0];
    let issuerQuery = supabase.from("card_issuers").select("id").eq("is_public_template", true).is("deleted_at", null);
    issuerQuery = card.issuerCode ? issuerQuery.eq("code", card.issuerCode) : issuerQuery.eq("name_ko", card.issuerNameKo);
    const { data: existingIssuer } = await issuerQuery.maybeSingle();
    let issuerId = existingIssuer?.id as string | undefined;
    if (!issuerId) {
      const { data: issuer, error: issuerError } = await supabase.from("card_issuers").insert({ user_id: null, name: card.issuerNameKo, name_ko: card.issuerNameKo, name_en: card.issuerNameEn ?? null, name_zh: card.issuerNameZh ?? null, code: card.issuerCode ?? null, country_code: "KR", slug: card.issuerCode?.toLowerCase() ?? null, is_public_template: true, is_active: true }).select("id").single();
      if (issuerError) return NextResponse.json({ data: null, error: { code: "ISSUER_WRITE_FAILED", message: "无法保存发卡机构" } }, { status: 400 });
      issuerId = issuer.id;
    }
    const fingerprint = catalogFingerprint(card);
    const { data: catalogCard, error: cardError } = await supabase.from("card_catalog").insert({ issuer_id: issuerId, provider_id: "manual", external_card_id: card.externalCardId, normalized_name: card.normalizedName, name_ko: card.nameKo, name_en: card.nameEn ?? null, name_zh: card.nameZh ?? null, card_type: card.cardType, brand: card.brand, annual_fee_domestic: card.annualFeeDomestic, annual_fee_overseas: card.annualFeeOverseas ?? null, currency: card.currency, image_url: card.imageUrl ?? null, official_url: card.officialUrl, application_url: card.applicationUrl ?? null, product_status: card.productStatus, source_url: card.sourceUrl, source_name: card.sourceName, source_updated_at: card.sourceUpdatedAt ?? null, last_synced_at: new Date().toISOString(), verification_status: "needs_review", coverage_note: card.coverageNote ?? null, source_fingerprint: fingerprint, raw_data: card.rawData ?? null }).select("id").single();
    if (cardError) return NextResponse.json({ data: null, error: { code: "CATALOG_WRITE_FAILED", message: cardError.code === "23505" ? "该人工目录卡片已存在" : "无法保存目录卡片" } }, { status: cardError.code === "23505" ? 409 : 400 });
    if (card.benefits.length) {
      const { error: benefitsError } = await supabase.from("catalog_benefits").insert(card.benefits.map((benefit) => ({ catalog_card_id: catalogCard.id, provider_benefit_id: benefit.providerBenefitId, name: benefit.name, description: benefit.description, category: benefit.category, rule: benefit.rule, source_text: benefit.sourceText, source_url: benefit.sourceUrl ?? null, effective_from: benefit.effectiveFrom ?? null, effective_to: benefit.effectiveTo ?? null, source_updated_at: benefit.sourceUpdatedAt ?? null, verification_status: "needs_review", review_reasons: benefit.reviewReasons, version: 1, is_current: true, raw_data: benefit.rawData ?? null })));
      if (benefitsError) return NextResponse.json({ data: { id: catalogCard.id }, error: { code: "BENEFIT_WRITE_FAILED", message: "卡片已进入审核队列，但部分权益保存失败" } }, { status: 207 });
    }
    return NextResponse.json({ data: { id: catalogCard.id, verificationStatus: "needs_review" }, error: null }, { status: 201 });
  } catch (error) { return forbidden(error); }
}
