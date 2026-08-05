import "server-only";
import { timingSafeEqual } from "node:crypto";

export function cardwiseCronSecret() {
  return process.env.CARDWISE_CRON_SECRET ?? process.env.CARD_CATALOG_CRON_SECRET;
}

export function verifySharedSecret(supplied: string | null, expected: string | undefined) {
  if (!supplied || !expected || expected.length < 32) return false;
  const suppliedBytes = Buffer.from(supplied);
  const expectedBytes = Buffer.from(expected);
  return suppliedBytes.length === expectedBytes.length && timingSafeEqual(suppliedBytes, expectedBytes);
}
