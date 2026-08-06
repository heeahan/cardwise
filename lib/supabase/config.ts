export type SupabaseConfigurationState = "configured" | "missing" | "invalid";

export interface SupabaseConfigurationInput {
  supabaseUrl?: string | null;
  supabaseAnonKey?: string | null;
}

export interface SupabaseConfiguration {
  state: SupabaseConfigurationState;
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
  issues: string[];
}

const placeholderFragments = [
  "project_ref",
  "your-project",
  "your_project",
  "your-anon-key",
  "your_anon_key",
  "replace-me",
  "replace_me",
  "example",
  "placeholder",
];

const normalized = (value?: string | null) => value?.trim() || null;

const isPlaceholder = (value: string) => {
  const lower = value.toLowerCase();
  return placeholderFragments.some((fragment) => lower.includes(fragment)) || ["null", "undefined", "true", "false"].includes(lower) || /[<>]/.test(value);
};

const validSupabaseUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && url.port === "" && url.pathname === "/" && /^[a-z0-9-]+\.supabase\.co$/i.test(url.hostname) && !isPlaceholder(url.hostname);
  } catch {
    return false;
  }
};

const validAnonKey = (value: string) => {
  if (value.length < 32 || isPlaceholder(value) || /\s/.test(value)) return false;
  return value.startsWith("eyJ") || value.startsWith("sb_publishable_") || value.startsWith("sb_anon_");
};

export function resolveSupabaseConfiguration(input: SupabaseConfigurationInput): SupabaseConfiguration {
  const supabaseUrl = normalized(input.supabaseUrl);
  const supabaseAnonKey = normalized(input.supabaseAnonKey);
  if (!supabaseUrl && !supabaseAnonKey) return { state: "missing", supabaseUrl: null, supabaseAnonKey: null, issues: ["missing_url", "missing_anon_key"] };

  const issues: string[] = [];
  if (!supabaseUrl) issues.push("missing_url");
  else if (!validSupabaseUrl(supabaseUrl)) issues.push("invalid_url");
  if (!supabaseAnonKey) issues.push("missing_anon_key");
  else if (!validAnonKey(supabaseAnonKey)) issues.push("invalid_anon_key");

  if (issues.length) return { state: "invalid", supabaseUrl: null, supabaseAnonKey: null, issues };
  return { state: "configured", supabaseUrl, supabaseAnonKey, issues: [] };
}

export function isDemoModeAllowed(nodeEnv: string | undefined, demoModeFlag: string | undefined) {
  return nodeEnv === "development" || demoModeFlag?.trim().toLowerCase() === "true";
}

export function configurationDiagnostic(configuration: SupabaseConfiguration) {
  return { state: configuration.state, issues: configuration.issues };
}
