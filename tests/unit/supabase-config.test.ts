import { describe, expect, it } from "vitest";
import { isDemoModeAllowed, resolveSupabaseConfiguration } from "../../lib/supabase/config";

const validConfiguration = {
  supabaseUrl: "https://abc123.supabase.co",
  supabaseAnonKey: `sb_publishable_${"a".repeat(48)}`,
};

describe("Supabase runtime configuration", () => {
  it("accepts a real-shaped HTTPS project URL and publishable key", () => {
    expect(resolveSupabaseConfiguration(validConfiguration)).toMatchObject({ state: "configured", issues: [] });
  });

  it("rejects partial, insecure, and placeholder production configuration", () => {
    expect(resolveSupabaseConfiguration({ supabaseUrl: validConfiguration.supabaseUrl }).state).toBe("invalid");
    expect(resolveSupabaseConfiguration({ ...validConfiguration, supabaseUrl: "http://abc123.supabase.co" }).issues).toContain("invalid_url");
    expect(resolveSupabaseConfiguration({ supabaseUrl: "https://PROJECT_REF.supabase.co", supabaseAnonKey: "your-anon-key" }).state).toBe("invalid");
  });

  it("allows demo mode only in development or behind the explicit public flag", () => {
    expect(isDemoModeAllowed("development", undefined)).toBe(true);
    expect(isDemoModeAllowed("production", "true")).toBe(true);
    expect(isDemoModeAllowed("production", undefined)).toBe(false);
    expect(isDemoModeAllowed("production", "false")).toBe(false);
  });
});
