import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { isDemoModeAllowed, resolveSupabaseConfiguration } from "./config";

export function getServerSupabaseConfiguration() {
  return resolveSupabaseConfiguration({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}

export function isServerSupabaseConfigured() {
  return getServerSupabaseConfiguration().state === "configured";
}

export function isServerDemoModeEnabled() {
  return !isServerSupabaseConfigured() && isDemoModeAllowed(process.env.NODE_ENV, process.env.NEXT_PUBLIC_DEMO_MODE);
}

export async function createServerSupabaseClient() {
  const configuration = getServerSupabaseConfiguration();
  if (configuration.state !== "configured" || !configuration.supabaseUrl || !configuration.supabaseAnonKey) {
    throw new Error(configuration.state === "invalid" ? "SUPABASE_CONFIGURATION_INVALID" : "SUPABASE_NOT_CONFIGURED");
  }
  const cookieStore = await cookies();
  return createServerClient(configuration.supabaseUrl, configuration.supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (items) => { try { items.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch { /* Server Components cannot always mutate cookies. */ } },
    },
  });
}

export async function requireUser() {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("UNAUTHORIZED");
  return { supabase, user };
}

export async function requireAdmin() {
  const context = await requireUser();
  const { data, error } = await context.supabase.rpc("is_cardwise_admin");
  if (error || data !== true) throw new Error("FORBIDDEN");
  return context;
}

export function createServiceRoleClient() {
  const configuration = getServerSupabaseConfiguration();
  if (configuration.state !== "configured" || !configuration.supabaseUrl || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("SERVICE_ROLE_NOT_CONFIGURED");
  return createSupabaseClient(configuration.supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}
