"use client";

/* eslint-disable @next/next/no-img-element -- catalog image hosts are provider-controlled and cannot be statically allowlisted. */

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createBrowserClient } from "@supabase/ssr";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  Bell, CalendarDays, ChevronDown, ChevronRight, CircleHelp, Coffee, CreditCard as CreditCardIcon, Download, Fuel, Gauge,
  Globe2, Hotel, LayoutDashboard, Menu, Moon, MoreHorizontal, Plus, Search, Settings, ShieldCheck, ShoppingBag,
  Sparkles, Star, Sun, Tag, Trash2, TrendingUp, Upload, User, Utensils, WalletCards, X, Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCardWise } from "../app/providers";
import { calculateBenefit, summarizeUsage } from "../lib/benefit-engine/calculator";
import { formatLimit } from "../lib/benefit-engine/explanations";
import { rankCards } from "../lib/benefit-engine/ranking";
import { normalizeImportDate, parseCsvDocument } from "../lib/csv";
import { creditCardInputSchema, type CreditCardInput } from "../lib/benefit-engine/schemas";
import type { Benefit, BenefitRule, BenefitUsage, CreditCard, PurchaseScenario } from "../lib/benefit-engine/types";
import { categories } from "../lib/data/demo";

const KRW = new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 });
const won = (value: number) => KRW.format(value);
const today = () => new Date().toISOString().slice(0, 10);
const subscribeToHydration = () => () => undefined;

const navItems: Array<{ href: string; label: string; icon: LucideIcon }> = [
  { href: "/dashboard", label: "概览", icon: LayoutDashboard }, { href: "/cards", label: "我的卡片", icon: WalletCards },
  { href: "/catalog", label: "韩国卡片目录", icon: Search },
  { href: "/benefits", label: "权益中心", icon: Tag }, { href: "/recommend", label: "该刷哪张卡", icon: Sparkles },
  { href: "/transactions", label: "消费记录", icon: CreditCardIcon }, { href: "/calendar", label: "权益日历", icon: CalendarDays },
  { href: "/analytics", label: "数据分析", icon: TrendingUp }, { href: "/notifications", label: "提醒", icon: Bell },
];

const categoryIcons: Record<string, LucideIcon> = { 咖啡: Coffee, 餐饮: Utensils, 加油: Fuel, 网购: ShoppingBag, 酒店代客泊车: Hotel, 机场贵宾厅: Globe2 };

interface CatalogIssuer { id: string; code?: string | null; name_ko?: string | null; name_en?: string | null; name_zh?: string | null; official_website?: string | null; logo_path?: string | null }
interface CatalogBenefit { id: string; provider_benefit_id?: string; name: string; description: string; category: string; rule: BenefitRule; source_text: string; source_url?: string | null; effective_from?: string | null; effective_to?: string | null; source_updated_at?: string | null; verification_status: string; review_reasons?: string[]; version: number; is_current?: boolean }
interface CatalogCard { id: string; issuer_id: string; provider_id: string; external_card_id: string; name_ko: string; name_en?: string | null; name_zh?: string | null; card_type: "credit" | "debit"; brand: CreditCard["network"]; annual_fee_domestic: number; annual_fee_overseas?: number | null; currency: string; image_url?: string | null; official_url: string; application_url?: string | null; product_status: string; source_url: string; source_name: string; source_updated_at?: string | null; last_synced_at?: string | null; verification_status: string; coverage_note?: string | null; card_issuers?: CatalogIssuer | CatalogIssuer[] | null; catalog_benefits?: CatalogBenefit[] }
interface CatalogProviderMeta { providerId: string; status: string; displayName: string; coverage: string; containsCompleteBenefits: boolean; contractVersion?: string; message?: string }
interface CatalogUpdate { id: string; created_at: string; credit_cards?: { id: string; nickname: string; card_name: string } | null; catalog_change_events?: { change_type: string; material_fields: string[]; card_catalog?: { name_ko: string; source_name: string; source_url: string } | null; catalog_benefits?: { name: string; description: string; version: number } | null } | null }

const catalogIssuer = (card: CatalogCard) => Array.isArray(card.card_issuers) ? card.card_issuers[0] : card.card_issuers;
const formatSyncDate = (value?: string | null) => value ? new Date(value).toLocaleString("zh-CN", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" }) : "尚未同步";
const catalogRequest = async <T,>(url: string, init?: RequestInit): Promise<{ data: T; meta?: Record<string, unknown> }> => {
  const response = await fetch(url, { ...init, headers: { ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...init?.headers }, cache: "no-store" });
  const body = await response.json() as { data: T; error?: { message?: string } | null; meta?: Record<string, unknown> };
  if (!response.ok || body.error) throw new Error(body.error?.message ?? "请求失败，请稍后重试");
  return { data: body.data, meta: body.meta };
};

export function CardWiseApp() {
  const pathname = usePathname();
  const hydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  const authScreen = pathname === "/login" || pathname === "/register" ? <AuthScreen register={pathname === "/register"} /> : pathname === "/forgot-password" ? <ForgotPasswordScreen /> : pathname === "/reset-password" ? <ResetPasswordScreen /> : null;
  return <div data-hydrated={hydrated ? "true" : "false"}>{authScreen ?? <AppShell pathname={pathname}><RouteContent pathname={pathname} /></AppShell>}</div>;
}

function AppShell({ pathname, children }: { pathname: string; children: React.ReactNode }) {
  const { demoMode, loading, dataError, reload, toast, clearToast, benefits, profile } = useCardWise();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [referenceNow] = useState(() => Date.now());
  const reminderCount = benefits.filter((benefit) => benefit.status === "expiring" || (benefit.rule.endsAt && new Date(benefit.rule.endsAt).getTime() - referenceNow <= 30 * 86400000 && new Date(benefit.rule.endsAt).getTime() >= referenceNow)).length;
  return (
    <div className={dark ? "app dark" : "app"}>
      <aside className={mobileOpen ? "sidebar open" : "sidebar"}>
        <div className="brand"><span className="brand-mark"><CreditCardIcon size={21} /></span><span>CardWise</span><button className="icon-btn close-mobile" onClick={() => setMobileOpen(false)} aria-label="关闭菜单"><X size={20} /></button></div>
        <nav className="main-nav" aria-label="主要导航">
          {navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={pathname.startsWith(href) ? "nav-item active" : "nav-item"} onClick={() => setMobileOpen(false)}><Icon size={19} /><span>{label}</span>{href === "/notifications" && reminderCount > 0 && <span className="nav-badge">{reminderCount}</span>}</Link>)}
        </nav>
        <div className="sidebar-bottom">
          <Link href="/settings" className={pathname.startsWith("/settings") ? "nav-item active" : "nav-item"}><Settings size={19} />设置</Link>
          <Link href="/help" className={pathname.startsWith("/help") ? "nav-item active" : "nav-item"}><CircleHelp size={19} />帮助中心</Link>
          <div className="profile-mini"><span className="avatar">{profile?.displayName.slice(0, 2).toUpperCase() ?? "CW"}</span><span><b>{profile?.displayName ?? "CardWise 用户"}</b><small>{profile?.defaultCurrency ?? "KRW"} · {profile?.defaultTimezone ?? "Asia/Seoul"}</small></span><MoreHorizontal size={18} /></div>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setMobileOpen(true)} aria-label="打开菜单"><Menu size={20} /></button>
          {demoMode && <span className="demo-pill"><span />演示模式 · 数据仅保存在本次浏览</span>}
          <div className="top-actions"><button className="icon-btn" onClick={() => setDark((v) => !v)} aria-label="切换深色模式">{dark ? <Sun size={19} /> : <Moon size={19} />}</button><Link href="/notifications" className="icon-btn"><Bell size={19} />{reminderCount > 0 && <i />}</Link><span className="avatar small">{profile?.displayName.slice(0, 2).toUpperCase() ?? "CW"}</span></div>
        </header>
        <main className="content">
          {loading && <div className="data-status" role="status">正在安全加载你的数据…</div>}
          {dataError && <div className="data-status error" role="alert"><span>{dataError}</span><button onClick={() => void reload()}>重试</button></div>}
          {children}
        </main>
        <footer className="disclaimer"><ShieldCheck size={15} />本网站提供的优惠计算仅供参考，实际优惠以发卡机构公告及账单为准。</footer>
      </div>
      <nav className="mobile-nav">{navItems.slice(0, 5).map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={pathname.startsWith(href) ? "active" : ""}><Icon size={19} /><small>{label}</small></Link>)}</nav>
      {toast && <button className="toast" onClick={clearToast}><ShieldCheck size={18} />{toast}<X size={16} /></button>}
      {mobileOpen && <button className="scrim" onClick={() => setMobileOpen(false)} aria-label="关闭菜单" />}
    </div>
  );
}

function RouteContent({ pathname }: { pathname: string }) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "catalog") return parts[1] ? <CatalogDetailScreen id={parts[1]} /> : <CatalogSearchScreen />;
  if (parts[0] === "admin" && parts[1] === "health") return <AdminHealthScreen />;
  if (parts[0] === "admin" && parts[1] === "catalog") return <AdminCatalogScreen />;
  if (parts[0] === "cards") {
    if (parts[1] === "new" && parts[2] === "manual") return <CardForm />;
    if (parts[1] === "new") return <CatalogSearchScreen />;
    if (parts[2] === "edit") return <CardForm cardId={parts[1]} />;
    if (parts[2] === "benefits" && parts[3] === "new") return <BenefitForm cardId={parts[1]} />;
    if (parts[1]) return <CardDetail id={parts[1]} />;
    return <CardsScreen />;
  }
  if (parts[0] === "benefits") {
    if (parts[1] && parts[2] === "edit") return <BenefitForm benefitId={parts[1]} />;
    if (parts[1]) return <BenefitDetail id={parts[1]} />;
    return <BenefitsScreen />;
  }
  if (parts[0] === "transactions") {
    if (parts[1] === "new") return <TransactionForm />;
    if (parts[1] === "import") return <ImportScreen />;
    if (parts[1] && parts[2] === "edit") return <TransactionForm usageId={parts[1]} />;
    return <TransactionsScreen />;
  }
  if (parts[0] === "recommend") return <RecommendScreen />;
  if (parts[0] === "calendar") return <CalendarScreen />;
  if (parts[0] === "analytics") return <AnalyticsScreen />;
  if (parts[0] === "notifications") return <NotificationsScreen />;
  if (parts[0] === "settings") return <SettingsScreen />;
  if (parts[0] === "help") return <HelpScreen />;
  if (parts.length === 1 && parts[0] === "dashboard") return <Dashboard />;
  return <NotFoundScreen />;
}

function NotFoundScreen() {
  return <section className="panel catalog-state"><span className="eyebrow">404 · NOT FOUND</span><h1>找不到这个页面</h1><p>地址可能已更改，或你没有访问该资源的权限。</p><Link href="/dashboard" className="primary-btn">返回概览</Link></section>;
}

function PageTitle({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: React.ReactNode }) {
  return <div className="page-title"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{action && <div className="page-action">{action}</div>}</div>;
}

function Dashboard() {
  const router = useRouter();
  const { cards, benefits, usages } = useCardWise();
  const [query, setQuery] = useState("");
  const now = new Date();
  const monthly = usages.filter((row) => new Date(row.occurredAt).getMonth() === now.getMonth() && new Date(row.occurredAt).getFullYear() === now.getFullYear());
  const totalSpend = monthly.reduce((sum, row) => sum + row.originalAmount, 0);
  const saved = monthly.reduce((sum, row) => sum + row.discountAmount, 0);
  const previousMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousMonthly = usages.filter((row) => { const date = new Date(row.occurredAt); return date.getMonth() === previousMonthDate.getMonth() && date.getFullYear() === previousMonthDate.getFullYear(); });
  const previousSpend = previousMonthly.reduce((sum, row) => sum + row.originalAmount, 0);
  const spendDelta = previousSpend > 0 ? `${totalSpend >= previousSpend ? "+" : ""}${(((totalSpend - previousSpend) / previousSpend) * 100).toFixed(1)}%` : "暂无上月对比";
  const expiringCount = benefits.filter((benefit) => benefit.status === "expiring" || (benefit.rule.endsAt && new Date(benefit.rule.endsAt).getTime() >= now.getTime() && new Date(benefit.rule.endsAt).getTime() - now.getTime() <= 30 * 86400000)).length;
  const chartData = categories.slice(0, 8).map((name) => ({ name, 优惠: monthly.filter((u) => u.category === name).reduce((s, u) => s + u.discountAmount, 0) })).filter((d) => d.优惠 > 0);
  const cardChart = cards.map((card) => ({ name: card.nickname, value: monthly.filter((u) => u.cardId === card.id).reduce((s, u) => s + u.discountAmount, 0) })).filter((d) => d.value > 0);
  const search = (e: FormEvent) => { e.preventDefault(); router.push(`/recommend?q=${encodeURIComponent(query || "星巴克")}`); };
  return <>
    <section className="hero-panel">
      <div className="hero-copy"><span className="eyebrow light">SMARTER SPENDING</span><h1>今天在哪里消费？<br />帮你找到最划算的信用卡</h1><p>输入商户或场景，CardWise 会根据门槛、剩余额度与次数给出可解释的前三名推荐。</p></div>
      <form className="hero-search" onSubmit={search}><Search size={21} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="例如：星巴克、周末餐厅、酒店停车" aria-label="搜索消费场景" /><button>智能推荐 <ChevronRight size={18} /></button></form>
      <div className="quick-links"><span>快速查询</span>{[{ n: "星巴克", i: Coffee }, { n: "餐厅", i: Utensils }, { n: "加油", i: Fuel }, { n: "酒店停车", i: Hotel }, { n: "机场贵宾厅", i: Globe2 }, { n: "网购", i: ShoppingBag }].map(({ n, i: Icon }) => <button key={n} onClick={() => router.push(`/recommend?q=${encodeURIComponent(n)}`)}><Icon size={15} />{n}</button>)}</div>
    </section>
    <section className="metric-grid">
      <Metric label="本月消费" value={won(totalSpend)} delta={`较上月 ${spendDelta}`} icon={Gauge} />
      <Metric label="本月获得优惠" value={won(saved)} delta={`已记录 ${monthly.length} 笔`} icon={Sparkles} accent />
      <Metric label="有效信用卡" value={`${cards.filter((c) => c.isActive).length} 张`} delta={`${benefits.length} 项有效权益`} icon={WalletCards} />
      <Metric label="待处理提醒" value={`${expiringCount} 项`} delta={expiringCount ? `${expiringCount} 项权益将在 30 天内到期` : "当前没有临近到期权益"} icon={Bell} warn />
    </section>
    <section className="section-head"><div><span className="eyebrow">MY WALLET</span><h2>我的常用卡片</h2></div><Link href="/cards">查看全部 <ChevronRight size={16} /></Link></section>
    <div className="card-strip">{cards.slice(0, 3).map((card) => <CreditCardVisual key={card.id} card={card} />)}<Link href="/cards/new" className="add-card-tile"><Plus /><b>添加信用卡</b><small>仅需卡片昵称和权益资料</small></Link></div>
    <div className="two-col dashboard-lower">
      <section className="panel"><div className="panel-head"><div><span className="eyebrow">THIS MONTH</span><h2>值得关注的权益</h2></div><Link href="/benefits">全部权益</Link></div><div className="benefit-list">{benefits.slice(0, 4).map((benefit) => <BenefitRow key={benefit.id} benefit={benefit} />)}</div></section>
      <section className="panel"><div className="panel-head"><div><span className="eyebrow">RECENT</span><h2>最近消费</h2></div><Link href="/transactions">查看记录</Link></div><div className="activity-list">{usages.slice(0, 5).map((usage) => <ActivityRow key={usage.id} usage={usage} />)}</div></section>
    </div>
    <div className="two-col charts-row">
      <section className="panel chart-panel"><div className="panel-head"><h2>各分类优惠金额</h2><span>本月</span></div><ResponsiveContainer width="100%" height={240}><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" /><XAxis dataKey="name" tickLine={false} axisLine={false} /><YAxis hide /><Tooltip formatter={(v) => won(Number(v))} /><Bar dataKey="优惠" fill="#5e4fe7" radius={[8, 8, 3, 3]} /></BarChart></ResponsiveContainer></section>
      <section className="panel chart-panel"><div className="panel-head"><h2>信用卡优惠贡献</h2><span>本月</span></div><ResponsiveContainer width="100%" height={240}><PieChart><Pie data={cardChart} dataKey="value" nameKey="name" innerRadius={62} outerRadius={90} paddingAngle={4}>{cardChart.map((_, i) => <Cell key={i} fill={["#5e4fe7", "#18a985", "#f28a4b", "#d94c91"][i % 4]} />)}</Pie><Tooltip formatter={(v) => won(Number(v))} /></PieChart></ResponsiveContainer></section>
    </div>
  </>;
}

