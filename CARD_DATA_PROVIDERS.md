# 韩国信用卡数据供应商

CardWise 只把已获授权、经过 Schema 校验和人工审核的数据描述为真实信用卡资料。测试 Mock、静态示例和未经确认的 AI/PDF 提取结果不会出现在公开目录，也不会参与确定性优惠计算。

## 当前支持状态

| Provider | 当前状态 | 覆盖范围 | 申请或费用 |
| --- | --- | --- | --- |
| Coocon / 쿠콘 | Skeleton；尚未签约，未安装正式字段合同，不会发起生产请求 | 以商业合同和正式 API 文档为准 | 联系 Coocon 申请企业接口，通常需要签约并可能产生费用 |
| data.go.kr 公共数据 | 适配接口已建立，尚未选择具体数据集 | 只覆盖所选开放数据集明确列出的机构和字段，通常不含完整优惠 | 在 data.go.kr 申请 Service Key，并逐项确认许可、更新频率和字段 |
| Manual 官方资料 | 可用 | 仅包含管理员有权使用并已审核发布的官方产品页、PDF、CSV 或 JSON | 无 API 费用；需要人工核对和持续维护 |
| Mock | 仅自动测试 | 虚构且带有 `TEST ONLY` 标记 | 禁止在生产启用 |

因此，当前代码没有声称已接入任何银行实时优惠 API，也没有使用 CardGorilla、银行或卡公司网页爬虫。

## 环境变量

```env
CARD_CATALOG_PROVIDER=coocon
NEXT_PUBLIC_CARD_CATALOG_PROVIDER=coocon
COOCON_API_BASE_URL=
COOCON_API_KEY=
COOCON_CLIENT_ID=
COOCON_CLIENT_SECRET=

DATA_GO_KR_SERVICE_KEY=
DATA_GO_KR_DATASET_NAME=

SUPABASE_SERVICE_ROLE_KEY=
CARDWISE_CRON_SECRET=
```

所有 Key、Secret 和 service role 值均为服务端变量。`NEXT_PUBLIC_CARD_CATALOG_PROVIDER` 只包含非敏感 Provider ID，用于管理员页面显示默认选项。

## Provider 未配置时

- 搜索接口仍可读取数据库中由管理员人工审核发布的目录。
- 页面显示“尚未配置韩国信用卡数据供应商”，不会返回测试卡或虚构成功结果。
- 同步接口创建可审计的 `not_configured` 记录并返回稳定错误码。
- 用户仍可选择“找不到我的卡，手动添加”，自行维护权益来源。

## 同步与可信状态

1. Provider 响应先经过 Zod 校验、Unicode/发卡机构标准化、去重和指纹计算。
2. 新产品、普通文字变化和无法精确转换的优惠进入 `needs_review`。
3. 金额、比例、限额、前月消费和有效期属于重点变化，必须经过管理员审核。
4. 发布新权益时创建新版本，不覆盖旧版。停发只改变目录状态，不删除用户卡片。
5. 持卡人收到版本提醒；确认后才为未来计算创建新的个人权益。过去交易的 `rule_snapshot` 保持不变。
6. 分页 Cursor、Rate Limit、超时和有限重试由具体签约客户端实现；同步任务使用 Provider + idempotency key 防重复。

可信状态含 `unverified`、`needs_review`、`verified`、`outdated` 和 `conflicted`。普通用户只能读取已发布的 `verified` 数据；原始供应商载荷不直接暴露给浏览器。

## 官方资料人工维护

管理员页面支持上传不超过 5MB 的 PDF、CSV 或 JSON，并记录官方 URL、资料日期和有效期。文件存入私有 Storage，初始状态固定为 `needs_review`。PDF 或 AI/OCR 只能生成候选字段，管理员必须对照原文确认结构化规则后发布。

## 增加新的供应商

1. 在 `lib/card-catalog/providers/` 实现 `KoreanCardCatalogProvider`。
2. 根据正式 API 文档实现独立的签约 Transport，不在通用 Provider 中猜测路径或认证。
3. 使用 `externalCardSchema` / `externalBenefitSchema` 校验响应，再调用 normalizer 和 mapping。
4. 为错误码、超时、分页、Rate Limit、字段差异和许可范围补充测试与文档。
5. 在测试环境使用清楚标记的 Mock；禁止把供应商原始字段直接传给 UI 或权益引擎。
6. 完成安全审查和管理员审核流程后，才允许在生产环境选择该 Provider。
