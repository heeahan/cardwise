# 安全说明

## 数据最小化

CardWise 不收集或保存完整卡号、CVC、银行卡密码、有效期、支付验证码或真实支付凭证。末四位是可选字段，网站不提供支付能力。

## 授权与输入

- Supabase Auth 建立身份；每张用户表强制 RLS，策略只允许 `user_id = auth.uid()`。
- Route Handler 从服务端会话读取用户 ID，永远不信任客户端提交的 `user_id`。
- ID 查询同时附带资源 ID 和当前用户 ID；无记录统一返回 404，避免枚举。
- 服务端输入通过 Zod；SQL 由 Supabase 参数化查询生成，避免 SQL 注入。
- React 默认转义文本；不使用 `dangerouslySetInnerHTML`，降低存储型 XSS 风险。
- 上传限制为 5MB，允许 JPEG/PNG/WebP/PDF/CSV；Storage 私有且路径首段必须是当前用户 UUID。
- service role key 只允许存在于受控服务端维护流程，不能使用 `NEXT_PUBLIC_` 前缀。
- 日志不得记录原始上传正文、邮箱之外的身份资料或任何支付信息。

## 账户删除

设置页提供删除入口。正式产品应在二次确认后调用受保护的服务端管理流程：导出可携带数据、删除 Storage 对象，再删除 Auth 用户；级联外键清理业务数据。操作写入不含敏感正文的审计事件。

## 来源可信度

AI/OCR 结果默认 `needs_review`，用户逐项确认后才可进入计算。演示模板始终显示为非官方示例，页面全局展示“实际优惠以发卡机构公告及账单为准”。
