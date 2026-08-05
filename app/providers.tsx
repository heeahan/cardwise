"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { demoBenefits, demoCards, demoUsages } from "../lib/data/demo";
import type { Benefit, BenefitRule, BenefitUsage, CreditCard } from "../lib/benefit-engine/types";
import { createClient, isSupabaseConfigured } from "../lib/supabase/client";

export interface CardWiseRuntimeConfig {
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
  appUrl: string;
  demoEnabled: boolean;
}

interface CardWiseState {
  cards: CreditCard[];
  archivedCards: CreditCard[];
  benefits: Benefit[];
  usages: BenefitUsage[];
  demoMode: boolean;
  loading: boolean;
  dataError: string | null;
  profile: UserProfile | null;
  toast: string | null;
  runtimeConfig: CardWiseRuntimeConfig;
  configurationMissing: boolean;
  reload: () => Promise<void>;
  addCard: (card: Omit<CreditCard, "id">) => CreditCard;
  updateCard: (id: string, changes: Partial<CreditCard>) => void;
  deleteCard: (id: string) => void;
  restoreCard: (id: string) => void;
  signOut: () => Promise<void>;
  updateProfile: (changes: UserProfile) => Promise<void>;
  addBenefit: (benefit: Omit<Benefit, "id">) => Benefit;
  updateBenefit: (id: string, changes: Partial<Benefit>) => void;
  deleteBenefit: (id: string) => void;
  addUsage: (usage: Omit<BenefitUsage, "id">) => BenefitUsage;
  updateUsage: (id: string, changes: Partial<BenefitUsage>) => void;
  deleteUsage: (id: string) => void;
  notify: (message: string) => void;
  clearToast: () => void;
}

interface CardRow {
  id: string; issuer_name: string; card_name: string; nickname: string; network: CreditCard["network"];
  last_four: string | null; color: string; status: string; is_favorite: boolean; annual_fee: number;
  annual_fee_month: number | null; opened_at: string | null; previous_month_spend_requirement: number;
  current_qualifying_spend: number; notes: string | null;
  currency?: string | null; statement_cycle_day?: number | null; sort_order?: number;
}
interface BenefitRow {
  id: string; card_id: string; name: string; category_slug: string; subcategory: string | null;
  description: string; rule: BenefitRule; status: Benefit["status"]; source_name: string;
  source_url: string | null; last_verified_at: string | null; verified_by_user: boolean; confidence: Benefit["confidence"];
}
interface UsageRow {
  id: string; transaction_id: string; benefit_id: string; card_id: string; occurred_at: string;
  usage_count: number; discount_amount: number; rule_snapshot: BenefitRule; deleted_at?: string | null;
}
interface TransactionRow {
  id: string; card_id: string; occurred_at: string; merchant_name: string; category_slug: string;
  original_amount: number; actual_discount_amount: number; points_earned: number; note: string | null;
  benefit_usages: UsageRow[];
}
interface ApiEnvelope<T> { data: T; error: { message?: string } | null }
export interface UserProfile { displayName: string; email: string; defaultLanguage: "zh-CN" | "ko-KR" | "en"; defaultCurrency: string; defaultTimezone: "Asia/Seoul" | "Asia/Shanghai" | "UTC"; emailNotifications: boolean }
interface ProfileRow { display_name?: string | null; email?: string; default_language?: UserProfile["defaultLanguage"]; default_currency?: string; default_timezone?: UserProfile["defaultTimezone"]; email_notifications?: boolean }

const CardWiseContext = createContext<CardWiseState | null>(null);
const publicPaths = new Set(["/login", "/register", "/forgot-password"]);

