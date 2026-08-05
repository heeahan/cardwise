"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useSyncExternalStore, type FormEvent } from "react";
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
import { creditCardInputSchema, type CreditCardInput } from "../lib/benefit-engine/schemas";
import type { Benefit, BenefitUsage, CreditCard, PurchaseScenario } from "../lib/benefit-engine/types";
import { categories } from "../lib/data/demo";

const KRW = new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 });
const won = (value: number) => KRW.format(value);
const today = () => new Date().toISOString().slice(0, 10);
const subscribeToHydration = () => () => undefined;

const navItems: Array<{ href: string; label: string; icon: LucideIcon }> = [
  { href: "/dashboard", label: "æ¦‚è§ˆ", icon: LayoutDashboard }, { href: "/cards", label: "æˆ‘çš„å¡ç‰‡", icon: WalletCards },
  { href: "/benefits", label: "æƒç›Šä¸­å¿ƒ", icon: Tag }, { href: "/recommend", label: "è¯¥åˆ·å“ªå¼ å¡", icon: Sparkles },
  { href: "/transactions", label: "æ¶ˆè´¹è®°å½•", icon: CreditCardIcon }, { href: "/calendar", label: "æƒç›Šæ—¥å†", icon: CalendarDays },
  { href: "/analytics", label: "æ•°æ®åˆ†æ", icon: TrendingUp }, { href: "/notifications", label: "æé†’", icon: Bell },
];

const categoryIcons: Record<string, LucideIcon> = { å’–å•¡: Coffee, é¤é¥®: Utensils, åŠ æ²¹: Fuel, ç½‘è´­: ShoppingBag, é…’åº—ä»£å®¢æ³Šè½¦: Hotel, æœºåœºè´µå®¾å…: Globe2 };

export function CardWiseApp() {
  const pathname = usePathname();
  const hydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  return <div data-hydrated={hydrated ? "true" : "false"}>{pathname === "/login" || pathname === "/register" ? <AuthScreen register={pathname === "/register"} /> : <AppShell pathname={pathname}><RouteContent pathname={pathname} /></AppShell>}</div>;
}

function AppShell({ pathname, children }: { pathname: string; children: React.ReactNode }) {
  const { demoMode, loading, dataError, reload, toast, clearToast } = useCardWise();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(false);
  return (
    <div className={dark ? "app dark" : "app"}>
      <aside className={mobileOpen ? "sidebar open" : "sidebar"}>
        <div className="brand"><span className="brand-mark"><CreditCardIcon size={21} /></span><span>CardWise</span><button className="icon-btn close-mobile" onClick={() => setMobileOpen(false)} aria-label="å…³é—­èœå•"><X size={20} /></button></div>
        <nav className="main-nav" aria-label="ä¸»è¦å¯¼èˆª">
          {navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={pathname.startsWith(href) ? "nav-item active" : "nav-item"} onClick={() => setMobileOpen(false)}><Icon size={19} /><span>{label}</span>{href === "/notifications" && <span className="nav-badge">3</span>}</Link>)}
        </nav>
        <div className="sidebar-bottom">
          <Link href="/settings" className={pathname.startsWith("/settings") ? "nav-item active" : "nav-item"}><Settings size={19} />è®¾ç½®</Link>
          <Link href="/help" className={pathname.startsWith("/help") ? "nav-item active" : "nav-item"}><CircleHelp size={19} />å¸®åŠ©ä¸­å¿ƒ</Link>
          <div className="profile-mini"><span className="avatar">CW</span><span><b>æ¼”ç¤ºç”¨æˆ·</b><small>KRW Â· é¦–å°”</small></span><MoreHorizontal size={18} /></div>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setMobileOpen(true)} aria-label="æ‰“å¼€èœå•"><Menu size={20} /></button>
          {demoMode && <span className="demo-pill"><span />æ¼”ç¤ºæ¨¡å¼ Â· æ•°æ®ä»…ä¿å­˜åœ¨æœ¬æ¬¡æµè§ˆ</span>}
          <div className="top-actions"><button className="icon-btn" onClick={() => setDark((v) => !v)} aria-label="åˆ‡æ¢æ·±è‰²æ¨¡å¼">{dark ? <Sun size={19} /> : <Moon size={19} />}</button><Link href="/notifications" className="icon-btn"><Bell size={19} /><i /></Link><span className="avatar small">CW</span></div>
        </header>
        <main className="content">
          {loading && <div className="data-status" role="status">æ­£åœ¨å®‰å…¨åŠ è½½ä½ çš„æ•°æ®â€¦</div>}
          {dataError && <div className="data-status error" role="alert"><span>{dataError}</span><button onClick={() => void reload()}>é‡è¯•</button></div>}
          {children}
        </main>
        <footer className="disclaimer"><ShieldCheck size={15} />æœ¬ç½‘ç«™æä¾›çš„ä¼˜æƒ è®¡ç®—ä»…ä¾›å‚è€ƒï¼Œå®é™…ä¼˜æƒ ä»¥å‘å¡æœºæ„å…¬å‘ŠåŠè´¦å•ä¸ºå‡†ã€‚</footer>
      </div>
      <nav className="mobile-nav">{navItems.slice(0, 5).map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={pathname.startsWith(href) ? "active" : ""}><Icon size={19} /><small>{label}</small></Link>)}</nav>
      {toast && <button className="toast" onClick={clearToast}><ShieldCheck size={18} />{toast}<X size={16} /></button>}
      {mobileOpen && <button className="scrim" onClick={() => setMobileOpen(false)} aria-label="å…³é—­èœå•" />}
    </div>
  );
}

