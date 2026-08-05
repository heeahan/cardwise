import { CardWiseApp } from "../../components/cardwise-app";
import { redirect } from "next/navigation";
import { isServerSupabaseConfigured, requireUser } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

const publicPaths = new Set(["/login", "/register", "/forgot-password"]);

export default async function CardWiseRoute({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug = [] } = await params;
  const pathname = `/${slug.join("/")}`;
  const configured = isServerSupabaseConfigured();
  const demoEnabled = !configured && (process.env.CARDWISE_ENABLE_DEMO_MODE === "true" || process.env.NODE_ENV === "development");
  if (!publicPaths.has(pathname)) {
    if (!configured && !demoEnabled) redirect("/login?error=configuration_required");
    if (configured) {
      try { await requireUser(); } catch { redirect(`/login?next=${encodeURIComponent(pathname)}`); }
    }
  }
  return <CardWiseApp />;
}
