import { NextResponse } from "next/server";
import { z } from "zod";
import { isServerDemoModeEnabled, isServerSupabaseConfigured, requireUser } from "../../../lib/supabase/server";

const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  defaultLanguage: z.enum(["zh-CN", "ko-KR", "en"]),
  defaultCurrency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  defaultTimezone: z.enum(["Asia/Seoul", "Asia/Shanghai", "UTC"]),
  emailNotifications: z.boolean(),
});

const failure = (message: string, status: number, code: string) => NextResponse.json({ data: null, error: { code, message } }, { status });

export async function GET() {
  if (!isServerSupabaseConfigured()) return isServerDemoModeEnabled() ? NextResponse.json({ data: null, error: null, meta: { mode: "demo" } }) : failure("认证服务配置错误", 503, "AUTH_CONFIGURATION_ERROR");
  try {
    const { supabase, user } = await requireUser();
    const { data, error } = await supabase.from("profiles").select("*").eq("user_id", user.id).is("deleted_at", null).maybeSingle();
    if (error) return failure("无法读取个人设置", 400, "QUERY_FAILED");
    return NextResponse.json({ data: { ...(data ?? {}), email: user.email ?? "" }, error: null });
  } catch { return failure("请先登录", 401, "UNAUTHORIZED"); }
}

export async function PATCH(request: Request) {
  const parsed = profileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ data: null, error: { code: "VALIDATION_ERROR", message: "设置校验失败", fields: parsed.error.flatten().fieldErrors } }, { status: 422 });
  try {
    const { supabase, user } = await requireUser(); const input = parsed.data;
    const { data, error } = await supabase.from("profiles").upsert({ user_id: user.id, display_name: input.displayName, default_language: input.defaultLanguage, default_currency: input.defaultCurrency, default_timezone: input.defaultTimezone, email_notifications: input.emailNotifications }, { onConflict: "user_id" }).select().single();
    if (error) return failure("保存个人设置失败", 400, "UPDATE_FAILED");
    return NextResponse.json({ data: { ...data, email: user.email ?? "" }, error: null });
  } catch { return failure("请先登录", 401, "UNAUTHORIZED"); }
}
