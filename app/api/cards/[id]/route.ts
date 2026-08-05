import { NextResponse } from "next/server";
import { creditCardInputSchema } from "../../../../lib/benefit-engine/schemas";
import { requireUser } from "../../../../lib/supabase/server";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = creditCardInputSchema.partial().safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: { code: "VALIDATION_ERROR", fields: parsed.error.flatten().fieldErrors } }, { status: 422 });
  try {
    const { id } = await params; const { supabase, user } = await requireUser(); const input = parsed.data;
    const payload = { ...(input.issuer !== undefined && { issuer_name: input.issuer }), ...(input.name !== undefined && { card_name: input.name }), ...(input.nickname !== undefined && { nickname: input.nickname }), ...(input.network !== undefined && { network: input.network }), ...(input.lastFour !== undefined && { last_four: input.lastFour || null }), ...(input.annualFee !== undefined && { annual_fee: input.annualFee }), ...(input.annualFeeMonth !== undefined && { annual_fee_month: input.annualFeeMonth }), ...(input.previousMonthSpend !== undefined && { previous_month_spend_requirement: input.previousMonthSpend }), ...(input.currentQualifyingSpend !== undefined && { current_qualifying_spend: input.currentQualifyingSpend }), ...(input.currency !== undefined && { currency: input.currency }), ...(input.statementCycleDay !== undefined && { statement_cycle_day: input.statementCycleDay }), ...(input.color !== undefined && { color: input.color }), ...(input.notes !== undefined && { notes: input.notes || null }), ...(input.isFavorite !== undefined && { is_favorite: input.isFavorite }), ...(input.isActive !== undefined && { status: input.isActive ? "active" : "inactive" }), ...(input.sortOrder !== undefined && { sort_order: input.sortOrder }), version: 2 };
    const { data, error } = await supabase.from("credit_cards").update(payload).eq("id", id).eq("user_id", user.id).is("deleted_at", null).select().maybeSingle();
    if (error) return NextResponse.json({ data: null, error: { code: "UPDATE_FAILED", message: "更新失败" } }, { status: 400 });
    if (!data) return NextResponse.json({ data: null, error: { code: "NOT_FOUND", message: "卡片不存在或无权访问" } }, { status: 404 });
    return NextResponse.json({ data, error: null });
  } catch { return NextResponse.json({ data: null, error: { code: "UNAUTHORIZED", message: "请先登录" } }, { status: 401 }); }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; const { supabase } = await requireUser();
    const { data, error } = await supabase.rpc("archive_credit_card", { target_id: id });
    if (error) return NextResponse.json({ data: null, error: { code: "DELETE_FAILED", message: "归档失败，请确认已执行最新数据库迁移" } }, { status: 400 });
    if (!data) return NextResponse.json({ data: null, error: { code: "NOT_FOUND", message: "卡片不存在或无权访问" } }, { status: 404 });
    return NextResponse.json({ data: { id }, error: null });
  } catch { return NextResponse.json({ data: null, error: { code: "UNAUTHORIZED", message: "请先登录" } }, { status: 401 }); }
}
