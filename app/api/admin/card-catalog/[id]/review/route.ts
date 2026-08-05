import { NextResponse } from "next/server";
import { catalogReviewSchema } from "../../../../../../lib/card-catalog/schemas";
import { requireAdmin } from "../../../../../../lib/supabase/server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = catalogReviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: { code: "VALIDATION_ERROR", message: "审核输入无效", fields: parsed.error.flatten().fieldErrors } }, { status: 422 });
  try {
    const { id } = await params;
    const { supabase } = await requireAdmin();
    const actionStatus = { publish: "verified", reject: "unverified", hide: "outdated", mark_discontinued: "outdated" } as const;
    for (const benefit of parsed.data.benefits ?? []) {
      const { error } = await supabase.from("catalog_benefits").update({ rule: benefit.rule, verification_status: benefit.verificationStatus, review_reasons: benefit.verificationStatus === "verified" ? [] : ["管理员尚未确认完整规则"] }).eq("id", benefit.id).eq("catalog_card_id", id);
      if (error) return NextResponse.json({ data: null, error: { code: "BENEFIT_REVIEW_FAILED", message: "权益审核保存失败" } }, { status: 400 });
    }
    const cardChanges: Record<string, unknown> = { verification_status: actionStatus[parsed.data.action] };
    if (parsed.data.action === "mark_discontinued") cardChanges.product_status = "discontinued";
    const { data: card, error: cardError } = await supabase.from("card_catalog").update(cardChanges).eq("id", id).select("id,name_ko,verification_status,product_status").maybeSingle();
    if (cardError) return NextResponse.json({ data: null, error: { code: "REVIEW_FAILED", message: "目录审核失败" } }, { status: 400 });
    if (!card) return NextResponse.json({ data: null, error: { code: "NOT_FOUND", message: "目录卡片不存在" } }, { status: 404 });
    if (parsed.data.action === "publish") {
      const { data: benefits } = await supabase.from("catalog_benefits").select("id,provider_benefit_id,name,rule,version,source_text,source_url").eq("catalog_card_id", id).eq("is_current", true).eq("verification_status", "verified").is("deleted_at", null);
      const { data: holders } = await supabase.from("credit_cards").select("id,user_id").eq("catalog_card_id", id).eq("auto_sync_enabled", true).is("deleted_at", null);
      for (const benefit of benefits ?? []) {
        const { data: previous } = await supabase.from("catalog_benefits").select("id,rule,version").eq("catalog_card_id", id).eq("provider_benefit_id", benefit.provider_benefit_id).lt("version", benefit.version).order("version", { ascending: false }).limit(1).maybeSingle();
        if (!previous && !(holders?.length)) continue;
        const changeType = previous ? "benefit_changed" : "benefit_added";
        const { data: existingEvent } = await supabase.from("catalog_change_events").select("id").eq("new_benefit_id", benefit.id).eq("change_type", changeType).maybeSingle();
        let eventId = existingEvent?.id as string | undefined;
        if (!eventId) {
          const { data: event } = await supabase.from("catalog_change_events").insert({ catalog_card_id: id, provider_benefit_id: benefit.provider_benefit_id, previous_benefit_id: previous?.id ?? null, new_benefit_id: benefit.id, change_type: changeType, material_fields: previous ? ["reviewed_rule_version"] : ["new_benefit"], before_snapshot: previous ? { version: previous.version, rule: previous.rule } : null, after_snapshot: { version: benefit.version, rule: benefit.rule, sourceText: benefit.source_text, sourceUrl: benefit.source_url } }).select("id").single();
          eventId = event?.id;
        }
        if (eventId && holders?.length) await supabase.from("user_catalog_updates").upsert(holders.map((holder) => ({ user_id: holder.user_id, credit_card_id: holder.id, change_event_id: eventId, status: "pending" })), { onConflict: "user_id,credit_card_id,change_event_id", ignoreDuplicates: true });
      }
    }
    return NextResponse.json({ data: card, error: null });
  } catch (error) { const unauthorized = error instanceof Error && error.message === "UNAUTHORIZED"; return NextResponse.json({ data: null, error: { code: unauthorized ? "UNAUTHORIZED" : "FORBIDDEN", message: unauthorized ? "请先登录" : "需要管理员权限" } }, { status: unauthorized ? 401 : 403 }); }
}
