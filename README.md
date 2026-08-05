# CardWise

CardWise 是一个可部署的个人信用卡权益管理与优惠额度追踪应用。它用结构化规则确定性地计算优惠、剩余额度和使用次数，并根据具体消费场景解释推荐前三张卡的理由。

> 仓库中的 A—E 信用卡和全部权益均为演示数据，不代表任何真实银行产品或当前有效权益。

## 已实现

- 邮箱密码与 Magic Link 登录入口；未配置 Supabase 时自动进入有明显标识的演示模式。
- 信用卡、权益和消费记录的新增、编辑、软删除，以及正式环境中连接 Supabase 的完整持久化链路。
- 百分比、固定金额、返现与免费服务计算；单笔/月/年限额、次数、门槛、日期、星期、渠道、地区与商户规则。
- 多语言商户关键词匹配与前三名信用卡推荐，包含不推荐原因和数据确认日期。
- 仪表盘、卡片、权益、推荐、消费、CSV 映射/校验/去重/写入、日历、分析、提醒、设置与帮助页面。
- PostgreSQL schema、索引、软删除、历史规则快照、Supabase RLS、私有 Storage 策略和初始化元数据。
- Vitest 单元测试与 Playwright 桌面/移动端端到端测试。

## 本地启动

要求 Node.js 22.13 或更高版本。

```bash
npm install
copy .env.example .env.local
npm run dev
```

打开终端中显示的本地地址。没有填写 Supabase 值时，界面使用本次浏览会话内的演示数据；这些数据不会被冒充为真实刷卡记录。

## 连接 Supabase

1. 新建 Supabase 项目。
2. 按 [DEPLOYMENT.md](./DEPLOYMENT.md) 执行 migration 和 seed。
3. 把 Project URL 与 anon key 写入 `.env.local`。
4. 在 Supabase Authentication 中启用 Email；Magic Link 需要配置 Site URL 和 Redirect URL。

## 常用命令

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run build:vercel
npm run test:e2e
```

## 目录

```text
app/                    Next.js App Router 页面与受保护 API
components/             CardWise 产品界面
lib/benefit-engine/     纯函数权益计算、资格判断、重置与排序
lib/supabase/           浏览器/服务端 Supabase 客户端
supabase/migrations/    完整数据库、索引与 RLS
supabase/seed.sql       公共演示元数据
tests/unit/             确定性计算测试
tests/e2e/              关键用户流程测试
```

详细说明见 [数据库](./DATABASE.md)、[权益引擎](./BENEFIT_ENGINE.md)、[安全](./SECURITY.md)、[测试](./TESTING.md) 和 [部署](./DEPLOYMENT.md)。
