"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { Bell, CreditCard, Sparkles, Star } from "lucide-react";
import { useCardWise } from "../../app/providers";
import { createClient } from "../../lib/supabase/client";
import { authErrorMessage, authQueryMessage, buildAuthCallbackUrl, isValidEmail, safeNextPath, validateAuthForm, type AuthFormErrors } from "../../lib/auth/helpers";

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return <label className={error ? "field error" : "field"}><span>{label}</span>{children}{error && <em role="alert">{error}</em>}</label>;
}

function AuthLayout({ children }: { children: ReactNode }) {
  return <main className="auth-page"><section className="auth-brand"><div className="brand light-brand"><span className="brand-mark"><CreditCard size={21} /></span><span>CardWise</span></div><div><span className="eyebrow light">YOUR BENEFITS, CLEARLY</span><h1>每一项权益，<br />都不该被忘记。</h1><p>追踪信用卡优惠额度与使用次数，在每次消费前找到更合适的卡。</p><div className="auth-art"><div className="credit-card" style={{ background: "linear-gradient(135deg,#7f70ff,#4638ce)" }}><div className="card-top"><span>CardWise</span><Star size={17} fill="currentColor" /></div><div className="chip" /><div className="card-bottom"><div><small>MY SMART CARD</small><b>•••• 2026</b></div><strong>Visa</strong></div></div><div className="floating-saving"><Sparkles size={18} /><span>本月已节省<strong>₩105,300</strong></span></div></div></div><small>演示数据不代表任何真实银行产品</small></section><section className="auth-form-wrap">{children}</section></main>;
}

const hasErrors = (errors: AuthFormErrors) => Object.keys(errors).length > 0;

