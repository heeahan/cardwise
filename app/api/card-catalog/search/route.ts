import { NextResponse } from "next/server";
import { normalizeSearchText } from "../../../../lib/card-catalog/normalizer";
import { parseCardSearchParams } from "../../../../lib/card-catalog/schemas";
import { resolveCatalogProvider } from "../../../../lib/card-catalog/service";
import { isServerDemoModeEnabled, isServerSupabaseConfigured, requireUser } from "../../../../lib/supabase/server";

const fail = (status: number, code: string, message: string, fields?: unknown) => NextResponse.json({ data: null, error: { code, message, fields } }, { status });

export async function GET(request: Request) {
  const parsed = parseCardSearchParams(new URL(request.url).searchParams);
  if (!parsed.success) return fail(422, "VALIDATION_ERROR", "搜索条件无效", parsed.error.flatten().fieldErrors);
  const provider = resolveCatalogProvider().getMetadata();
  if (!isServerSupabaseConfigured()) return isServerDemoModeEnabled() ? NextResponse.json({ data: { items: [], total: 0, page: parsed.data.page, pageSize: parsed.data.pageSize }, error: null, meta: { provider, catalogStatus: "database_not_configured" } }) : fail(503, "AUTH_CONFIGURATION_ERROR", "认证服务配置错误");
  try {
    const { supabase } = await requireUser();
    const input = parsed.data;
    let catalogIds: string[] | undefined;
    if (input.benefitCategory) {
      const { data: benefitRows, error: benefitError } = await supabase.from("catalog_benefits").select("catalog_card_id").eq("verification_status", "verified").eq("is_current", true).eq("category", input.benefitCategory).limit(500);
      if (benefitError) return fail(400, "QUERY_FAILED", "无法筛选权益分类");
      catalogIds = [...new Set((benefitRows ?? []).map((row) => row.catalog_card_id))];
      if (!catalogIds.length) return NextResponse.json({ data: { items: [], total: 0, page: input.page, pageSize: input.pageSize }, error: null, meta: { provider, catalogStatus: "ready" } });
    }
    const from = (input.page - 1) * input.pageSize;
    const to = from + input.pageSize - 1;
    let query = supabase.from("card_catalog").select("id,issuer_id,provider_id,external_card_id,name_ko,name_en,name_zh,card_type,brand,annual_fee_domestic,annual_fee_overseas,currency,image_url,official_url,application_url,product_status,source_url,source_name,source_updated_at,last_synced_at,verification_status,coverage_note,card_issuers(id,code,name_ko,name_en,name_zh,official_website,logo_path),catalog_benefits(id,name,description,category,rule,source_text,source_url,effective_from,effective_to,source_updated_at,verification_status,version,is_current)", { count: "exact" }).eq("verification_status", "verified").is("deleted_at", null);
    if (input.query) {
      const safe = normalizeSearchText(input.query).replace(/[,().%*_]/g, "");
      if (safe) query = query.or(`normalized_name.ilike.%${safe}%,name_ko.ilike.%${input.query.replace(/[,().%*_]/g, "")}%,name_en.ilike.%${input.query.replace(/[,().%*_]/g, "")}%,name_zh.ilike.%${input.query.replace(/[,().%*_]/g, "")}%`);
    }
    if (input.issuer) query = query.eq("issuer_id", input.issuer);
    if (input.cardType) query = query.eq("card_type", input.cardType);
    if (input.brand) query = query.eq("brand", input.brand);
    if (input.productStatus) query = query.eq("product_status", input.productStatus);
    if (input.annualFeeMin !== undefined) query = query.gte("annual_fee_domestic", input.annualFeeMin);
    if (input.annualFeeMax !== undefined) query = query.lte("annual_fee_domestic", input.annualFeeMax);
    if (catalogIds) query = query.in("id", catalogIds);
    const { data, error, count } = await query.order("name_ko").range(from, to);
    if (error) return fail(400, "QUERY_FAILED", "无法读取信用卡目录");
    const items = (data ?? []).map((row) => ({ ...row, catalog_benefits: row.catalog_benefits?.filter((benefit) => benefit.is_current) ?? [] }));
    return NextResponse.json({ data: { items, total: count ?? 0, page: input.page, pageSize: input.pageSize }, error: null, meta: { provider, catalogStatus: "ready" } });
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === "UNAUTHORIZED";
    return fail(unauthorized ? 401 : 503, unauthorized ? "UNAUTHORIZED" : "SERVICE_UNAVAILABLE", unauthorized ? "请先登录" : "信用卡目录服务暂不可用");
  }
}