function RouteContent({ pathname }: { pathname: string }) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "cards") {
    if (parts[1] === "new") return <CardForm />;
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
    return <TransactionsScreen />;
  }
  if (parts[0] === "recommend") return <RecommendScreen />;
  if (parts[0] === "calendar") return <CalendarScreen />;
  if (parts[0] === "analytics") return <AnalyticsScreen />;
  if (parts[0] === "notifications") return <NotificationsScreen />;
  if (parts[0] === "settings") return <SettingsScreen />;
  if (parts[0] === "help") return <HelpScreen />;
  return <Dashboard />;
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
  const chartData = categories.slice(0, 8).map((name) => ({ name, ä¼˜æƒ : monthly.filter((u) => u.category === name).reduce((s, u) => s + u.discountAmount, 0) })).filter((d) => d.ä¼˜æƒ  > 0);
  const cardChart = cards.map((card) => ({ name: card.nickname, value: monthly.filter((u) => u.cardId === card.id).reduce((s, u) => s + u.discountAmount, 0) })).filter((d) => d.value > 0);
  const search = (e: FormEvent) => { e.preventDefault(); router.push(`/recommend?q=${encodeURIComponent(query || "æ˜Ÿå·´å…‹")}`); };
  return <>
    <section className="hero-panel">
      <div className="hero-copy"><span className="eyebrow light">SMARTER SPENDING</span><h1>ä»Šå¤©åœ¨å“ªé‡Œæ¶ˆè´¹ï¼Ÿ<br />å¸®ä½ æ‰¾åˆ°æœ€åˆ’ç®—çš„ä¿¡ç”¨å¡</h1><p>è¾“å…¥å•†æˆ·æˆ–åœºæ™¯ï¼ŒCardWise ä¼šæ ¹æ®é—¨æ§›ã€å‰©ä½™é¢åº¦ä¸æ¬¡æ•°ç»™å‡ºå¯è§£é‡Šçš„å‰ä¸‰åæ¨èã€‚</p></div>
      <form className="hero-search" onSubmit={search}><Search size={21} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ä¾‹å¦‚ï¼šæ˜Ÿå·´å…‹ã€å‘¨æœ«é¤å…ã€é…’åº—åœè½¦" aria-label="æœç´¢æ¶ˆè´¹åœºæ™¯" /><button>æ™ºèƒ½æ¨è <ChevronRight size={18} /></button></form>
      <div className="quick-links"><span>å¿«é€ŸæŸ¥è¯¢</span>{[{ n: "æ˜Ÿå·´å…‹", i: Coffee }, { n: "é¤å…", i: Utensils }, { n: "åŠ æ²¹", i: Fuel }, { n: "é…’åº—åœè½¦", i: Hotel }, { n: "æœºåœºè´µå®¾å…", i: Globe2 }, { n: "ç½‘è´­", i: ShoppingBag }].map(({ n, i: Icon }) => <button key={n} onClick={() => router.push(`/recommend?q=${encodeURIComponent(n)}`)}><Icon size={15} />{n}</button>)}</div>
    </section>
    <section className="metric-grid">
      <Metric label="æœ¬æœˆæ¶ˆè´¹" value={won(totalSpend)} delta="è¾ƒä¸Šæœˆ +8.2%" icon={Gauge} />
      <Metric label="æœ¬æœˆè·å¾—ä¼˜æƒ " value={won(saved)} delta="å·²è®°å½• 6 ç¬”" icon={Sparkles} accent />
      <Metric label="æœ‰æ•ˆä¿¡ç”¨å¡" value={`${cards.filter((c) => c.isActive).length} å¼ `} delta={`${benefits.length} é¡¹æœ‰æ•ˆæƒç›Š`} icon={WalletCards} />
      <Metric label="å¾…å¤„ç†æé†’" value="3 é¡¹" delta="1 é¡¹æƒç›Šå³å°†åˆ°æœŸ" icon={Bell} warn />
    </section>
    <section className="section-head"><div><span className="eyebrow">MY WALLET</span><h2>æˆ‘çš„å¸¸ç”¨å¡ç‰‡</h2></div><Link href="/cards">æŸ¥çœ‹å…¨éƒ¨ <ChevronRight size={16} /></Link></section>
    <div className="card-strip">{cards.slice(0, 3).map((card) => <CreditCardVisual key={card.id} card={card} />)}<Link href="/cards/new" className="add-card-tile"><Plus /><b>æ·»åŠ ä¿¡ç”¨å¡</b><small>ä»…éœ€å¡ç‰‡æ˜µç§°å’Œæƒç›Šèµ„æ–™</small></Link></div>
    <div className="two-col dashboard-lower">
      <section className="panel"><div className="panel-head"><div><span className="eyebrow">THIS MONTH</span><h2>å€¼å¾—å…³æ³¨çš„æƒç›Š</h2></div><Link href="/benefits">å…¨éƒ¨æƒç›Š</Link></div><div className="benefit-list">{benefits.slice(0, 4).map((benefit) => <BenefitRow key={benefit.id} benefit={benefit} />)}</div></section>
      <section className="panel"><div className="panel-head"><div><span className="eyebrow">RECENT</span><h2>æœ€è¿‘æ¶ˆè´¹</h2></div><Link href="/transactions">æŸ¥çœ‹è®°å½•</Link></div><div className="activity-list">{usages.slice(0, 5).map((usage) => <ActivityRow key={usage.id} usage={usage} />)}</div></section>
    </div>
    <div className="two-col charts-row">
      <section className="panel chart-panel"><div className="panel-head"><h2>å„åˆ†ç±»ä¼˜æƒ é‡‘é¢</h2><span>æœ¬æœˆ</span></div><ResponsiveContainer width="100%" height={240}><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" /><XAxis dataKey="name" tickLine={false} axisLine={false} /><YAxis hide /><Tooltip formatter={(v) => won(Number(v))} /><Bar dataKey="ä¼˜æƒ " fill="#5e4fe7" radius={[8, 8, 3, 3]} /></BarChart></ResponsiveContainer></section>
      <section className="panel chart-panel"><div className="panel-head"><h2>ä¿¡ç”¨å¡ä¼˜æƒ è´¡çŒ®</h2><span>æœ¬æœˆ</span></div><ResponsiveContainer width="100%" height={240}><PieChart><Pie data={cardChart} dataKey="value" nameKey="name" innerRadius={62} outerRadius={90} paddingAngle={4}>{cardChart.map((_, i) => <Cell key={i} fill={["#5e4fe7", "#18a985", "#f28a4b", "#d94c91"][i % 4]} />)}</Pie><Tooltip formatter={(v) => won(Number(v))} /></PieChart></ResponsiveContainer></section>
    </div>
  </>;
}

function Metric({ label, value, delta, icon: Icon, accent, warn }: { label: string; value: string; delta: string; icon: LucideIcon; accent?: boolean; warn?: boolean }) {
  return <article className={`metric ${accent ? "accent" : ""} ${warn ? "warn" : ""}`}><div><span>{label}</span><strong>{value}</strong><small>{delta}</small></div><i><Icon size={20} /></i></article>;
}

function CreditCardVisual({ card, compact = false }: { card: CreditCard; compact?: boolean }) {
  return <Link href={`/cards/${card.id}`} className={compact ? "credit-card compact" : "credit-card"} style={{ background: card.color }}><div className="card-top"><span>{card.issuer}</span>{card.isFavorite && <Star size={17} fill="currentColor" />}</div><div className="chip" /><div className="card-bottom"><div><small>{card.nickname}</small><b>â€¢â€¢â€¢â€¢ {card.lastFour ?? "â€”"}</b></div><strong>{card.network}</strong></div></Link>;
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
  const remaining = cap !== undefined ? won(Math.max(0, cap - usage.monthlyDiscountUsed)) : limit !== undefined ? `${Math.max(0, limit - usedCount)} æ¬¡` : "æ— é™é¢";
  return <Link href={`/benefits/${benefit.id}`} className="benefit-row"><span className="category-icon"><Icon size={19} /></span><div className="benefit-main"><div><b>{benefit.name}</b><small>{card.nickname} Â· {benefit.category}</small></div><div className="progress"><i style={{ width: `${progress}%` }} /></div></div><div className="benefit-remaining"><small>å‰©ä½™</small><strong>{remaining}</strong></div><ChevronRight size={17} /></Link>;
}

