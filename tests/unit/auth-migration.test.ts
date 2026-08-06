import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationPath = fileURLToPath(new URL("../../supabase/migrations/202608060001_auth_profile_trigger_hardening.sql", import.meta.url));
const migration = readFileSync(migrationPath, "utf8");

describe("Auth profile migration", () => {
  it("keeps the trigger idempotent and security-definer with a constrained search path", () => {
    expect(migration).toMatch(/create or replace function public\.handle_new_user\(\)/i);
    expect(migration).toMatch(/security definer\s+set search_path = pg_catalog/i);
    expect(migration).toMatch(/drop trigger if exists on_auth_user_created/i);
    expect(migration).toMatch(/on conflict \(user_id\) do nothing/i);
  });

  it("handles missing display name and nullable email and backfills profiles", () => {
    expect(migration).toContain("coalesce(new.email, '')");
    expect(migration).toContain("'CardWise 用户'");
    expect(migration).toMatch(/from auth\.users as users[\s\S]+where profiles\.user_id is null/i);
  });
});
