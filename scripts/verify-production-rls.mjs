import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const WRITE_CONFIRMATION = "--confirm-write-tests";
const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "CARDWISE_RLS_TEST_USER_A_EMAIL",
  "CARDWISE_RLS_TEST_USER_A_PASSWORD",
  "CARDWISE_RLS_TEST_USER_B_EMAIL",
  "CARDWISE_RLS_TEST_USER_B_PASSWORD",
];

const fail = (message) => {
  console.error(`[FAIL] ${message}`);
  process.exitCode = 1;
};
const pass = (message) => console.log(`[PASS] ${message}`);
const expectDenied = (error, label) => {
  if (!error) throw new Error(`${label}: operation unexpectedly succeeded`);
  pass(label);
};

if (!process.argv.includes(WRITE_CONFIRMATION)) {
  console.error(`Refusing to write. Re-run with ${WRITE_CONFIRMATION} using two dedicated non-admin test accounts.`);
  process.exit(2);
}

const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length) {
  missing.forEach((name) => console.error(`[BLOCKED] ${name} is not configured`));
  process.exit(2);
}

const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const clientA = createClient(url, anonKey, options);
const clientB = createClient(url, anonKey, options);
const anonymous = createClient(url, anonKey, options);
let cardId;
let storagePath;

try {
  const [loginA, loginB] = await Promise.all([
    clientA.auth.signInWithPassword({ email: process.env.CARDWISE_RLS_TEST_USER_A_EMAIL, password: process.env.CARDWISE_RLS_TEST_USER_A_PASSWORD }),
    clientB.auth.signInWithPassword({ email: process.env.CARDWISE_RLS_TEST_USER_B_EMAIL, password: process.env.CARDWISE_RLS_TEST_USER_B_PASSWORD }),
  ]);
  if (loginA.error || !loginA.data.user || loginB.error || !loginB.data.user) throw new Error("Dedicated test-account sign-in failed");
  if (loginA.data.user.id === loginB.data.user.id) throw new Error("RLS test accounts must be different users");
  pass("two distinct authenticated test sessions");

  const marker = randomUUID();
  const created = await clientA.from("credit_cards").insert({
    user_id: loginA.data.user.id,
    issuer_name: "CardWise RLS Test",
    card_name: "Disposable Test Card",
    nickname: `rls-${marker}`,
    network: "Local",
    notes: "Automated disposable RLS verification record",
  }).select("id,nickname").single();
  if (created.error || !created.data) throw new Error("User A could not create its disposable test card");
  cardId = created.data.id;
  pass("owner can create and read own credit card");

  const visibleToB = await clientB.from("credit_cards").select("id").eq("id", cardId);
  if (visibleToB.error || visibleToB.data.length !== 0) throw new Error("User B could observe User A's card");
  pass("cross-account card read is denied by RLS");

  const visibleAnon = await anonymous.from("credit_cards").select("id").eq("id", cardId);
  if (!visibleAnon.error && visibleAnon.data.length !== 0) throw new Error("Anonymous client could observe a private card");
  pass("anonymous private-card read is denied");

  const updateByB = await clientB.from("credit_cards").update({ nickname: "forbidden" }).eq("id", cardId).select("id");
  if (updateByB.error || updateByB.data.length !== 0) throw new Error("User B could update User A's card");
  pass("cross-account update is denied by RLS");

  const deleteByB = await clientB.from("credit_cards").delete().eq("id", cardId).select("id");
  if (deleteByB.error || deleteByB.data.length !== 0) throw new Error("User B could delete User A's card");
  pass("cross-account delete is denied by RLS");

  const catalogMutation = await clientB.from("card_catalog").insert({
    provider_id: "manual", external_card_id: marker, normalized_name: marker, name_ko: marker,
    card_type: "credit", brand: "Local", official_url: "https://example.invalid",
    source_url: "https://example.invalid", source_name: "RLS test",
  });
  expectDenied(catalogMutation.error, "non-admin catalog mutation is denied");

  const adminRpc = await clientB.rpc("bootstrap_cardwise_admin", { target_user: loginB.data.user.id });
  expectDenied(adminRpc.error, "non-service-role admin bootstrap is denied");

  storagePath = `${loginA.data.user.id}/rls/${marker}.json`;
  const uploaded = await clientA.storage.from("cardwise-private").upload(storagePath, new Blob(["{}"], { type: "application/json" }));
  if (uploaded.error) throw new Error("User A storage upload failed");
  pass("owner can upload into own private storage prefix");
  const crossDownload = await clientB.storage.from("cardwise-private").download(storagePath);
  expectDenied(crossDownload.error, "cross-account storage download is denied");

  const before = await clientA.from("credit_cards").select("id", { count: "exact", head: true });
  const invalidRpc = await clientA.rpc("add_catalog_card_to_wallet", { target_catalog_card: randomUUID(), options: {} });
  expectDenied(invalidRpc.error, "invalid wallet RPC is rejected atomically");
  const after = await clientA.from("credit_cards").select("id", { count: "exact", head: true });
  if (before.error || after.error || before.count !== after.count) throw new Error("Rejected RPC changed the owner's card count");
  pass("rejected RPC left the owner's data unchanged");
} catch (error) {
  fail(error instanceof Error ? error.message : "RLS verification failed");
} finally {
  if (storagePath) {
    const cleanup = await clientA.storage.from("cardwise-private").remove([storagePath]);
    if (cleanup.error) fail("storage cleanup failed; remove the disposable RLS object manually");
  }
  if (cardId) {
    const cleanup = await clientA.from("credit_cards").delete().eq("id", cardId);
    if (cleanup.error) fail("database cleanup failed; remove the disposable RLS card manually");
  }
  await Promise.all([clientA.auth.signOut({ scope: "local" }), clientB.auth.signOut({ scope: "local" })]);
}
