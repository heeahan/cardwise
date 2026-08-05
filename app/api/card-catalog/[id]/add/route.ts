import { NextResponse } from "next/server";
import { catalogAddSchema } from "../../../../../lib/card-catalog/schemas";
import { requireUser } from "../../../../../lib/supabase/server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = catalogAddSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: { code: "VALIDATION_ERROR", message: "添加设置无效", fields: parsed.error.flatten().fieldErrors } }, { status: 422 });
  try {
    const { id } = await params;
    const { supabase } = await requireUser();
    const { data, error } = await supabase.rpc("add_catalog_card_to_wallet", { target_catalog_card: id, options: parsed.data });
    if (error?.message.includes("DUPLICATE_CATALOG_CARD")) return NextResponse.json({ data: null, error: { code: "DUPLICATE_CARD", message: "这张实体卡已经添加过；如为另一张副卡，请填写不同末四位" } }, { status: 409 });
    if (error) return NextResponse.json({ data: null, error: { code: "ADD_FAILED", message: "无法添加信用卡，请确认已执行最新数据库迁移" } }, { status: 400 });
    if (!data) return NextResponse.json({ data: null, error: { code: "NOT_FOUND", message: "卡片不存在、尚未发布或无权访问" } }, { status: 404 });
    return NextResponse.json({ data: { cardId: data }, error: null }, { status: 201 });
  } catch { return NextResponse.json({ data: null, error: { code: "UNAUTHORIZED", message: "请先登录" } }, { status: 401 }); }
}
