import { NextResponse } from "next/server";
import { requireUser } from "../../../../../lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase } = await requireUser();
    const { data, error } = await supabase.from("catalog_benefits").select("id,provider_benefit_id,name,description,category,rule,source_text,source_url,effective_from,effective_to,source_updated_at,verification_status,version").eq("catalog_card_id", id).eq("verification_status", "verified").eq("is_current", true).is("deleted_at", null).order("category");
    if (error) return NextResponse.json({ data: null, error: { code: "QUERY_FAILED", message: "无法读取目录权益" } }, { status: 400 });
    return NextResponse.json({ data: data ?? [], error: null });
  } catch { return NextResponse.json({ data: null, error: { code: "UNAUTHORIZED", message: "请先登录" } }, { status: 401 }); }
}
