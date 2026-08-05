import { addDays, endOfMonth, endOfYear, formatISO } from "date-fns";
import type { ResetPeriod } from "./types";

export function nextResetDate(period: ResetPeriod, now: Date): string | null {
  if (period === "monthly") return formatISO(addDays(endOfMonth(now), 1), { representation: "date" });
  if (period === "yearly") return formatISO(addDays(endOfYear(now), 1), { representation: "date" });
  return null;
}
const seoulPart = (date: Date, part: "year" | "month") => new Intl.DateTimeFormat("en", { timeZone: "Asia/Seoul", [part]: part === "year" ? "numeric" : "2-digit" }).format(date);
export function isSameSeoulMonth(iso: string, now: Date): boolean { return seoulPart(new Date(iso), "year") === seoulPart(now, "year") && seoulPart(new Date(iso), "month") === seoulPart(now, "month"); }
export function isSameSeoulYear(iso: string, now: Date): boolean { return seoulPart(new Date(iso), "year") === seoulPart(now, "year"); }
