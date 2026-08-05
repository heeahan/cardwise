import { afterEach, describe, expect, it } from "vitest";
import { cardwiseCronSecret, verifySharedSecret } from "../../lib/security/shared-secret";

describe("scheduled-sync shared secret", () => {
  const originalPrimary = process.env.CARDWISE_CRON_SECRET;
  const originalLegacy = process.env.CARD_CATALOG_CRON_SECRET;

  afterEach(() => {
    if (originalPrimary === undefined) delete process.env.CARDWISE_CRON_SECRET;
    else process.env.CARDWISE_CRON_SECRET = originalPrimary;
    if (originalLegacy === undefined) delete process.env.CARD_CATALOG_CRON_SECRET;
    else process.env.CARD_CATALOG_CRON_SECRET = originalLegacy;
  });

  it("fails closed for absent, short, or different values", () => {
    expect(verifySharedSecret(null, "a".repeat(32))).toBe(false);
    expect(verifySharedSecret("short", "short")).toBe(false);
    expect(verifySharedSecret("a".repeat(32), "b".repeat(32))).toBe(false);
    expect(verifySharedSecret("a".repeat(31), "a".repeat(32))).toBe(false);
  });

  it("accepts only an exact sufficiently long value", () => {
    const secret = "cardwise-production-cron-secret-0001";
    expect(verifySharedSecret(secret, secret)).toBe(true);
  });

  it("prefers the new variable while retaining the legacy alias", () => {
    process.env.CARD_CATALOG_CRON_SECRET = "legacy";
    expect(cardwiseCronSecret()).toBe("legacy");
    process.env.CARDWISE_CRON_SECRET = "primary";
    expect(cardwiseCronSecret()).toBe("primary");
  });
});