function Metric({ label, value, delta, icon: Icon, accent, warn }: { label: string; value: string; delta: string; icon: LucideIcon; accent?: boolean; warn?: boolean }) {
  return <article className={`metric ${accent ? "accent" : ""} ${warn ? "warn" : ""}`}><div><span>{label}</span><strong>{value}</strong><small>{delta}</small></div><i><Icon size={20} /></i></article>;
}

function CreditCardVisual({ card, compact = false }: { card: CreditCard; compact?: boolean }) {
  return <Link href={`/cards/${card.id}`} className={compact ? "credit-card compact" : "credit-card"} style={{ background: card.color }}><div className="card-top"><span>{card.issuer}</span>{card.isFavorite && <Star size={17} fill="currentColor" />}</div><div className="chip" /><div className="card-bottom"><div><small>{card.nickname}</small><b>•••• {card.lastFour ?? "—"}</b></div><strong>{card.network}</strong></div></Link>;
}

function BenefitRow({ benefit }: { benefit: Benefit }) {
  const { usages, cards } = useCardWise();
  const card = cards.find((c) => c.id === benefit.cardId);
  if (!card) return null;
  const usage = summarizeUsage(benefit.id, usages, new Date());
  const cap = benefit.rule.monthlyDiscountCap;
  const limit = benefit.rule.monthlyUsageLimit ?? benefit.rule.annualUsageLimit;
  const usedCount = benefit.rule.monthlyUsageLimit ? usage.monthlyUsageCount : usage.annualUsageCount;
  const progress = cap ? Math.min(100, (usage.monthlyDiscountUsed / cap) * 100) : limit ? Math.min(100, (usedCount / limit) * 100) : 18;
  const Icon = categoryIcons[benefit.category] ?? Zap;
  const remaining = cap !== undefined ? won(Math.max(0, cap - usage.monthlyDiscountUsed)) : limit !== undefined ? `${Math.max(0, limit - usedCount)} 次` : "无限额";
  return <Link href={`/benefits/${benefit.id}`} className="benefit-row"><span className="category-icon"><Icon size={19} /></span><div className="benefit-main"><div><b>{benefit.name}</b><small>{card.nickname} · {benefit.category}</small></div><div className="progress"><i style={{ width: `${progress}%` }} /></div></div><div className="benefit-remaining"><small>剩余</small><strong>{remaining}</strong></div><ChevronRight size={17} /></Link>;
}

function ActivityRow({ usage }: { usage: BenefitUsage }) {
  const { cards } = useCardWise(); const card = cards.find((c) => c.id === usage.cardId); const Icon = categoryIcons[usage.category] ?? ShoppingBag;
  return <div className="activity"><span className="category-icon soft"><Icon size={18} /></span><div><b>{usage.merchantName}</b><small>{new Date(usage.occurredAt).toLocaleDateString("zh-CN")} · {card?.nickname}</small></div><span><b>-{won(usage.originalAmount)}</b><small className="saved">省 {won(usage.discountAmount)}</small></span></div>;
}

function CatalogSearchScreen() {
  const [query, setQuery] = useState("");
  const [issuer, setIssuer] = useState("");
  const [cardType, setCardType] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("active");
  const [feeMax, setFeeMax] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<CatalogCard[]>([]);
  const [total, setTotal] = useState(0);
  const [provider, setProvider] = useState<CatalogProviderMeta | null>(null);
  const [catalogStatus, setCatalogStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ page: String(page), pageSize: "12" });
      if (query.trim()) params.set("q", query.trim());
      if (issuer) params.set("issuer", issuer);
      if (cardType) params.set("cardType", cardType);
      if (brand) params.set("brand", brand);
      if (category) params.set("category", category);
      if (status) params.set("status", status);
      if (feeMax) params.set("annualFeeMax", feeMax);
      setLoading(true); setError("");
      void catalogRequest<{ items: CatalogCard[]; total: number }>(`/api/card-catalog/search?${params}`, { signal: controller.signal })
        .then((result) => { setItems(result.data.items); setTotal(result.data.total); setProvider(result.meta?.provider as CatalogProviderMeta ?? null); setCatalogStatus(String(result.meta?.catalogStatus ?? "")); })
        .catch((reason) => { if (!controller.signal.aborted) { setError(reason instanceof Error ? reason.message : "目录搜索失败"); setItems([]); } })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 350);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, issuer, cardType, brand, category, status, feeMax, page]);
  const issuers = [...new Map(items.map((card) => { const row = catalogIssuer(card); return row ? [row.id, row] : null; }).filter((entry): entry is [string, CatalogIssuer] => Boolean(entry))).values()];
  const resetPage = (setter: (value: string) => void, value: string) => { setter(value); setPage(1); };
  const pages = Math.max(1, Math.ceil(total / 12));
  return <>
    <PageTitle eyebrow="KOREAN CARD CATALOG" title="搜索韩国真实信用卡" description="这里只展示管理员审核发布的合法来源数据；未配置供应商时不会用演示卡片冒充真实产品。" action={<Link href="/cards/new/manual" className="secondary-btn"><Plus size={17} />找不到？手动添加</Link>} />
    {provider && <section className={`provider-banner ${provider.status === "ready" || provider.status === "partial" ? "ready" : "warning"}`}><Globe2 size={21} /><div><b>{provider.displayName}</b><p>{provider.message ?? provider.coverage}</p><small>覆盖范围：{provider.coverage} · {provider.containsCompleteBenefits ? "包含完整优惠字段" : "可能只包含部分优惠字段"}</small></div></section>}
    <section className="catalog-filters panel" aria-label="信用卡目录筛选">
      <label className="search-input catalog-search"><Search size={18} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="输入韩文、英文或中文辅助卡名" aria-label="搜索韩国信用卡名称" /></label>
      <Field label="发卡机构"><select value={issuer} onChange={(event) => resetPage(setIssuer, event.target.value)}><option value="">全部机构</option>{issuers.map((row) => <option value={row.id} key={row.id}>{row.name_ko ?? row.name_zh ?? row.name_en}</option>)}</select></Field>
      <Field label="卡片类型"><select value={cardType} onChange={(event) => resetPage(setCardType, event.target.value)}><option value="">信用卡与 체크카드</option><option value="credit">信用卡</option><option value="debit">체크카드</option></select></Field>
      <Field label="卡组织"><select value={brand} onChange={(event) => resetPage(setBrand, event.target.value)}><option value="">全部</option>{["Visa", "Mastercard", "AMEX", "UnionPay", "JCB", "Local"].map((value) => <option key={value}>{value}</option>)}</select></Field>
      <Field label="优惠分类"><select value={category} onChange={(event) => resetPage(setCategory, event.target.value)}><option value="">全部分类</option>{categories.map((value) => <option key={value}>{value}</option>)}</select></Field>
      <Field label="国内年费上限"><input type="number" min="0" value={feeMax} onChange={(event) => resetPage(setFeeMax, event.target.value)} placeholder="不限" /></Field>
      <Field label="发行状态"><select value={status} onChange={(event) => resetPage(setStatus, event.target.value)}><option value="">全部状态</option><option value="active">正在发行</option><option value="suspended">暂停申请</option><option value="discontinued">已停发</option><option value="unknown">待确认</option></select></Field>
    </section>
    {error ? <section className="panel catalog-state error" role="alert"><Bell /><h2>无法读取信用卡目录</h2><p>{error}</p><button className="secondary-btn" onClick={() => setPage((value) => value)}>重试</button></section> : loading ? <div className="catalog-grid" aria-label="正在加载卡片目录">{Array.from({ length: 6 }, (_, index) => <div className="catalog-skeleton" key={index}><i /><span /><span /><b /></div>)}</div> : items.length ? <>
      <div className="catalog-result-head"><b>找到 {total} 张已发布卡片</b><span>第 {page} / {pages} 页</span></div>
      <div className="catalog-grid">{items.map((card) => { const issuerRow = catalogIssuer(card); const benefitNames = (card.catalog_benefits ?? []).filter((benefit) => benefit.verification_status === "verified").slice(0, 3); return <article className="catalog-card" key={card.id}>{card.image_url ? <img src={card.image_url} alt={`${card.name_ko} 卡片图片`} loading="lazy" referrerPolicy="no-referrer" /> : <div className="catalog-card-art"><CreditCardIcon /><span>{card.brand}</span></div>}<div className="catalog-card-copy"><div className="catalog-badges"><span>{card.card_type === "debit" ? "체크카드" : "信用卡"}</span><span className={card.product_status === "active" ? "verified" : "warning"}>{card.product_status === "active" ? "正在发行" : card.product_status === "discontinued" ? "已停发" : "状态待确认"}</span></div><h2>{card.name_ko}</h2><p>{issuerRow?.name_ko ?? "发卡机构待确认"} · {card.brand}</p><dl><div><dt>国内年费</dt><dd>{won(Number(card.annual_fee_domestic))}</dd></div><div><dt>海外兼用</dt><dd>{card.annual_fee_overseas == null ? "未提供" : won(Number(card.annual_fee_overseas))}</dd></div></dl><div className="catalog-benefit-tags">{benefitNames.length ? benefitNames.map((benefit) => <span key={benefit.id}>{benefit.name}</span>) : <span>优惠明细尚未发布</span>}</div><small>{card.source_name} · 同步 {formatSyncDate(card.last_synced_at)}</small><Link href={`/catalog/${card.id}`} className="primary-btn">查看官方优惠与限制 <ChevronRight size={16} /></Link></div></article>; })}</div>
      <nav className="pagination" aria-label="目录分页"><button disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</button><span>{page} / {pages}</span><button disabled={page >= pages} onClick={() => setPage(page + 1)}>下一页</button></nav>
    </> : <section className="panel"><Empty title={catalogStatus === "database_not_configured" ? "尚未配置韩国信用卡数据供应商" : "没有匹配的已审核卡片"} body={provider?.message ?? "调整筛选条件，或使用手动添加并自行维护官方权益资料。"} /><div className="empty-actions"><Link href="/cards/new/manual" className="primary-btn">手动添加我的卡</Link></div></section>}
  </>;
}

const ruleFacts = (rule: BenefitRule) => [
  rule.discountRate !== undefined ? `优惠比例 ${rule.discountRate}%` : null,
  rule.fixedAmount !== undefined ? `固定优惠 ${won(rule.fixedAmount)}` : null,
  rule.previousMonthSpendRequirement !== undefined ? `上月消费 ${won(rule.previousMonthSpendRequirement)}` : null,
  rule.minimumTransactionAmount !== undefined ? `单笔至少 ${won(rule.minimumTransactionAmount)}` : null,
  rule.perTransactionCap !== undefined ? `单笔上限 ${won(rule.perTransactionCap)}` : null,
  rule.monthlyDiscountCap !== undefined ? `每月上限 ${won(rule.monthlyDiscountCap)}` : null,
  rule.annualDiscountCap !== undefined ? `每年上限 ${won(rule.annualDiscountCap)}` : null,
  rule.monthlyUsageLimit !== undefined ? `每月 ${rule.monthlyUsageLimit} 次` : null,
  rule.merchantKeywords?.length ? `商户：${rule.merchantKeywords.join("、")}` : null,
  rule.channel && rule.channel !== "both" ? `仅${rule.channel === "online" ? "线上" : "线下"}` : null,
  rule.enrollmentRequired ? "需要报名" : null,
  rule.couponRequired ? "需要优惠券" : null,
  rule.stackingAllowed === false ? "不可叠加其他优惠" : null,
].filter((value): value is string => Boolean(value));

