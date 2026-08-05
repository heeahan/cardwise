import { NextResponse } from "next/server";
import { requireUser } from "../../../../../../lib/supabase/server";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase } = await requireUser();
    const { data, error } = await supabase.rpc("accept_catalog_update", { target_update: id });
    if (error) return NextResponse.json({ data: null, error: { code: "UPDATE_FAILED", message: "无法应用目录更新；未验证规则不会进入你的推荐计算" } }, { status: 400 });
    if (!data) return NextResponse.json({ data: null, error: { code: "NOT_FOUND", message: "更新不存在、已处理或无权访问" } }, { status: 404 });
    return NextResponse.json({ data: { benefitId: data }, error: null });
  } catch { return NextResponse.json({ data: null, error: { code: "UNAUTHORIZED", message: "请先登录" } }, { status: 401 }); }
}