const mapCard = (row: CardRow): CreditCard => ({
  id: row.id, issuer: row.issuer_name, name: row.card_name, nickname: row.nickname, network: row.network,
  lastFour: row.last_four ?? undefined, color: row.color, isFavorite: row.is_favorite, isActive: row.status === "active",
  annualFee: Number(row.annual_fee), annualFeeMonth: row.annual_fee_month ?? 1,
  openedAt: row.opened_at ?? new Date().toISOString().slice(0, 10),
  previousMonthSpend: Number(row.previous_month_spend_requirement), currentQualifyingSpend: Number(row.current_qualifying_spend),
  currency: row.currency ?? "KRW", statementCycleDay: row.statement_cycle_day ?? undefined, sortOrder: row.sort_order ?? 0, notes: row.notes ?? undefined,
});
const mapBenefit = (row: BenefitRow): Benefit => ({
  id: row.id, cardId: row.card_id, name: row.name, category: row.category_slug,
  subcategory: row.subcategory ?? undefined, description: row.description, rule: row.rule, status: row.status,
  sourceName: row.source_name, sourceUrl: row.source_url ?? undefined,
  lastVerifiedAt: row.last_verified_at ?? new Date().toISOString().slice(0, 10),
  verifiedByUser: row.verified_by_user, confidence: row.confidence,
});
const mapTransaction = (row: TransactionRow): BenefitUsage[] => row.benefit_usages.filter((usage) => !usage.deleted_at).map((usage) => ({
  id: usage.id, transactionId: row.id, benefitId: usage.benefit_id, cardId: usage.card_id,
  occurredAt: usage.occurred_at ?? row.occurred_at, merchantName: row.merchant_name, category: row.category_slug,
  originalAmount: Number(row.original_amount), discountAmount: Number(usage.discount_amount ?? row.actual_discount_amount),
  usageCount: Number(usage.usage_count), pointsEarned: Number(row.points_earned), ruleSnapshot: usage.rule_snapshot,
  note: row.note ?? undefined,
}));
const mapProfile = (row: ProfileRow): UserProfile => ({ displayName: row.display_name ?? "CardWise 用户", email: row.email ?? "", defaultLanguage: row.default_language ?? "zh-CN", defaultCurrency: row.default_currency ?? "KRW", defaultTimezone: row.default_timezone ?? "Asia/Seoul", emailNotifications: row.email_notifications ?? false });

async function callApi<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers }, cache: "no-store" });
  const body = await response.json() as ApiEnvelope<T>;
  if (!response.ok || body.error) throw new Error(body.error?.message ?? "请求失败，请稍后重试");
  return body.data;
}

const cardPayload = (card: Partial<CreditCard>) => ({
  ...(card.issuer !== undefined && { issuer: card.issuer }), ...(card.name !== undefined && { name: card.name }),
  ...(card.nickname !== undefined && { nickname: card.nickname }), ...(card.network !== undefined && { network: card.network }),
  ...(card.lastFour !== undefined && { lastFour: card.lastFour }), ...(card.annualFee !== undefined && { annualFee: card.annualFee }),
  ...(card.annualFeeMonth !== undefined && { annualFeeMonth: card.annualFeeMonth }),
  ...(card.previousMonthSpend !== undefined && { previousMonthSpend: card.previousMonthSpend }),
  ...(card.currentQualifyingSpend !== undefined && { currentQualifyingSpend: card.currentQualifyingSpend }),
  ...(card.currency !== undefined && { currency: card.currency }), ...(card.statementCycleDay !== undefined && { statementCycleDay: card.statementCycleDay }),
  ...(card.color !== undefined && { color: card.color }), ...(card.notes !== undefined && { notes: card.notes }),
  ...(card.isFavorite !== undefined && { isFavorite: card.isFavorite }), ...(card.isActive !== undefined && { isActive: card.isActive }),
  ...(card.sortOrder !== undefined && { sortOrder: card.sortOrder }),
});
const benefitPayload = (benefit: Partial<Benefit>) => ({
  ...(benefit.cardId !== undefined && { cardId: benefit.cardId }), ...(benefit.name !== undefined && { name: benefit.name }),
  ...(benefit.category !== undefined && { category: benefit.category }), ...(benefit.subcategory !== undefined && { subcategory: benefit.subcategory }),
  ...(benefit.description !== undefined && { description: benefit.description }), ...(benefit.rule !== undefined && { rule: benefit.rule }),
  ...(benefit.status !== undefined && { status: benefit.status }), ...(benefit.sourceName !== undefined && { sourceName: benefit.sourceName }),
  ...(benefit.sourceUrl !== undefined && { sourceUrl: benefit.sourceUrl }), ...(benefit.lastVerifiedAt !== undefined && { lastVerifiedAt: benefit.lastVerifiedAt }),
  ...(benefit.verifiedByUser !== undefined && { verifiedByUser: benefit.verifiedByUser }), ...(benefit.confidence !== undefined && { confidence: benefit.confidence }),
});

