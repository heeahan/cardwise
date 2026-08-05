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

也可在 SQL Editor 中依次执行 `supabase/migrations/202608040001_cardwise.sql` 与 `supabase/seed.sql`。随后检查所有 13 张表均已启用并强制执行 RLS。

在 Authentication → URL Configuration 设置生产 Site URL，并加入：

```text
http://localhost:3000/dashboard
https://YOUR_DOMAIN/dashboard
```

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
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 3. 部署到 Vercel

1. 将仓库导入 Vercel。
2. Framework Preset 选择 Next.js。
3. Build Command 设置为 `npm run build:vercel`。
4. 添加与 `.env.example` 同名的三个生产环境变量。
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
- [ ] `npm run typecheck`、`npm run lint`、`npm test`、`npm run build:vercel` 全部通过。
- [ ] 数据备份、账户删除与隐私联系流程已确定。
- [ ] 逐条确认准备发布的真实权益来源与最后确认日期。
