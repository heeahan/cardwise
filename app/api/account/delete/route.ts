import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient, requireUser } from "../../../../lib/supabase/server";
import { logServerEvent } from "../../../../lib/observability";

const inputSchema = z.object({ confirmation: z.literal("删除我的账户") });
const bucket = "cardwise-private";

async function listOwnedObjects(client: SupabaseClient, prefix: string, depth = 0): Promise<string[]> {
  if (depth > 10) throw new Error("STORAGE_DEPTH_LIMIT");
  const paths: string[] = [];
  for (let offset = 0; offset < 10000; offset += 100) {
    const { data, error } = await client.storage.from(bucket).list(prefix, { limit: 100, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error("STORAGE_LIST_FAILED");
    if (!data?.length) break;
    for (const item of data) {
      const path = `${prefix}/${item.name}`;
      if (item.id) paths.push(path);
      else paths.push(...await listOwnedObjects(client, path, depth + 1));
    }
    if (data.length < 100) break;
  }
  return paths;
}

export async function POST(request: Request) {
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: { code: "CONFIRMATION_REQUIRED", message: "请输入“删除我的账户”完成二次确认" } }, { status: 422 });
  let auditId: string | null = null;
  try {
    const { supabase, user } = await requireUser();
    const { data: isAdmin } = await supabase.rpc("is_cardwise_admin");
    if (isAdmin === true) return NextResponse.json({ data: null, error: { code: "ADMIN_TRANSFER_REQUIRED", message: "请先转移管理员职责和官方资料，再删除管理员账户" } }, { status: 409 });

    const service = createServiceRoleClient();
    const subjectHash = createHash("sha256").update(`cardwise-account-delete:${user.id}`).digest("hex");
    const { data: audit, error: auditError } = await service.from("account_deletion_audits").insert({ subject_hash: subjectHash, status: "requested" }).select("id").single();
    if (auditError || !audit) return NextResponse.json({ data: null, error: { code: auditError?.code === "23505" ? "DELETION_IN_PROGRESS" : "AUDIT_UNAVAILABLE", message: auditError?.code === "23505" ? "账户删除已在处理中" : "账户删除审计服务暂不可用" } }, { status: auditError?.code === "23505" ? 409 : 503 });
    auditId = audit.id;

    const objects = await listOwnedObjects(service, user.id);
    for (let index = 0; index < objects.length; index += 100) {
      const { error } = await service.storage.from(bucket).remove(objects.slice(index, index + 100));
      if (error) throw new Error("STORAGE_DELETE_FAILED");
    }
    const { error: storageAuditError } = await service.from("account_deletion_audits").update({ status: "storage_deleted", storage_objects_deleted: objects.length }).eq("id", auditId);
    if (storageAuditError) throw new Error("AUDIT_UPDATE_FAILED");

    const { error: deleteError } = await service.auth.admin.deleteUser(user.id, false);
    if (deleteError) throw new Error("AUTH_DELETE_FAILED");
    const { error: completionAuditError } = await service.from("account_deletion_audits").update({ status: "completed", completed_at: new Date().toISOString(), storage_objects_deleted: objects.length }).eq("id", auditId);
    if (completionAuditError) logServerEvent("account.deletion_audit_completion_failed", "error", { code: "AUDIT_UPDATE_FAILED" });
    logServerEvent("account.deletion_completed", "info", { storageObjectsDeleted: objects.length });
    return NextResponse.json({ data: { deleted: true }, error: null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "ACCOUNT_DELETE_FAILED";
    if (auditId) {
      try { await createServiceRoleClient().from("account_deletion_audits").update({ status: "failed", error_code: code.slice(0, 80) }).eq("id", auditId); } catch { /* The original safe error is returned below. */ }
    }
    logServerEvent("account.deletion_failed", "error", { code });
    const unauthorized = code === "UNAUTHORIZED";
    return NextResponse.json({ data: null, error: { code: unauthorized ? "UNAUTHORIZED" : code === "SERVICE_ROLE_NOT_CONFIGURED" ? "SERVICE_NOT_CONFIGURED" : "ACCOUNT_DELETE_FAILED", message: unauthorized ? "请先登录" : code === "SERVICE_ROLE_NOT_CONFIGURED" ? "账户删除服务尚未配置" : "账户删除未完成；你的登录账户仍保留，可安全重试" } }, { status: unauthorized ? 401 : 503 });
  }
}
