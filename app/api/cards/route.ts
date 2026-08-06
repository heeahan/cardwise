import { NextResponse } from "next/server";
import { creditCardInputSchema } from "../../../lib/benefit-engine/schemas";
import { isServerDemoModeEnabled, isServerSupabaseConfigured, requireUser } from "../../../lib/supabase/server";

const failure = (message: string, status: number, code: string) => NextResponse.json({ data: null, error: { code, message } }, { status });

export async function GET(request: Request) {
  if (!isServerSupabaseConfigured()) return isServerDemoModeEnabled() ? NextResponse.json({ data: [], error: null, meta: { mode: "demo" } }) : failure("认证服务配置错误", 503, "AUTH_CONFIGURATION_ERROR");
  try {
    const { supabase, user } = await requireUser();
    const archived = new URL(request.url).searchParams.get("archived") === "1";
    let query = supabase.from("credit_cards").select("*").eq("user_id", user.id).order("sort_order").order("created_at", { ascending: false });
    query = archived ? query.not("deleted_at", "is", null) : query.is("deleted_at", null);
    const { data, error } = await query;
    if (error) return failure("无法读取信用卡", 400, "QUERY_FAILED");
    return NextResponse.json({ data, error: null });
  } catch (error) { return failure(error instanceof Error && error.message === "UNAUTHORIZED" ? "请先登录" : "服务暂不可用", error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 503, "UNAUTHORIZED"); }
}

export async function POST(request: Request) {
  if (!isServerSupabaseConfigured()) return failure(isServerDemoModeEnabled() ? "演示模式不会写入远程数据库" : "认证服务配置错误", 503, isServerDemoModeEnabled() ? "DEMO_MODE" : "AUTH_CONFIGURATION_ERROR");
  const parsed = creditCardInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: { code: "VALIDATION_ERROR", message: "输入校验失败", fields: parsed.error.flatten().fieldErrors } }, { status: 422 });
  try {
    const { supabase, user } = await requireUser(); const input = parsed.data;
    const { data, error } = await supabase.from("credit_cards").insert({ user_id: user.id, issuer_name: input.issuer, card_name: input.name, nickname: input.nickname, network: input.network, last_four: input.lastFour || null, annual_fee: input.annualFee, annual_fee_month: input.annualFeeMonth, previous_month_spend_requirement: input.previousMonthSpend, current_qualifying_spend: input.currentQualifyingSpend ?? 0, currency: input.currency ?? "KRW", statement_cycle_day: input.statementCycleDay ?? null, color: input.color ?? "#5d4de2", notes: input.notes ?? null, is_favorite: input.isFavorite ?? false, status: input.isActive === false ? "inactive" : "active", sort_order: input.sortOrder ?? 0 }).select().single();
    if (error) return failure("保存失败", 400, "INSERT_FAILED");
    return NextResponse.json({ data, error: null }, { status: 201 });
  } catch (error) { return failure(error instanceof Error && error.message === "UNAUTHORIZED" ? "请先登录" : "服务暂不可用", 401, "UNAUTHORIZED"); }
}
