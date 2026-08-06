const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isValidEmail = (value: string) => emailPattern.test(value.trim());

export interface AuthFormValues {
  displayName?: string;
  email: string;
  password: string;
  confirmPassword?: string;
}

export type AuthFormErrors = Partial<Record<keyof AuthFormValues, string>>;

export function validateAuthForm(values: AuthFormValues, mode: "login" | "register" | "reset"): AuthFormErrors {
  const errors: AuthFormErrors = {};
  if (mode === "register" && !values.displayName?.trim()) errors.displayName = "请输入显示名称。";
  if (mode !== "reset" && !isValidEmail(values.email)) errors.email = "请输入有效的邮箱地址。";
  if (values.password.length < 8) errors.password = "密码至少需要 8 位。";
  if (mode !== "login" && values.confirmPassword !== values.password) errors.confirmPassword = "两次输入的密码不一致。";
  return errors;
}

export function safeNextPath(value: string | null | undefined, fallback = "/dashboard") {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  try {
    const parsed = new URL(value, "https://cardwise.local");
    if (parsed.origin !== "https://cardwise.local") return fallback;
    if (parsed.pathname === "/auth/callback") return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function authErrorMessage(error: unknown) {
  const detail = typeof error === "object" && error ? error as { code?: unknown; message?: unknown; name?: unknown } : {};
  const code = String(detail.code ?? "").toLowerCase();
  const message = String(detail.message ?? "").toLowerCase();
  const name = String(detail.name ?? "").toLowerCase();
  if (["supabase_not_configured", "supabase_configuration_invalid"].includes(code) || message.includes("supabase_not_configured")) return "认证服务配置错误，请联系站点管理员。";
  if (["email_address_invalid", "email_invalid"].includes(code) || message.includes("invalid email")) return "请输入有效的邮箱地址。";
  if (["invalid_credentials", "user_not_found"].includes(code)) return "邮箱或密码不正确。";
  if (code === "email_not_confirmed") return "邮箱尚未验证，请先点击验证邮件中的链接。";
  if (["user_already_exists", "email_exists"].includes(code)) return "该邮箱已注册，请直接登录或重置密码。";
  if (code === "signup_disabled") return "当前暂未开放新用户注册。";
  if (["over_email_send_rate_limit", "email_rate_limit_exceeded", "over_request_rate_limit", "rate_limit_exceeded"].includes(code) || message.includes("rate limit")) return "请求过于频繁，请稍后再试。";
  if (code === "weak_password" || message.includes("password should be at least")) return "密码强度不足，请至少使用 8 位并避免常见密码。";
  if (code === "same_password") return "新密码不能与当前密码相同。";
  if (name === "typeerror" || message.includes("fetch") || message.includes("network")) return "网络连接失败，请检查网络后重试。";
  return "认证请求失败，请稍后再试。";
}

export function authQueryMessage(code: string | null) {
  if (code === "account_deleted") return "账户及个人数据已删除。";
  if (code === "configuration_required") return "认证服务配置错误，请联系站点管理员。";
  if (code === "auth_callback_missing_code") return "登录链接不完整，请重新请求。";
  if (code === "auth_callback_failed") return "登录链接无效、已过期或已被使用，请重新请求。";
  if (code === "auth_callback_exchange_failed") return "登录链接无效、已过期或已被使用，请重新请求。";
  if (code === "recovery_session_required") return "密码重置会话无效或已过期，请重新发送重置邮件。";
  return "";
}

export function buildAuthCallbackUrl(origin: string, next: string) {
  const url = new URL("/auth/callback", origin);
  url.searchParams.set("next", safeNextPath(next));
  return url.toString();
}