function CatalogDetailScreen({ id }: { id: string }) {
  const router = useRouter();
  const { reload } = useCardWise();
  const [card, setCard] = useState<CatalogCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [nickname, setNickname] = useState("");
  const [network, setNetwork] = useState<CreditCard["network"]>("Visa");
  const [lastFour, setLastFour] = useState("");
  const [statementDay, setStatementDay] = useState("");
  const [favorite, setFavorite] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  useEffect(() => { const controller = new AbortController(); void catalogRequest<CatalogCard>(`/api/card-catalog/${id}`, { signal: controller.signal }).then(({ data }) => { setCard(data); setNickname(data.name_ko); setNetwork(data.brand); }).catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "无法读取卡片详情"); }).finally(() => { if (!controller.signal.aborted) setLoading(false); }); return () => controller.abort(); }, [id]);
  if (loading) return <section className="panel catalog-state"><span className="spinner" /><h2>正在读取官方优惠资料…</h2></section>;
  if (error || !card) return <section className="panel"><Empty title="无法查看这张目录卡片" body={error || "它可能尚未发布。"} /><div className="empty-actions"><Link href="/catalog" className="secondary-btn">返回目录</Link><Link href="/cards/new/manual" className="primary-btn">手动添加</Link></div></section>;
  const issuer = catalogIssuer(card);
  const benefits = (card.catalog_benefits ?? []).filter((benefit) => benefit.verification_status === "verified");
  const add = async (event: FormEvent) => { event.preventDefault(); setAdding(true); setAddError(""); try { const { data } = await catalogRequest<{ cardId: string }>(`/api/card-catalog/${id}/add`, { method: "POST", body: JSON.stringify({ nickname, network, lastFour, isFavorite: favorite, statementCycleDay: statementDay ? Number(statementDay) : undefined, autoSyncEnabled: true }) }); await reload(); router.push(`/cards/${data.cardId}`); } catch (reason) { setAddError(reason instanceof Error ? reason.message : "添加失败"); } finally { setAdding(false); } };
  return <>
    <PageTitle eyebrow="VERIFIED CATALOG DETAIL" title={card.name_ko} description={`${issuer?.name_ko ?? "发卡机构待确认"} · ${card.card_type === "debit" ? "체크카드" : "信用卡"} · ${card.brand}`} action={<Link href="/catalog" className="secondary-btn">返回目录</Link>} />
    <div className="catalog-detail-layout"><section><article className="panel catalog-product"><div className="catalog-product-art">{card.image_url ? <img src={card.image_url} alt={`${card.name_ko} 官方卡片图片`} referrerPolicy="no-referrer" /> : <div className="catalog-card-art large"><CreditCardIcon /><span>{card.brand}</span></div>}</div><div><div className="catalog-badges"><span className="verified"><ShieldCheck size={13} />{card.verification_status === "verified" ? "已审核发布" : card.verification_status}</span><span>{card.product_status === "active" ? "正在发行" : card.product_status}</span></div><dl className="details-list"><div><dt>国内年费</dt><dd>{won(Number(card.annual_fee_domestic))}</dd></div><div><dt>海外兼用年费</dt><dd>{card.annual_fee_overseas == null ? "资料未提供" : won(Number(card.annual_fee_overseas))}</dd></div><div><dt>数据来源</dt><dd>{card.source_name}</dd></div><div><dt>来源更新时间</dt><dd>{formatSyncDate(card.source_updated_at)}</dd></div><div><dt>CardWise 最后同步</dt><dd>{formatSyncDate(card.last_synced_at)}</dd></div></dl><div className="button-row"><a className="secondary-btn" href={card.official_url} target="_blank" rel="noreferrer">官方详情 <Globe2 size={15} /></a>{card.application_url && <a className="secondary-btn" href={card.application_url} target="_blank" rel="noreferrer">官方申请页面</a>}</div></div></article>
      <section className="panel"><div className="panel-head"><h2>官方公布的优惠与限制</h2><span>{benefits.length} 项已审核</span></div>{benefits.length ? <div className="catalog-benefit-list">{benefits.map((benefit) => <article key={benefit.id}><div><span className="eyebrow">{benefit.category} · V{benefit.version}</span><h3>{benefit.name}</h3><p>{benefit.description}</p></div><div className="rule-chips">{ruleFacts(benefit.rule).map((fact) => <span key={fact}>{fact}</span>)}</div><blockquote>{benefit.source_text}</blockquote><footer><span>有效期 {benefit.effective_from ?? "未注明"} — {benefit.effective_to ?? "未注明"}</span>{benefit.source_url && <a href={benefit.source_url} target="_blank" rel="noreferrer">核对官方来源</a>}</footer></article>)}</div> : <Empty title="尚无已确认的结构化权益" body="卡片基本资料已发布，但优惠条件仍可能处于人工审核状态，不会进入确定性推荐。" />}</section></section>
      <aside className="panel catalog-add-panel"><span className="eyebrow">ADD TO MY WALLET</span><h2>添加到我的信用卡</h2><p>将保存当前卡片与权益快照。以后官方规则变化时，需由你确认后才更新未来计算。</p><form onSubmit={add}><Field label="自定义昵称"><input required maxLength={60} value={nickname} onChange={(event) => setNickname(event.target.value)} /></Field><Field label="发行版本 / 卡组织"><select value={network} onChange={(event) => setNetwork(event.target.value as CreditCard["network"])}>{["Visa", "Mastercard", "AMEX", "UnionPay", "JCB", "Local"].map((value) => <option key={value}>{value}</option>)}</select></Field><Field label="末四位（可选）" hint="仅用于区分实体卡"><input inputMode="numeric" pattern="[0-9]{4}" maxLength={4} value={lastFour} onChange={(event) => setLastFour(event.target.value.replace(/\D/g, "").slice(0, 4))} /></Field><Field label="结算日（可选）"><input type="number" min="1" max="31" value={statementDay} onChange={(event) => setStatementDay(event.target.value)} /></Field><label className="toggle-row"><span>设为常用卡</span><input type="checkbox" checked={favorite} onChange={(event) => setFavorite(event.target.checked)} /><i /></label><div className="import-preview"><b>即将导入</b><span>1 张卡片 · {benefits.length} 项已审核权益</span><small>未审核权益不会进入推荐计算</small></div>{addError && <p className="form-message" role="alert">{addError}</p>}<button className="primary-btn wide" disabled={adding || !nickname.trim()}>{adding ? "安全添加中…" : "确认添加到我的卡片"}</button></form><div className="sensitive-warning"><ShieldCheck /><p>请勿输入完整卡号、CVC、银行密码、有效期、验证码或 주민등록번호。</p></div></aside></div>
    <section className="source-card warning"><Bell size={20} /><div><b>重要提示</b><p>实际优惠以发卡机构最新产品说明书及账单为准。{card.coverage_note ? ` ${card.coverage_note}` : " 数据源可能未覆盖全部附加条件。"}</p></div></section>
  </>;
}

