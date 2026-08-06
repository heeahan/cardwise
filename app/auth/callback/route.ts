import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { resolveAuthCallback } from "../../../lib/auth/callback";

export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    const supabase = await createServerSupabaseClient();
    const result = await resolveAuthCallback(request.url, (code) => supabase.auth.exchangeCodeForSession(code));
    return NextResponse.redirect(new URL(result.redirectPath, url.origin));
  } catch {
    return NextResponse.redirect(new URL("/login?error=configuration_required", url.origin));
  }
}