export function CardWiseProvider({ children, runtimeConfig }: { children: ReactNode; runtimeConfig: CardWiseRuntimeConfig }) {
  const configured = isSupabaseConfigured(runtimeConfig);
  const demoMode = !configured && runtimeConfig.demoEnabled;
  const configurationMissing = !configured && !demoMode;
  const [cards, setCards] = useState<CreditCard[]>(demoMode ? demoCards : []);
  const [archivedCards, setArchivedCards] = useState<CreditCard[]>([]);
  const [benefits, setBenefits] = useState<Benefit[]>(demoMode ? demoBenefits : []);
  const [usages, setUsages] = useState<BenefitUsage[]>(demoMode ? demoUsages : []);
  const [profile, setProfile] = useState<UserProfile | null>(demoMode ? { displayName: "演示用户", email: "demo@cardwise.local", defaultLanguage: "zh-CN", defaultCurrency: "KRW", defaultTimezone: "Asia/Seoul", emailNotifications: false } : null);
  const [loading, setLoading] = useState(configured);
  const [dataError, setDataError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2800);
  }, []);

  const reload = useCallback(async () => {
    if (demoMode || configurationMissing) return;
    setLoading(true);
    setDataError(null);
    try {
      const [cardRows, archivedCardRows, benefitRows, transactionRows, profileRow] = await Promise.all([
        callApi<CardRow[]>("/api/cards"), callApi<CardRow[]>("/api/cards?archived=1"), callApi<BenefitRow[]>("/api/benefits"), callApi<TransactionRow[]>("/api/transactions"), callApi<ProfileRow>("/api/profile"),
      ]);
      setCards(cardRows.map(mapCard));
      setArchivedCards(archivedCardRows.map(mapCard));
      setBenefits(benefitRows.map(mapBenefit));
      setUsages(transactionRows.flatMap(mapTransaction));
      setProfile(mapProfile(profileRow));
    } catch (error) {
      setDataError(error instanceof Error ? error.message : "数据加载失败");
    } finally {
      setLoading(false);
    }
  }, [configurationMissing, demoMode]);

  useEffect(() => {
    if (demoMode || configurationMissing) return;
    const supabase = createClient(runtimeConfig);
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) void reload();
      else {
        setLoading(false);
        if (!publicPaths.has(pathname)) router.replace("/login");
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) void reload();
      else {
        setCards([]); setArchivedCards([]); setBenefits([]); setUsages([]); setProfile(null); setLoading(false);
        if (!publicPaths.has(pathname)) router.replace("/login");
      }
    });
    return () => listener.subscription.unsubscribe();
  }, [configurationMissing, demoMode, pathname, reload, router, runtimeConfig]);

  const failWrite = useCallback((error: unknown) => {
    notify(error instanceof Error ? error.message : "保存失败，请稍后重试");
    void reload();
  }, [notify, reload]);

  const addCard = (input: Omit<CreditCard, "id">) => {
    const row = { ...input, id: crypto.randomUUID() };
    setCards((items) => [row, ...items]);
    notify("信用卡已保存");
    if (!demoMode) void callApi<CardRow>("/api/cards", { method: "POST", body: JSON.stringify(cardPayload(input)) })
      .then((saved) => setCards((items) => items.map((item) => item.id === row.id ? mapCard(saved) : item))).catch(failWrite);
    return row;
  };
  const updateCard = (id: string, changes: Partial<CreditCard>) => {
    setCards((items) => items.map((row) => row.id === id ? { ...row, ...changes } : row)); notify("信用卡已更新");
    if (!demoMode) void callApi<CardRow>(`/api/cards/${id}`, { method: "PATCH", body: JSON.stringify(cardPayload(changes)) }).catch(failWrite);
  };
  const deleteCard = (id: string) => {
    const current = cards.find((row) => row.id === id); if (current) setArchivedCards((items) => [{ ...current, isActive: false }, ...items]);
    setCards((items) => items.filter((row) => row.id !== id)); setBenefits((items) => items.filter((row) => row.cardId !== id)); setUsages((items) => items.filter((row) => row.cardId !== id)); notify("信用卡已移入回收站");
    if (!demoMode) void callApi<{ id: string }>(`/api/cards/${id}`, { method: "DELETE" }).catch(failWrite);
  };
  const restoreCard = (id: string) => {
    const current = archivedCards.find((row) => row.id === id);
    if (current) { setArchivedCards((items) => items.filter((row) => row.id !== id)); setCards((items) => [{ ...current, isActive: true }, ...items]); }
    notify("信用卡已恢复");
    if (!demoMode) void callApi<{ id: string }>(`/api/cards/${id}/restore`, { method: "POST" }).then(() => reload()).catch(failWrite);
  };
  const signOut = async () => {
    if (demoMode) { router.push("/login"); return; }
    const { error } = await createClient(runtimeConfig).auth.signOut();
    if (error) throw error;
    router.replace("/login");
  };
  const updateProfile = async (changes: UserProfile) => {
    if (demoMode) { setProfile(changes); notify("演示设置已保存在当前会话"); return; }
    const row = await callApi<ProfileRow>("/api/profile", { method: "PATCH", body: JSON.stringify(changes) });
    setProfile(mapProfile(row)); notify("个人设置已保存");
  };
  const addBenefit = (input: Omit<Benefit, "id">) => {
    const row = { ...input, id: crypto.randomUUID() };
    setBenefits((items) => [row, ...items]); notify("权益已保存");
    if (!demoMode) void callApi<BenefitRow>("/api/benefits", { method: "POST", body: JSON.stringify(benefitPayload(input)) })
      .then((saved) => setBenefits((items) => items.map((item) => item.id === row.id ? mapBenefit(saved) : item))).catch(failWrite);
    return row;
  };
  const updateBenefit = (id: string, changes: Partial<Benefit>) => {
    setBenefits((items) => items.map((row) => row.id === id ? { ...row, ...changes } : row)); notify("权益已更新");
    if (!demoMode) void callApi<BenefitRow>(`/api/benefits/${id}`, { method: "PATCH", body: JSON.stringify(benefitPayload(changes)) }).catch(failWrite);
  };
  const deleteBenefit = (id: string) => {
    setBenefits((items) => items.filter((row) => row.id !== id)); setUsages((items) => items.filter((row) => row.benefitId !== id)); notify("权益已删除");
    if (!demoMode) void callApi<{ id: string }>(`/api/benefits/${id}`, { method: "DELETE" }).catch(failWrite);
  };
  const addUsage = (input: Omit<BenefitUsage, "id">) => {
    const row = { ...input, id: crypto.randomUUID() };
    setUsages((items) => [row, ...items]); notify("消费记录已保存，额度已重新计算");
    if (!demoMode) void callApi<{ transaction: TransactionRow; usage: UsageRow }>("/api/transactions", {
      method: "POST", body: JSON.stringify({ cardId: input.cardId, benefitId: input.benefitId, occurredAt: input.occurredAt, merchantName: input.merchantName, category: input.category, originalAmount: input.originalAmount, discountAmount: input.discountAmount, usageCount: input.usageCount, note: input.note }),
    }).then(({ transaction, usage }) => setUsages((items) => items.map((item) => item.id === row.id ? mapTransaction({ ...transaction, benefit_usages: [usage] })[0] : item))).catch(failWrite);
    return row;
  };
  const updateUsage = (id: string, changes: Partial<BenefitUsage>) => {
    const current = usages.find((row) => row.id === id);
    setUsages((items) => items.map((row) => row.id === id ? { ...row, ...changes } : row)); notify("消费记录已更新，额度已重新计算");
    if (!demoMode && current?.transactionId) void callApi<TransactionRow>(`/api/transactions/${current.transactionId}`, { method: "PATCH", body: JSON.stringify({ cardId: changes.cardId, benefitId: changes.benefitId, occurredAt: changes.occurredAt, merchantName: changes.merchantName, category: changes.category, originalAmount: changes.originalAmount, discountAmount: changes.discountAmount, usageCount: changes.usageCount, note: changes.note }) }).catch(failWrite);
  };
  const deleteUsage = (id: string) => {
    const current = usages.find((row) => row.id === id);
    setUsages((items) => items.filter((row) => row.id !== id)); notify("消费记录已删除，额度已恢复");
    if (!demoMode && current?.transactionId) void callApi<{ id: string }>(`/api/transactions/${current.transactionId}`, { method: "DELETE" }).catch(failWrite);
  };

  const value: CardWiseState = {
    cards, archivedCards, benefits, usages, demoMode, loading, dataError, profile, toast, runtimeConfig, configurationMissing, reload,
    addCard, updateCard, deleteCard, restoreCard, signOut, updateProfile, addBenefit, updateBenefit, deleteBenefit, addUsage, updateUsage, deleteUsage,
    notify, clearToast: () => setToast(null),
  };
  return <CardWiseContext.Provider value={value}>{children}</CardWiseContext.Provider>;
}

export function useCardWise() {
  const value = useContext(CardWiseContext);
  if (!value) throw new Error("useCardWise must be used within CardWiseProvider");
  return value;
}
