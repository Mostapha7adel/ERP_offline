import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Lock, Mail, ShieldCheck, ArrowLeft } from "lucide-react";
import { loginSchema, type LoginFormValues } from "@/lib/schemas";
import { useAuthStore } from "@/stores/auth-store";
import { useSettingsStore } from "@/stores/settings-store";
import { hydrateAll } from "@/lib/api/hydration";
import { authApi } from "@/lib/api";
import { toast } from "@/shared/lib/toast";
import { APP_TAGLINE, APP_VERSION } from "@/config/app";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { useT, type TranslateFn } from "@/shared/lib/i18n";
import { LocaleToggle } from "@/shared/components/layout/locale-toggle";
import { AppLogo } from "@/shared/components/layout/app-logo";
import { WorkspaceConnect } from "@/features/network/workspace-connect";

export function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const company = useSettingsStore((s) => s.company);
  const { t } = useT();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(true);
  const [mode, setMode] = useState<"login" | "forgot">("login");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const forgot = useForm<{ email: string; newPassword: string; confirmPassword: string }>({
    defaultValues: { email: "", newPassword: "", confirmPassword: "" },
  });
  const [forgotLoading, setForgotLoading] = useState(false);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      const user = await login(email, password, remember);
      await hydrateAll();
      useAuthStore.getState().setHydrated();
      toast.success(t("Welcome back, ", "مرحباً بعودتك، ") + user.name.split(" ")[0]);
      navigate("/app/dashboard");
    } catch (error) {
      const message = translateLoginError(error, t);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (values: LoginFormValues) => {
    void signIn(values.email, values.password);
  };

  const onForgot = async (values: { email: string; newPassword: string; confirmPassword: string }) => {
    if (values.newPassword.length < 8) {
      toast.error(t("New password must be at least 8 characters", "يجب ألا تقل كلمة المرور الجديدة عن 8 أحرف"));
      return;
    }
    if (values.newPassword !== values.confirmPassword) {
      toast.error(t("Passwords do not match", "كلمتا المرور غير متطابقتين"));
      return;
    }
    setForgotLoading(true);
    try {
      await authApi().forgotPassword(values.email, values.newPassword);
      toast.success(t("Password reset. You can now sign in.", "تمت إعادة تعيين كلمة المرور. يمكنك الآن تسجيل الدخول."));
      setMode("login");
      forgot.reset();
    } catch (error) {
      const message =
        error && (error as Error).message === "Only the super admin can reset a password. Contact your administrator."
          ? t("Only the super admin can reset a password. You are not allowed to perform this action.", "فقط السوبر أدمن يمكنه إعادة تعيين كلمة المرور. غير مسموح لك بالقيام بهذا الإجراء.")
          : (error instanceof Error ? error.message : t("Reset failed", "فشلت إعادة التعيين"));
      toast.error(message);
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-muted/30 p-4">
      <BackgroundDecor />
      <div className="absolute start-4 top-4 z-10 flex items-center gap-2">
        <LocaleToggle />
      </div>
      <div className="grid w-full max-w-4xl overflow-hidden rounded-2xl border bg-card shadow-2xl lg:grid-cols-2">
        <div className="relative hidden flex-col justify-between bg-gradient-to-br from-primary to-[hsl(262_83%_58%)] p-8 text-primary-foreground lg:flex">
          <div className="flex items-center gap-2.5">
            <AppLogo className="size-9 rounded-lg shadow-lg" />
            <span className="text-lg font-semibold">{company.name}</span>
          </div>
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold leading-tight">
              {company.name}
              <br />
              {t("keeps your books offline", "يحفظ دفاترك دون اتصال")}
            </h2>
            <p className="max-w-xs text-sm text-primary-foreground/80">
              {APP_TAGLINE}. {t("Your data never leaves this device.", "بياناتك لا تغادر هذا الجهاز أبداً.")}
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              {[t("Offline", "دون اتصال"), t("Private", "خاص"), t("Local-first", "محلي أولاً")].map((badge) => (
                <span
                  key={badge}
                  className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur"
                >
                  {badge}
                </span>
              ))}
            </div>
          </div>
          <p className="text-xs text-primary-foreground/60">
            {t("Version", "الإصدار")} {APP_VERSION}
          </p>
        </div>

        <div className="p-8">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <AppLogo className="size-9 rounded-lg shadow" />
            <span className="text-lg font-semibold">{company.name}</span>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">{mode === "login" ? t("Sign in", "تسجيل الدخول") : t("Forgot password", "نسيت كلمة المرور")}</h1>
              <p className="text-sm text-muted-foreground">
                {mode === "login"
                  ? t("Welcome back. Enter your credentials.", "مرحباً بعودتك. أدخل بيانات الدخول الخاصة بك.")
                  : t("Enter your email and a new password to reset it.", "أدخل بريدك الإلكتروني وكلمة مرور جديدة لإعادة تعيينها.")}
              </p>
            </div>

            {mode === "login" ? (
              <>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">{t("Email", "البريد الإلكتروني")}</Label>
                  <div className="relative">
                    <Mail className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@company.com"
                      className="ps-9"
                      {...register("email")}
                    />
                  </div>
                  {errors.email ? (
                    <p className="text-xs text-destructive">{errors.email.message}</p>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password">{t("Password", "كلمة المرور")}</Label>
                  <div className="relative">
                    <Lock className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className="ps-9 pe-9"
                      {...register("password")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? t("Hide password", "إخفاء كلمة المرور") : t("Show password", "إظهار كلمة المرور")}
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                  {errors.password ? (
                    <p className="text-xs text-destructive">{errors.password.message}</p>
                  ) : null}
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Checkbox id="remember" checked={remember} onCheckedChange={(v) => setRemember(Boolean(v))} />
                    <Label htmlFor="remember" className="font-normal text-muted-foreground">
                      {t("Remember me", "تذكرني")}
                    </Label>
                  </div>
                  <button type="button" onClick={() => setMode("forgot")} className="text-primary hover:underline">
                    {t("Forgot password?", "نسيت كلمة المرور؟")}
                  </button>
                </div>

                <Button type="submit" className="w-full" size="lg" loading={loading}>
                  {loading ? t("Signing in…", "جارٍ تسجيل الدخول…") : t("Sign in", "تسجيل الدخول")}
                </Button>
              </form>

              <WorkspaceConnect />
              </>
            ) : (
              <form onSubmit={forgot.handleSubmit(onForgot)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="forgot-email">{t("Email", "البريد الإلكتروني")}</Label>
                  <div className="relative">
                    <Mail className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="forgot-email"
                      type="email"
                      placeholder="you@company.com"
                      className="ps-9"
                      {...forgot.register("email")}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="forgot-new">{t("New password", "كلمة المرور الجديدة")}</Label>
                  <div className="relative">
                    <Lock className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="forgot-new"
                      type="password"
                      autoComplete="new-password"
                      placeholder="••••••••"
                      className="ps-9"
                      {...forgot.register("newPassword")}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="forgot-confirm">{t("Confirm new password", "تأكيد كلمة المرور الجديدة")}</Label>
                  <div className="relative">
                    <Lock className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="forgot-confirm"
                      type="password"
                      autoComplete="new-password"
                      placeholder="••••••••"
                      className="ps-9"
                      {...forgot.register("confirmPassword")}
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" size="lg" loading={forgotLoading}>
                  {forgotLoading ? t("Please wait…", "يرجى الانتظار…") : t("Reset password", "إعادة تعيين كلمة المرور")}
                </Button>
                <button
                  type="button"
                  onClick={() => { setMode("login"); forgot.reset(); }}
                  className="flex w-full items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="size-4 rtl:rotate-180" /> {t("Back to sign in", "العودة لتسجيل الدخول")}
                </button>
              </form>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

/**
 * Map backend error messages (which are English) to Arabic, honoring the
 * active locale. Falls back to the raw message when unknown.
 */
function translateLoginError(error: unknown, t: TranslateFn): string {
  const message = error instanceof Error ? error.message : "";
  const pairs: Array<[string, [string, string]]> = [
    ["Email not found. Check the email address or create an account.", ["Email not found. Check the email address or create an account.", "البريد الإلكتروني غير موجود. تحقق من العنوان أو أنشئ حساباً."]],
    ["Incorrect password. Please try again.", ["Incorrect password. Please try again.", "كلمة المرور غير صحيحة. حاول مرة أخرى."]],
    ["This account is disabled", ["This account is disabled", "هذا الحساب معطّل."]],
    ["Invalid email address", ["Invalid email address", "عنوان بريد إلكتروني غير صالح."]],
    ["Password is required", ["Password is required", "كلمة المرور مطلوبة."]],
  ];
  for (const [en, both] of pairs) {
    if (message === en) return t(both[0], both[1]);
  }
  return message || t("Unable to sign in", "تعذّر تسجيل الدخول");
}

function BackgroundDecor() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <motion.div
        animate={{ y: [0, -30, 0], opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -left-32 -top-32 size-96 rounded-full bg-primary/20 blur-3xl"
      />
      <motion.div
        animate={{ y: [0, 30, 0], opacity: [0.15, 0.3, 0.15] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -bottom-40 -right-32 size-[30rem] rounded-full bg-[#0ea5e9]/20 blur-3xl"
      />
    </div>
  );
}

export function Flyer({ icon: Icon, label, value }: { icon: typeof Lock; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border p-3">
      <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" />
      </div>
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{value}</p>
      </div>
    </div>
  );
}

export function SecurityTrustBanner() {
  const { t } = useT();
  return (
    <div className="flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
      <ShieldCheck className="size-4" />
      <span>{t("All data stays on your device", "كل البيانات تبقى على جهازك")}</span>
    </div>
  );
}