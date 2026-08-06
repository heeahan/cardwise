import { NextResponse } from "next/server";
import { benefitInputSchema } from "../../../lib/benefit-engine/schemas";
import { isServerDemoModeEnabled, isServerSupabaseConfigured, requireUser } from "../../../lib/supabase/server";

export async function GET() {
  if (!isServerSupabaseConfigured()) return isServerDemoModeEnabled() ? NextResponse.json({ data: [], error: null, meta: { mode: "demo" } }) : NextResponse.json({ data: null, error: { code: "AUTH_CONFIGURATION_ERROR", message: "认证服务配置错误" } }, { status: 503 });
  try {
    const { supabase, user } = await requireUser();
    const { data, error } = await supabase.from("card_benefits").select("*").eq("user_id", user.id).is("deleted_at", null).order("created_at", { ascending: false });
    if (error) throw error; return NextResponse.json({ data, error: null });
  } catch { return NextResponse.json({ data: null, error: { code: "UNAUTHORIZED", message: "请先登录" } }, { status: 401 }); }
}

export async function POST(request: Request) {
  const parsed = benefitInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: { code: "VALIDATION_ERROR", fields: parsed.error.flatten().fieldErrors } }, { status: 422 });
  try {
    const { supabase, user } = await requireUser(); const input = parsed.data;
    const { data: ownedCard } = await supabase.from("credit_cards").select("id").eq("id", input.cardId).eq("user_id", user.id).is("deleted_at", null).maybeSingle();
    if (!ownedCard) return NextResponse.json({ data: null, error: { code: "NOT_FOUND", message: "信用卡不存在或无权访问" } }, { status: 404 });
    const { data, error } = await supabase.from("card_benefits").insert({ user_id: user.id, card_id: input.cardId, name: input.name, category_slug: input.category, subcategory: input.subcategory, description: input.description, benefit_type: input.rule.benefitType, rule: input.rule, status: input.status, source_name: input.sourceName, source_url: input.sourceUrl || null, last_verified_at: input.lastVerifiedAt, verified_by_user: input.verifiedByUser, confidence: input.confidence }).select().single();
    if (error) throw error; return NextResponse.json({ data, error: null }, { status: 201 });
  } catch { return NextResponse.json({ data: null, error: { code: "WRITE_FAILED", message: "保存失败" } }, { status: 400 }); }
}