function AdminCatalogScreen() {
  const [queue, setQueue] = useState<CatalogCard[]>([]); const [runs, setRuns] = useState<Array<Record<string, unknown>>>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [message, setMessage] = useState(""); const [json, setJson] = useState(""); const [file, setFile] = useState<File | null>(null);
  const load = async () => { setLoading(true); setError(""); try { const [cardsResult, runsResult] = await Promise.all([catalogRequest<CatalogCard[]>("/api/admin/card-catalog?status=needs_review"), catalogRequest<Array<Record<string, unknown>>>("/api/admin/card-catalog/sync-runs")]); setQueue(cardsResult.data); setRuns(runsResult.data); } catch (reason) { setError(reason instanceof Error ? reason.message : "无法读取管理员数据"); } finally { setLoading(false); } };
  useEffect(() => {
    let active = true;
    void Promise.all([
      catalogRequest<CatalogCard[]>("/api/admin/card-catalog?status=needs_review"),
      catalogRequest<Array<Record<string, unknown>>>("/api/admin/card-catalog/sync-runs"),
    ]).then(([cardsResult, runsResult]) => {
      if (!active) return;
      setQueue(cardsResult.data);
      setRuns(runsResult.data);
    }).catch((reason) => {
      if (active) setError(reason instanceof Error ? reason.message : "无法读取管理员数据");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);
  const review = async (card: CatalogCard, action: "publish" | "reject" | "hide" | "mark_discontinued") => { setMessage(""); try { await catalogRequest(`/api/admin/card-catalog/${card.id}/review`, { method: "POST", body: JSON.stringify({ action, benefits: (card.catalog_benefits ?? []).map((benefit) => ({ id: benefit.id, rule: benefit.rule, verificationStatus: benefit.rule.reviewRequired ? "needs_review" : "verified" })) }) }); setMessage(action === "publish" ? "已发布通过审核的数据；未确认权益仍保持隐藏" : "审核状态已更新"); await load(); } catch (reason) { setMessage(reason instanceof Error ? reason.message : "审核失败"); } };
  const importJson = async () => { try { const payload = JSON.parse(json) as unknown; await catalogRequest("/api/admin/card-catalog", { method: "POST", body: JSON.stringify(payload) }); setJson(""); setMessage("官方资料 JSON 已进入待审核队列"); await load(); } catch (reason) { setMessage(reason instanceof Error ? reason.message : "JSON 格式无效"); } };
  const upload = async () => { if (!file) return; const form = new FormData(); form.set("file", file); form.set("sourceName", "管理员上传的官方产品资料"); try { await catalogRequest("/api/admin/card-catalog/import", { method: "POST", body: form }); setFile(null); setMessage("文件已上传并标记为 needs_review，不会自动发布"); } catch (reason) { setMessage(reason instanceof Error ? reason.message : "上传失败"); } };
  const sync = async () => { try { const providerId = process.env.NEXT_PUBLIC_CARD_CATALOG_PROVIDER === "public-data" ? "public-data" : "coocon"; await catalogRequest("/api/admin/card-catalog/sync", { method: "POST", body: JSON.stringify({ providerId, pageSize: 100, idempotencyKey: `${providerId}-${new Date().toISOString()}-${crypto.randomUUID()}` }) }); setMessage("同步任务已进入候选审核流程"); await load(); } catch (reason) { setMessage(reason instanceof Error ? reason.message : "同步未启动"); await load(); } };
  if (loading) return <section className="panel catalog-state"><span className="spinner" /><h2>正在读取目录审核队列…</h2></section>;
  if (error) return <section className="panel"><Empty title="无法访问目录管理" body={error} /><div className="empty-actions"><Link href="/catalog" className="secondary-btn">返回公开目录</Link></div></section>;
  return <><PageTitle eyebrow="CATALOG ADMIN" title="韩国信用卡数据审核" description="管理员权限由数据库和服务端共同验证；候选解析结果必须对照官方资料后才能发布。" action={<button className="primary-btn" onClick={() => void sync()}><Download size={17} />启动受保护同步</button>} />{message && <div className="data-status" role="status">{message}</div>}<div className="two-col admin-catalog-tools"><section className="panel"><h2>上传官方资料</h2><p>支持 PDF、CSV、JSON，最大 5MB。上传后只进入人工审核队列。</p><Field label="官方资料文件"><input type="file" accept="application/pdf,text/csv,application/json" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></Field><button className="secondary-btn" disabled={!file} onClick={() => void upload()}><Upload size={16} />上传并待审核</button></section><section className="panel"><h2>录入标准化 JSON</h2><p>必须符合 Provider 无关 Schema，并包含官方来源 URL；不会把静态 JSON 描述成实时 API。</p><Field label="目录卡片 JSON"><textarea value={json} onChange={(event) => setJson(event.target.value)} placeholder="粘贴 providerId=manual 的已获授权官方资料结构" /></Field><button className="secondary-btn" disabled={!json.trim()} onClick={() => void importJson()}>校验并进入审核队列</button></section></div><section className="panel"><div className="panel-head"><h2>待审核卡片</h2><span>{queue.length} 张</span></div>{queue.length ? <div className="review-list">{queue.map((card) => <article key={card.id}><div><span className="eyebrow">{card.provider_id} · {card.product_status}</span><h3>{card.name_ko}</h3><p>{card.source_name} · {card.source_url}</p><small>{(card.catalog_benefits ?? []).length} 项候选权益；标记 reviewRequired 的规则不会发布</small></div><div className="button-row"><button className="primary-btn" onClick={() => void review(card, "publish")}>确认并发布</button><button className="secondary-btn" onClick={() => void review(card, "mark_discontinued")}>标记停发</button><button className="danger-btn" onClick={() => void review(card, "reject")}>拒绝</button></div></article>)}</div> : <Empty title="没有待审核卡片" body="新的同步候选或人工资料会显示在这里。" />}</section><section className="panel"><div className="panel-head"><h2>同步历史</h2><span>{runs.length} 次</span></div><div className="sync-run-list">{runs.slice(0, 20).map((run) => <article key={String(run.id)}><b>{String(run.provider_id)}</b><span className={`status ${run.status === "completed" ? "ok" : "warning"}`}>{String(run.status)}</span><small>{formatSyncDate(String(run.started_at))} · 获取 {String(run.fetched_count ?? 0)} · 更新 {String(run.updated_count ?? 0)}</small><p>{run.error_summary ? String(run.error_summary) : "无错误摘要"}</p></article>)}</div></section></>;
}

function AdminHealthScreen() {
  const [data, setData] = useState<{ database: string; readiness?: Record<string, unknown>; provider?: Record<string, unknown>; timestamp?: string } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    void catalogRequest<{ database: string; readiness?: Record<string, unknown>; provider?: Record<string, unknown>; timestamp?: string }>("/api/admin/health", { signal: controller.signal }).then((result) => setData(result.data)).catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "无法读取生产健康状态"); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  if (loading) return <section className="panel catalog-state"><span className="spinner" /><h2>正在检查生产状态…</h2></section>;
  if (error || !data) return <section className="panel"><Empty title="生产健康检查不可用" body={error || "请确认已执行最新 migration，并使用管理员账户登录。"} /><div className="empty-actions"><Link href="/admin/catalog" className="secondary-btn">返回目录管理</Link></div></section>;
  const readiness = data.readiness ?? {};
  const provider = data.provider ?? {};
  const count = (key: string) => Array.isArray(readiness[key]) ? readiness[key].length : 0;
  return <><PageTitle eyebrow="PRODUCTION HEALTH" title="生产健康状态" description="仅显示安全状态摘要，不显示密钥、Token、原始供应商响应或用户数据。" action={<Link href="/admin/catalog" className="secondary-btn">目录管理</Link>} /><div className="metric-grid three"><Metric label="数据库" value={data.database === "healthy" ? "正常" : "需处理"} delta={`Schema ${String(readiness.schemaVersion ?? "未知")}`} icon={ShieldCheck} accent={data.database === "healthy"} warn={data.database !== "healthy"} /><Metric label="管理员" value={String(readiness.administratorCount ?? 0)} delta="已初始化账户" icon={User} /><Metric label="已审核目录" value={String(readiness.verifiedCatalogCount ?? 0)} delta={`过期资料 ${String(readiness.staleCatalogCount ?? 0)}`} icon={CreditCardIcon} /></div><div className="two-col"><section className="panel"><h2>数据库验收摘要</h2><dl className="details-list"><div><dt>缺失数据表</dt><dd>{count("missingTables")}</dd></div><div><dt>缺失 RPC</dt><dd>{count("missingFunctions")}</dd></div><div><dt>未启用 RLS</dt><dd>{count("rlsDisabledTables")}</dd></div><div><dt>私有 Storage</dt><dd>{(readiness.storage as { private?: boolean } | undefined)?.private ? "已启用" : "需检查"}</dd></div></dl></section><section className="panel"><h2>数据供应商连接</h2><dl className="details-list"><div><dt>Provider</dt><dd>{String(provider.providerName ?? "未配置")}</dd></div><div><dt>配置状态</dt><dd>{String(provider.configurationStatus ?? "unknown")}</dd></div><div><dt>连接</dt><dd>{provider.connected === true ? "成功" : "未连接"}</dd></div><div><dt>合同版本</dt><dd>{String(provider.contractVersion ?? "未安装")}</dd></div><div><dt>响应时间</dt><dd>{String(provider.responseTimeMs ?? 0)}ms</dd></div></dl></section></div></>;
}

function CardsScreen() {
  const { cards, archivedCards, benefits, usages, deleteCard, restoreCard, updateCard } = useCardWise();
  const [query, setQuery] = useState(""); const [confirmId, setConfirmId] = useState<string | null>(null); const [view, setView] = useState<"active" | "archived">("active");
  const source = view === "active" ? cards : archivedCards; const filtered = source.filter((c) => `${c.issuer}${c.name}${c.nickname}`.toLowerCase().includes(query.toLowerCase()));
  return <><PageTitle eyebrow="MY WALLET" title="我的信用卡" description="管理卡片、年费与上月消费门槛。CardWise 永远不会要求完整卡号或 CVC。" action={<Link className="primary-btn" href="/cards/new"><Plus size={18} />添加信用卡</Link>} />
    <div className="toolbar"><label className="search-input"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索发卡机构或卡片昵称" /></label><button className="filter-btn" onClick={() => setView(view === "active" ? "archived" : "active")}>{view === "active" ? `使用中 (${cards.length})` : `回收站 (${archivedCards.length})`} <ChevronDown size={16} /></button></div>
    {!filtered.length ? <Empty title={view === "archived" ? "回收站为空" : "还没有匹配的卡片"} body={view === "archived" ? "归档的卡片会保留在这里，可随时恢复。" : "换个关键词，或添加一张新信用卡。"} /> : <div className="cards-grid">{filtered.map((card) => { const cardBenefits = benefits.filter((b) => b.cardId === card.id); const saved = usages.filter((u) => u.cardId === card.id).reduce((s, u) => s + u.discountAmount, 0); return <article className="card-card" key={card.id}><CreditCardVisual card={card} /><div className="card-summary"><div><span>有效权益<strong>{cardBenefits.length}</strong></span><span>已节省<strong>{won(saved)}</strong></span><span>年费<strong>{won(card.annualFee)}</strong></span></div><p>状态 <b className={card.isActive ? "ok" : "warning"}>{view === "archived" ? "已归档" : card.isActive ? "使用中" : "已停用"}</b> · 币种 {card.currency ?? "KRW"}</p><div className="row-actions">{view === "archived" ? <button onClick={() => restoreCard(card.id)}>恢复卡片</button> : <><Link href={`/cards/${card.id}`}>查看详情</Link><Link href={`/cards/${card.id}/edit`}>编辑</Link><button onClick={() => updateCard(card.id, { isFavorite: !card.isFavorite })} aria-label="切换收藏"><Star size={16} fill={card.isFavorite ? "currentColor" : "none"} /></button><button onClick={() => updateCard(card.id, { isActive: !card.isActive })}>{card.isActive ? "停用" : "启用"}</button><button onClick={() => setConfirmId(card.id)}><Trash2 size={16} /></button></>}</div></div></article>; })}</div>}
    {confirmId && <ConfirmDialog title="将这张信用卡移入回收站？" body="卡片、关联权益和消费记录会软删除并保留审计记录，之后可以完整恢复。" onCancel={() => setConfirmId(null)} onConfirm={() => { deleteCard(confirmId); setConfirmId(null); }} />}
  </>;
}

function CardDetail({ id }: { id: string }) {
  const { cards, benefits, usages } = useCardWise(); const card = cards.find((c) => c.id === id); if (!card) return <Empty title="找不到这张卡片" body="它可能已被删除或你没有访问权限。" />;
  const list = benefits.filter((b) => b.cardId === id); const saved = usages.filter((u) => u.cardId === id).reduce((s, u) => s + u.discountAmount, 0);
  return <><div className="detail-hero"><CreditCardVisual card={card} /><div><span className="eyebrow">CARD DETAIL</span><h1>{card.nickname}</h1><p>{card.issuer} · {card.name} · {card.network} •••• {card.lastFour}</p><div className="detail-actions"><Link className="secondary-btn" href={`/cards/${id}/edit`}>编辑卡片</Link><Link className="primary-btn" href={`/cards/${id}/benefits/new`}><Plus size={17} />添加权益</Link></div></div></div>
    <div className="metric-grid three"><Metric label="累计节省" value={won(saved)} delta="基于已录入记录" icon={Sparkles} accent /><Metric label="上月消费" value={won(card.previousMonthSpend)} delta="门槛计算依据" icon={Gauge} /><Metric label="年费" value={won(card.annualFee)} delta={`${card.annualFeeMonth}月扣款`} icon={Bell} warn /></div>
    <section className="panel"><div className="panel-head"><h2>卡片权益</h2><span>{list.length} 项</span></div>{list.length ? <div className="benefit-list">{list.map((b) => <BenefitRow benefit={b} key={b.id} />)}</div> : <Empty title="还没有权益" body="添加第一项结构化权益，系统才能开始计算。" />}</section></>;
}

function CardForm({ cardId }: { cardId?: string }) {
  const { cards, addCard, updateCard } = useCardWise(); const router = useRouter(); const card = cards.find((c) => c.id === cardId);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CreditCardInput>({ resolver: zodResolver(creditCardInputSchema), defaultValues: card ? { issuer: card.issuer, name: card.name, nickname: card.nickname, network: card.network, lastFour: card.lastFour, annualFee: card.annualFee, annualFeeMonth: card.annualFeeMonth, previousMonthSpend: card.previousMonthSpend, currentQualifyingSpend: card.currentQualifyingSpend, currency: card.currency ?? "KRW", statementCycleDay: card.statementCycleDay, color: card.color, notes: card.notes, isFavorite: card.isFavorite, isActive: card.isActive, sortOrder: card.sortOrder } : { network: "Visa", annualFee: 0, annualFeeMonth: 1, previousMonthSpend: 0, currentQualifyingSpend: 0, currency: "KRW", statementCycleDay: 1, color: "#5d4de2", isFavorite: false, isActive: true, sortOrder: cards.length } });
  const submit = handleSubmit(async (values) => { await new Promise((r) => setTimeout(r, 250)); if (card) updateCard(card.id, values); else addCard({ ...values, lastFour: values.lastFour || undefined, color: "linear-gradient(135deg,#4e39f3,#8a7cff)", isFavorite: false, isActive: true, openedAt: today(), currentQualifyingSpend: 0 }); router.push("/cards"); });
  return <><PageTitle eyebrow="CARD SETUP" title={card ? "编辑信用卡" : "添加信用卡"} description="只填写识别卡片与计算权益所需的信息；请勿输入完整卡号。" />
    <form className="form-panel" onSubmit={submit}><div className="form-section"><h2>基本信息</h2><div className="form-grid"><Field label="发卡机构" error={errors.issuer?.message}><input {...register("issuer")} placeholder="例如：演示银行" /></Field><Field label="信用卡名称" error={errors.name?.message}><input {...register("name")} placeholder="例如：Daily Coffee" /></Field><Field label="卡片昵称" error={errors.nickname?.message}><input {...register("nickname")} placeholder="例如：日常咖啡卡" /></Field><Field label="卡组织"><select {...register("network")}><option>Visa</option><option>Mastercard</option><option>AMEX</option><option>UnionPay</option><option>JCB</option><option>Local</option></select></Field><Field label="末四位（可选）" hint="不保存完整卡号" error={errors.lastFour?.message}><input {...register("lastFour")} inputMode="numeric" maxLength={4} placeholder="1234" /></Field><Field label="默认币种"><select {...register("currency")}><option>KRW</option><option>CNY</option><option>USD</option><option>JPY</option><option>EUR</option></select></Field><Field label="卡片颜色"><input type="color" {...register("color")} /></Field></div></div><div className="form-section"><h2>年费、账单与门槛</h2><div className="form-grid"><Field label="年费"><input type="number" {...register("annualFee", { valueAsNumber: true })} /></Field><Field label="年费扣款月份"><input type="number" min="1" max="12" {...register("annualFeeMonth", { valueAsNumber: true })} /></Field><Field label="账单日"><input type="number" min="1" max="31" {...register("statementCycleDay", { valueAsNumber: true })} /></Field><Field label="上月消费金额"><input type="number" {...register("previousMonthSpend", { valueAsNumber: true })} /></Field><Field label="本期合资格消费"><input type="number" {...register("currentQualifyingSpend", { valueAsNumber: true })} /></Field><Field label="排序"><input type="number" min="0" {...register("sortOrder", { valueAsNumber: true })} /></Field><Field label="备注"><textarea {...register("notes")} placeholder="不要填写完整卡号、CVC 或密码" /></Field><label className="toggle-row"><span>收藏卡片</span><input type="checkbox" {...register("isFavorite")} /><i /></label><label className="toggle-row"><span>启用卡片</span><input type="checkbox" {...register("isActive")} /><i /></label></div></div><div className="form-footer"><Link href="/cards" className="secondary-btn">取消</Link><button className="primary-btn" disabled={isSubmitting}>{isSubmitting ? "保存中…" : "保存信用卡"}</button></div></form></>;
}

function BenefitsScreen() {
  const { benefits } = useCardWise(); const [query, setQuery] = useState(""); const list = benefits.filter((b) => `${b.name}${b.category}${b.description}${b.rule.merchantKeywords?.join("")}`.toLowerCase().includes(query.toLowerCase()));
  return <><PageTitle eyebrow="BENEFITS" title="权益中心" description="统一管理结构化权益规则、限额、次数与来源确认状态。" action={<Link href="/cards" className="primary-btn"><Plus size={18} />从卡片添加</Link>} /><div className="toolbar"><label className="search-input"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索权益、分类或中韩英商户关键词" /></label><button className="filter-btn">状态：全部 <ChevronDown size={16} /></button></div><section className="panel table-panel"><div className="benefit-list">{list.length ? list.map((b) => <BenefitRow benefit={b} key={b.id} />) : <Empty title="没有匹配的权益" body="尝试搜索“咖啡”“스타벅스”或“hotel”。" />}</div></section></>;
}

function BenefitDetail({ id }: { id: string }) {
  const { benefits, cards, usages, deleteBenefit } = useCardWise(); const router = useRouter(); const [confirm, setConfirm] = useState(false); const b = benefits.find((x) => x.id === id); if (!b) return <Empty title="找不到这项权益" body="它可能已被删除或你没有访问权限。" />; const card = cards.find((c) => c.id === b.cardId)!;
  const result = calculateBenefit(card, b, { merchantName: b.rule.merchantKeywords?.[0] ?? b.category, category: b.category, amount: 30000, occurredAt: new Date().toISOString(), channel: b.rule.channel === "online" ? "online" : "offline", geography: b.rule.geography === "overseas" ? "overseas" : "domestic" }, usages);
  return <><PageTitle eyebrow={b.category} title={b.name} description={b.description} action={<div className="button-row"><Link className="secondary-btn" href={`/benefits/${id}/edit`}>编辑</Link><button className="danger-btn" onClick={() => setConfirm(true)}><Trash2 size={17} />删除</button></div>} /><div className="two-col"><section className="panel"><h2>本期使用情况</h2><div className="limit-hero"><strong>{b.rule.monthlyDiscountCap !== undefined ? won(result.remainingMonthlyAmount ?? 0) : result.remainingAnnualUses !== null ? `${result.remainingAnnualUses} 次` : "无限额"}</strong><span>当前剩余</span></div><div className="progress large"><i style={{ width: `${b.rule.monthlyDiscountCap ? 100 - ((result.remainingMonthlyAmount ?? 0) / b.rule.monthlyDiscountCap) * 100 : 66}%` }} /></div><dl className="details-list"><div><dt>理论优惠</dt><dd>{won(result.theoreticalValue)}</dd></div><div><dt>下次重置</dt><dd>{result.nextResetAt ?? "不重置"}</dd></div><div><dt>使用次数</dt><dd>{formatLimit(result.remainingMonthlyUses, " 次")}</dd></div></dl></section><section className="panel"><h2>结构化规则</h2><dl className="details-list"><div><dt>优惠类型</dt><dd>{b.rule.benefitType}</dd></div><div><dt>优惠数值</dt><dd>{b.rule.discountRate ? `${b.rule.discountRate}%` : won(b.rule.fixedAmount ?? 0)}</dd></div><div><dt>最低消费</dt><dd>{won(b.rule.minimumTransactionAmount ?? 0)}</dd></div><div><dt>上月门槛</dt><dd>{won(b.rule.previousMonthSpendRequirement ?? 0)}</dd></div><div><dt>适用渠道</dt><dd>{b.rule.channel ?? "不限"}</dd></div><div><dt>商户关键词</dt><dd>{b.rule.merchantKeywords?.join(" · ") ?? "不限"}</dd></div></dl></section></div><section className="source-card"><ShieldCheck size={20} /><div><b>来源与准确性</b><p>{b.sourceName} · 最后确认 {b.lastVerifiedAt} · {b.confidence === "example" ? "演示数据，不代表真实银行当前权益" : "用户已确认"}</p></div></section>{confirm && <ConfirmDialog title="删除这项权益？" body="历史消费记录仍会保留规则快照，正式环境执行软删除。" onCancel={() => setConfirm(false)} onConfirm={() => { deleteBenefit(id); router.push("/benefits"); }} />}</>;
}

function BenefitForm({ cardId, benefitId }: { cardId?: string; benefitId?: string }) {
  const { cards, benefits, addBenefit, updateBenefit } = useCardWise(); const router = useRouter(); const existing = benefits.find((b) => b.id === benefitId);
  const rule = existing?.rule;
  const [form, setForm] = useState({ cardId: cardId ?? existing?.cardId ?? cards[0]?.id ?? "", name: existing?.name ?? "", category: existing?.category ?? "咖啡", description: existing?.description ?? "", benefitType: rule?.benefitType ?? "percentage", rate: rule?.discountRate ?? 10, fixedAmount: rule?.fixedAmount ?? 0, pointsMultiplier: rule?.pointsMultiplier ?? 1, fixedPoints: rule?.fixedPoints ?? 0, milesPerUnit: rule?.milesPerUnit ?? 1, pointsUnitAmount: rule?.pointsUnitAmount ?? 1000, perTransactionCap: rule?.perTransactionCap ?? 0, dailyCap: rule?.dailyDiscountCap ?? 0, monthlyCap: rule?.monthlyDiscountCap ?? 10000, annualCap: rule?.annualDiscountCap ?? 0, monthlyUses: rule?.monthlyUsageLimit ?? 0, annualUses: rule?.annualUsageLimit ?? 0, minAmount: rule?.minimumTransactionAmount ?? 0, maxEligibleAmount: rule?.maximumEligibleAmount ?? 0, requirement: rule?.previousMonthSpendRequirement ?? 0, keywords: rule?.merchantKeywords?.join(", ") ?? "", participating: rule?.participatingMerchants?.join(", ") ?? "", excluded: rule?.excludedMerchantKeywords?.join(", ") ?? "", weekdays: rule?.weekdays?.join(",") ?? "", timeStart: rule?.timeRanges?.[0]?.start ?? "", timeEnd: rule?.timeRanges?.[0]?.end ?? "", channel: rule?.channel ?? "both", geography: rule?.geography ?? "both", paymentMethods: rule?.paymentMethods?.join(", ") ?? "", startsAt: rule?.startsAt?.slice(0, 10) ?? "", endsAt: rule?.endsAt?.slice(0, 10) ?? "", resetPeriod: rule?.resetPeriod ?? "monthly", enrollmentRequired: rule?.enrollmentRequired ?? false, enrolled: rule?.enrolled ?? false, couponRequired: rule?.couponRequired ?? false, reservationRequired: rule?.reservationRequired ?? false, sourceName: existing?.sourceName ?? "用户手动录入", sourceUrl: existing?.sourceUrl ?? "" });
  const list = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);
  const positive = (value: number) => value > 0 ? value : undefined;
  const submit = (e: FormEvent) => { e.preventDefault(); const structuredRule: BenefitRule = { benefitType: form.benefitType as BenefitRule["benefitType"], ...(form.benefitType === "percentage" || form.benefitType === "cashback" ? { discountRate: Number(form.rate) } : {}), ...(["fixed_discount", "free_service"].includes(form.benefitType) ? { fixedAmount: positive(Number(form.fixedAmount)) } : {}), ...(form.benefitType === "points_multiplier" ? { pointsMultiplier: Number(form.pointsMultiplier), pointsUnitAmount: Number(form.pointsUnitAmount) } : {}), ...(form.benefitType === "fixed_points" ? { fixedPoints: Number(form.fixedPoints) } : {}), ...(form.benefitType === "miles" ? { milesPerUnit: Number(form.milesPerUnit), pointsUnitAmount: Number(form.pointsUnitAmount) } : {}), perTransactionCap: positive(Number(form.perTransactionCap)), dailyDiscountCap: positive(Number(form.dailyCap)), monthlyDiscountCap: positive(Number(form.monthlyCap)), annualDiscountCap: positive(Number(form.annualCap)), monthlyUsageLimit: positive(Number(form.monthlyUses)), annualUsageLimit: positive(Number(form.annualUses)), minimumTransactionAmount: positive(Number(form.minAmount)), maximumEligibleAmount: positive(Number(form.maxEligibleAmount)), previousMonthSpendRequirement: positive(Number(form.requirement)), merchantKeywords: list(form.keywords), participatingMerchants: list(form.participating), excludedMerchantKeywords: list(form.excluded), weekdays: list(form.weekdays).map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6), timeRanges: form.timeStart && form.timeEnd ? [{ start: form.timeStart, end: form.timeEnd }] : undefined, channel: form.channel as BenefitRule["channel"], geography: form.geography as BenefitRule["geography"], paymentMethods: list(form.paymentMethods), startsAt: form.startsAt || undefined, endsAt: form.endsAt || undefined, resetPeriod: form.resetPeriod as BenefitRule["resetPeriod"], enrollmentRequired: form.enrollmentRequired, enrolled: form.enrolled, couponRequired: form.couponRequired, reservationRequired: form.reservationRequired }; const input: Omit<Benefit, "id"> = { cardId: form.cardId, name: form.name, category: form.category, description: form.description, rule: structuredRule, status: "active", sourceName: form.sourceName, sourceUrl: form.sourceUrl || undefined, lastVerifiedAt: today(), verifiedByUser: true, confidence: "confirmed" }; if (existing) updateBenefit(existing.id, input); else addBenefit(input); router.push("/benefits"); };
  const change = (key: keyof typeof form, value: string | number | boolean) => setForm((old) => ({ ...old, [key]: value }));
  const valueLabel = form.benefitType === "percentage" || form.benefitType === "cashback" ? "比例（%）" : form.benefitType === "fixed_points" ? "固定积分" : form.benefitType === "points_multiplier" ? "积分倍数" : form.benefitType === "miles" ? "每计价单位里程" : "固定价值（最小货币单位）";
  const value = form.benefitType === "percentage" || form.benefitType === "cashback" ? form.rate : form.benefitType === "fixed_points" ? form.fixedPoints : form.benefitType === "points_multiplier" ? form.pointsMultiplier : form.benefitType === "miles" ? form.milesPerUnit : form.fixedAmount;
  const valueKey = form.benefitType === "percentage" || form.benefitType === "cashback" ? "rate" : form.benefitType === "fixed_points" ? "fixedPoints" : form.benefitType === "points_multiplier" ? "pointsMultiplier" : form.benefitType === "miles" ? "milesPerUnit" : "fixedAmount";
  return <><PageTitle eyebrow="BENEFIT RULE" title={existing ? "编辑权益" : "添加权益"} description="展示说明与可计算规则会同时保存，并在消费记录中保留规则快照。" /><form className="form-panel" onSubmit={submit}><div className="form-section"><h2>权益说明</h2><div className="form-grid"><Field label="所属信用卡"><select value={form.cardId} onChange={(e) => change("cardId", e.target.value)}>{cards.map((c) => <option value={c.id} key={c.id}>{c.nickname}</option>)}</select></Field><Field label="权益名称"><input required value={form.name} onChange={(e) => change("name", e.target.value)} placeholder="例如：星巴克 20% 优惠" /></Field><Field label="主分类"><select value={form.category} onChange={(e) => change("category", e.target.value)}>{categories.map((c) => <option key={c}>{c}</option>)}</select></Field><Field label="权益说明"><textarea required value={form.description} onChange={(e) => change("description", e.target.value)} /></Field><Field label="信息来源"><input required value={form.sourceName} onChange={(e) => change("sourceName", e.target.value)} /></Field><Field label="来源链接（可选）"><input type="url" value={form.sourceUrl} onChange={(e) => change("sourceUrl", e.target.value)} /></Field></div></div><div className="form-section"><h2>价值、上限与次数</h2><div className="form-grid"><Field label="权益类型"><select value={form.benefitType} onChange={(e) => change("benefitType", e.target.value)}><option value="percentage">百分比优惠</option><option value="cashback">返现</option><option value="fixed_discount">固定减免</option><option value="free_service">免费服务</option><option value="points_multiplier">积分倍数</option><option value="fixed_points">固定积分</option><option value="miles">里程</option><option value="custom">自定义（仅追踪）</option></select></Field><Field label={valueLabel}><input type="number" min="0" value={value} onChange={(e) => change(valueKey, Number(e.target.value))} /></Field>{["points_multiplier", "miles"].includes(form.benefitType) && <Field label="计价单位"><input type="number" min="1" value={form.pointsUnitAmount} onChange={(e) => change("pointsUnitAmount", Number(e.target.value))} /></Field>}<Field label="单笔优惠上限"><input type="number" min="0" value={form.perTransactionCap} onChange={(e) => change("perTransactionCap", Number(e.target.value))} /></Field><Field label="每日优惠上限"><input type="number" min="0" value={form.dailyCap} onChange={(e) => change("dailyCap", Number(e.target.value))} /></Field><Field label="每月优惠上限"><input type="number" min="0" value={form.monthlyCap} onChange={(e) => change("monthlyCap", Number(e.target.value))} /></Field><Field label="每年优惠上限"><input type="number" min="0" value={form.annualCap} onChange={(e) => change("annualCap", Number(e.target.value))} /></Field><Field label="每月使用次数"><input type="number" min="0" value={form.monthlyUses} onChange={(e) => change("monthlyUses", Number(e.target.value))} /></Field><Field label="每年使用次数"><input type="number" min="0" value={form.annualUses} onChange={(e) => change("annualUses", Number(e.target.value))} /></Field><Field label="重置周期"><select value={form.resetPeriod} onChange={(e) => change("resetPeriod", e.target.value)}><option value="monthly">每月</option><option value="yearly">每年</option><option value="none">不重置</option></select></Field></div></div><div className="form-section"><h2>资格与适用范围</h2><div className="form-grid"><Field label="最低单笔消费"><input type="number" min="0" value={form.minAmount} onChange={(e) => change("minAmount", Number(e.target.value))} /></Field><Field label="最大合资格金额"><input type="number" min="0" value={form.maxEligibleAmount} onChange={(e) => change("maxEligibleAmount", Number(e.target.value))} /></Field><Field label="上月消费门槛"><input type="number" min="0" value={form.requirement} onChange={(e) => change("requirement", Number(e.target.value))} /></Field><Field label="商户关键词" hint="逗号分隔，支持中韩英"><input value={form.keywords} onChange={(e) => change("keywords", e.target.value)} /></Field><Field label="指定参与门店"><input value={form.participating} onChange={(e) => change("participating", e.target.value)} /></Field><Field label="排除商户关键词"><input value={form.excluded} onChange={(e) => change("excluded", e.target.value)} /></Field><Field label="适用星期" hint="0=周日，1=周一…6=周六"><input value={form.weekdays} onChange={(e) => change("weekdays", e.target.value)} placeholder="1,2,3,4,5" /></Field><Field label="开始时刻"><input type="time" value={form.timeStart} onChange={(e) => change("timeStart", e.target.value)} /></Field><Field label="结束时刻"><input type="time" value={form.timeEnd} onChange={(e) => change("timeEnd", e.target.value)} /></Field><Field label="渠道"><select value={form.channel} onChange={(e) => change("channel", e.target.value)}><option value="both">线上与线下</option><option value="online">仅线上</option><option value="offline">仅线下</option></select></Field><Field label="地区"><select value={form.geography} onChange={(e) => change("geography", e.target.value)}><option value="both">境内与境外</option><option value="domestic">仅境内</option><option value="overseas">仅境外</option></select></Field><Field label="支付方式"><input value={form.paymentMethods} onChange={(e) => change("paymentMethods", e.target.value)} placeholder="实体卡, Samsung Pay" /></Field><Field label="开始日期"><input type="date" value={form.startsAt} onChange={(e) => change("startsAt", e.target.value)} /></Field><Field label="结束日期"><input type="date" value={form.endsAt} onChange={(e) => change("endsAt", e.target.value)} /></Field>{[["enrollmentRequired", "需要报名"], ["enrolled", "已完成报名"], ["couponRequired", "需要优惠券"], ["reservationRequired", "需要预约"]].map(([key, label]) => <label className="toggle-row" key={key}><span>{label}</span><input type="checkbox" checked={Boolean(form[key as keyof typeof form])} onChange={(e) => change(key as keyof typeof form, e.target.checked)} /><i /></label>)}</div></div><div className="form-footer"><button type="button" className="secondary-btn" onClick={() => router.back()}>取消</button><button className="primary-btn">保存并确认规则</button></div></form></>;
}

