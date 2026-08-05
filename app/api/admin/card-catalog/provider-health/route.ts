import { NextResponse } from "next/server";
import { testProviderConnection } from "../../../../../lib/card-catalog/health";
import { resolveCatalogProvider } from "../../../../../lib/card-catalog/service";
import { requireAdmin } from "../../../../../lib/supabase/server";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const requested = new URL(request.url).searchParams.get("provider");
    const providerId = requested === "public-data" ? "public-data" : "coocon";
    const data = await testProviderConnection(resolveCatalogProvider(providerId));
    return NextResponse.json({ data, error: null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "FORBIDDEN";
    return NextResponse.json({ data: null, error: { code: code === "UNAUTHORIZED" ? "UNAUTHORIZED" : "FORBIDDEN", message: code === "UNAUTHORIZED" ? "请先登录" : "需要管理员权限" } }, { status: code === "UNAUTHORIZED" ? 401 : 403 });
  }
}
