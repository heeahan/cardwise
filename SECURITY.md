# 安全说明

## 数据最小化

CardWise 不收集或保存完整卡号、CVC、银行卡密码、有效期、支付验证码或真实支付凭证。末四位是可选字段，网站不提供支付能力。

## 授权与输入

- Supabase Auth 建立身份；每张用户表强制 RLS，策略只允许 `user_id = auth.uid()`。
- Route Handler 从服务端会话读取用户 ID，永远不信任客户端提交的 `user_id`。
- ID 查询同时附带资源 ID 和当前用户 ID；无记录统一返回 404，避免枚举。
- 服务端输入通过 Zod；SQL 由 Supabase 参数化查询生成，避免 SQL 注入。
- React 默认转义文本；不使用 `dangerouslySetInnerHTML`，降低存储型 XSS 风险。
- CSV 上传限制为 5MB/5000 行；Storage 私有且路径首段必须是当前用户 UUID。服务端重新校验映射、日期和整数金额，不信任浏览器预览结果。
- service role key 只允许存在于受控服务端维护流程，不能使用 `NEXT_PUBLIC_` 前缀。
- 日志不得记录原始上传正文、邮箱之外的身份资料或任何支付信息。
- 发布检查使用 `npm audit --omit=dev` 区分生产依赖与只在本地运行的构建工具；不得用 `npm audit fix --force` 自动接受破坏性降级。
- 目录搜索只返回 `verified` 记录；`raw_data` 通过列级权限与 RLS 对普通浏览器隐藏。管理员权限由 `cardwise_admins`、数据库策略和 Route Handler 三层检查，不能靠隐藏按钮。
- Coocon、data.go.kr、Cron 与 service role 凭据只允许使用无 `NEXT_PUBLIC_` 前缀的服务端变量。同步错误不会返回供应商原始响应、密钥或堆栈。
- 官方 PDF/CSV/JSON 限制为 5MB 并存入私有 Storage；解析结果默认为 `needs_review`，人工确认前不会进入确定性推荐。

## 账户删除

当前版本尚未开放账户自助删除，因为删除 Auth 用户需要受控的服务端管理权限。上线前应实现二次确认流程：先导出可携带数据、删除 Storage 对象，再删除 Auth 用户并依靠级联外键清理业务数据；不得把 service role key 放入客户端。

## 来源可信度

AI/OCR 结果默认 `needs_review`，用户逐项确认后才可进入计算。演示模板始终显示为非官方示例，页面全局展示“实际优惠以发卡机构公告及账单为准”。