function RecommendScreen() {
  const { cards, benefits, usages } = useCardWise(); const params = useSearchParams(); const initial = params.get("q") ?? "星巴克";
  const [scenario, setScenario] = useState<PurchaseScenario>({ merchantName: initial, category: initial.includes("星巴克") ? "咖啡" : "餐饮", amount: 30000, occurredAt: new Date().toISOString(), channel: initial.includes("网购") ? "online" : "offline", geography: "domestic", currency: "KRW", couponApplied: false, reservationMade: false });
  const [submitted, setSubmitted] = useState(true); const recommendations = submitted ? rankCards(cards, benefits, usages, scenario).slice(0, 3) : [];
  return <><PageTitle eyebrow="CARD MATCH" title="该刷哪张卡？" description="确定性计算每项限制，显示前三名与不推荐原因。" /><form className="recommend-form" onSubmit={(e) => { e.preventDefault(); setSubmitted(true); }}><Field label="商户名称"><input value={scenario.merchantName} onChange={(e) => setScenario({ ...scenario, merchantName: e.target.value })} /></Field><Field label="消费分类"><select value={scenario.category} onChange={(e) => setScenario({ ...scenario, category: e.target.value })}>{categories.map((c) => <option key={c}>{c}</option>)}</select></Field><Field label={`预计金额（${scenario.currency ?? "KRW"}）`}><input type="number" value={scenario.amount} onChange={(e) => setScenario({ ...scenario, amount: Number(e.target.value) })} /></Field><Field label="币种"><select value={scenario.currency} onChange={(e) => setScenario({ ...scenario, currency: e.target.value })}><option>KRW</option><option>CNY</option><option>USD</option><option>JPY</option><option>EUR</option></select></Field><Field label="渠道"><select value={scenario.channel} onChange={(e) => setScenario({ ...scenario, channel: e.target.value as "online" | "offline" })}><option value="offline">线下</option><option value="online">线上</option></select></Field><Field label="地区"><select value={scenario.geography} onChange={(e) => setScenario({ ...scenario, geography: e.target.value as "domestic" | "overseas" })}><option value="domestic">韩国境内</option><option value="overseas">海外</option></select></Field><Field label="支付方式"><input value={scenario.paymentMethod ?? ""} onChange={(e) => setScenario({ ...scenario, paymentMethod: e.target.value })} placeholder="实体卡 / Samsung Pay" /></Field><label className="toggle-row"><span>已领取优惠券</span><input type="checkbox" checked={scenario.couponApplied} onChange={(e) => setScenario({ ...scenario, couponApplied: e.target.checked })} /><i /></label><label className="toggle-row"><span>已提前预约</span><input type="checkbox" checked={scenario.reservationMade} onChange={(e) => setScenario({ ...scenario, reservationMade: e.target.checked })} /><i /></label><button className="primary-btn"><Sparkles size={18} />重新计算</button></form>
    <section className="recommend-results"><div className="section-head compact"><div><span className="eyebrow">TOP MATCHES</span><h2>推荐结果</h2></div><small>每张卡只保留最优权益，按可量化价值与可用性排序</small></div>{recommendations.map((r, index) => <article key={r.benefit.id} className={`recommend-card ${index === 0 ? "winner" : ""}`}><div className="rank">#{index + 1}</div><CreditCardVisual card={r.card} compact /><div className="recommend-copy"><span className={r.eligible ? "status ok" : "status warning"}>{r.eligible ? "当前可用" : "暂不适用"}</span><h3>{r.card.nickname} · {r.benefit.name}</h3><p>{r.explanation || "未找到适用原因"}</p><div className="reason-tags">{(r.eligible ? ["商户匹配", "门槛已满足", "仍有额度"] : r.reasons).slice(0, 3).map((x) => <span key={x}>{x}</span>)}</div><small>最后确认 {r.benefit.lastVerifiedAt} · {r.benefit.sourceName}</small></div><div className="recommend-value"><small>{r.pointsEarned ? "预计积分" : r.milesEarned ? "预计里程" : "预计优惠"}</small><strong>{r.pointsEarned ? `${r.pointsEarned.toLocaleString()} 分` : r.milesEarned ? `${r.milesEarned.toLocaleString()} 里` : won(r.estimatedValue)}</strong><span>{r.estimatedValue > 0 ? `实付 ${won(Math.max(0, scenario.amount - r.estimatedValue))}` : "积分/里程不折算现金"}</span></div></article>)}</section></>;
}

function TransactionsScreen() {
  const { usages, cards, deleteUsage } = useCardWise(); const [query, setQuery] = useState(""); const rows = usages.filter((u) => u.merchantName.toLowerCase().includes(query.toLowerCase()));
  const exportCsv = () => { const csv = ["date,merchant,category,amount,discount,card", ...rows.map((u) => [u.occurredAt.slice(0, 10), u.merchantName, u.category, u.originalAmount, u.discountAmount, cards.find((c) => c.id === u.cardId)?.nickname].map((v) => `"${String(v).replaceAll('"', '""')}"`).join(","))].join("\n"); const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" })); const a = document.createElement("a"); a.href = url; a.download = `cardwise-transactions-${today()}.csv`; a.click(); URL.revokeObjectURL(url); };
  return <><PageTitle eyebrow="ACTIVITY" title="消费及权益使用记录" description="手动录入实际优惠；删除或修改记录后，剩余额度会立即恢复并重新计算。" action={<div className="button-row"><button className="secondary-btn" onClick={exportCsv}><Download size={17} />导出 CSV</button><Link href="/transactions/new" className="primary-btn"><Plus size={17} />新增记录</Link></div>} /><div className="toolbar"><label className="search-input"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索商户" /></label><Link href="/transactions/import" className="filter-btn"><Upload size={16} />导入 CSV</Link></div><section className="panel table-panel"><div className="data-table"><div className="table-row header"><span>日期 / 商户</span><span>卡片</span><span>分类</span><span>消费金额</span><span>优惠</span><span /></div>{rows.map((u) => <div className="table-row" key={u.id}><span><b>{u.merchantName}</b><small>{new Date(u.occurredAt).toLocaleDateString("zh-CN")}</small></span><span>{cards.find((c) => c.id === u.cardId)?.nickname}</span><span>{u.category}</span><span>{won(u.originalAmount)}</span><span className="saved">+{won(u.discountAmount)}</span><span className="button-row"><Link className="icon-btn" href={`/transactions/${u.id}/edit`} aria-label="编辑记录">✎</Link><button className="icon-btn" onClick={() => window.confirm("删除这条记录并恢复额度？") && deleteUsage(u.id)}><Trash2 size={16} /></button></span></div>)}</div></section></>;
}

function TransactionForm({ usageId }: { usageId?: string }) {
  const { cards, benefits, usages, addUsage, updateUsage } = useCardWise(); const router = useRouter(); const existing = usages.find((usage) => usage.id === usageId); const [cardId, setCardId] = useState(existing?.cardId ?? cards[0]?.id ?? ""); const cardBenefits = benefits.filter((b) => b.cardId === cardId); const [benefitId, setBenefitId] = useState(existing?.benefitId ?? cardBenefits[0]?.id ?? benefits[0]?.id ?? ""); const [merchant, setMerchant] = useState(existing?.merchantName ?? "星巴克"); const [amount, setAmount] = useState(existing?.originalAmount ?? 30000); const [date, setDate] = useState(existing?.occurredAt.slice(0, 10) ?? today()); const benefit = benefits.find((b) => b.id === benefitId); const card = cards.find((c) => c.id === cardId); const occurredAt = `${date}T12:00:00+09:00`; const estimate = benefit && card ? calculateBenefit(card, benefit, { merchantName: merchant, category: benefit.category, amount, occurredAt, channel: benefit.rule.channel === "online" ? "online" : "offline", geography: "domestic", currency: card.currency }, existing ? usages.filter((usage) => usage.id !== existing.id) : usages) : null; const [discount, setDiscount] = useState<number | null>(existing?.discountAmount ?? null);
  const submit = (e: FormEvent) => { e.preventDefault(); if (!benefit) return; const input = { benefitId, cardId, occurredAt, merchantName: merchant, category: benefit.category, originalAmount: amount, discountAmount: discount ?? estimate?.estimatedValue ?? 0, usageCount: existing?.usageCount ?? 1, ruleSnapshot: benefit.rule }; if (existing) updateUsage(existing.id, input); else addUsage(input); router.push("/transactions"); };
  return <><PageTitle eyebrow={existing ? "EDIT ACTIVITY" : "NEW ACTIVITY"} title={existing ? "编辑消费记录" : "新增消费记录"} description="系统提供建议优惠金额，你可以按账单结果手动修正。" /><form className="form-panel" onSubmit={submit}><div className="form-section"><div className="form-grid"><Field label="信用卡"><select value={cardId} onChange={(e) => { setCardId(e.target.value); setBenefitId(benefits.find((b) => b.cardId === e.target.value)?.id ?? ""); }}>{cards.map((c) => <option value={c.id} key={c.id}>{c.nickname}</option>)}</select></Field><Field label="使用权益"><select value={benefitId} onChange={(e) => setBenefitId(e.target.value)}>{benefits.filter((b) => b.cardId === cardId).map((b) => <option value={b.id} key={b.id}>{b.name}</option>)}</select></Field><Field label="商户名称"><input value={merchant} onChange={(e) => setMerchant(e.target.value)} /></Field><Field label="原始消费金额"><input type="number" min="0" value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></Field><Field label="实际优惠金额" hint={`建议：${won(estimate?.estimatedValue ?? 0)}`}><input type="number" min="0" value={discount ?? estimate?.estimatedValue ?? 0} onChange={(e) => setDiscount(Number(e.target.value))} /></Field><Field label="消费日期"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field></div></div>{estimate && <div className={estimate.eligible ? "calculation-note" : "calculation-note warning"}><Sparkles size={19} /><div><b>{estimate.eligible ? `预计可优惠 ${won(estimate.estimatedValue)}` : "当前记录可能不符合权益"}</b><p>{estimate.eligible ? `本月剩余 ${estimate.remainingMonthlyAmount === null ? "无限额" : won(estimate.remainingMonthlyAmount)}` : estimate.reasons.join("；")}</p></div></div>}<div className="form-footer"><Link href="/transactions" className="secondary-btn">取消</Link><button className="primary-btn">{existing ? "保存修改" : "保存记录"}</button></div></form></>;
}

function ImportScreen() {
  const { cards, benefits, usages, addUsage, notify, demoMode, reload } = useCardWise(); const router = useRouter();
  const [step, setStep] = useState(1); const [fileName, setFileName] = useState(""); const [file, setFile] = useState<File | null>(null); const [rows, setRows] = useState<string[][]>([]); const [importing, setImporting] = useState(false);
  const [mapping, setMapping] = useState([0, 1, 2, 3]); const [chosenCard, setChosenCard] = useState(""); const [chosenBenefit, setChosenBenefit] = useState("");
  const cardId = chosenCard || cards[0]?.id || ""; const cardBenefits = benefits.filter((benefit) => benefit.cardId === cardId);
  const benefit = benefits.find((item) => item.id === chosenBenefit) ?? cardBenefits[0];
  const load = async (file?: File) => {
    if (!file) return; if (file.size > 5 * 1024 * 1024) { notify("文件不能超过 5MB"); return; }
    setFileName(file.name); setFile(file); const parsed = parseCsvDocument(await file.text()); if (parsed.length > 5001) { notify("单次最多导入 5000 行"); return; } setRows(parsed); setStep(2);
  };
  const seen = new Set(usages.map((usage) => `${usage.occurredAt.slice(0, 10)}|${usage.merchantName.trim().toLowerCase()}|${usage.originalAmount}`));
  const preview = rows.slice(1).map((row, index) => {
    const date = row[mapping[0]]?.trim() ?? ""; const merchant = row[mapping[1]]?.trim() ?? "";
    const amount = Number((row[mapping[2]] ?? "").replaceAll(",", "")); const discount = Number((row[mapping[3]] ?? "0").replaceAll(",", ""));
    const normalizedDate = normalizeImportDate(date) ?? "";
    const key = `${normalizedDate}|${merchant.toLowerCase()}|${amount}`; const duplicate = seen.has(key); if (normalizedDate && merchant && Number.isInteger(amount) && amount >= 0) seen.add(key);
    return { index, date: normalizedDate, merchant, amount, discount, duplicate, valid: Boolean(normalizedDate && merchant && Number.isInteger(amount) && amount >= 0 && Number.isInteger(discount) && discount >= 0) };
  });
  const importable = preview.filter((row) => row.valid && !row.duplicate); const skipped = preview.length - importable.length;
  const confirmImport = async () => {
    if (!cardId || !benefit) { notify("请先添加信用卡和至少一项权益"); return; }
    if (demoMode) { importable.forEach((row) => addUsage({ benefitId: benefit.id, cardId, occurredAt: `${row.date}T12:00:00+09:00`, merchantName: row.merchant, category: benefit.category, originalAmount: row.amount, discountAmount: row.discount, usageCount: 1, ruleSnapshot: benefit.rule, note: `CSV 导入：${fileName}` })); notify(`演示导入完成：已写入 ${importable.length} 条，跳过 ${skipped} 条`); router.push("/transactions"); return; }
    if (!file) { notify("请重新选择 CSV 文件"); return; }
    setImporting(true); try { const body = new FormData(); body.append("file", file); body.append("cardId", cardId); body.append("benefitId", benefit.id); body.append("mapping", JSON.stringify(mapping)); const response = await fetch("/api/imports", { method: "POST", body }); const result = await response.json() as { data?: { imported: number; skipped: number; errors: number }; error?: { message?: string } }; if (!response.ok || !result.data) throw new Error(result.error?.message ?? "导入失败"); await reload(); notify(`导入完成：写入 ${result.data.imported} 条，重复 ${result.data.skipped} 条，错误 ${result.data.errors} 条`); router.push("/transactions"); } catch (error) { notify(error instanceof Error ? error.message : "导入失败"); } finally { setImporting(false); }
  };
  return <><PageTitle eyebrow="CSV IMPORT" title="导入消费记录" description="正式环境会私有保存原始 CSV、记录导入任务，并在服务端校验和去重。" /><div className="steps"><span className={step >= 1 ? "active" : ""}>1 上传文件</span><i /><span className={step >= 2 ? "active" : ""}>2 字段映射</span><i /><span className={step >= 3 ? "active" : ""}>3 预览确认</span></div>{step === 1 && <label className="dropzone"><Upload size={34} /><b>拖放 CSV 文件，或点击选择</b><p>最大 5MB / 5000 行 · UTF-8 · 不接受银行卡完整卡号</p><input type="file" accept=".csv,text/csv" onChange={(e) => void load(e.target.files?.[0])} /></label>}{step === 2 && <section className="form-panel"><div className="panel-head"><h2>{fileName}</h2><span>{Math.max(0, rows.length - 1)} 行预览</span></div><div className="mapping-grid"><Field label="记入信用卡"><select value={cardId} onChange={(e) => { setChosenCard(e.target.value); setChosenBenefit(""); }}>{cards.map((card) => <option key={card.id} value={card.id}>{card.nickname}</option>)}</select></Field><Field label="关联权益"><select value={benefit?.id ?? ""} onChange={(e) => setChosenBenefit(e.target.value)}>{cardBenefits.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>{["消费日期", "商户名称", "消费金额", "优惠金额"].map((field, i) => <Field label={field} key={field}><select value={String(mapping[i])} onChange={(e) => setMapping((old) => old.map((value, index) => index === i ? Number(e.target.value) : value))}>{(rows[0] ?? []).map((header, index) => <option value={index} key={index}>{header || `第 ${index + 1} 列`}</option>)}</select></Field>)}</div><div className="import-checks"><span className="ok"><ShieldCheck size={16} />支持引号、逗号和单元格内换行</span><span className="warning"><Bell size={16} />重复记录会自动跳过</span></div><div className="form-footer"><button className="secondary-btn" onClick={() => setStep(1)}>返回</button><button className="primary-btn" onClick={() => setStep(3)}>检查并预览</button></div></section>}{step === 3 && <section className="panel"><div className="panel-head"><h2>导入前预览</h2><span>{importable.length} 条可导入 · {skipped} 条需跳过</span></div><div className="preview-table">{preview.slice(0, 200).map((row) => <div key={row.index} className={!row.valid || row.duplicate ? "error-row" : ""}><span>{row.date || "日期无效"}</span><span>{row.merchant || "商户缺失"}</span><span>{Number.isFinite(row.amount) ? won(row.amount) : "金额无效"}</span><b>{!row.valid ? "格式错误" : row.duplicate ? "重复" : "可导入"}</b></div>)}</div><div className="form-footer"><button className="secondary-btn" onClick={() => setStep(2)}>返回映射</button><button className="primary-btn" disabled={!importable.length || importing} onClick={() => void confirmImport()}>{importing ? "服务端导入中…" : "确认导入"}</button></div></section>}</>;
}

function CalendarScreen() {
  const { cards, benefits } = useCardWise(); const [now] = useState(() => new Date()); const [cursor, setCursor] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1)); const year = cursor.getFullYear(); const month = cursor.getMonth(); const daysInMonth = new Date(year, month + 1, 0).getDate(); const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const cells = Array.from({ length: 42 }, (_, index) => { const day = index - offset + 1; const date = new Date(year, month, day); return { date, day: date.getDate(), inMonth: day >= 1 && day <= daysInMonth }; });
  const eventsFor = (date: Date) => { const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; const events: string[] = []; if (date.getDate() === 1) events.push("月度额度重置"); benefits.filter((benefit) => benefit.rule.endsAt?.slice(0, 10) === key).forEach((benefit) => events.push(`${benefit.name}到期`)); cards.filter((card) => card.annualFeeMonth === date.getMonth() + 1 && date.getDate() === (card.statementCycleDay ?? 1)).forEach((card) => events.push(`${card.nickname}年费`)); return events; };
  const move = (delta: number) => setCursor(new Date(year, month + delta, 1));
  return <><PageTitle eyebrow="CALENDAR" title={`${year} 年 ${month + 1} 月`} description="权益到期、月度重置和年费事项由你的真实卡片与规则生成。" action={<button className="secondary-btn" onClick={() => setCursor(new Date(now.getFullYear(), now.getMonth(), 1))}>今天</button>} /><section className="calendar panel"><div className="calendar-toolbar"><button className="icon-btn" onClick={() => move(-1)}>‹</button><h2>{month + 1} 月</h2><button className="icon-btn" onClick={() => move(1)}>›</button></div><div className="week-row">{"一二三四五六日".split("").map((d) => <b key={d}>周{d}</b>)}</div><div className="month-grid">{cells.map(({ date, day, inMonth }) => { const events = eventsFor(date); const isToday = date.toDateString() === now.toDateString(); return <div key={date.toISOString()} className={!inMonth ? "muted" : isToday ? "today" : ""}><span>{day}</span>{events.slice(0, 3).map((event) => <small key={event}>{event}</small>)}</div>; })}</div></section><div className="legend"><span><i className="purple" />额度重置</span><span><i className="orange" />权益到期</span><span><i className="pink" />年费提醒</span></div></>;
}

function AnalyticsScreen() {
  const { usages, cards } = useCardWise(); const [now] = useState(() => new Date()); const trend = Array.from({ length: 6 }, (_, i) => { const date = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1); const rows = usages.filter((usage) => { const occurred = new Date(usage.occurredAt); return occurred.getFullYear() === date.getFullYear() && occurred.getMonth() === date.getMonth(); }); return { month: `${date.getMonth() + 1}月`, 节省: rows.reduce((sum, row) => sum + row.discountAmount, 0), 消费: rows.reduce((sum, row) => sum + row.originalAmount, 0) }; }); const total = usages.reduce((sum, usage) => sum + usage.discountAmount, 0); const spend = usages.reduce((sum, usage) => sum + usage.originalAmount, 0); const annualFees = cards.reduce((sum, card) => sum + card.annualFee, 0); const averageRate = spend ? (total / spend) * 100 : 0; const payback = annualFees ? Math.min(999, (total / annualFees) * 100) : 100;
  return <><PageTitle eyebrow="INSIGHTS" title="数据分析" description="所有指标都基于已录入记录，不会生成虚构趋势。" /><div className="metric-grid three"><Metric label="累计优惠价值" value={won(total)} delta={`基于 ${usages.length} 笔记录`} icon={Sparkles} accent /><Metric label="平均优惠率" value={`${averageRate.toFixed(1)}%`} delta={`累计消费 ${won(spend)}`} icon={TrendingUp} /><Metric label="年费回本进度" value={`${payback.toFixed(0)}%`} delta={`${cards.length} 张卡年费合计 ${won(annualFees)}`} icon={Gauge} warn /></div><section className="panel chart-panel big"><div className="panel-head"><h2>近 6 个月优惠趋势</h2><span>优惠金额</span></div>{trend.some((row) => row.节省 > 0) ? <ResponsiveContainer width="100%" height={320}><AreaChart data={trend}><defs><linearGradient id="saving" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#5e4fe7" stopOpacity={0.3}/><stop offset="95%" stopColor="#5e4fe7" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)"/><XAxis dataKey="month" axisLine={false} tickLine={false}/><YAxis hide/><Tooltip formatter={(v) => won(Number(v))}/><Area dataKey="节省" stroke="#5e4fe7" strokeWidth={3} fill="url(#saving)" /></AreaChart></ResponsiveContainer> : <Empty title="还没有趋势数据" body="添加消费记录后，这里会按真实月份展示优惠变化。" />}</section></>;
}

function NotificationsScreen() {
  const { benefits, cards, usages } = useCardWise(); const [now] = useState(() => new Date()); const [dismissed, setDismissed] = useState<string[]>([]); const [enabled, setEnabled] = useState<Record<string, boolean>>({ expiry: true, reset: true, fee: true, threshold: true });
  const [catalogUpdates, setCatalogUpdates] = useState<CatalogUpdate[]>([]); const [catalogUpdateError, setCatalogUpdateError] = useState("");
  useEffect(() => { const controller = new AbortController(); void catalogRequest<CatalogUpdate[]>("/api/card-catalog/updates", { signal: controller.signal }).then(({ data }) => setCatalogUpdates(data)).catch((reason) => { if (!controller.signal.aborted && !(reason instanceof Error && reason.message === "请先登录")) setCatalogUpdateError(reason instanceof Error ? reason.message : "无法读取目录变更"); }); return () => controller.abort(); }, []);
  const acceptCatalogUpdate = async (id: string) => { try { await catalogRequest(`/api/card-catalog/updates/${id}/accept`, { method: "POST", body: "{}" }); setCatalogUpdates((items) => items.filter((item) => item.id !== id)); } catch (reason) { setCatalogUpdateError(reason instanceof Error ? reason.message : "无法应用目录更新"); } };
  const alerts = [...(enabled.expiry ? benefits.filter((benefit) => benefit.rule.endsAt && new Date(benefit.rule.endsAt).getTime() >= now.getTime() && new Date(benefit.rule.endsAt).getTime() - now.getTime() <= 30 * 86400000).map((benefit) => ({ id: `expiry-${benefit.id}`, title: `${benefit.name}即将到期`, body: `权益将在 ${benefit.rule.endsAt?.slice(0, 10)} 到期，请在使用前再次核对发卡机构规则。`, tone: "orange" })) : []), ...(enabled.reset ? benefits.filter((benefit) => benefit.rule.monthlyUsageLimit && summarizeUsage(benefit.id, usages, now).monthlyUsageCount < (benefit.rule.monthlyUsageLimit ?? 0)).map((benefit) => { const remaining = (benefit.rule.monthlyUsageLimit ?? 0) - summarizeUsage(benefit.id, usages, now).monthlyUsageCount; return { id: `reset-${benefit.id}`, title: `${benefit.name}本月还有 ${remaining} 次`, body: "未使用次数将在月末重置；实际可用性仍取决于其他资格条件。", tone: "purple" }; }) : []), ...(enabled.fee ? cards.filter((card) => card.annualFee > 0 && [now.getMonth() + 1, (now.getMonth() + 1) % 12 + 1].includes(card.annualFeeMonth)).map((card) => ({ id: `fee-${card.id}`, title: `${card.nickname}年费提醒`, body: `预计 ${card.annualFeeMonth} 月收取 ${won(card.annualFee)}，请核对实际账单日。`, tone: "pink" })) : []), ...(enabled.threshold ? cards.filter((card) => card.currentQualifyingSpend < card.previousMonthSpend).map((card) => ({ id: `threshold-${card.id}`, title: `${card.nickname}尚未达到本期目标`, body: `按当前记录还差 ${won(card.previousMonthSpend - card.currentQualifyingSpend)}；该金额仅基于手动录入。`, tone: "green" })) : [])].filter((alert) => !dismissed.includes(alert.id));
  return <><PageTitle eyebrow="REMINDERS" title="提醒中心" description="提醒由已录入的卡片、权益规则、目录版本和使用记录生成。" />{catalogUpdateError && <div className="data-status error" role="alert">{catalogUpdateError}</div>}{catalogUpdates.length > 0 && <section className="panel catalog-update-panel"><div className="panel-head"><h2>官方权益资料有新版本</h2><span>{catalogUpdates.length} 项待确认</span></div><div className="review-list">{catalogUpdates.map((update) => { const event = update.catalog_change_events; return <article key={update.id}><div><span className="eyebrow">CATALOG UPDATE</span><h3>{update.credit_cards?.nickname ?? event?.card_catalog?.name_ko ?? "目录卡片"}</h3><p>{event?.catalog_benefits?.name ?? "卡片资料"} 已发布新版本；变化字段：{event?.material_fields?.join("、") || "官方资料"}</p><small>{event?.card_catalog?.source_name} · 未确认前继续使用你原来的规则</small></div><div className="button-row">{event?.card_catalog?.source_url && <a className="secondary-btn" href={event.card_catalog.source_url} target="_blank" rel="noreferrer">核对来源</a>}<button className="primary-btn" onClick={() => void acceptCatalogUpdate(update.id)}>确认用于未来计算</button></div></article>; })}</div></section>}<div className="two-col notifications-layout"><section className="panel"><div className="panel-head"><h2>待处理</h2><span>{alerts.length} 项</span></div>{alerts.length ? <div className="alert-list">{alerts.map((alert) => <article key={alert.id}><i className={alert.tone}><Bell size={18} /></i><div><b>{alert.title}</b><p>{alert.body}</p><small>实时生成 · 仅供参考</small></div><button className="icon-btn" onClick={() => setDismissed([...dismissed, alert.id])} aria-label="忽略提醒"><X size={16} /></button></article>)}</div> : <Empty title="当前没有待处理提醒" body="临近到期、未使用次数、年费和消费门槛会显示在这里。" />}</section><section className="panel"><h2>提醒设置</h2>{Object.entries({ expiry: "权益即将到期", reset: "月度次数即将重置", fee: "年费即将扣款", threshold: "消费尚未达到门槛" }).map(([key, label]) => <label className="toggle-row" key={key}><span>{label}<small>在当前设备即时生效</small></span><input type="checkbox" checked={enabled[key]} onChange={() => setEnabled({ ...enabled, [key]: !enabled[key] })} /><i /></label>)}</section></div></>;
}

function SettingsScreen() {
  const { profile, updateProfile, signOut, demoMode, runtimeConfig } = useCardWise(); const [tab, setTab] = useState("profile"); if (!profile) return <Empty title="正在加载个人设置" body="请稍候，或检查登录状态。" />; return <SettingsEditor key={`${profile.email}-${profile.displayName}`} profile={profile} updateProfile={updateProfile} signOut={signOut} demoMode={demoMode} runtimeConfig={runtimeConfig} tab={tab} setTab={setTab} />;
}

function SettingsEditor({ profile, updateProfile, signOut, demoMode, runtimeConfig, tab, setTab }: { profile: import("../app/providers").UserProfile; updateProfile: (profile: import("../app/providers").UserProfile) => Promise<void>; signOut: () => Promise<void>; demoMode: boolean; runtimeConfig: import("../app/providers").CardWiseRuntimeConfig; tab: string; setTab: (tab: string) => void }) {
  const router = useRouter();
  const [form, setForm] = useState(profile); const [saving, setSaving] = useState(false); const [confirmation, setConfirmation] = useState(""); const [accountBusy, setAccountBusy] = useState(false); const [accountMessage, setAccountMessage] = useState("");
  const save = async () => { setSaving(true); try { await updateProfile(form); } finally { setSaving(false); } };
  const deleteAccount = async () => {
    setAccountBusy(true); setAccountMessage("");
    try {
      const response = await fetch("/api/account/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation }) });
      const result = await response.json() as { data?: { deleted?: boolean }; error?: { message?: string } };
      if (!response.ok || !result.data?.deleted) throw new Error(result.error?.message ?? "账户删除失败");
      if (runtimeConfig.supabaseUrl && runtimeConfig.supabaseAnonKey) await createBrowserClient(runtimeConfig.supabaseUrl, runtimeConfig.supabaseAnonKey).auth.signOut({ scope: "local" });
      router.replace("/login?accountDeleted=1");
    } catch (error) { setAccountMessage(error instanceof Error ? error.message : "账户删除失败"); }
    finally { setAccountBusy(false); }
  };
  // A regular anchor preserves the browser's attachment download response from this Route Handler.
  // eslint-disable-next-line @next/next/no-html-link-for-pages
  const securityPanel = demoMode ? <div className="privacy-box"><ShieldCheck /><div><b>演示会话</b><p>演示数据只存在于当前浏览会话，没有远程账户可导出或删除。</p></div></div> : <><div className="privacy-box"><ShieldCheck /><div><b>敏感信息保护</b><p>CardWise 不收集完整卡号、CVC、银行卡密码、有效期或支付验证码。</p></div></div><div className="button-row"><a className="secondary-btn" href="/api/account/export"><Download size={16} />导出我的数据</a><button className="secondary-btn" onClick={() => void signOut()}>安全退出登录</button></div><section className="danger-zone"><h3>删除账户</h3><p>请先导出数据。删除会清理你的私有文件、Auth 账户与业务数据，完成后无法恢复；管理员必须先转移职责。</p><Field label="二次确认" hint="请输入：删除我的账户"><input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" /></Field>{accountMessage && <p className="form-message" role="alert">{accountMessage}</p>}<button className="danger-btn" disabled={accountBusy || confirmation !== "删除我的账户"} onClick={() => void deleteAccount()}>{accountBusy ? "正在安全删除…" : "永久删除我的账户"}</button></section></>;
  return <><PageTitle eyebrow="PREFERENCES" title="个人设置" description={demoMode ? "演示设置仅保存在当前会话。" : "设置会安全保存到你的 Supabase 账户。"} /><div className="settings-layout"><nav>{[["profile", User, "个人资料"], ["locale", Globe2, "语言与地区"], ["security", ShieldCheck, "安全与隐私"]].map(([key, Icon, label]) => { const C = Icon as LucideIcon; return <button key={String(key)} className={tab === key ? "active" : ""} onClick={() => setTab(String(key))}><C size={18} />{String(label)}</button>; })}</nav><section className="form-panel settings-panel"><h2>{tab === "locale" ? "语言与地区" : tab === "security" ? "安全与隐私" : "个人资料"}</h2><div className="form-grid">{tab === "locale" ? <><Field label="默认语言"><select value={form.defaultLanguage} onChange={(e) => setForm({ ...form, defaultLanguage: e.target.value as typeof form.defaultLanguage })}><option value="zh-CN">简体中文</option><option value="ko-KR">한국어</option><option value="en">English</option></select></Field><Field label="默认货币"><select value={form.defaultCurrency} onChange={(e) => setForm({ ...form, defaultCurrency: e.target.value })}><option>KRW</option><option>CNY</option><option>USD</option><option>JPY</option><option>EUR</option></select></Field><Field label="默认时区"><select value={form.defaultTimezone} onChange={(e) => setForm({ ...form, defaultTimezone: e.target.value as typeof form.defaultTimezone })}><option>Asia/Seoul</option><option>Asia/Shanghai</option><option>UTC</option></select></Field><label className="toggle-row"><span>邮件提醒<small>需要另外配置邮件发送适配器</small></span><input type="checkbox" checked={form.emailNotifications} onChange={(e) => setForm({ ...form, emailNotifications: e.target.checked })} /><i /></label></> : tab === "security" ? securityPanel : <><Field label="显示名称"><input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} /></Field><Field label="邮箱"><input value={form.email} disabled /></Field></>} </div>{tab !== "security" && <div className="form-footer"><button className="primary-btn" disabled={saving || !form.displayName.trim()} onClick={() => void save()}>{saving ? "保存中…" : "保存设置"}</button></div>}</section></div></>;
}

function HelpScreen() {
  const [open, setOpen] = useState(0); const faqs = [{ q: "CardWise 会自动获取真实刷卡记录吗？", a: "第一版不会。你需要手动录入或通过 CSV 导入；未接入银行 API 时系统不会假装拥有真实交易。" }, { q: "为什么计算结果可能与账单不同？", a: "结果基于你录入的数据和确认的结构化规则。税费、礼品卡、特定商品或银行清算时间都可能影响实际优惠。" }, { q: "演示数据是真实银行产品吗？", a: "不是。A—E 信用卡和全部权益都明确标注为演示模板，只用于测试计算流程。" }, { q: "如何保证其他用户看不到我的数据？", a: "正式环境使用 Supabase Auth 与逐表 RLS。每个查询仍在服务端校验 user_id，避免 IDOR 越权。" }];
  return <><PageTitle eyebrow="HELP CENTER" title="如何更聪明地使用每一张卡" description="快速了解数据准确性、额度计算与隐私保护。" /><label className="help-search"><Search /><input placeholder="搜索帮助主题" /></label><div className="help-grid"><section className="panel"><h2>常见问题</h2>{faqs.map((f, i) => <button className="faq" key={f.q} onClick={() => setOpen(open === i ? -1 : i)}><span><b>{f.q}</b>{open === i && <p>{f.a}</p>}</span><ChevronDown size={18} /></button>)}</section><aside className="support-card"><Sparkles /><h2>需要开始使用？</h2><p>先添加信用卡，再录入每项权益的结构化规则。你也可以直接体验演示数据。</p><Link href="/cards/new" className="primary-btn">添加第一张卡</Link></aside></div></>;
}

const authErrorMessage = (error: unknown) => {
  const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  if (["invalid_credentials", "user_not_found"].includes(code)) return "邮箱或密码不正确。";
  if (code === "email_not_confirmed") return "请先通过邮箱中的链接完成验证。";
  if (["user_already_exists", "email_exists"].includes(code)) return "该邮箱已注册，请直接登录或重置密码。";
  if (code === "signup_disabled") return "当前暂未开放新用户注册。";
  if (["over_email_send_rate_limit", "email_rate_limit_exceeded"].includes(code)) return "邮件发送过于频繁，请稍后再试。";
  if (code === "weak_password") return "密码强度不足，请至少使用 8 位并避免常见密码。";
  if (code === "same_password") return "新密码不能与当前密码相同。";
  return "认证请求失败，请稍后再试。";
};

const authCallbackUrl = (next: string) => {
  const url = new URL("/auth/callback", location.origin);
  url.searchParams.set("next", next);
  return url.toString();
};

function AuthLayout({ children }: { children: React.ReactNode }) {
  return <main className="auth-page"><section className="auth-brand"><div className="brand light-brand"><span className="brand-mark"><CreditCardIcon size={21} /></span><span>CardWise</span></div><div><span className="eyebrow light">YOUR BENEFITS, CLEARLY</span><h1>每一项权益，<br />都不该被忘记。</h1><p>追踪信用卡优惠额度与使用次数，在每次消费前找到更合适的卡。</p><div className="auth-art"><CreditCardVisual card={{ id: "auth", issuer: "CardWise", name: "Benefit Manager", nickname: "MY SMART CARD", network: "Visa", lastFour: "2026", color: "linear-gradient(135deg,#7f70ff,#4638ce)", isFavorite: true, isActive: true, annualFee: 0, annualFeeMonth: 1, openedAt: today(), previousMonthSpend: 0, currentQualifyingSpend: 0 }} /><div className="floating-saving"><Sparkles size={18} /><span>本月已节省<strong>₩105,300</strong></span></div></div></div><small>演示数据不代表任何真实银行产品</small></section><section className="auth-form-wrap">{children}</section></main>;
}

function AuthScreen({ register: isRegister }: { register: boolean }) {
  const router = useRouter(); const searchParams = useSearchParams(); const { runtimeConfig, demoMode, configurationMissing } = useCardWise(); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [message, setMessage] = useState(""); const [loading, setLoading] = useState(false); const configured = Boolean(runtimeConfig.supabaseUrl && runtimeConfig.supabaseAnonKey);
  const nextValue = searchParams.get("next"); const next = nextValue?.startsWith("/") && !nextValue.startsWith("//") ? nextValue : "/dashboard";
  const queryMessage = searchParams.get("accountDeleted") === "1" ? "账户及个人数据已删除。" : searchParams.get("error") === "auth_callback_failed" ? "登录链接无效或已过期，请重新请求。" : searchParams.get("error") === "configuration_required" ? "生产环境尚未配置认证服务。" : "";
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setLoading(true); setMessage("");
    try {
      if (demoMode) { router.push("/dashboard"); return; }
      if (!configured) { setMessage("认证服务尚未配置，请联系站点管理员。"); return; }
      const supabase = createBrowserClient(runtimeConfig.supabaseUrl!, runtimeConfig.supabaseAnonKey!);
      if (isRegister) {
        const result = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: authCallbackUrl(next) } });
        if (result.error) throw result.error;
        if (!result.data.session) { setMessage("注册成功，请检查邮箱并完成验证后登录。"); return; }
      } else {
        const result = await supabase.auth.signInWithPassword({ email, password });
        if (result.error) throw result.error;
      }
      router.replace(next);
    } catch (error) { setMessage(authErrorMessage(error)); }
    finally { setLoading(false); }
  };
  const magic = async () => {
    if (!configured || !email.trim()) { setMessage("请先填写有效邮箱。"); return; }
    setLoading(true); setMessage("");
    try {
      const supabase = createBrowserClient(runtimeConfig.supabaseUrl!, runtimeConfig.supabaseAnonKey!);
      const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: authCallbackUrl(next) } });
      if (error) throw error;
      setMessage("登录链接已发送，请检查邮箱。");
    } catch (error) { setMessage(authErrorMessage(error)); }
    finally { setLoading(false); }
  };
  return <AuthLayout><form className="auth-form" onSubmit={submit}><span className="eyebrow">WELCOME</span><h2>{isRegister ? "创建 CardWise 账户" : "欢迎回来"}</h2><p>{isRegister ? "开始管理属于你的信用卡权益。" : "登录后继续管理你的权益与额度。"}</p>{demoMode && <div className="demo-callout"><Sparkles size={17} /><span>当前为明确启用的演示模式，数据不会写入远程数据库。</span></div>}{configurationMissing && <div className="demo-callout warning"><Bell size={17} /><span>生产认证服务尚未配置，演示数据不会自动加载。</span></div>}<Field label="邮箱"><input type="email" required={configured} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" /></Field><Field label="密码"><input type="password" required={configured} minLength={configured ? 8 : undefined} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="至少 8 位" autoComplete={isRegister ? "new-password" : "current-password"} /></Field>{(message || queryMessage) && <p className="form-message" role="status">{message || queryMessage}</p>}<button className="primary-btn wide" disabled={loading || configurationMissing}>{loading ? "请稍候…" : isRegister ? "注册账户" : configured ? "登录" : demoMode ? "进入演示模式" : "等待管理员配置"}</button>{configured && <><button type="button" className="secondary-btn wide" disabled={loading} onClick={() => void magic()}>使用 Magic Link</button><Link className="auth-text-link" href="/forgot-password">忘记密码？</Link></>}<p className="auth-switch">{isRegister ? "已经有账户？" : "还没有账户？"}<Link href={isRegister ? "/login" : "/register"}>{isRegister ? "立即登录" : "免费注册"}</Link></p></form></AuthLayout>;
}

