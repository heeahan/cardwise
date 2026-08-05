import { createClient } from "@supabase/supabase-js";

const checks = [];
const add = (name, status, detail) => checks.push({ name, status, detail });
const configured = (name) => Boolean(process.env[name]?.trim());
const required = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_APP_URL", "CARDWISE_CRON_SECRET"];
for (const key of required) add(`environment:${key}`, configured(key) ? "pass" : "blocked", configured(key) ? "已配置" : "未配置");

const parseHttpUrl = (value, allowLocalhost = false) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || (allowLocalhost && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname));
  } catch { return false; }
};
if (configured("NEXT_PUBLIC_SUPABASE_URL")) add("supabase:url", parseHttpUrl(process.env.NEXT_PUBLIC_SUPABASE_URL) ? "pass" : "fail", "必须使用有效 HTTPS URL");
if (configured("NEXT_PUBLIC_APP_URL")) add("application:url", parseHttpUrl(process.env.NEXT_PUBLIC_APP_URL, true) ? "pass" : "fail", "生产使用 HTTPS；仅本地允许 HTTP");
if (configured("CARDWISE_CRON_SECRET")) add("cron:secret-strength", process.env.CARDWISE_CRON_SECRET.length >= 32 ? "pass" : "fail", "至少 32 个字符");

const providerId = process.env.CARD_CATALOG_PROVIDER?.trim() || "coocon";
add("provider:not-mock", providerId === "mock" ? "fail" : "pass", providerId === "mock" ? "生产禁止 Mock Provider" : providerId);
if (providerId === "coocon") {
  const providerKeys = ["COOCON_API_BASE_URL", "COOCON_API_KEY", "COOCON_CLIENT_ID", "COOCON_CLIENT_SECRET", "COOCON_CONTRACT_VERSION"];
  add("provider:coocon-contract", providerKeys.every(configured) ? "pass" : "blocked", providerKeys.every(configured) ? "配置已声明；仍需连接测试" : "Skeleton：尚未签约或安装正式字段合同");
} else if (providerId === "public-data") {
  const providerKeys = ["DATA_GO_KR_SERVICE_KEY", "DATA_GO_KR_DATASET_NAME", "DATA_GO_KR_CONTRACT_VERSION"];
  add("provider:public-data-contract", providerKeys.every(configured) ? "pass" : "blocked", providerKeys.every(configured) ? "数据集合同已声明；仍需连接测试" : "尚未选择合法数据集或字段合同");
}

if (required.slice(0, 3).every(configured)) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const { error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
    add("supabase:auth-connection", error ? "fail" : "pass", error ? "连接或权限失败" : "可连接");
  } catch { add("supabase:auth-connection", "fail", "连接失败"); }
  try {
    const { data, error } = await supabase.rpc("cardwise_production_readiness");
    if (error || !data) add("database:migrations", "fail", "生产就绪 RPC 不存在；请执行全部 migration");
    else {
      add("database:schema-version", data.schemaVersion === "202608050003" ? "pass" : "fail", String(data.schemaVersion ?? "unknown"));
      add("database:required-tables", data.missingTables?.length ? "fail" : "pass", data.missingTables?.length ? `${data.missingTables.length} 项缺失` : "完整");
      add("database:required-rpcs", data.missingFunctions?.length ? "fail" : "pass", data.missingFunctions?.length ? `${data.missingFunctions.length} 项缺失` : "完整");
      add("database:rls", data.rlsDisabledTables?.length ? "fail" : "pass", data.rlsDisabledTables?.length ? `${data.rlsDisabledTables.length} 张表未启用` : "已启用");
      add("storage:private-bucket", data.storage?.exists && data.storage?.private && Number(data.storage?.fileSizeLimit) === 5242880 && data.storage?.mimeTypesMatch === true ? "pass" : "fail", data.storage?.exists ? "已检查隐私、5MB 限制与 MIME allowlist" : "桶不存在");
      add("administrator:exists", Number(data.administratorCount) > 0 ? "pass" : "blocked", Number(data.administratorCount) > 0 ? "已初始化" : "尚未初始化");
      add("catalog:verified-data", Number(data.verifiedCatalogCount) > 0 ? "pass" : "blocked", Number(data.verifiedCatalogCount) > 0 ? "存在已审核卡片" : "尚未发布第一张真实信用卡");
    }
  } catch { add("database:migrations", "fail", "就绪检查失败"); }
}

if (configured("NEXT_PUBLIC_APP_URL")) {
  try {
    const response = await fetch(new URL("/api/health", process.env.NEXT_PUBLIC_APP_URL), { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000), redirect: "follow" });
    const isJson = response.headers.get("content-type")?.includes("application/json");
    add("application:health", response.ok && isJson ? "pass" : "blocked", response.ok && isJson ? "健康检查通过" : "未获得公开 JSON 健康摘要；可能尚未部署或受访问策略保护");
  } catch { add("application:health", "blocked", "无法连接已配置 App URL"); }
}

for (const check of checks) console.log(`[${check.status.toUpperCase()}] ${check.name} — ${check.detail}`);
const failures = checks.filter((check) => check.status === "fail").length;
const blockers = checks.filter((check) => check.status === "blocked").length;
console.log(`生产就绪摘要：通过 ${checks.length - failures - blockers}，失败 ${failures}，阻塞 ${blockers}。未输出任何环境变量值。`);
process.exitCode = failures ? 1 : blockers ? 2 : 0;
