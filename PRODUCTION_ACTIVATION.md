# CardWise 生产激活手册

本手册把“代码已部署”与“生产服务已激活”严格分开。所有命令只打印状态，不打印密钥、用户邮箱或 Auth UUID。不要在聊天、Issue、PR、日志或截图中粘贴任何密钥。

## 1. 创建生产 Supabase 项目

在 Supabase Dashboard 新建独立的生产项目。记录 Project URL、anon key 和 service role key，并只保存到受控的环境变量管理器。不要复用开发项目。

## 2. 连接 Supabase CLI

安装并登录 Supabase CLI，然后在仓库根目录执行 `supabase link --project-ref <project-ref>`。`<project-ref>` 本身不是密钥，但不要把本机访问令牌写入仓库。

## 3. 执行 migration

运行 `supabase db push`。如果只能用 SQL Editor，严格按文件名顺序执行 `supabase/migrations/` 中的全部 SQL，最后一个应为 `202608050003_production_activation.sql`。不要只执行最新文件。

## 4. 验证数据库与 Storage

确认所有业务表启用 RLS，`cardwise-private` 为 private、大小上限 5 MB，允许的 MIME 类型与 migration 一致。配置服务端变量后运行 `npm run verify:production`；它会调用只返回计数和状态的 readiness RPC。

## 5. 配置 Auth URL

在 Authentication → URL Configuration 中把生产站点设为 Site URL，并加入 `<NEXT_PUBLIC_APP_URL>/auth/callback`。本地开发另加 `http://localhost:3000/auth/callback`。不要使用通配的第三方域名。

## 6. 创建首个正式账号

从 `/register` 注册所有者邮箱，完成邮件确认，再通过密码登录。Magic Link 也必须回到同一受控 callback。忘记密码页面始终返回非枚举式结果。

## 7. 获取 Auth UUID

在 Supabase Authentication → Users 中复制已确认账号的 UUID。不要把 UUID 发到聊天或提交到 Git。

## 8. 原子初始化管理员

仅在本机 `.env.local` 临时设置 `CARDWISE_BOOTSTRAP_ADMIN_USER_ID`，然后执行：

```bash
npm run bootstrap:admin -- --confirm
```

脚本先验证 Auth 用户存在且邮箱已确认，再调用仅 service role 可执行的原子 RPC。成功后立即删除这个一次性变量；重复执行是幂等的。

## 9. 配置部署环境变量

在 Sites 的 Environment Variables 中设置 `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`、`NEXT_PUBLIC_APP_URL` 和至少 32 字符的 `CARDWISE_CRON_SECRET`。供应商变量按已签订合同添加。不要设置 `CARDWISE_ENABLE_DEMO_MODE`，也不要把 service role 或供应商密钥加上 `NEXT_PUBLIC_`。

## 10. 重新部署并检查健康状态

环境变量变更后重新部署。访问 `/api/health`，只应看到 application/database/auth/provider/latestSync/timestamp 的安全摘要。管理员登录后访问 `/admin/health` 查看 readiness 与 Provider 连接状态；页面不会显示密钥或原始响应。

## 11. 选择首张真实韩国信用卡来源

在录入首张真实卡之前，由项目所有者明确选择以下一种输入：提供官方权益指南；提供卡名并授权定位官方公开来源；或指定许可允许使用的 data.go.kr 数据集。没有这个决定时保持目录为空，不抓取 CardGorilla，不用 AI 猜测，不把 mock 数据发布为真实卡。

## 12. 管理员审核并发布

把有权使用的 PDF/CSV/JSON 上传到私有 Storage，或通过已安装正式字段合同的 Provider 同步。候选数据必须进入 `needs_review`，管理员核对官方 URL、有效期、费用、资格、上限、例外和来源时间后才能发布为 `verified`。

## 13. 双账户 RLS 验收

创建两个专用、非管理员、可删除的测试账号 A/B，将凭据只放到本机 `.env.local`，再显式执行：

```bash
npm run verify:production:rls -- --confirm-write-tests
```

脚本验证 A 自有数据、B/匿名跨账户拒绝、目录写保护、私有 Storage 和失败 RPC 原子性，并在 `finally` 清理临时对象。未提供确认参数时不会写入。不得使用真实客户账号。

## 14. 运行完整验收

依次运行 `npm run typecheck`、`npm run lint`、`npm test`、`npm run build:vercel`、`npm run build`、`npm run test:e2e`、`npm audit --omit=dev`、`npm run verify:production` 和 `git diff --check`。`verify:production` 中任何 `BLOCKED` 都表示生产尚未激活。

## 15. 配置定时同步

调度器向 `POST /api/admin/card-catalog/sync` 发送 `x-cardwise-cron-secret`，并提供唯一 `idempotencyKey`。仅使用 `CARDWISE_CRON_SECRET`；旧变量 `CARD_CATALOG_CRON_SECRET` 只为兼容。Provider 未配置、仍为 skeleton、限流或已有运行中任务时必须安全失败，并告警而不是重试风暴。

## 16. 监控、回滚与账号生命周期

监控 `/api/health`、同步历史、登录失败率与 5xx；日志只能记录事件分类和关联 ID。部署前保留数据库/Storage 备份，回滚应用版本时不要回滚已应用 migration。用户可在设置中导出自己的 JSON 数据；删除账号需要精确二次确认，会清理私有 Storage 和 Auth 账号并保留去标识化审计记录。管理员必须先转移职责再删除。
