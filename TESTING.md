# 测试

## 单元测试

```bash
npm test
```

Vitest 覆盖 20% 折扣、月度截断、无限额、次数汇总、上月门槛、最低消费、到期、指定星期、线上/线下、多语言商户、排序、删除/修改记录后的恢复、首尔跨月边界和整数舍入。

## 静态检查

```bash
npm run typecheck
npm run lint
```

## 端到端测试

首次运行先安装 Chromium：

```bash
npx playwright install chromium
npm run test:e2e
```

Playwright 配置会复用或启动本地服务，并在桌面 Chromium 与移动端尺寸验证演示登录、推荐前三名和信用卡表单校验/保存。

## RLS 手工验收

在测试 Supabase 建立用户 A 和 B：

1. A 创建卡片、权益和消费。
2. B 直接请求 A 的 UUID；SELECT 应返回空、UPDATE/DELETE 应影响 0 行。
3. A 可以正常读取和修改自己的记录。
4. anon 角色不能读取业务表。
5. 检查 `rule_snapshot` 在权益编辑后保持不变。

邮件和 AI 环境变量保持未配置时，全部核心页面与测试仍应正常运行。
