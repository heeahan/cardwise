# 部署指南

## 1. 创建 Supabase

在 Supabase Dashboard 创建项目，记下 Project URL 与 anon key。正式环境只把 anon key 暴露给浏览器；service role key 不在当前客户端流程中使用，也绝不能写入 `NEXT_PUBLIC_*`。

安装 Supabase CLI 后，在项目根目录执行：

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase db seed
```

也可在 SQL Editor 中按文件名顺序执行 `supabase/migrations/` 中的全部 SQL；最后一个必须是 `202608060001_auth_profile_trigger_hardening.sql`。不要跳过、改写或重复粘贴历史 migration。随后运行 `npm run verify:production` 检查表、RPC、RLS、私有 Storage、管理员和已审核目录。

在 Authentication → Providers → Email 中启用 Email provider。生产环境建议保持 Confirm email 开启；本地开发可以为自动化测试临时关闭，但上线前必须恢复并实测确认邮件。Magic Link 使用同一个 Email provider。

在 Authentication → URL Configuration 中：

- Site URL：本地项目填 `http://localhost:3000`；生产项目填真实的 `https://YOUR_PRODUCTION_DOMAIN`。
- Redirect URLs 至少逐项加入：

```text
http://localhost:3000/auth/callback
http://localhost:3000/reset-password
https://YOUR_PRODUCTION_DOMAIN/auth/callback
https://YOUR_PRODUCTION_DOMAIN/reset-password
```

把 `YOUR_PRODUCTION_DOMAIN` 替换为 Vercel 或实际生产部署显示的域名，不要填写 `/dashboard` 作为认证 callback，也不要使用第三方域名通配符。

在 Storage 确认 `cardwise-private` 为私有桶。文件路径必须以当前用户 UUID 为第一层目录。

## 2. 本地验证

```bash
npm install
npm run typecheck
npm run lint
npm test
npm run build:vercel
```

在 `.env.local` 设置：

```text
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=真实的-publishable-或-anon-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_DEMO_MODE=false
```

韩国信用卡目录至少配置 `CARD_CATALOG_PROVIDER`。Coocon 需要签约后提供的 Base URL、API Key、Client ID、Client Secret 及正式字段合同；公共数据需要 `DATA_GO_KR_SERVICE_KEY`、明确的数据集名称、许可和接口文档。没有这些条件时系统会显示未配置状态。

定时同步需要仅存在于服务端的 `SUPABASE_SERVICE_ROLE_KEY` 与至少 32 字符的 `CARDWISE_CRON_SECRET`，请求 `POST /api/admin/card-catalog/sync` 时通过 `x-cardwise-cron-secret` 发送。限制调用频率，并为每次任务提供唯一 `idempotencyKey`。旧变量 `CARD_CATALOG_CRON_SECRET` 仅保留兼容，不应用于新部署。

完整的 Sites 环境变量、Auth callback、管理员 bootstrap、RLS 双账号验收、健康检查、首张真实卡审核和 Cron 操作顺序见 [PRODUCTION_ACTIVATION.md](./PRODUCTION_ACTIVATION.md)。

## 3. 部署到 Vercel

1. 将仓库导入 Vercel。
2. Framework Preset 选择 Next.js。
3. Build Command 设置为 `npm run build:vercel`。
4. 添加 `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`NEXT_PUBLIC_APP_URL=https://YOUR_PRODUCTION_DOMAIN`、`NEXT_PUBLIC_DEMO_MODE=false` 四个生产环境变量；需要管理员任务时再添加仅服务端可见的 service role key。
5. 部署后把真实域名加入 Supabase Redirect URLs，再进行一次密码登录与 Magic Link 验证。

## 4. 备份与恢复

- 在 Supabase 启用 Point-in-Time Recovery（如套餐支持）或按计划运行 `supabase db dump -f backups/cardwise.sql`。
- Storage 文件单独复制；数据库只存文件元数据与路径。
- 恢复到新项目后先执行 migration，再导入数据，最后复制 Storage 对象并重新检查 RLS。
- 备份文件包含个人数据，必须加密并限制访问。

## 正式发布检查清单

- [ ] 删除或隔离演示账号；演示模板仍标注“非银行官方数据”。
- [ ] Supabase Email、Site URL、Redirect URL 配置正确。
- [ ] 使用两个测试账号验证跨用户读取、修改和删除均被 RLS 拒绝。
- [ ] 未在浏览器包、日志或仓库中出现 service role key。
- [ ] Storage 桶保持私有，格式与 5MB 限制生效。
- [ ] 运行一次含重复行与错误行的 CSV 导入，确认 `uploaded_files`、`import_jobs` 和 Storage 对象均属当前用户。
- [ ] `npm run typecheck`、`npm run lint`、`npm test`、`npm run build:vercel` 全部通过。
- [ ] 数据备份、账户删除与隐私联系流程已确定。
- [ ] 逐条确认准备发布的真实权益来源与最后确认日期。
