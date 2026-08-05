# 测试

## 单元测试

```bash
npm test
```

Vitest 覆盖百分比与积分、单日/月度截断、无限额、次数汇总、上月门槛、最低消费、到期、首尔星期/时段与跨日/月/年边界、渠道、支付方式、报名/优惠券/预约、参与及排除商户、中韩英与标点规范化、同卡推荐去重、删除/修改记录后的额度恢复、整数舍入，以及含引号/逗号/换行的 CSV 解析。

目录测试另外覆盖 Provider 响应校验、韩文搜索标准化、发卡机构别名、同卡去重、外部规则转换、缺失字段进入 `needs_review`、限额与上月消费、同步幂等、停发候选、历史输入不被修改、未配置/待签约状态、超时错误及明确标记的测试 Mock。

## 静态检查

```bash
npm run typecheck
npm run lint
```

## 端到端测试

首次运行先安装 Chromium：

```bash
npx playwright install chromium
npm run build:vercel
npm run test:e2e
```

Playwright 配置会启动已构建的 Next.js 生产服务器，并在桌面 Chromium 与移动端尺寸验证演示登录、推荐前三名、目录未配置提示和手动添加兜底。带真实 Supabase 测试项目的 CI 还应覆盖目录发布、跨用户拒绝、添加目录卡片及权益版本确认。

## 依赖安全审计

```bash
npm audit --omit=dev
npm audit
```

当前生产依赖审计为 0。完整审计仍会报告 Drizzle Kit 与 Cloudflare 本地开发工具的间接依赖；npm 只提供破坏性回退方案，因此不使用 `--force`，应持续跟踪上游安全版本。开发服务器仅绑定受信任网络，生产部署不携带这些开发工具。

## RLS 手工验收

在测试 Supabase 建立用户 A 和 B：

1. A 创建卡片、权益和消费。
2. B 直接请求 A 的 UUID；SELECT 应返回空、UPDATE/DELETE 应影响 0 行。
3. A 可以正常读取和修改自己的记录。
4. anon 角色不能读取业务表。
5. 检查 `rule_snapshot` 在权益编辑后保持不变。

邮件和 AI 环境变量保持未配置时，全部核心页面与测试仍应正常运行。
