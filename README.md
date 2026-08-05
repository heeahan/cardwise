# CardWise

CardWise 是一个可部署的个人信用卡权益管理与优惠额度追踪应用。它用结构化规则确定性地计算优惠、剩余额度和使用次数，并根据具体消费场景解释推荐前三张卡的理由。

> 仓库中的 A—E 信用卡和全部权益均为演示数据，不代表任何真实银行产品或当前有效权益。

## 已实现

- 邮箱密码与 Magic Link 登录入口；未配置 Supabase 时自动进入有明显标识的演示模式。
- 信用卡、权益和消费记录的新增/编辑；卡片收藏、启停、排序、软删除和整组恢复；正式环境使用 Supabase 持久化。
- 百分比、固定减免、返现、免费服务、积分和里程；单笔/日/月/年限额、次数、门槛、日期、首尔时区星期/时段、渠道、地区、支付方式、门店、报名、优惠券和预约规则。
- 中韩英商户关键词规范化匹配；推荐结果按信用卡去重，返回前三张卡及可用或不推荐原因。
- 真实数据仪表盘、动态日历/分析/站内提醒、个人设置和安全退出。
- CSV 在浏览器预览，正式环境将原文件存入私有 Storage，由服务端最多导入 5000 行，并记录文件、任务、指纹去重及错误统计。
- PostgreSQL schema、索引、软删除、历史规则快照、Supabase RLS、私有 Storage 策略和初始化元数据。
- Vitest 单元测试与 Playwright 桌面/移动端端到端测试。
- 韩国信用卡目录 Provider 框架、已审核目录搜索/详情、添加到个人账户、官方资料人工导入、增量同步记录、权益版本确认与数据库级管理员审核。

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

详细说明见 [数据库](./DATABASE.md)、[权益引擎](./BENEFIT_ENGINE.md)、[信用卡数据供应商](./CARD_DATA_PROVIDERS.md)、[安全](./SECURITY.md)、[测试](./TESTING.md) 和 [部署](./DEPLOYMENT.md)。当前未取得 Coocon 商业接口合同，也未选择 data.go.kr 具体数据集，因此线上不会返回伪造的韩国信用卡产品；管理员可从有权使用的官方资料建立待审核目录。当前也未接入银行流水 API，交易仍需手动录入或 CSV 导入。
