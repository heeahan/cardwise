import "server-only";

type LogLevel = "info" | "warn" | "error";
type SafeValue = string | number | boolean | null;

const blockedKey = /(token|secret|key|cookie|authorization|password|content|payload|card.?number|merchant|amount)/i;

export function logServerEvent(event: string, level: LogLevel, context: Record<string, SafeValue> = {}) {
  const safeContext = Object.fromEntries(Object.entries(context).filter(([key]) => !blockedKey.test(key)).slice(0, 20));
  const line = JSON.stringify({ timestamp: new Date().toISOString(), level, event, ...safeContext });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}
