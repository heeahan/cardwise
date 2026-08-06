import { redirect } from "next/navigation";
import { CardWiseApp } from "../../components/cardwise-app";
import { isServerSupabaseConfigured, requireUser } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (isServerSupabaseConfigured()) {
    try { await requireUser(); } catch { return <CardWiseApp />; }
    redirect("/dashboard");
  }
  return <CardWiseApp />;
}
