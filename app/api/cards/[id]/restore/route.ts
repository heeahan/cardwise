import { NextResponse } from "next/server";
import { requireUser } from "../../../../../lib/supabase/server";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase } = await requireUser();
    const { data, error } = await supabase.rpc("restore_credit_card", { target_id: id });
    if (error) return NextResponse.json({ data: null, error: { code: "RESTORE_FAILED", message: "恢复失败，请确认已执行最新数据库迁移" } }, { status: 400 });
    if (!data) return NextResponse.json({ data: null, error: { code: "NOT_FOUND", message: "卡片不存在或无权访问" } }, { status: 404 });
    return NextResponse.json({ data: { id }, error: null });
  } catch {
    return NextResponse.json({ data: null, error: { code: "UNAUTHORIZED", message: "请先登录" } }, { status: 401 });
  }
}
