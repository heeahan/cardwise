# CardWise 生产检查清单

- [ ] 独立生产 Supabase 已创建，CLI 已连接。
- [ ] 全部 migration 已按顺序应用，最新为 `202608060001_auth_profile_trigger_hardening.sql`。
- [ ] RLS、私有 Storage、5 MB 上限和 MIME allowlist 已由 readiness 检查通过。
- [ ] Sites 中五个核心环境变量已设置，且没有把服务端密钥设为 `NEXT_PUBLIC_*`。
- [ ] `NEXT_PUBLIC_DEMO_MODE=false`；Provider 不是 mock。
- [ ] Email 注册、验证、密码登录、Magic Link、重置密码、退出和 session 刷新已实测。
- [ ] 已确认首位正式用户，并用一次性 UUID 原子 bootstrap 管理员；临时变量已删除。
- [ ] `/api/health` 不泄露敏感值，管理员 `/admin/health` readiness 通过。
- [ ] 两个专用非管理员账号的 `verify:production:rls` 已通过并完成清理。
- [ ] 首张真实卡的数据来源与授权方式已由所有者明确选择。
- [ ] 首张卡及权益已对照官方资料审核为 `verified`，不存在猜测字段。
- [ ] Cron secret 至少 32 字符，调度器、幂等键、限流和失败告警已配置。
- [ ] 账号数据导出和精确二次确认删除已用测试账号验证。
- [ ] 类型、Lint、单测、两种构建、Playwright、生产依赖审计与 `git diff --check` 全部通过。
- [ ] `npm run verify:production` 为全 PASS，PR CI 通过且无未解决 review。
- [ ] Sites 新版本已部署并完成桌面、移动端与 404 冒烟；访问策略已由所有者确认。

任何未勾选项都是发布阻塞项，不得用占位密钥、mock 卡片或跳过 RLS 来绕过。
