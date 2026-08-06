import { redirect } from "next/navigation";
import { CardWiseApp } from "../../components/cardwise-app";
import { isServerSupabaseConfigured, requireUser } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage() {
  if (!isServerSupabaseConfigured()) redirect("/login?error=configuration_required");
  try { await requireUser(); } catch { redirect("/login?error=recovery_session_required"); }
  return <CardWiseApp />;
}
