import { NextResponse } from "next/server";
import { requireUser } from "../../../../lib/supabase/server";

export async function GET() {
  try {
    const { supabase, user } = await requireUser();
    const { data, error } = await supabase.from("user_catalog_updates").select("id,status,created_at,credit_card_id,credit_cards(id,nickname,card_name),catalog_change_events(id,change_type,material_fields,before_snapshot,after_snapshot,created_at,card_catalog(id,name_ko,source_name,source_url),catalog_benefits!catalog_change_events_new_benefit_id_fkey(id,name,description,rule,version,source_text,source_url))").eq("user_id", user.id).eq("status", "pending").order("created_at", { ascending: false });
    if (error) return NextResponse.json({ data: null, error: { code: "QUERY_FAILED", message: "无法读取目录变更提醒" } }, { status: 400 });
    return NextResponse.json({ data: data ?? [], error: null });
  } catch { return NextResponse.json({ data: null, error: { code: "UNAUTHORIZED", message: "请先登录" } }, { status: 401 }); }
}
