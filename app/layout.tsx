import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { CardWiseProvider } from "./providers";

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
  return <html lang="zh-CN"><body><CardWiseProvider>{children}</CardWiseProvider></body></html>;
}
