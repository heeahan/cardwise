import { NextResponse } from "next/server";
import { benefitInputSchema } from "../../../../lib/benefit-engine/schemas";
import { requireUser } from "../../../../lib/supabase/server";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = benefitInputSchema.partial().safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: { code: "VALIDATION_ERROR", fields: parsed.error.flatten().fieldErrors } }, { status: 422 });
  try {
    const { id } = await params; const { supabase, user } = await requireUser(); const input = parsed.data;
    if (input.cardId) { const { data: ownedCard } = await supabase.from("credit_cards").select("id").eq("id", input.cardId).eq("user_id", user.id).is("deleted_at", null).maybeSingle(); if (!ownedCard) return NextResponse.json({ data: null, error: { code: "NOT_FOUND" } }, { status: 404 }); }
    const payload = { ...(input.cardId !== undefined && { card_id: input.cardId }), ...(input.name !== undefined && { name: input.name }), ...(input.category !== undefined && { category_slug: input.category }), ...(input.subcategory !== undefined && { subcategory: input.subcategory }), ...(input.description !== undefined && { description: input.description }), ...(input.rule !== undefined && { rule: input.rule, benefit_type: input.rule.benefitType, rule_version: 2 }), ...(input.status !== undefined && { status: input.status }), ...(input.sourceName !== undefined && { source_name: input.sourceName }), ...(input.sourceUrl !== undefined && { source_url: input.sourceUrl || null }), ...(input.lastVerifiedAt !== undefined && { last_verified_at: input.lastVerifiedAt }), ...(input.verifiedByUser !== undefined && { verified_by_user: input.verifiedByUser }), ...(input.confidence !== undefined && { confidence: input.confidence }) };
    const { data, error } = await supabase.from("card_benefits").update(payload).eq("id", id).eq("user_id", user.id).is("deleted_at", null).select().maybeSingle();
    if (error) throw error; if (!data) return NextResponse.json({ data: null, error: { code: "NOT_FOUND" } }, { status: 404 }); return NextResponse.json({ data, error: null });
  } catch { return NextResponse.json({ data: null, error: { code: "WRITE_FAILED", message: "更新失败" } }, { status: 400 }); }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; const { supabase, user } = await requireUser();
    const deletedAt = new Date().toISOString();
    const { data, error } = await supabase.from("card_benefits").update({ deleted_at: deletedAt, status: "expired" }).eq("id", id).eq("user_id", user.id).is("deleted_at", null).select("id").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ data: null, error: { code: "NOT_FOUND" } }, { status: 404 });
    const { error: usageError } = await supabase.from("benefit_usages").update({ deleted_at: deletedAt }).eq("benefit_id", id).eq("user_id", user.id).is("deleted_at", null);
    if (usageError) throw usageError;
    return NextResponse.json({ data, error: null });
  } catch { return NextResponse.json({ data: null, error: { code: "WRITE_FAILED", message: "删除失败" } }, { status: 400 }); }
}