function ForgotPasswordScreen() {
  const { runtimeConfig } = useCardWise(); const [email, setEmail] = useState(""); const [message, setMessage] = useState(""); const [loading, setLoading] = useState(false); const configured = Boolean(runtimeConfig.supabaseUrl && runtimeConfig.supabaseAnonKey);
  const submit = async (event: FormEvent) => { event.preventDefault(); if (!configured) { setMessage("认证服务尚未配置。"); return; } setLoading(true); setMessage(""); try { const supabase = createBrowserClient(runtimeConfig.supabaseUrl!, runtimeConfig.supabaseAnonKey!); const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: authCallbackUrl("/reset-password") }); if (error) throw error; setMessage("如果该邮箱已注册，将收到密码重置链接。"); } catch (error) { setMessage(authErrorMessage(error)); } finally { setLoading(false); } };
  return <AuthLayout><form className="auth-form" onSubmit={submit}><span className="eyebrow">ACCOUNT RECOVERY</span><h2>重置密码</h2><p>我们只会向已注册邮箱发送一次性重置链接。</p><Field label="邮箱"><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></Field>{message && <p className="form-message" role="status">{message}</p>}<button className="primary-btn wide" disabled={loading || !configured}>{loading ? "正在发送…" : "发送重置链接"}</button><p className="auth-switch"><Link href="/login">返回登录</Link></p></form></AuthLayout>;
}

