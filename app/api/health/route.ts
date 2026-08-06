import { NextResponse } from "next/server";
import { resolveCatalogProvider } from "../../../lib/card-catalog/service";
import { createServiceRoleClient, getServerSupabaseConfiguration, isServerDemoModeEnabled } from "../../../lib/supabase/server";

const probe = async (url: string, anonKey: string) => {
  try {
    const response = await fetch(url, { headers: { apikey: anonKey }, cache: "no-store", signal: AbortSignal.timeout(4000) });
    return response.ok ? "healthy" : "unavailable";
  } catch { return "unavailable"; }
};

export async function GET() {
  const timestamp = new Date().toISOString();
  const configuration = getServerSupabaseConfiguration();
  const supabaseUrl = configuration.supabaseUrl?.replace(/\/$/, "");
  const anonKey = configuration.supabaseAnonKey;
  const provider = resolveCatalogProvider().getMetadata();
  let database = "not_configured";
  let auth = "not_configured";
  let latestSync: { status: string; providerId: string; finishedAt: string | null } | null = null;
  if (configuration.state === "invalid" || (configuration.state === "missing" && !isServerDemoModeEnabled())) {
    database = "configuration_error";
    auth = "configuration_error";
  } else if (supabaseUrl && anonKey) {
    [database, auth] = await Promise.all([probe(`${supabaseUrl}/rest/v1/`, anonKey), probe(`${supabaseUrl}/auth/v1/health`, anonKey)]);
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const { data } = await createServiceRoleClient().from("catalog_sync_runs").select("status,provider_id,finished_at").order("started_at", { ascending: false }).limit(1).maybeSingle();
      if (data) latestSync = { status: data.status, providerId: data.provider_id, finishedAt: data.finished_at };
    }
  }
  return NextResponse.json({ application: "healthy", database, auth, cardCatalogProvider: { name: provider.displayName, status: provider.status, contractVersion: provider.contractVersion }, latestSync, timestamp }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
