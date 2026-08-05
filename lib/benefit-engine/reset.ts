import type { ResetPeriod } from "./types";

const seoulParts = (date: Date) => Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
}).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));

export function nextResetDate(period: ResetPeriod, now: Date): string | null {
  const parts = seoulParts(now);
  const year = Number(parts.year);
  const month = Number(parts.month);
  if (period === "monthly") return month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  if (period === "yearly") return `${year + 1}-01-01`;
  return null;
}
export function isSameSeoulDay(iso: string, now: Date): boolean { const left = seoulParts(new Date(iso)); const right = seoulParts(now); return left.year === right.year && left.month === right.month && left.day === right.day; }
export function isSameSeoulMonth(iso: string, now: Date): boolean { const left = seoulParts(new Date(iso)); const right = seoulParts(now); return left.year === right.year && left.month === right.month; }
export function isSameSeoulYear(iso: string, now: Date): boolean { return seoulParts(new Date(iso)).year === seoulParts(now).year; }
