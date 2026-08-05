import { NextResponse } from "next/server";
import { creditCardInputSchema } from "../../../lib/benefit-engine/schemas";
import { isServerSupabaseConfigured, requireUser } from "../../../lib/supabase/server";

const failure = (message: string, status: number, code: string) => NextResponse.json({ data: null, error: { code, message } }, { status });

export async function GET() {
  if (!isServerSupabaseConfigured()) return NextResponse.json({ data: [], error: null, meta: { mode: "demo" } });
  try {
    const { supabase } = await requireUser();
    const { data, error } = await supabase.from("credit_cards").select("*").is("deleted_at", null).order("sort_order").order("created_at", { ascending: false });
    if (error) return failure("无法读取信用卡", 400, "QUERY_FAILED");
    return NextResponse.json({ data, error: null });
  } catch (error) { return failure(error instanceof Error && error.message === "UNAUTHORIZED" ? "请先登录" : "服务暂不可用", error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 503, "UNAUTHORIZED"); }
}

export async function POST(request: Request) {
  if (!isServerSupabaseConfigured()) return failure("演示模式不会写入远程数据库", 503, "DEMO_MODE");
  const parsed = creditCardInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: { code: "VALIDATION_ERROR", message: "输入校验失败", fields: parsed.error.flatten().fieldErrors } }, { status: 422 });
  try {
    const { supabase, user } = await requireUser(); const input = parsed.data;
    const { data, error } = await supabase.from("credit_cards").insert({ user_id: user.id, issuer_name: input.issuer, card_name: input.name, nickname: input.nickname, network: input.network, last_four: input.lastFour || null, annual_fee: input.annualFee, annual_fee_month: input.annualFeeMonth, previous_month_spend_requirement: input.previousMonthSpend }).select().single();
    if (error) return failure("保存失败", 400, "INSERT_FAILED");
    return NextResponse.json({ data, error: null }, { status: 201 });
  } catch (error) { return failure(error instanceof Error && error.message === "UNAUTHORIZED" ? "请先登录" : "服务暂不可用", 401, "UNAUTHORIZED"); }
}