export function AuthScreen({ register: isRegister }: { register: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { runtimeConfig, demoMode, configurationMissing } = useCardWise();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<AuthFormErrors>({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const configured = runtimeConfig.configurationState === "configured";
  const next = safeNextPath(searchParams.get("next"));
  const queryCode = searchParams.get("accountDeleted") === "1" ? "account_deleted" : searchParams.get("error");
  const queryMessage = authQueryMessage(queryCode);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (loading) return;
    if (demoMode && !isRegister) { router.push("/dashboard"); return; }
    if (!configured) { setMessage("认证服务配置错误，请联系站点管理员。"); return; }
    const validation = validateAuthForm({ displayName, email, password, confirmPassword }, isRegister ? "register" : "login");
    setErrors(validation);
    if (hasErrors(validation)) return;
    setLoading(true); setMessage("");
    try {
      const supabase = createClient(runtimeConfig);
      if (isRegister) {
        const result = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: displayName.trim() }, emailRedirectTo: buildAuthCallbackUrl(location.origin, next) },
        });
        if (result.error) throw result.error;
        if (result.data.user && result.data.user.identities?.length === 0) throw Object.assign(new Error("EMAIL_EXISTS"), { code: "email_exists" });
        if (!result.data.session) { setMessage("注册成功，请检查邮箱并完成验证后登录。"); return; }
      } else {
        const result = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (result.error) throw result.error;
      }
      router.replace(next);
      router.refresh();
    } catch (error) { setMessage(authErrorMessage(error)); }
    finally { setLoading(false); }
  };

  const magic = async () => {
    if (loading) return;
    if (!configured) { setMessage("认证服务配置错误，请联系站点管理员。"); return; }
    if (!isValidEmail(email)) { setErrors({ email: "请输入有效的邮箱地址。" }); return; }
    setErrors({}); setLoading(true); setMessage("");
    try {
      const { error } = await createClient(runtimeConfig).auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false, emailRedirectTo: buildAuthCallbackUrl(location.origin, next) } });
      if (error) throw error;
      setMessage("登录链接已发送，请检查邮箱。");
    } catch (error) { setMessage(authErrorMessage(error)); }
    finally { setLoading(false); }
  };

  return <AuthLayout><form className="auth-form" onSubmit={submit} noValidate><span className="eyebrow">WELCOME</span><h2>{isRegister ? "创建 CardWise 账户" : "欢迎回来"}</h2><p>{isRegister ? "开始管理属于你的信用卡权益。" : "登录后继续管理你的权益与额度。"}</p>{demoMode && <div className="demo-callout"><Sparkles size={17} /><span>当前为明确启用的演示模式，数据不会写入远程数据库。</span></div>}{configurationMissing && <div className="demo-callout warning"><Bell size={17} /><span>认证服务配置错误，演示数据不会自动加载。</span></div>}{isRegister && <Field label="显示名称" error={errors.displayName}><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" /></Field>}<Field label="邮箱" error={errors.email}><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" /></Field><Field label="密码" error={errors.password}><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="至少 8 位" autoComplete={isRegister ? "new-password" : "current-password"} /></Field>{isRegister && <Field label="确认密码" error={errors.confirmPassword}><input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" /></Field>}{(message || queryMessage) && <p className="form-message" role="status">{message || queryMessage}</p>}<button className="primary-btn wide" disabled={loading || configurationMissing || (demoMode && isRegister)}>{loading ? "请稍候…" : demoMode && !isRegister ? "进入演示模式" : isRegister ? "注册账户" : configured ? "登录" : "等待管理员配置"}</button>{configured && !isRegister && <><button type="button" className="secondary-btn wide" disabled={loading} onClick={() => void magic()}>使用 Magic Link</button><Link className="auth-text-link" href="/forgot-password">忘记密码？</Link></>}<p className="auth-switch">{isRegister ? "已经有账户？" : "还没有账户？"}<Link href={isRegister ? "/login" : "/register"}>{isRegister ? "立即登录" : "免费注册"}</Link></p></form></AuthLayout>;
}

export function ForgotPasswordScreen() {
  const { runtimeConfig, configurationMissing } = useCardWise();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (loading) return;
    if (configurationMissing) { setMessage("认证服务配置错误，请联系站点管理员。"); return; }
    if (!isValidEmail(email)) { setError("请输入有效的邮箱地址。"); return; }
    setError(""); setLoading(true); setMessage("");
    try {
      const { error: authError } = await createClient(runtimeConfig).auth.resetPasswordForEmail(email.trim(), { redirectTo: buildAuthCallbackUrl(location.origin, "/reset-password") });
      if (authError) throw authError;
      setMessage("如果该邮箱已注册，将收到密码重置链接。");
    } catch (reason) { setMessage(authErrorMessage(reason)); }
    finally { setLoading(false); }
  };
  return <AuthLayout><form className="auth-form" onSubmit={submit} noValidate><span className="eyebrow">ACCOUNT RECOVERY</span><h2>重置密码</h2><p>我们只会向已注册邮箱发送一次性重置链接。</p><Field label="邮箱" error={error}><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></Field>{message && <p className="form-message" role="status">{message}</p>}<button className="primary-btn wide" disabled={loading || configurationMissing}>{loading ? "正在发送…" : "发送重置链接"}</button><p className="auth-switch"><Link href="/login">返回登录</Link></p></form></AuthLayout>;
}

export function ResetPasswordScreen() {
  const router = useRouter();
  const { runtimeConfig, configurationMissing } = useCardWise();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<AuthFormErrors>({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (loading) return;
    if (configurationMissing) { setMessage("认证服务配置错误，请联系站点管理员。"); return; }
    const validation = validateAuthForm({ email: "", password, confirmPassword }, "reset");
    setErrors(validation);
    if (hasErrors(validation)) return;
    setLoading(true); setMessage("");
    try {
      const { error } = await createClient(runtimeConfig).auth.updateUser({ password });
      if (error) throw error;
      router.replace("/dashboard");
      router.refresh();
    } catch (reason) { setMessage(authErrorMessage(reason)); }
    finally { setLoading(false); }
  };
  return <AuthLayout><form className="auth-form" onSubmit={submit} noValidate><span className="eyebrow">NEW PASSWORD</span><h2>设置新密码</h2><p>新密码至少 8 位，更新后当前安全会话会继续有效。</p><Field label="新密码" error={errors.password}><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" /></Field><Field label="确认新密码" error={errors.confirmPassword}><input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" /></Field>{message && <p className="form-message" role="alert">{message}</p>}<button className="primary-btn wide" disabled={loading || configurationMissing}>{loading ? "正在更新…" : "更新密码"}</button></form></AuthLayout>;
}
