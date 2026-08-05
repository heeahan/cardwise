import { NextResponse } from "next/server";
import { testProviderConnection } from "../../../../lib/card-catalog/health";
import { resolveCatalogProvider } from "../../../../lib/card-catalog/service";
import { requireAdmin } from "../../../../lib/supabase/server";

export async function GET() {
  try {
    const { supabase } = await requireAdmin();
    const [{ data: readiness, error }, provider] = await Promise.all([
      supabase.rpc("cardwise_production_readiness"),
      testProviderConnection(resolveCatalogProvider()),
    ]);
    if (error) return NextResponse.json({ data: { database: "migration_incomplete", provider }, error: { code: "READINESS_RPC_MISSING", message: "请执行最新生产迁移" } }, { status: 503 });
    return NextResponse.json({ data: { database: "healthy", readiness, provider, timestamp: new Date().toISOString() }, error: null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "FORBIDDEN";
    return NextResponse.json({ data: null, error: { code: code === "UNAUTHORIZED" ? "UNAUTHORIZED" : "FORBIDDEN", message: code === "UNAUTHORIZED" ? "请先登录" : "需要管理员权限" } }, { status: code === "UNAUTHORIZED" ? 401 : 403 });
  }
}
