import { NextResponse } from "next/server";
import { requireUser } from "../../../../lib/supabase/server";
import { logServerEvent } from "../../../../lib/observability";

export async function GET() {
  try {
    const { supabase, user } = await requireUser();
    const results = await Promise.all([
      supabase.from("profiles").select("display_name,default_language,default_currency,default_timezone,email_notifications,created_at,updated_at").eq("user_id", user.id).maybeSingle(),
      supabase.from("credit_cards").select("id,issuer_name,card_name,nickname,network,last_four,color,opened_at,status,is_favorite,sort_order,annual_fee,annual_fee_month,previous_month_spend_requirement,current_qualifying_spend,statement_cycle_day,notes,currency,catalog_card_id,catalog_snapshot,catalog_synced_at,auto_sync_enabled,created_at,updated_at,deleted_at").eq("user_id", user.id),
      supabase.from("card_benefits").select("id,card_id,name,category_slug,subcategory,description,benefit_type,rule,rule_version,starts_at,ends_at,status,source_name,source_url,last_verified_at,verified_by_user,confidence,catalog_benefit_key,catalog_benefit_version,catalog_source_snapshot,created_at,updated_at,deleted_at").eq("user_id", user.id),
      supabase.from("transactions").select("id,card_id,occurred_at,merchant_name,category_slug,original_amount,currency,actual_discount_amount,points_earned,note,created_at,updated_at,deleted_at").eq("user_id", user.id),
      supabase.from("benefit_usages").select("id,transaction_id,benefit_id,card_id,occurred_at,usage_count,discount_amount,rule_snapshot,benefit_name_snapshot,created_at,updated_at,deleted_at").eq("user_id", user.id),
      supabase.from("spend_requirements").select("id,card_id,period_start,period_end,required_amount,qualifying_amount,is_satisfied,source,created_at,updated_at,deleted_at").eq("user_id", user.id),
      supabase.from("reminders").select("id,card_id,benefit_id,reminder_type,title,body,due_at,is_enabled,read_at,dismissed_at,delivery_channels,created_at,updated_at,deleted_at").eq("user_id", user.id),
      supabase.from("uploaded_files").select("id,original_name,content_type,size_bytes,purpose,sha256,scan_status,created_at,updated_at,deleted_at").eq("user_id", user.id),
      supabase.from("import_jobs").select("id,uploaded_file_id,status,field_mapping,row_count,imported_count,skipped_count,error_count,errors,created_at,updated_at,deleted_at").eq("user_id", user.id),
      supabase.from("user_catalog_updates").select("id,credit_card_id,change_event_id,status,reviewed_at,created_at").eq("user_id", user.id),
    ]);
    if (results.some((result) => result.error)) {
      logServerEvent("account.export_failed", "error", { code: "QUERY_FAILED" });
      return NextResponse.json({ data: null, error: { code: "EXPORT_FAILED", message: "暂时无法导出全部账户数据" } }, { status: 503 });
    }
    const [profile, cards, benefits, transactions, usages, spendRequirements, reminders, uploadedFiles, importJobs, catalogUpdates] = results;
    const body = {
      format: "cardwise-user-export-v1",
      exportedAt: new Date().toISOString(),
      account: { email: user.email ?? null, profile: profile.data },
      data: { creditCards: cards.data, benefits: benefits.data, transactions: transactions.data, benefitUsages: usages.data, spendRequirements: spendRequirements.data, reminders: reminders.data, uploadedFiles: uploadedFiles.data, importJobs: importJobs.data, catalogUpdates: catalogUpdates.data },
      exclusions: ["authentication tokens", "cookies", "provider raw payloads", "service credentials", "stored file bytes"],
    };
    logServerEvent("account.export_completed", "info", { recordGroups: 9 });
    return new NextResponse(JSON.stringify(body, null, 2), { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="cardwise-export-${new Date().toISOString().slice(0, 10)}.json"`, "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return NextResponse.json({ data: null, error: { code: "UNAUTHORIZED", message: "请先登录" } }, { status: 401 });
  }
}
