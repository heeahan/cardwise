import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/supabase/server";

export async function GET() {
  try {
    const { supabase } = await requireAdmin();
    const { data, error } = await supabase.from("catalog_sync_runs").select("id,provider_id,started_at,finished_at,status,fetched_count,created_count,updated_count,unchanged_count,conflicted_count,failed_count,error_summary,cursor,trigger_type").order("started_at", { ascending: false }).limit(100);
    if (error) return NextResponse.json({ data: null, error: { code: "QUERY_FAILED", message: "无法读取同步历史" } }, { status: 400 });
    return NextResponse.json({ data: data ?? [], error: null });
  } catch (error) { const unauthorized = error instanceof Error && error.message === "UNAUTHORIZED"; return NextResponse.json({ data: null, error: { code: unauthorized ? "UNAUTHORIZED" : "FORBIDDEN", message: unauthorized ? "请先登录" : "需要管理员权限" } }, { status: unauthorized ? 401 : 403 }); }
}
