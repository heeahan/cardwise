import { CardWiseApp } from "../../components/cardwise-app";
import { redirect } from "next/navigation";
import { isServerDemoModeEnabled, isServerSupabaseConfigured, requireUser } from "../../lib/supabase/server";
import { safeNextPath } from "../../lib/auth/helpers";

export const dynamic = "force-dynamic";

const publicPaths = new Set(["/login", "/register", "/forgot-password"]);

export default async function CardWiseRoute({ params, searchParams }: { params: Promise<{ slug?: string[] }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { slug = [] } = await params;
  const pathname = `/${slug.join("/")}`;
  const configured = isServerSupabaseConfigured();
  const demoEnabled = isServerDemoModeEnabled();
  if ((pathname === "/login" || pathname === "/register") && configured) {
    try {
      await requireUser();
      redirect("/dashboard");
    } catch (error) {
      if (error instanceof Error && error.message !== "UNAUTHORIZED") throw error;
    }
  }
  if (!publicPaths.has(pathname)) {
    if (!configured && !demoEnabled) redirect("/login?error=configuration_required");
    if (configured) {
      try { await requireUser(); } catch {
        const query = new URLSearchParams();
        const values = await searchParams;
        Object.entries(values).forEach(([key, value]) => Array.isArray(value) ? value.forEach((item) => query.append(key, item)) : value !== undefined && query.set(key, value));
        const intended = safeNextPath(`${pathname}${query.size ? `?${query.toString()}` : ""}`);
        redirect(`/login?next=${encodeURIComponent(intended)}`);
      }
    }
  }
  return <CardWiseApp />;
}
