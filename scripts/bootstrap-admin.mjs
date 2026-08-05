import { createClient } from "@supabase/supabase-js";

const required = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "CARDWISE_BOOTSTRAP_ADMIN_USER_ID"];
const missing = required.filter((key) => !process.env[key]?.trim());
const userId = process.env.CARDWISE_BOOTSTRAP_ADMIN_USER_ID?.trim() ?? "";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

if (!process.argv.includes("--confirm")) {
  console.error("管理员初始化是写入操作。确认目标 Supabase 项目后，请使用 npm run bootstrap:admin -- --confirm。");
  process.exit(2);
}
if (missing.length) {
  console.error(`管理员初始化未执行：缺少 ${missing.join(", ")}。请在本地 .env.local 或平台 Secret 中设置，不要粘贴到聊天。`);
  process.exit(2);
}
if (!uuid.test(userId) || userId === "00000000-0000-0000-0000-000000000000") {
  console.error("管理员初始化未执行：CARDWISE_BOOTSTRAP_ADMIN_USER_ID 不是有效的非占位 UUID。");
  process.exit(2);
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId);
if (authError || !authUser.user) {
  console.error("管理员初始化未执行：目标 Auth 用户不存在或当前 Service Role 无权读取。");
  process.exit(1);
}
if (!authUser.user.email_confirmed_at) {
  console.error("管理员初始化未执行：目标 Auth 用户的邮箱尚未验证。");
  process.exit(2);
}

const { data: inserted, error } = await supabase.rpc("bootstrap_cardwise_admin", { target_user: userId });
if (error) {
  console.error("管理员初始化失败：请确认已执行 202608050003_production_activation.sql，且连接的是正确项目。");
  process.exit(1);
}
console.log(inserted ? "管理员已安全初始化，并写入最小审计事件。" : "管理员已存在；幂等检查完成，未重复写入。");
console.log("请立即从运行环境移除一次性变量 CARDWISE_BOOTSTRAP_ADMIN_USER_ID。脚本不会输出用户 UUID 或邮箱。");
