import { NextResponse } from "next/server";
import { isServerSupabaseConfigured, requireUser } from "../../../../lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isServerSupabaseConfigured()) return NextResponse.json({ data: null, error: { code: "NOT_CONFIGURED", message: "尚未配置信用卡目录数据库" } }, { status: 503 });
  try {
    const { id } = await params;
    const { supabase } = await requireUser();
    const { data, error } = await supabase.from("card_catalog").select("id,issuer_id,provider_id,external_card_id,name_ko,name_en,name_zh,card_type,brand,annual_fee_domestic,annual_fee_overseas,currency,image_url,official_url,application_url,product_status,source_url,source_name,source_updated_at,last_synced_at,verification_status,coverage_note,card_issuers(id,code,name_ko,name_en,name_zh,official_website,logo_path),catalog_benefits(id,provider_benefit_id,name,description,category,rule,source_text,source_url,effective_from,effective_to,source_updated_at,verification_status,version,is_current)").eq("id", id).eq("verification_status", "verified").is("deleted_at", null).maybeSingle();
    if (error) return NextResponse.json({ data: null, error: { code: "QUERY_FAILED", message: "无法读取卡片详情" } }, { status: 400 });
    if (!data) return NextResponse.json({ data: null, error: { code: "NOT_FOUND", message: "卡片不存在、尚未发布或无权访问" } }, { status: 404 });
    return NextResponse.json({ data: { ...data, catalog_benefits: data.catalog_benefits?.filter((benefit) => benefit.is_current) ?? [] }, error: null });
  } catch { return NextResponse.json({ data: null, error: { code: "UNAUTHORIZED", message: "请先登录" } }, { status: 401 }); }
}
