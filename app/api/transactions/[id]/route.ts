import { NextResponse } from "next/server";
import { transactionInputSchema } from "../../../../lib/benefit-engine/schemas";
import { requireUser } from "../../../../lib/supabase/server";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = transactionInputSchema.partial().safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: { code: "VALIDATION_ERROR", fields: parsed.error.flatten().fieldErrors } }, { status: 422 });
  try {
    const { id } = await params;
    const { supabase, user } = await requireUser();
    const input = parsed.data;
    const payload = {
      ...(input.cardId !== undefined && { card_id: input.cardId }),
      ...(input.occurredAt !== undefined && { occurred_at: input.occurredAt }),
      ...(input.merchantName !== undefined && { merchant_name: input.merchantName }),
      ...(input.category !== undefined && { category_slug: input.category }),
      ...(input.originalAmount !== undefined && { original_amount: input.originalAmount }),
      ...(input.discountAmount !== undefined && { actual_discount_amount: input.discountAmount }),
      ...(input.note !== undefined && { note: input.note }),
    };
    const { data: transaction, error } = await supabase.from("transactions").update(payload).eq("id", id).eq("user_id", user.id).is("deleted_at", null).select().maybeSingle();
    if (error) throw error;
    if (!transaction) return NextResponse.json({ data: null, error: { code: "NOT_FOUND", message: "消费记录不存在或无权访问" } }, { status: 404 });
    const usagePayload = {
      ...(input.cardId !== undefined && { card_id: input.cardId }),
      ...(input.benefitId !== undefined && { benefit_id: input.benefitId }),
      ...(input.occurredAt !== undefined && { occurred_at: input.occurredAt }),
      ...(input.discountAmount !== undefined && { discount_amount: input.discountAmount }),
      ...(input.usageCount !== undefined && { usage_count: input.usageCount }),
    };
    if (Object.keys(usagePayload).length) {
      const { error: usageError } = await supabase.from("benefit_usages").update(usagePayload).eq("transaction_id", id).eq("user_id", user.id).is("deleted_at", null);
      if (usageError) throw usageError;
    }
    return NextResponse.json({ data: transaction, error: null });
  } catch {
    return NextResponse.json({ data: null, error: { code: "WRITE_FAILED", message: "更新失败，请稍后重试" } }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { supabase, user } = await requireUser();
    const deletedAt = new Date().toISOString();
    const { data, error } = await supabase.from("transactions").update({ deleted_at: deletedAt }).eq("id", id).eq("user_id", user.id).is("deleted_at", null).select("id").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ data: null, error: { code: "NOT_FOUND", message: "消费记录不存在或无权访问" } }, { status: 404 });
    const { error: usageError } = await supabase.from("benefit_usages").update({ deleted_at: deletedAt }).eq("transaction_id", id).eq("user_id", user.id).is("deleted_at", null);
    if (usageError) throw usageError;
    return NextResponse.json({ data, error: null });
  } catch {
    return NextResponse.json({ data: null, error: { code: "DELETE_FAILED", message: "删除失败，请稍后重试" } }, { status: 400 });
  }
}
