import { createBrowserClient } from "@supabase/ssr";

export interface SupabaseBrowserConfig {
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
}

export function isSupabaseConfigured(config?: SupabaseBrowserConfig) {
  return Boolean(config?.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL) && Boolean(config?.supabaseAnonKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function createClient(config?: SupabaseBrowserConfig) {
  const supabaseUrl = config?.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
  const supabaseAnonKey = config?.supabaseAnonKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? null;
  if (!supabaseUrl || !supabaseAnonKey) throw new Error("SUPABASE_NOT_CONFIGURED");
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