function ActivityRow({ usage }: { usage: BenefitUsage }) {
  const { cards } = useCardWise(); const card = cards.find((c) => c.id === usage.cardId); const Icon = categoryIcons[usage.category] ?? ShoppingBag;
  return <div className="activity"><span className="category-icon soft"><Icon size={18} /></span><div><b>{usage.merchantName}</b><small>{new Date÷O6¶‰ËkºwµçyÁÕĞÑåÁ”ô‰™¥±”ˆ…•ÁĞôˆ¹ÍØ±Ñ•áĞ½ÍØˆ½¹¡…¹”õì¡”¤€ôøÙ½¥±½…¡”¹Ñ…É•Ğ¹™¥±•Ìü¹lÁt¥ô€¼øğ½±…‰•°ùõíÍÑ•À€ôôô€È€˜˜€ñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰™½É´µÁ…¹•°ˆøñ‘¥Ø±…ÍÍ9…µ”ô‰Á…¹•°µ¡•…ˆøñ Èùí™¥±•9…µ•ôğ½ ÈøñÍÁ…¸ùí5…Ñ ¹µ…à À°É½İÌ¹±•¹Ñ €´€Ä¥ôƒ¢†3¦Š¢ ğ½ÍÁ…¸øğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰µ…ÁÁ¥¹œµÉ¥ˆøñ¥•±±…‰•°ô‹¢ºÃ–—’ş‡R£–6„ˆøñÍ•±•ĞÙ…±Õ”õí…É‘%‘ô½¹¡…¹”õì¡”¤€ôøìÍ•Ñ¡½Í•¹…É¡”¹Ñ…É•Ğ¹Ù…±Õ”¤ìÍ•Ñ¡½Í•¹	•¹•™¥Ğ ˆˆ¤ìõôùí…É‘Ì¹µ…À ¡…É¤€ôø€ñ½ÁÑ¥½¸­•äõí…É¹¥‘ôÙ…±Õ”õí…É¹¥‘ôùí…É¹¹¥­¹…µ•ôğ½½ÁÑ¥½¸ø¥ôğ½Í•±•Ğøğ½¥•±øñ¥•±±…‰•°ô‹–Ï¢Sšvn(ˆøñÍ•±•ĞÙ…±Õ”õí‰•¹•™¥Ğü¹¥€üü€ˆ‰ô½¹¡…¹”õì¡”¤€ôøÍ•Ñ¡½Í•¹	•¹•™¥Ğ¡”¹Ñ…É•Ğ¹Ù…±Õ”¥ôùí…É‘	•¹•™¥ÑÌ¹µ…À ¡¥Ñ•´¤€ôø€ñ½ÁÑ¥½¸­•äõí¥Ñ•´¹¥‘ôÙ…±Õ”õí¥Ñ•´¹¥‘ôùí¥Ñ•´¹¹…µ•ôğ½½ÁÑ¥½¸ø¥ôğ½Í•±•Ğøğ½¥•±ùíl‹šÚ#¢Òçš^—šr|ˆ°€‹–Vš"ß–B7Àˆ°€‹šÚ#¢Òç¦G¦Štˆ°€‹’òcšƒ¦G¦Št‰t¹µ…À ¡™¥•±°¤¤€ôø€ñ¥•±±…‰•°õí™¥•±‘ô­•äõí™¥•±‘ôøñÍ•±•ĞÙ…±Õ”õíMÑÉ¥¹œ¡µ…ÁÁ¥¹m¥t¥ô½¹¡…¹”õì¡”¤€ôøÍ•Ñ5…ÁÁ¥¹œ ¡½±¤€ôø½±¹µ…À ¡Ù…±Õ”°¥¹‘•à¤€ôø¥¹‘•à€ôôô¤€ü9Õµ‰•È¡”¹Ñ…É•Ğ¹Ù…±Õ”¤€èÙ…±Õ”¤¥ôùì¡É½İÍlÁt€üümt¤¹µ…À ¡¡•…‘•È°¥¹‘•à¤€ôø€ñ½ÁÑ¥½¸Ù…±Õ”õí¥¹‘•áô­•äõí¥¹‘•áôùí¡•…‘•Èñğƒ²°€‘í¥¹‘•à€¬€Åôƒ–"]ôğ½½ÁÑ¥½¸ø¥ôğ½Í•±•Ğøğ½¥•±ø¥ôğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰¥µÁ½ÉĞµ¡•­ÌˆøñÍÁ…¸±…ÍÍ9…µ”ô‰½¬ˆøñM¡¥•±‘¡•¬Í¥é”õìÄÙô€¼ûšr³–rÃš‚‡¦ª3š^—šr’â;šVÓšVÃ¦G¦Štğ½ÍÁ…¸øñÍÁ…¸±…ÍÍ9…µ”ô‰İ…É¹¥¹œˆøñ	•±°Í¥é”õìÄÙô€¼û¦7–’7¢ºÃ–öW’òk¢«–*£¢ŞÏ¢şğ½ÍÁ…¸øğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰™½É´µ™½½Ñ•Èˆøñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰Í•½¹‘…Éäµ‰Ñ¸ˆ½¹±¥¬õì ¤€ôøÍ•ÑMÑ•À Ä¥ôû¢şS–nxğ½‰ÕÑÑ½¸øñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰ÁÉ¥µ…Éäµ‰Ñ¸ˆ½¹±¥¬õì ¤€ôøÍ•ÑMÑ•À Ì¥ôûšš~—–æÛ¦Š¢ ğ½‰ÕÑÑ½¸øğ½‘¥Øøğ½Í•Ñ¥½¸ùõíÍÑ•À€ôôô€Ì€˜˜€ñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰Á…¹•°ˆøñ‘¥Ø±…ÍÍ9…µ”ô‰Á…¹•°µ¡•…ˆøñ Èû–¾ó–—–&7¦Š¢ ğ½ ÈøñÍÁ…¸ùí¥µÁ½ÉÑ…‰±”¹±•¹Ñ¡ôƒšv‡–>¿–¾ó–”ƒ
ÜíÍ­¥ÁÁ•‘ôƒšv‡¦r¢ŞÏ¢şğ½ÍÁ…¸øğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰ÁÉ•Ù¥•ÜµÑ…‰±”ˆùíÁÉ•Ù¥•Ü¹µ…À ¡É½Ü¤€ôø€ñ‘¥Ø­•äõíÉ½Ü¹¥¹‘•áô±…ÍÍ9…µ”õì…É½Ü¹Ù…±¥ñğÉ½Ü¹‘ÕÁ±¥…Ñ”€ü€‰•ÉÉ½ÈµÉ½Üˆ€è€ˆ‰ôøñÍÁ…¸ùíÉ½Ü¹‘…Ñ”ñğ€‹š^—šrš^ƒšV ‰ôğ½ÍÁ…¸øñÍÁ…¸ùíÉ½Ü¹µ•É¡…¹Ğñğ€‹–Vš"ßòë–’Ä‰ôğ½ÍÁ…¸øñÍÁ…¸ùí9Õµ‰•È¹¥Í¥¹¥Ñ”¡É½Ü¹…µ½Õ¹Ğ¤€üİ½¸¡É½Ü¹…µ½Õ¹Ğ¤€è€‹¦G¦Šwš^ƒšV ‰ôğ½ÍÁ…¸øñˆùì…É½Ü¹Ù…±¥€ü€‹š‚ó–ò?¦Rg¢¾¼ˆ€èÉ½Ü¹‘ÕÁ±¥…Ñ”€ü€‹¦7–’4ˆ€è€‹–>¿–¾ó–”‰ôğ½ˆøğ½‘¥Øø¥ôğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰™½É´µ™½½Ñ•Èˆøñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰Í•½¹‘…Éäµ‰Ñ¸ˆ½¹±¥¬õì ¤€ôøÍ•ÑMÑ•À È¥ôû¢şS–n{šbƒ–Âğ½‰ÕÑÑ½¸øñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰ÁÉ¥µ…Éäµ‰Ñ¸ˆ‘¥Í…‰±•õì…¥µÁ½ÉÑ…‰±”¹±•¹Ñ¡ô½¹±¥¬õí½¹™¥Éµ%µÁ½ÉÑôû†»¢º“–¾ó–”ğ½‰ÕÑÑ½¸øğ½‘¥Øøğ½Í•Ñ¥½¸ùôğ¼øì)ô()™Õ¹Ñ¥½¸…±•¹‘…ÉMÉ••¸ ¤ì(€½¹ÍĞ‘…åÌ€ôÉÉ…ä¹™É½´¡ì±•¹Ñ è€ÌÔô°€¡|°¤¤€ôø¤€´€Ì¤ì½¹ÍĞ•Ù•¹ÑÌèI•½Éñ¹Õµ‰•È°ÍÑÉ¥¹mtø€ôì€Äèl‹šr#–ê›¦Šw–ê›¦7ö¸‰t°€Ôèl‹–F£šr¯¦’C¦–¸€ÄÀ”‰t°€ÄÄèl‹öG¢Ò·¢şS:Ã–"Ãšr|‰t°€Äàèl‹¦K–ê_šÎ+¢ö›š>C¦H‰t°€ÈÔèl‹–æÓ¢Òçš&š²û¦Š–F(‰tôì(€É•ÑÕÉ¸€ğøñA…•Q¥Ñ±”•å•‰É½Üô‰19HˆÑ¥Ñ±”ôˆÈÀÈØƒ–æĞ€àƒšr ˆ‘•ÍÉ¥ÁÑ¥½¸ô‹švn+–"Ãšr¦7ö»–æÓ¢Òç’â;¦r¢šš*—–B7jšÒï–*£¦n’â·–ÆW’ëˆ…Ñ¥½¸õìñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰Í•½¹‘…Éäµ‰Ñ¸ˆû’î+–’¤ğ½‰ÕÑÑ½¸ùô€¼øñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰…±•¹‘…ÈÁ…¹•°ˆøñ‘¥Ø±…ÍÍ9…µ”ô‰…±•¹‘…ÈµÑ½½±‰…Èˆøñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰¥½¸µ‰Ñ¸ˆûŠäğ½‰ÕÑÑ½¸øñ Èû–¯šr ğ½ Èøñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰¥½¸µ‰Ñ¸ˆûŠèğ½‰ÕÑÑ½¸øğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰İ••¬µÉ½Üˆùì‹’â’ê3’â'–no’êS–·š^”ˆ¹ÍÁ±¥Ğ ˆˆ¤¹µ…À ¡¤€ôø€ñˆ­•äõí‘ôû–F¡í‘ôğ½ˆø¥ôğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰µ½¹Ñ µÉ¥ˆùí‘…åÌ¹µ…À ¡‘…ä°¤¤€ôø€ñ‘¥Ø­•äõí¥ô±…ÍÍ9…µ”õí‘…ä€ğ€Äñğ‘…ä€ø€ÌÄ€ü€‰µÕÑ•ˆ€è‘…ä€ôôô€Ğ€ü€‰Ñ½‘…äˆ€è€ˆ‰ôøñÍÁ…¸ùí‘…ä€ğ€Ä€ü€ÌÄ€¬‘…ä€è‘…ä€ø€ÌÄ€ü‘…ä€´€ÌÄ€è‘…åôğ½ÍÁ…¸ùì¡•Ù•¹ÑÍm‘…åt€üümt¤¹µ…À ¡”¤€ôø€ñÍµ…±°­•äõí•ôùí•ôğ½Íµ…±°ø¥ôğ½‘¥Øø¥ôğ½‘¥Øøğ½Í•Ñ¥½¸øñ‘¥Ø±…ÍÍ9…µ”ô‰±••¹ˆøñÍÁ…¸øñ¤±…ÍÍ9…µ”ô‰ÁÕÉÁ±”ˆ€¼û¦Šw–ê›¦7ö¸ğ½ÍÁ…¸øñÍÁ…¸øñ¤±…ÍÍ9…µ”ô‰½É…¹”ˆ€¼û–6Ï–Â–"Ãšr|ğ½ÍÁ…¸øñÍÁ…¸øñ¤±…ÍÍ9…µ”ô‰É••¸ˆ€¼û–>¿R£švn(ğ½ÍÁ…¸øñÍÁ…¸øñ¤±…ÍÍ9…µ”ô‰Á¥¹¬ˆ€¼û–æÓ¢Òçš>C¦Hğ½ÍÁ…¸øğ½‘¥Øøğ¼øì)ô()™Õ¹Ñ¥½¸¹…±åÑ¥ÍMÉ••¸ ¤ì(€½¹ÍĞìÕÍ…•Ìô€ôÕÍ•…É‘]¥Í” ¤ì½¹ÍĞÑÉ•¹€ôÉÉ…ä¹™É½´¡ì±•¹Ñ è€Øô°€¡|°¤¤€ôø€¡ìµ½¹Ñ è€‘í¤€¬€Í÷šr!€°ƒ¢*rè€ÜÀÀÀ€¬¤€¨€ÈÌÀÀ€¬€¡¤€”€È¤€¨€ĞÈÀÀ°ƒšÚ#¢Òäè€ÄàÀÀÀÀ€¬¤€¨€ÌÔÀÀÀô¤¤ì½¹ÍĞÑ½Ñ…°€ôÕÍ…•Ì¹É•‘Õ” ¡Ì°Ô¤€ôøÌ€¬Ô¹‘¥Í½Õ¹Ñµ½Õ¹Ğ°€À¤ì(€É•ÑÕÉ¸€ğøñA…•Q¥Ñ±”•å•‰É½Üô‰%9M%!QLˆÑ¥Ñ±”ô‹šVÃš6»–"šz@ˆ‘•ÍÉ¥ÁÑ¥½¸ô‹’ê¢’òcšƒ¢Ò‡2»švn+’öÿR£:’â;š¾?–òƒ–6‡j–æÓ¢Òç’îß–óˆ€¼øñ‘¥Ø±…ÍÍ9…µ”ô‰µ•ÑÉ¥ŒµÉ¥Ñ¡É•”ˆøñ5•ÑÉ¥Œ±…‰•°ô‹Ò¿¢º‡’òcšƒ’îß–ğˆÙ…±Õ”õíİ½¸¡Ñ½Ñ…°¥ô‘•±Ñ„ô‹–~ë’ê;šòS’ë¢ºÃ–öTˆ¥½¸õíMÁ…É­±•Íô…•¹Ğ€¼øñ5•ÑÉ¥Œ±…‰•°ô‹–æÏ–v’òcšƒ:ˆÙ…±Õ”ôˆÜ¸à”ˆ‘•±Ñ„ô‹¢ú’â+šr €¬Ä¸È”ˆ¥½¸õíQÉ•¹‘¥¹UÁô€¼øñ5•ÑÉ¥Œ±…‰•°ô‹–æÓ¢Òç–n{šr³¢şo–ê˜ˆÙ…±Õ”ôˆĞÈ”ˆ‘•±Ñ„ôˆÔƒ–òƒ–6‡–B#¢º„ˆ¥½¸õí…Õ•ôİ…É¸€¼øğ½‘¥ØøñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰Á…¹•°¡…ÉĞµÁ…¹•°‰¥œˆøñ‘¥Ø±…ÍÍ9…µ”ô‰Á…¹•°µ¡•…ˆøñ Èû¢şD€Øƒ’â«šr#’òcšƒ¢Ú/–*üğ½ Èøñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰™¥±Ñ•Èµ‰Ñ¸ˆû’òcšƒ¦G¦Št€ñ¡•ÙÉ½¹½İ¸Í¥é”õìÄÕô€¼øğ½‰ÕÑÑ½¸øğ½‘¥ØøñI•ÍÁ½¹Í¥Ù•½¹Ñ…¥¹•Èİ¥‘Ñ ôˆÄÀÀ”ˆ¡•¥¡ĞõìÌÈÁôøñÉ•…¡…ÉĞ‘…Ñ„õíÑÉ•¹‘ôøñ‘•™Ìøñ±¥¹•…ÉÉ…‘¥•¹Ğ¥ô‰Í…Ù¥¹œˆàÄôˆÀˆäÄôˆÀˆàÈôˆÀˆäÈôˆÄˆøñÍÑ½À½™™Í•ĞôˆÔ”ˆÍÑ½Á½±½ÈôˆŒÕ”Ñ™”ÜˆÍÑ½Á=Á…¥ÑäõìÀ¸Íô¼øñÍÑ½À½™™Í•ĞôˆäÔ”ˆÍÑ½Á½±½ÈôˆŒÕ”Ñ™”ÜˆÍÑ½Á=Á…¥ÑäõìÁô¼øğ½±¥¹•…ÉÉ…‘¥•¹Ğøğ½‘•™Ìøñ…ÉÑ•Í¥…¹É¥ÍÑÉ½­•…Í¡…ÉÉ…äôˆÌ€ÌˆÙ•ÉÑ¥…°õí™…±Í•ôÍÑÉ½­”ô‰Ù…È ´µ±¥¹”¤ˆ¼øñaá¥Ì‘…Ñ…-•äô‰µ½¹Ñ ˆ…á¥Í1¥¹”õí™…±Í•ôÑ¥­1¥¹”õí™…±Í•ô¼øñeá¥Ì¡¥‘”¼øñQ½½±Ñ¥À™½Éµ…ÑÑ•Èõì¡Ø¤€ôøİ½¸¡9Õµ‰•È¡Ø¤¥ô¼øñÉ•„‘…Ñ…-•äô‹¢*rˆÍÑÉ½­”ôˆŒÕ”Ñ™”ÜˆÍÑÉ½­•]¥‘Ñ õìÍô™¥±°ô‰ÕÉ° Í…Ù¥¹œ¤ˆ€¼øğ½É•…¡…ÉĞøğ½I•ÍÁ½¹Í¥Ù•½¹Ñ…¥¹•Èøğ½Í•Ñ¥½¸øğ¼øì)ô()™Õ¹Ñ¥½¸9½Ñ¥™¥…Ñ¥½¹ÍMÉ••¸ ¤ì(€½¹ÍĞm•¹…‰±•°Í•Ñ¹…‰±•‘t€ôÕÍ•MÑ…Ñ”ñI•½ÉñÍÑÉ¥¹œ°‰½½±•…¸øø¡ì•áÁ¥ÉäèÑÉÕ”°É•Í•ĞèÑÉÕ”°™•”èÑÉÕ”°Ñ¡É•Í¡½±è™…±Í”ô¤ì(€½¹ÍĞ…±•ÉÑÌ€ômìÑ¥Ñ±”è€‹öG¢Ò´€Ô”ƒ¢şS:Ã–6Ï–Â–"Ãšr|ˆ°‰½‘äè€‰’ş‡R£–6‡švn+–Â–r €Üƒ–’§–B;–"Ãšr¾ò3šr³šr#’î7šr$ƒŠ
¤ÄÔ°ÜÀÀƒ¦Šw–ê›ˆ°Ñ½¹”è€‰½É…¹”ˆô°ìÑ¥Ñ±”è€‹¦K–ê_’î–º‹šÎ+¢ö›šr³šr#–Âkšr«’öÿR ˆ°‰½‘äè€‰’ş‡R£–6‡’î7šr$€Äƒš²‡–>¿R£¾ò3¦Šw–ê›–Â–r£šr#šr¯¦7ö»ˆ°Ñ½¹”è€‰ÁÕÉÁ±”ˆô°ìÑ¥Ñ±”è€‰’ş‡R£–6‡¢ŞwšïšÚ#¢Òç¦^£šo¢şc–Ş¸ƒŠ
¤ÌÈ°ÀÀÀˆ°‰½‘äè€‹¢úû–"ÀƒŠ
¤ÌÀÀ°ÀÀÀƒ–B;¾ò3’â/šr#–>¿îŸî·’öÿR£–J[–V‡švn+ˆ°Ñ½¹”è€‰É••¸ˆõtì(€É•ÑÕÉ¸€ğøñA…•Q¥Ñ±”•å•‰É½Üô‰I5%9ILˆÑ¥Ñ±”ô‹š>C¦K’â·–şˆ‘•ÍÉ¥ÁÑ¥½¸ô‹®g–š>C¦K–ŞË–B¿R£¾òo¦
»’îÛš>C¦K¦¦7–f£¦îc¢º“–Ï¦^·’âS’â7’òk–öÇ–N7–Û’î[–*¢÷ˆ€¼øñ‘¥Ø±…ÍÍ9…µ”ô‰Ñİ¼µ½°¹½Ñ¥™¥…Ñ¥½¹Ìµ±…å½ÕĞˆøñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰Á…¹•°ˆøñ‘¥Ø±…ÍÍ9…µ”ô‰Á…¹•°µ¡•…ˆøñ Èû–ú–’Bğ½ ÈøñÍÁ…¸øÌƒ¦†äğ½ÍÁ…¸øğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰…±•ÉĞµ±¥ÍĞˆùí…±•ÉÑÌ¹µ…À ¡„¤€ôø€ñ…ÉÑ¥±”­•äõí„¹Ñ¥Ñ±•ôøñ¤±…ÍÍ9…µ”õí„¹Ñ½¹•ôøñ	•±°Í¥é”õìÄáô€¼øğ½¤øñ‘¥Øøñˆùí„¹Ñ¥Ñ±•ôğ½ˆøñÀùí„¹‰½‘åôğ½ÀøñÍµ…±°û’î+–’¤ƒ
ÜƒšòS’ëš>C¦Hğ½Íµ…±°øğ½‘¥Øøñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰¥½¸µ‰Ñ¸ˆøñ`Í¥é”õìÄÙô€¼øğ½‰ÕÑÑ½¸øğ½…ÉÑ¥±”ø¥ôğ½‘¥Øøğ½Í•Ñ¥½¸øñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰Á…¹•°ˆøñ Èûš>C¦K¢ºûö¸ğ½ Èùí=‰©•Ğ¹•¹ÑÉ¥•Ì¡ì•áÁ¥Éäè€‹švn+–6Ï–Â–"Ãšr|ˆ°É•Í•Ğè€‹šr#–ê›¦Šw–ê›–6Ï–Â¦7ö¸ˆ°™•”è€‹–æÓ¢Òç–6Ï–Âš&š²øˆ°Ñ¡É•Í¡½±è€‹šÚ#¢Òçš:—¢şG¦^£šlˆô¤¹µ…À ¡m­•ä°±…‰•±t¤€ôø€ñ±…‰•°±…ÍÍ9…µ”ô‰Ñ½±”µÉ½Üˆ­•äõí­•åôøñÍÁ…¸ùí±…‰•±ôñÍµ…±°ûš>C–&4€Üƒ–’§š>C¦Hğ½Íµ…±°øğ½ÍÁ…¸øñ¥¹ÁÕĞÑåÁ”ô‰¡•­‰½àˆ¡•­•õí•¹…‰±•‘m­•åuô½¹¡…¹”õì ¤€ôøÍ•Ñ¹…‰±•¡ì€¸¸¹•¹…‰±•°m­•åtè€…•¹…‰±•‘m­•åtô¥ô€¼øñ¤€¼øğ½±…‰•°ø¥ôğ½Í•Ñ¥½¸øğ½‘¥Øøğ¼øì)ô()™Õ¹Ñ¥½¸M•ÑÑ¥¹ÍMÉ••¸ ¤ì(€½¹ÍĞì¹½Ñ¥™äô€ôÕÍ•…É‘]¥Í” ¤ì½¹ÍĞmÑ…ˆ°Í•ÑQ…‰t€ôÕÍ•MÑ…Ñ” ‰ÁÉ½™¥±”ˆ¤ìÉ•ÑÕÉ¸€ğøñA…•Q¥Ñ±”•å•‰É½Üô‰AII9LˆÑ¥Ñ±”ô‹’â«’êë¢ºûö¸ˆ‘•ÍÉ¥ÁÑ¥½¸ô‹¢ºûö»¢¾·¢¢¢ÒŸ–âš^Û–2ë’â;šVÃš6»¦jCˆ€¼øñ‘¥Ø±…ÍÍ9…µ”ô‰Í•ÑÑ¥¹Ìµ±…å½ÕĞˆøñ¹…Øùíml‰ÁÉ½™¥±”ˆ°UÍ•È°€‹’â«’êë¢ÖšZd‰t°l‰±½…±”ˆ°±½‰”È°€‹¢¾·¢¢’â;–rÃ–2è‰t°l‰Í•ÕÉ¥Ñäˆ°M¡¥•±‘¡•¬°€‹–º'–£’â;¦jC‰t°l‰…ÁÁ•…É…¹”ˆ°5½½¸°€‹–’[¢‰ut¹µ…À ¡m­•ä°%½¸°±…‰•±t¤€ôøì½¹ÍĞ€ô%½¸…Ì1Õ¥‘•%½¸ìÉ•ÑÕÉ¸€ñ‰ÕÑÑ½¸­•äõíMÑÉ¥¹œ¡­•ä¥ô±…ÍÍ9…µ”õíÑ…ˆ€ôôô­•ä€ü€‰…Ñ¥Ù”ˆ€è€ˆ‰ô½¹±¥¬õì ¤€ôøÍ•ÑQ…ˆ¡MÑÉ¥¹œ¡­•ä¤¥ôøñÍ¥é”õìÄáô€¼ùíMÑÉ¥¹œ¡±…‰•°¥ôğ½‰ÕÑÑ½¸øìô¥ôğ½¹…ØøñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰™½É´µÁ…¹•°Í•ÑÑ¥¹ÌµÁ…¹•°ˆøñ ÈùíÑ…ˆ€ôôô€‰±½…±”ˆ€ü€‹¢¾·¢¢’â;–rÃ–2èˆ€èÑ…ˆ€ôôô€‰Í•ÕÉ¥Ñäˆ€ü€‹–º'–£’â;¦jCˆ€èÑ…ˆ€ôôô€‰…ÁÁ•…É…¹”ˆ€ü€‹–’[¢ˆ€è€‹’â«’êë¢ÖšZd‰ôğ½ Èøñ‘¥Ø±…ÍÍ9…µ”ô‰™½É´µÉ¥ˆùíÑ…ˆ€ôôô€‰±½…±”ˆ€ü€ğøñ¥•±±…‰•°ô‹¦îc¢º“¢¾·¢¢ ˆøñÍ•±•Ğ‘•™…Õ±ÑY…±Õ”ô‰é µ8ˆøñ½ÁÑ¥½¸Ù…±Õ”ô‰é µ8ˆûº’öO’â·šZğ½½ÁÑ¥½¸øñ½ÁÑ¥½¸Ù…±Õ”ô‰­¼µ-Hˆû¶VsªÖ·²ZĞğ½½ÁÑ¥½¸øñ½ÁÑ¥½¸Ù…±Õ”ô‰•¸ˆù¹±¥Í ğ½½ÁÑ¥½¸øğ½Í•±•Ğøğ½¥•±øñ¥•±±…‰•°ô‹¦îc¢º“¢ÒŸ–âˆøñÍ•±•Ğ‘•™…Õ±ÑY…±Õ”ô‰-I\ˆøñ½ÁÑ¥½¸ù-I\ğ½½ÁÑ¥½¸øñ½ÁÑ¥½¸ù9dğ½½ÁÑ¥½¸øñ½ÁÑ¥½¸ùUMğ½½ÁÑ¥½¸øğ½Í•±•Ğøğ½¥•±øñ¥•±±…‰•°ô‹¦îc¢º“š^Û–2èˆøñÍ•±•Ğ‘•™…Õ±ÑY…±Õ”ô‰Í¥„½M•½Õ°ˆøñ½ÁÑ¥½¸ùÍ¥„½M•½Õ°ğ½½ÁÑ¥½¸øñ½ÁÑ¥½¸ùÍ¥„½M¡…¹¡…¤ğ½½ÁÑ¥½¸øñ½ÁÑ¥½¸ùUQğ½½ÁÑ¥½¸øğ½Í•±•Ğøğ½¥•±øğ¼ø€èÑ…ˆ€ôôô€‰Í•ÕÉ¥Ñäˆ€ü€ğøñ‘¥Ø±…ÍÍ9…µ”ô‰ÁÉ¥Ù…äµ‰½àˆøñM¡¥•±‘¡•¬€¼øñ‘¥ØøñˆûšV?š’ş‡š¿’şwš*ğ½ˆøñÀù…É‘]¥Í”ƒ’â7šRÛ¦n–º3šVÓ–6‡–>ßY¦NÛ¢†3–6‡–¾‚šr'šV#šrš"[šR¿’îc¦ª3¢¾‚ğ½Àøğ½‘¥Øøğ½‘¥Øøñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰‘…¹•Èµ‰Ñ¸ˆûRÏ¢¾ß–"ƒ¦f“¢Ò›š"ß’â;šVÃš6¸ğ½‰ÕÑÑ½¸øğ¼ø€è€ğøñ¥•±±…‰•°ô‹šbû’ë–B7Àˆøñ¥¹ÁÕĞ‘•™…Õ±ÑY…±Õ”ô‹šòS’ëR£š"Üˆ€¼øğ½¥•±øñ¥•±±…‰•°ô‹¦
»ºÄˆøñ¥¹ÁÕĞ‘•™…Õ±ÑY…±Õ”ô‰‘•µ½…É‘İ¥Í”¹±½…°ˆ‘¥Í…‰±•€¼øğ½¥•±øğ¼ùô€ğ½‘¥Øøñ‘¥Ø±…ÍÍ9…µ”ô‰™½É´µ™½½Ñ•Èˆøñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰ÁÉ¥µ…Éäµ‰Ñ¸ˆ½¹±¥¬õì ¤€ôø¹½Ñ¥™ä ‹¢ºûö»–ŞË’şw–¶`ˆ¥ôû’şw–¶c¢ºûö¸ğ½‰ÕÑÑ½¸øğ½‘¥Øøğ½Í•Ñ¥½¸øğ½‘¥Øøğ¼øì)ô()™Õ¹Ñ¥½¸!•±ÁMÉ••¸ ¤ì(€½¹ÍĞm½Á•¸°Í•Ñ=Á•¹t€ôÕÍ•MÑ…Ñ” À¤ì½¹ÍĞ™…ÅÌ€ômìÄè€‰…É‘]¥Í”ƒ’òk¢«–*£¢:ß–>[r–º{–"ß–6‡¢ºÃ–öW–B_¾ò|ˆ°„è€‹²³’â&#’â7’òk’öƒ¦r¢šš&/–*£–öW–—š"[¦k¢şMXƒ–¾ó–—¾òošr«š:—–—¦NÛ¢†0A$ƒš^ÛÎïî’â7’òk–¢š.—šr'r–º{’ê“šbOˆô°ìÄè€‹’âë’î’æ#¢º‡º_îOšzs–>¿¢÷’â;¢Ò›–6W’â7–B3¾ò|ˆ°„è€‹îOšzs–~ë’ê;’öƒ–öW–—jšVÃš6»–J3†»¢º“jîOšz–2[¢–"g¢;¢Òç’ó–N–6‡&ç–ºk–V–Nš"[¦NÛ¢†3šâº_š^Û¦^Ó¦÷–>¿¢÷–öÇ–N7–º{¦f’òcšƒˆô°ìÄè€‹šòS’ëšVÃš6»šb¿r–º{¦NÛ¢†3’êŸ–N–B_¾ò|ˆ°„è€‹’â7šb¿	ŠQƒ’ş‡R£–6‡–J3–£¦£švn+¦÷šb;†»š‚šÎ£’âëšòS’ëš¢‡švÿ¾ò3–>«R£’ê;šÖ/¢¾W¢º‡º_šÖ¢/ˆô°ìÄè€‹–š’öW’şw¢¾–Û’î[R£š"ßr/’â7–"Ãš"GjšVÃš6»¾ò|ˆ°„è€‹š¶–ò?:¿–Š’öÿR MÕÁ…‰…Í”ÕÑ ƒ’â;¦C¢† I1Oš¾?’â«š~—¢¾‹’î7–r£šr7–*‡®¿š‚‡¦ª0ÕÍ•É}¥“¾ò3¦ÿ–4%=Hƒ¢Ú+švˆõtì(€É•ÑÕÉ¸€ğøñA…•Q¥Ñ±”•å•‰É½Üô‰!1@9QHˆÑ¥Ñ±”ô‹–š’öWšnÓ¢«šb;–rÃ’öÿR£š¾?’â–òƒ–6„ˆ‘•ÍÉ¥ÁÑ¥½¸ô‹–ş¯¦’ê¢šVÃš6»–†»šŸ¦Šw–ê›¢º‡º_’â;¦jC’şwš*“ˆ€¼øñ±…‰•°±…ÍÍ9…µ”ô‰¡•±ÀµÍ•…É ˆøñM•…É €¼øñ¥¹ÁÕĞÁ±…•¡½±‘•Èô‹šBsÒ‹–â»–*§’âï¦Š`ˆ€¼øğ½±…‰•°øñ‘¥Ø±…ÍÍ9…µ”ô‰¡•±ÀµÉ¥ˆøñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰Á…¹•°ˆøñ Èû–âã¢¦^»¦Š`ğ½ Èùí™…ÅÌ¹µ…À ¡˜°¤¤€ôø€ñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰™…Äˆ­•äõí˜¹Åô½¹±¥¬õì ¤€ôøÍ•Ñ=Á•¸¡½Á•¸€ôôô¤€ü€´Ä€è¤¥ôøñÍÁ…¸øñˆùí˜¹Åôğ½ˆùí½Á•¸€ôôô¤€˜˜€ñÀùí˜¹…ôğ½Àùôğ½ÍÁ…¸øñ¡•ÙÉ½¹½İ¸Í¥é”õìÄáô€¼øğ½‰ÕÑÑ½¸ø¥ôğ½Í•Ñ¥½¸øñ…Í¥‘”±…ÍÍ9…µ”ô‰ÍÕÁÁ½ÉĞµ…ÉˆøñMÁ…É­±•Ì€¼øñ Èû¦r¢š–ò–/’öÿR£¾ò|ğ½ ÈøñÀû–#šŞï–*ƒ’ş‡R£–6‡¾ò3–7–öW–—š¾?¦†çšvn+jîOšz–2[¢–"g’öƒ’æ–>¿’î—nÓš:—’öO¦ª3šòS’ëšVÃš6»ğ½Àøñ1¥¹¬¡É•˜ôˆ½…É‘Ì½¹•Üˆ±…ÍÍ9…µ”ô‰ÁÉ¥µ…Éäµ‰Ñ¸ˆûšŞï–*ƒ²³’â–òƒ–6„ğ½1¥¹¬øğ½…Í¥‘”øğ½‘¥Øøğ¼øì)ô()™Õ¹Ñ¥½¸ÕÑ¡MÉ••¸¡ìÉ•¥ÍÑ•Èè¥ÍI•¥ÍÑ•ÈôèìÉ•¥ÍÑ•Èè‰½½±•…¸ô¤ì(€½¹ÍĞÉ½ÕÑ•È€ôÕÍ•I½ÕÑ•È ¤ì½¹ÍĞm•µ…¥°°Í•Ñµ…¥±t€ôÕÍ•MÑ…Ñ” ˆˆ¤ì½¹ÍĞmÁ…ÍÍİ½É°Í•ÑA…ÍÍİ½É‘t€ôÕÍ•MÑ…Ñ” ˆˆ¤ì½¹ÍĞmµ•ÍÍ…”°Í•Ñ5•ÍÍ…•t€ôÕÍ•MÑ…Ñ” ˆˆ¤ì½¹ÍĞm±½…‘¥¹œ°Í•Ñ1½…‘¥¹t€ôÕÍ•MÑ…Ñ”¡™…±Í”¤ì½¹ÍĞ½¹™¥ÕÉ•€ô	½½±•…¸¡ÁÉ½•ÍÌ¹•¹Ø¹9aQ}AU	1%}MUA	M}UI0€˜˜ÁÉ½•ÍÌ¹•¹Ø¹9aQ}AU	1%}MUA	M}9=9}-d¤ì(€½¹ÍĞÍÕ‰µ¥Ğ€ô…Íå¹Œ€¡”è½ÉµÙ•¹Ğ¤€ôøì”¹ÁÉ•Ù•¹Ñ•™…Õ±Ğ ¤ìÍ•Ñ1½…‘¥¹œ¡ÑÉÕ”¤ìÍ•Ñ5•ÍÍ…” ˆˆ¤ì¥˜€ …½¹™¥ÕÉ•¤ì…İ…¥Ğ¹•ÜAÉ½µ¥Í” ¡È¤€ôøÍ•ÑQ¥µ•½ÕĞ¡È°€ÔÀÀ¤¤ìÉ½ÕÑ•È¹ÁÕÍ  ˆ½‘…Í¡‰½…Éˆ¤ìÉ•ÑÕÉ¸ìô½¹ÍĞÍÕÁ…‰…Í”€ôÉ•…Ñ•	É½İÍ•É±¥•¹Ğ¡ÁÉ½•ÍÌ¹•¹Ø¹9aQ}AU	1%}MUA	M}UI0„°ÁÉ½•ÍÌ¹•¹Ø¹9aQ}AU	1%}MUA	M}9=9}-d„¤ì½¹ÍĞÉ•ÍÕ±Ğ€ô¥ÍI•¥ÍÑ•È€ü…İ…¥ĞÍÕÁ…‰…Í”¹…ÕÑ ¹Í¥¹UÀ¡ì•µ…¥°°Á…ÍÍİ½Éô¤€è…İ…¥ĞÍÕÁ…‰…Í”¹…ÕÑ ¹Í¥¹%¹]¥Ñ¡A…ÍÍİ½É¡ì•µ…¥°°Á…ÍÍİ½Éô¤ìÍ•Ñ1½…‘¥¹œ¡™…±Í”¤ì¥˜€¡É•ÍÕ±Ğ¹•ÉÉ½È¤Í•Ñ5•ÍÍ…”¡É•ÍÕ±Ğ¹•ÉÉ½È¹µ•ÍÍ…”¤ì•±Í”É½ÕÑ•È¹ÁÕÍ  ˆ½‘…Í¡‰½…Éˆ¤ìôì(€½¹ÍĞµ…¥Œ€ô…Íå¹Œ€ ¤€ôøì¥˜€ …½¹™¥ÕÉ•¤ìÉ½ÕÑ•È¹ÁÕÍ  ˆ½‘…Í¡‰½…Éˆ¤ìÉ•ÑÕÉ¸ìôÍ•Ñ1½…‘¥¹œ¡ÑÉÕ”¤ì½¹ÍĞÍÕÁ…‰…Í”€ôÉ•…Ñ•	É½İÍ•É±¥•¹Ğ¡ÁÉ½•ÍÌ¹•¹Ø¹9aQ}AU	1%}MUA	M}UI0„°ÁÉ½•ÍÌ¹•¹Ø¹9aQ}AU	1%}MUA	M}9=9}-d„¤ì½¹ÍĞì•ÉÉ½Èô€ô…İ…¥ĞÍÕÁ…‰…Í”¹…ÕÑ ¹Í¥¹%¹]¥Ñ¡=ÑÀ¡ì•µ…¥°°½ÁÑ¥½¹Ìèì•µ…¥±I•‘¥É•ÑQ¼è€‘í±½…Ñ¥½¸¹½É¥¥¹ô½‘…Í¡‰½…É‘€ôô¤ìÍ•Ñ5•ÍÍ…”¡•ÉÉ½Èü¹µ•ÍÍ…”€üü€‹fï–öW¦Nûš:—–ŞË–>G¦¾ò3¢¾ßšš~—¦
»ºÇˆ¤ìÍ•Ñ1½…‘¥¹œ¡™…±Í”¤ìôì(€É•ÑÕÉ¸€ñµ…¥¸±…ÍÍ9…µ”ô‰…ÕÑ µÁ…”ˆøñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰…ÕÑ µ‰É…¹ˆøñ‘¥Ø±…ÍÍ9…µ”ô‰‰É…¹±¥¡Ğµ‰É…¹ˆøñÍÁ…¸±…ÍÍ9…µ”ô‰‰É…¹µµ…É¬ˆøñÉ•‘¥Ñ…É‘%½¸Í¥é”õìÈÅô€¼øğ½ÍÁ…¸øñÍÁ…¸ù…É‘]¥Í”ğ½ÍÁ…¸øğ½‘¥Øøñ‘¥ØøñÍÁ…¸±…ÍÍ9…µ”ô‰•å•‰É½Ü±¥¡Ğˆùe=UH	9%QL°1I1dğ½ÍÁ…¸øñ Äûš¾?’â¦†çšvn+¾ò0ñ‰È€¼û¦÷’â7¢¾—¢Š¯–şc¢ºÃğ½ ÄøñÀû¢ş÷¢â«’ş‡R£–6‡’òcšƒ¦Šw–ê›’â;’öÿR£š²‡šVÃ¾ò3–r£š¾?š²‡šÚ#¢Òç–&7š&û–"ÃšnÓ–B#¦j–6‡ğ½Àøñ‘¥Ø±…ÍÍ9…µ”ô‰…ÕÑ µ…ÉĞˆøñÉ•‘¥Ñ…É‘Y¥ÍÕ…°…Éõíì¥è€‰…ÕÑ ˆ°¥ÍÍÕ•Èè€‰…É‘]¥Í”ˆ°¹…µ”è€‰	•¹•™¥Ğ5…¹…•Èˆ°¹¥­¹…µ”è€‰5dM5IPIˆ°¹•Ñİ½É¬è€‰Y¥Í„ˆ°±…ÍÑ½ÕÈè€ˆÈÀÈØˆ°½±½Èè€‰±¥¹•…ÈµÉ…‘¥•¹Ğ ÄÌÕ‘•œ°Œİ˜ÜÁ™˜°ŒĞØÌá”¤ˆ°¥Í…Ù½É¥Ñ”èÑÉÕ”°¥ÍÑ¥Ù”èÑÉÕ”°…¹¹Õ…±•”è€À°…¹¹Õ…±••5½¹Ñ è€Ä°½Á•¹•‘ĞèÑ½‘…ä ¤°ÁÉ•Ù¥½ÕÍ5½¹Ñ¡MÁ•¹è€À°ÕÉÉ•¹ÑEÕ…±¥™å¥¹MÁ•¹è€Àõô€¼øñ‘¥Ø±…ÍÍ9…µ”ô‰™±½…Ñ¥¹œµÍ…Ù¥¹œˆøñMÁ…É­±•ÌÍ¥é”õìÄáô€¼øñÍÁ…¸ûšr³šr#–ŞË¢*rñÍÑÉ½¹œûŠ
¤ÄÀÔ°ÌÀÀğ½ÍÑÉ½¹œøğ½ÍÁ…¸øğ½‘¥Øøğ½‘¥Øøğ½‘¥ØøñÍµ…±°ûšòS’ëšVÃš6»’â7’î¢†£’îï’öWr–º{¦NÛ¢†3’êŸ–Nğ½Íµ…±°øğ½Í•Ñ¥½¸øñÍ•Ñ¥½¸±…ÍÍ9…µ”ô‰…ÕÑ µ™½É´µİÉ…Àˆøñ™½É´±…ÍÍ9…µ”ô‰…ÕÑ µ™½É´ˆ½¹MÕ‰µ¥ĞõíÍÕ‰µ¥ÑôøñÍÁ…¸±…ÍÍ9…µ”ô‰•å•‰É½Üˆù]1=5ğ½ÍÁ…¸øñ Èùí¥ÍI•¥ÍÑ•È€ü€‹–"o–îè…É‘]¥Í”ƒ¢Ò›š"Üˆ€è€‹š²‹¢ş;–n{šv”‰ôğ½ ÈøñÀùí¥ÍI•¥ÍÑ•È€ü€‹–ò–/º‡B–Æ{’ê;’öƒj’ş‡R£–6‡švn+ˆ€è€‹fï–öW–B;îŸî·º‡B’öƒjšvn+’â;¦Šw–ê›‰ôğ½Àùì…½¹™¥ÕÉ•€˜˜€ñ‘¥Ø±…ÍÍ9…µ”ô‰‘•µ¼µ…±±½ÕĞˆøñMÁ…É­±•ÌÍ¥é”õìÄİô€¼øñÍÁ…¸û–öO–&7’âëšòS’ëš¢‡–ò?¾ò3–>¿nÓš:—¢şo–—’öO¦ª3ğ½ÍÁ…¸øğ½‘¥Øùôñ¥•±±…‰•°ô‹¦
»ºÄˆøñ¥¹ÁÕĞÑåÁ”ô‰•µ…¥°ˆÉ•ÅÕ¥É•õí½¹™¥ÕÉ•‘ôÙ…±Õ”õí•µ…¥±ô½¹¡…¹”õì¡”¤€ôøÍ•Ñµ…¥°¡”¹Ñ…É•Ğ¹Ù…±Õ”¥ôÁ±…•¡½±‘•Èô‰å½Õ•á…µÁ±”¹½´ˆ€¼øğ½¥•±øñ¥•±±…‰•°ô‹–¾‚ˆøñ¥¹ÁÕĞÑåÁ”ô‰Á…ÍÍİ½ÉˆÉ•ÅÕ¥É•õí½¹™¥ÕÉ•‘ôµ¥¹1•¹Ñ õí½¹™¥ÕÉ•€ü€à€èÕ¹‘•™¥¹•‘ôÙ…±Õ”õíÁ…ÍÍİ½É‘ô½¹¡…¹”õì¡”¤€ôøÍ•ÑA…ÍÍİ½É¡”¹Ñ…É•Ğ¹Ù…±Õ”¥ôÁ±…•¡½±‘•Èô‹¢Ï–ÂD€àƒ’ö4ˆ€¼øğ½¥•±ùíµ•ÍÍ…”€˜˜€ñÀ±…ÍÍ9…µ”ô‰™½É´µµ•ÍÍ…”ˆùíµ•ÍÍ…•ôğ½Àùôñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰ÁÉ¥µ…Éäµ‰Ñ¸İ¥‘”ˆ‘¥Í…‰±•õí±½…‘¥¹ôùí±½…‘¥¹œ€ü€‹¢¾ß¢7–gŠ˜ˆ€è¥ÍI•¥ÍÑ•È€ü€‹šÎ£–3¢Ò›š"Üˆ€è½¹™¥ÕÉ•€ü€‹fï–öTˆ€è€‹¢şo–—šòS’ëš¢‡–ò<‰ôğ½‰ÕÑÑ½¸øñ‰ÕÑÑ½¸ÑåÁ”ô‰‰ÕÑÑ½¸ˆ±…ÍÍ9…µ”ô‰Í•½¹‘…Éäµ‰Ñ¸İ¥‘”ˆ½¹±¥¬õíµ…¥ôû’öÿR 5…¥Œ1¥¹¬ğ½‰ÕÑÑ½¸øñÀ±…ÍÍ9…µ”ô‰…ÕÑ µÍİ¥Ñ ˆùí¥ÍI•¥ÍÑ•È€ü€‹–ŞËî?šr'¢Ò›š"ß¾ò|ˆ€è€‹¢şcšÊ‡šr'¢Ò›š"ß¾ò|‰ôñ1¥¹¬¡É•˜õí¥ÍI•¥ÍÑ•È€ü€ˆ½±½¥¸ˆ€è€ˆ½É•¥ÍÑ•È‰ôùí¥ÍI•¥ÍÑ•È€ü€‹®/–6Ïfï–öTˆ€è€‹–7¢ÒçšÎ£–0‰ôğ½1¥¹¬øğ½Àøğ½™½É´øğ½Í•Ñ¥½¸øğ½µ…¥¸øì)ô()™Õ¹Ñ¥½¸¥•±¡ì±…‰•°°¡¥¹Ğ°•ÉÉ½È°¡¥±‘É•¸ôèì±…‰•°èÍÑÉ¥¹œì¡¥¹ĞüèÍÑÉ¥¹œì•ÉÉ½ÈüèÍÑÉ¥¹œì¡¥±‘É•¸èI•…Ğ¹I•…Ñ9½‘”ô¤ìÉ•ÑÕÉ¸€ñ±…‰•°±…ÍÍ9…µ”õí•ÉÉ½È€ü€‰™¥•±•ÉÉ½Èˆ€è€‰™¥•±‰ôøñÍÁ…¸ùí±…‰•±õí¡¥¹Ğ€˜˜€ñÍµ…±°ùí¡¥¹Ñôğ½Íµ…±°ùôğ½ÍÁ…¸ùí¡¥±‘É•¹õí•ÉÉ½È€˜˜€ñ•´ùí•ÉÉ½Éôğ½•´ùôğ½±…‰•°øìô)™Õ¹Ñ¥½¸µÁÑä¡ìÑ¥Ñ±”°‰½‘äôèìÑ¥Ñ±”èÍÑÉ¥¹œì‰½‘äèÍÑÉ¥¹œô¤ìÉ•ÑÕÉ¸€ñ‘¥Ø±…ÍÍ9…µ”ô‰•µÁÑäˆøñÍÁ…¸øñÉ•‘¥Ñ…É‘%½¸€¼øğ½ÍÁ…¸øñ ÌùíÑ¥Ñ±•ôğ½ ÌøñÀùí‰½‘åôğ½Àøğ½‘¥Øøìô)™Õ¹Ñ¥½¸½¹™¥Éµ¥…±½œ¡ìÑ¥Ñ±”°‰½‘ä°½¹…¹•°°½¹½¹™¥É´ôèìÑ¥Ñ±”èÍÑÉ¥¹œì‰½‘äèÍÑÉ¥¹œì½¹…¹•°è€ ¤€ôøÙ½¥ì½¹½¹™¥É´è€ ¤€ôøÙ½¥ô¤ìÉ•ÑÕÉ¸€ñ‘¥Ø±…ÍÍ9…µ”ô‰µ½‘…°µİÉ…Àˆøñ‘¥Ø±…ÍÍ9…µ”ô‰µ½‘…°ˆøñÍÁ…¸±…ÍÍ9…µ”ô‰‘…¹•Èµ¥½¸ˆøñQÉ…Í È€¼øğ½ÍÁ…¸øñ ÈùíÑ¥Ñ±•ôğ½ ÈøñÀùí‰½‘åôğ½Àøñ‘¥Ø±…ÍÍ9…µ”ô‰‰ÕÑÑ½¸µÉ½Üˆøñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰Í•½¹‘…Éäµ‰Ñ¸ˆ½¹±¥¬õí½¹…¹•±ôû–>[šÚ ğ½‰ÕÑÑ½¸øñ‰ÕÑÑ½¸±…ÍÍ9…µ”ô‰‘…¹•Èµ‰Ñ¸ˆ½¹±¥¬õí½¹½¹™¥Éµôû†»¢º“–"ƒ¦fğ½‰ÕÑÑ½¸øğ½‘¥Øøğ½‘¥Øøğ½‘¥Øøìô(