import { NextResponse } from "next/server";
import { transactionInputSchema } from "../../../lib/benefit-engine/schemas";
import { isServerSupabaseConfigured, requireUser } from "../../../lib/supabase/server";

export async function GET(request: Request) {
  if (!isServerSupabaseConfigured()) return NextResponse.json({ data: [], error: null, meta: { mode: "demo" } });
  try {
    const { supabase, user } = await requireUser(); const url = new URL(request.url); const month = url.searchParams.get("month");
    let query = supabase.from("transactions").select("*, benefit_usages(*)").eq("user_id", user.id).is("deleted_at", null).order("occurred_at", { ascending: false }).limit(200);
    if (month && /^\d{4}-\d{2}$/.test(month)) { const start = `${month}-01T00:00:00+09:00`; const endDate = new Date(`${month}-01T00:00:00+09:00`); endDate.setMonth(endDate.getMonth() + 1); query = query.gte("occurred_at", start).lt("occurred_at", endDate.toISOString()); }
    const { data, error } = await query; if (error) throw error; return NextResponse.json({ data, error: null });
  } catch { return NextResponse.json({ data: null, error: { code: "UNAUTHORIZED", message: "请先登录" } }, { status: 401 }); }
}

export async function POST(request: Request) {
  const parsed = transactionInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: { code: "VALIDATION_ERROR", fields: parsed.error.flatten().fieldErrors } }, { status: 422 });
  try {
    const { supabase, user } = await requireUser(); const input = parsed.data;
    const { data: benefit } = await supabase.from("card_benefits").select("id,card_id,name,rule").eq("id", input.benefitId).eq("user_id", user.id).is("deleted_at", null).single();
    if (!benefit || benefit.card_id !== input.cardId) return NextResponse.json({ data: null, error: { code: "NOT_FOUND", message: "权益不存在或无权访问" } }, { status: 404 });
    const { data: transaction, error } = await supabase.from("transactions").insert({ user_id: user.id, card_id: input.cardId, occurred_at: input.occurredAt, merchant_name: input.merchantName, category_slug: input.category, original_amount: input.originalAmount, actual_discount_amount: input.discountAmount, note: input.note }).select().single();
    if (error) throw error;
    const { data: usage, error: usageError } = await supabase.from("benefit_usages").insert({ user_id: user.id, transaction_id: transaction.id, benefit_id: benefit.id, card_id: benefit.card_id, occurred_at: input.occurredAt, usage_count: input.usageCount, discount_amount: input.discountAmount, rule_snapshot: benefit.rule, benefit_name_snapshot: benefit.name }).select().single();
    if (usageError) { await supabase.from("transactions").delete().eq("id", transaction.id).eq("user_id", user.id); throw usageError; }
    return NextResponse.json({ data: { transaction, usage }, error: null }, { status: 201 });
  } catch { return NextResponse.json({ data: null, error: { code: "WRITE_FAILED", message: "保存失败，请稍后重试" } }, { status: 400 }); }
}
