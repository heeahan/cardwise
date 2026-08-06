import { describe, expect, it, vi } from "vitest";
import { resolveAuthCallback } from "../../lib/auth/callback";
import { authErrorMessage, buildAuthCallbackUrl, safeNextPath, validateAuthForm } from "../../lib/auth/helpers";

describe("authentication forms", () => {
  it("validates registration fields and confirmation", () => {
    expect(validateAuthForm({ displayName: "", email: "bad", password: "short", confirmPassword: "other" }, "register")).toEqual({
      displayName: "请输入显示名称。",
      email: "请输入有效的邮箱地址。",
      password: "密码至少需要 8 位。",
      confirmPassword: "两次输入的密码不一致。",
    });
  });

  it("validates login email and password", () => {
    expect(validateAuthForm({ email: "person@example.com", password: "correct-password" }, "login")).toEqual({});
    expect(validateAuthForm({ email: "person", password: "123" }, "login")).toMatchObject({ email: expect.any(String), password: expect.any(String) });
  });

  it("maps actionable Supabase and network failures", () => {
    expect(authErrorMessage({ code: "email_not_confirmed" })).toContain("尚未验证");
    expect(authErrorMessage({ code: "email_exists" })).toContain("已注册");
    expect(authErrorMessage({ code: "over_request_rate_limit" })).toContain("频繁");
    expect(authErrorMessage(new TypeError("Failed to fetch"))).toContain("网络");
  });
});

describe("authentication callback", () => {
  it("exchanges a code and preserves a safe internal destination", async () => {
    const exchange = vi.fn().mockResolvedValue({ error: null });
    await expect(resolveAuthCallback("https://cardwise.test/auth/callback?code=abc&next=%2Fcards%3Farchived%3D1", exchange)).resolves.toEqual({ redirectPath: "/cards?archived=1", exchanged: true });
    expect(exchange).toHaveBeenCalledWith("abc");
  });

  it("reports missing and failed codes", async () => {
    await expect(resolveAuthCallback("https://cardwise.test/auth/callback", vi.fn())).resolves.toMatchObject({ redirectPath: "/login?error=auth_callback_missing_code", exchanged: false });
    await expect(resolveAuthCallback("https://cardwise.test/auth/callback?code=bad", vi.fn().mockResolvedValue({ error: new Error("expired") }))).resolves.toMatchObject({ redirectPath: "/login?error=auth_callback_exchange_failed", exchanged: false });
  });

  it("blocks external, protocol-relative, and backslash redirects", async () => {
    expect(safeNextPath("https://evil.test/steal")).toBe("/dashboard");
    expect(safeNextPath("//evil.test/steal")).toBe("/dashboard");
    expect(safeNextPath("/\\evil.test/steal")).toBe("/dashboard");
    expect(buildAuthCallbackUrl("https://cardwise.test", "//evil.test/steal")).toBe("https://cardwise.test/auth/callback?next=%2Fdashboard");
  });
});
