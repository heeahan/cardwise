import { safeNextPath } from "./helpers";

export interface AuthCodeExchange {
  (code: string): Promise<{ error: unknown }>;
}

export async function resolveAuthCallback(requestUrl: string, exchangeCode: AuthCodeExchange) {
  const url = new URL(requestUrl);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));
  if (!code) return { redirectPath: "/login?error=auth_callback_missing_code", exchanged: false };

  try {
    const { error } = await exchangeCode(code);
    if (error) return { redirectPath: "/login?error=auth_callback_exchange_failed", exchanged: false };
    return { redirectPath: next, exchanged: true };
  } catch {
    return { redirectPath: "/login?error=auth_callback_exchange_failed", exchanged: false };
  }
}
