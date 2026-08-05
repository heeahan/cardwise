import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../../lib/supabase/server";

const allowedTypes = new Set(["application/pdf", "text/csv", "application/json"]);

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireAdmin();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !allowedTypes.has(file.type) || file.size < 1 || file.size > 5 * 1024 * 1024) return NextResponse.json({ data: null, error: { code: "INVALID_FILE", message: "仅支持不超过 5MB 的 PDF、CSV 或 JSON 官方资料" } }, { status: 422 });
    const officialUrl = String(form.get("officialUrl") ?? "").trim();
    if (officialUrl && !URL.canParse(officialUrl)) return NextResponse.json({ data: null, error: { code: "INVALID_URL", message: "官方资料链接无效" } }, { status: 422 });
    const safeName = file.name.normalize("NFKC").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "source";
    const storagePath = `${user.id}/catalog-sources/${crypto.randomUUID()}-${safeName}`;
    const bytes = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage.from("cardwise-private").upload(storagePath, bytes, { contentType: file.type, upsert: false });
    if (uploadError) return NextResponse.json({ data: null, error: { code: "UPLOAD_FAILED", message: "官方资料上传失败" } }, { status: 400 });
    const { data, error } = await supabase.from("catalog_source_documents").insert({ uploaded_by: user.id, storage_path: storagePath, original_name: file.name.slice(0, 255), content_type: file.type, size_bytes: file.size, official_url: officialUrl || null, source_name: String(form.get("sourceName") ?? "官方产品资料").trim().slice(0, 200), published_at: String(form.get("publishedAt") ?? "") || null, effective_from: String(form.get("effectiveFrom") ?? "") || null, effective_to: String(form.get("effectiveTo") ?? "") || null, parse_status: "needs_review" }).select("id,original_name,parse_status,created_at").single();
    if (error) {
      await supabase.storage.from("cardwise-private").remove([storagePath]);
      return NextResponse.json({ data: null, error: { code: "METADATA_WRITE_FAILED", message: "资料元数据保存失败，上传对象已清理" } }, { status: 400 });
    }
    return NextResponse.json({ data, error: null, meta: { message: "资料已进入人工审核队列；不会自动成为已验证权益" } }, { status: 201 });
  } catch (error) { const unauthorized = error instanceof Error && error.message === "UNAUTHORIZED"; return NextResponse.json({ data: null, error: { code: unauthorized ? "UNAUTHORIZED" : "FORBIDDEN", message: unauthorized ? "请先登录" : "需要管理员权限" } }, { status: unauthorized ? 401 : 403 }); }
}
