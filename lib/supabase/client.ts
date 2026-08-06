import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveSupabaseConfiguration } from "./config";

export interface SupabaseBrowserConfig {
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
}

export function isSupabaseConfigured(config?: SupabaseBrowserConfig) {
  return resolveSupabaseConfiguration({
    supabaseUrl: config?.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: config?.supabaseAnonKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  }).state === "configured";
}

let browserClient: SupabaseClient | null = null;
let browserClientIdentity = "";

export function createClient(config?: SupabaseBrowserConfig) {
  const resolved = resolveSupabaseConfiguration({
    supabaseUrl: config?.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: config?.supabaseAnonKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  if (resolved.state !== "configured" || !resolved.supabaseUrl || !resolved.supabaseAnonKey) {
    const error = new Error(resolved.state === "invalid" ? "SUPABASE_CONFIGURATION_INVALID" : "SUPABASE_NOT_CONFIGURED");
    Object.assign(error, { code: error.message.toLowerCase() });
    throw error;
  }
  const identity = `${resolved.supabaseUrl}|${resolved.supabaseAnonKey}`;
  if (!browserClient || browserClientIdentity !== identity) {
    browserClient = createBrowserClient(resolved.supabaseUrl, resolved.supabaseAnonKey);
    browserClientIdentity = identity;
  }
  return browserClient;
}
