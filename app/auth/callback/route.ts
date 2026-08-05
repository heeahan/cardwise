import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../lib/supabase/server";

const safeNextPath = (value: string | null) => {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  try {
    const parsed = new URL(value, "https://cardwise.local");
    return parsed.origin === "https://cardwise.local" ? `${parsed.pathname}${parsed.search}${parsed.hash}` : "/dashboard";
  } catch { return "/dashboard"; }
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));
  if (!code) return NextResponse.redirect(new URL("/login?error=auth_callback_failed", url.origin));
  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(new URL("/login?error=auth_callback_failed", url.origin));
    return NextResponse.redirect(new URL(next, url.origin));
  } catch {
    return NextResponse.redirect(new URL("/login?error=auth_callback_failed", url.origin));
  }
}
