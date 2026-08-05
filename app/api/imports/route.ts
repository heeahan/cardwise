import { NextResponse } from "next/server";
import { parseCsvDocument, normalizeImportDate } from "../../../lib/csv";
import { normalizeMerchant } from "../../../lib/benefit-engine/eligibility";
import { requireUser } from "../../../lib/supabase/server";

const failure = (message: string, status: number, code: string) => NextResponse.json({ data: null, error: { code, message } }, { status });
const fingerprint = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))).map((byte) => byte.toString(16).padStart(2, "0")).join("");

export async function POST(request: Request) {
  try {
    const form = await request.formData(); const file = form.get("file"); const cardId = String(form.get("cardId") ?? ""); const benefitId = String(form.get("benefitId") ?? "");
    const mapping = JSON.parse(String(form.get("mapping") ?? "[]")) as unknown;
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".csv") || file.size < 1 || file.size > 5 * 1024 * 1024) return failure("请选择 5MB 以内的 CSV 文件", 422, "INVALID_FILE");
    if (!Array.isArray(mapping) || mapping.length !== 4 || !mapping.every((value) => Number.isInteger(value) && Number(value) >= 0)) return failure("字段映射无效", 422, "INVALID_MAPPING");
    const indexes = mapping.map(Number); const rows = parseCsvDocument(await file.text());
    if (rows.length < 2) return failure("CSV 没有可导入的数据行", 422, "EMPTY_FILE");
    if (rows.length > 5001) return failure("单次最多导入 5000 行", 422, "TOO_MANY_ROWS");
    const { supabase, user } = await requireUser();
    const { data: benefit } = await supabase.from("card_benefits").select("id,card_id,name,rule,category_slug").eq("id", benefitId).eq("card_id", cardId).eq("user_id", user.id).is("deleted_at", null).maybeSingle();
    if (!benefit) return failure("权益不存在、与卡片不匹配或无权访问", 404, "NOT_FOUND");

    const fileId = crypto.randomUUID(); const storagePath = `${user.id}/csv/${fileId}.csv`;
    const { error: uploadError } = await supabase.storage.from("cardwise-private").upload(storagePath, file, { contentType: "text/csv", upsert: false });
    if (uploadError) return failure("CSV 私有上传失败", 400, "UPLOAD_FAILED");
    const fileHash = await fingerprint(await file.text());
    const { data: uploaded, error: metadataError } = await supabase.from("uploaded_files").insert({ id: fileId, user_id: user.id, storage_path: storagePath, original_name: file.name.slice(0, 240), content_type: "text/csv", size_bytes: file.size, purpose: "csv_import", sha256: fileHash, scan_status: "not_required_text" }).select("id").single();
    if (metadataError) { await supabase.storage.from("cardwise-private").remove([storagePath]); return failure("无法记录上传文件", 400, "METADATA_FAILED"); }
    const { data: job, error: jobError } = await supabase.from("import_jobs").insert({ user_id: user.id, uploaded_file_id: uploaded.id, status: "importing", field_mapping: { date: indexes[0], merchant: indexes[1], amount: indexes[2], discount: indexes[3] }, row_count: rows.length - 1 }).select("id").single();
    if (jobError) return failure("无法创建导入任务", 400, "JOB_FAILED");

    let imported = 0; let skipped = 0; let errorCount = 0; const errors: Array<{ row: number; message: string }> = [];
    for (const [offset, row] of rows.slice(1).entries()) {
      const date = normalizeImportDate(row[indexes[0]] ?? ""); const merchant = (row[indexes[1]] ?? "").trim(); const amount = Number((row[indexes[2]] ?? "").replaceAll(",", "")); const discount = Number((row[indexes[3]] ?? "0").replaceAll(",", ""));
      if (!date || !merchant || !Number.isSafeInteger(amount) || amount < 0 || !Number.isSafeInteger(discount) || discount < 0) { errorCount += 1; errors.push({ row: offset + 2, message: "日期、商户或整数金额格式无效" }); continue; }
      const externalFingerprint = await fingerprint(`${cardId}|${date}|${normalizeMerchant(merchant)}|${amount}`);
      const { data: transaction, error: transactionError } = await supabase.from("transactions").insert({ user_id: user.id, card_id: cardId, occurred_at: `${date}T12:00:00+09:00`, merchant_name: merchant, category_slug: benefit.category_slug, original_amount: amount, actual_discount_amount: discount, external_fingerprint: externalFingerprint, import_job_id: job.id, note: `CSV 导入：${file.name.slice(0, 120)}` }).select("id").maybeSingle();
      if (transactionError?.code === "23505") { skipped += 1; continue; }
      if (transactionError || !transaction) { errorCount += 1; errors.push({ row: offset + 2, message: "交易写入失败" }); continue; }
      const { error: usageError } = await supabase.from("benefit_usages").insert({ user_id: user.id, transaction_id: transaction.id, benefit_id: benefit.id, card_id: cardId, occurred_at: `${date}T12:00:00+09:00`, usage_count: 1, discount_amount: discount, rule_snapshot: benefit.rule, benefit_name_snapshot: benefit.name });
      if (usageError) { await supabase.from("transactions").delete().eq("id", transaction.id).eq("user_id", user.id); errorCount += 1; errors.push({ row: offset + 2, message: "权益使用记录写入失败" }); continue; }
      imported += 1;
    }
    const status = errorCount && !imported ? "failed" : "completed";
    await supabase.from("import_jobs").update({ status, imported_count: imported, skipped_count: skipped, error_count: errorCount, errors: errors.slice(0, 100) }).eq("id", job.id).eq("user_id", user.id);
    return NextResponse.json({ data: { jobId: job.id, imported, skipped, errors: errorCount }, error: null }, { status: 201 });
  } catch (error) {
    return failure(error instanceof Error && error.message === "UNAUTHORIZED" ? "请先登录" : "导入失败，请稍后重试", error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 400, "IMPORT_FAILED");
  }
}