function ResetPasswordScreen() {
  const router = useRouter(); const { runtimeConfig } = useCardWise(); const [password, setPassword] = useState(""); const [message, setMessage] = useState(""); const [loading, setLoading] = useState(false);
  const submit = async (event: FormEvent) => { event.preventDefault(); if (!runtimeConfig.supabaseUrl || !runtimeConfig.supabaseAnonKey) return; setLoading(true); setMessage(""); try { const supabase = createBrowserClient(runtimeConfig.supabaseUrl, runtimeConfig.supabaseAnonKey); const { error } = await supabase.auth.updateUser({ password }); if (error) throw error; router.replace("/dashboard"); } catch (error) { setMessage(authErrorMessage(error)); } finally { setLoading(false); } };
  return <AuthLayout><form className="auth-form" onSubmit={submit}><span className="eyebrow">NEW PASSWORD</span><h2>设置新密码</h2><p>新密码至少 8 位，更新后当前安全会话会继续有效。</p><Field label="新密码"><input type="password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" /></Field>{message && <p className="form-message" role="alert">{message}</p>}<button className="primary-btn wide" disabled={loading}>{loading ? "正在更新…" : "更新密码"}</button></form></AuthLayout>;
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) { return <label className={error ? "field error" : "field"}><span>{label}{hint && <small>{hint}</small>}</span>{children}{error && <em>{error}</em>}</label>; }
function Empty({ title, body }: { title: string; body: string }) { return <div className="empty"><span><CreditCardIcon /></span><h3>{title}</h3><p>{body}</p></div>; }
function ConfirmDialog({ title, body, onCancel, onConfirm }: { title: string; body: string; onCancel: () => void; onConfirm: () => void }) { return <div className="modal-wrap"><div className="modal"><span className="danger-icon"><Trash2 /></span><h2>{title}</h2><p>{body}</p><div className="button-row"><button className="secondary-btn" onClick={onCancel}>取消</button><button className="danger-btn" onClick={onConfirm}>确认删除</button></div></div></div>; }
