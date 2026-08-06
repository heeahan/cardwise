import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { CardWiseProvider, type CardWiseRuntimeConfig } from "./providers";
import { configurationDiagnostic, isDemoModeAllowed, resolveSupabaseConfiguration } from "../lib/supabase/config";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host?.includes("localhost") ? "http" : "https");
  const base = host ? new URL(`${protocol}://${host}`) : new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
  const title = "CardWise — 信用卡权益管理";
  const description = "追踪信用卡优惠额度、使用次数与消费门槛，在每次消费前找到更合适的信用卡。";
  return {
    metadataBase: base,
    title: { default: title, template: "%s · CardWise" }, description,
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: { title, description, type: "website", locale: "zh_CN", images: [{ url: new URL("/og.png", base), width: 1728, height: 906, alt: "CardWise 信用卡权益管理" }] },
    twitter: { card: "summary_large_image", title, description, images: [new URL("/og.png", base)] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const configuration = resolveSupabaseConfiguration({ supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL, supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY });
  const demoEnabled = configuration.state !== "configured" && isDemoModeAllowed(process.env.NODE_ENV, process.env.NEXT_PUBLIC_DEMO_MODE);
  if (configuration.state !== "configured" && !demoEnabled && process.env.NODE_ENV === "production") {
    console.error("[CardWise Auth] Supabase configuration error", configurationDiagnostic(configuration));
  }
  const runtimeConfig: CardWiseRuntimeConfig = {
    supabaseUrl: configuration.supabaseUrl,
    supabaseAnonKey: configuration.supabaseAnonKey,
    appUrl: process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000",
    demoEnabled,
    configurationState: configuration.state,
  };
  return <html lang="zh-CN"><body><CardWiseProvider runtimeConfig={runtimeConfig}>{children}</CardWiseProvider></body></html>;
}
