import { NextResponse } from "next/server";
import { catalogSyncSchema } from "../../../../../lib/card-catalog/schemas";
import { CatalogProviderError } from "../../../../../lib/card-catalog/providers/provider";
import { resolveCatalogProvider } from "../../../../../lib/card-catalog/service";
import { createServiceRoleClient, requireAdmin } from "../../../../../lib/supabase/server";
import { logServerEvent } from "../../../../../lib/observability";
import { cardwiseCronSecret, verifySharedSecret } from "../../../../../lib/security/shared-secret";

async function syncContext(request: Request) {
  const supplied = request.headers.get("x-cardwise-cron-secret");
  if (verifySharedSecret(supplied, cardwiseCronSecret())) return { supabase: createServiceRoleClient(), triggerType: "cron" as const };
  const { supabase } = await requireAdmin();
  return { supabase, triggerType: "admin" as const };
}

export async function POST(request: Request) {
  const parsed = catalogSyncSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: { code: "VALIDATION_ERROR", message: "同步参数无效", fields: parsed.error.flatten().fieldErrors } }, { status: 422 });
  try {
    const { supabase, triggerType } = await syncContext(request);
    const input = parsed.data;
    const { data: existingRun } = await supabase.from("catalog_sync_runs").select("*").eq("provider_id", input.providerId).eq("idempotency_key", input.idempotencyKey).maybeSingle();
    if (existingRun) return NextResponse.json({ data: existingRun, error: null, meta: { idempotentReplay: true } });
    const provider = resolveCatalogProvider(input.providerId);
    const metadata = provider.getMetadata();
    const { data: run, error: runError } = await supabase.from("catalog_sync_runs").insert({ provider_id: input.providerId, idempotency_key: input.idempotencyKey, trigger_type: triggerType, status: metadata.status === "ready" || metadata.status === "partial" ? "running" : "not_configured", cursor: input.cursor ?? null, request_id: request.headers.get("x-request-id") }).select().single();
    if (runError) {
      logServerEvent("catalog.sync_lock_failed", "warn", { providerId: input.providerId, code: runError.code ?? "UNKNOWN" });
      return NextResponse.json({ data: null, error: { code: "SYNC_LOCK_FAILED", message: "已有同步任务运行，或幂等键已被占用" } }, { status: 409 });
    }
    if (!provider.syncCards || !["ready", "partial"].includes(metadata.status)) {
      await supabase.from("catalog_sync_runs").update({ finished_at: new Date().toISOString(), status: "not_configured", error_summary: metadata.message ?? "Provider 未配置" }).eq("id", run.id);
      logServerEvent("catalog.provider_not_configured", "warn", { providerId: input.providerId, triggerType });
      return NextResponse.json({ data: { ...run, status: "not_configured", provider: metadata }, error: { code: metadata.status === "contract_required" ? "PROVIDER_CONTRACT_REQUIRED" : "PROVIDER_NOT_CONFIGURED", message: metadata.message ?? "尚未配置韩国信用卡数据供应商" } }, { status: 503 });
    }
    try {
      const result = await provider.syncCards({ cursor: input.cursor, pageSize: input.pageSize, idempotencyKey: input.idempotencyKey });
      await supabase.from("catalog_sync_runs").update({ finished_at: new Date().toISOString(), status: "partial", fetched_count: result.cards.length, cursor: result.nextCursor ?? null, error_summary: "数据已通过 Provider 校验并进入候选队列；需要安装签约字段持久化映射后才能自动写入" }).eq("id", run.id);
      logServerEvent("catalog.sync_partial", "info", { providerId: input.providerId, fetchedCount: result.cards.length, triggerType });
      return NextResponse.json({ data: { runId: run.id, fetched: result.cards.length, nextCursor: result.nextCursor, provider: result.provider }, error: null, meta: { requiresReview: true } }, { status: 202 });
    } catch (error) {
      const providerError = error instanceof CatalogProviderError ? error : new CatalogProviderError("unavailable", "供应商同步失败", true);
      await supabase.from("catalog_sync_runs").update({ finished_at: new Date().toISOString(), status: "failed", failed_count: 1, error_summary: providerError.message }).eq("id", run.id);
      logServerEvent("catalog.sync_failed", "error", { providerId: input.providerId, classification: providerError.code, retryable: providerError.retryable, triggerType });
      return NextResponse.json({ data: { runId: run.id }, error: { code: `PROVIDER_${providerError.code.toUpperCase()}`, message: providerError.message, retryable: providerError.retryable } }, { status: providerError.code === "rate_limited" ? 429 : 502 });
    }
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    logServerEvent("catalog.sync_unavailable", "error", { code });
    return NextResponse.json({ data: null, error: { code: code === "UNAUTHORIZED" ? "UNAUTHORIZED" : code === "FORBIDDEN" ? "FORBIDDEN" : "SYNC_UNAVAILABLE", message: code === "UNAUTHORIZED" ? "请先登录" : code === "FORBIDDEN" ? "需要管理员权限" : "同步服务暂不可用" } }, { status: code === "UNAUTHORIZED" ? 401 : code === "FORBIDDEN" ? 403 : 503 });
  }
}
