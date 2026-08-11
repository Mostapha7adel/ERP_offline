import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { Lock, Mail, ShieldCheck, ArrowRight } from "lucide-react";
import { authApi } from "@/lib/api";
import { setAccessToken } from "@/lib/api/client";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { useT } from "@/shared/lib/i18n";

interface ForcePasswordFormValues {
  email: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/**
 * Optional first-run credentials screen. The signed-in user may update their
 * email/password, or continue to the dashboard leaving them unchanged.
 */
export function ForcePasswordChange() {
  const navigate = useNavigate();
  const clearMustChangePassword = useAuthStore((s) => s.clearMustChangePassword);
  const updateCurrentUserEmail = useAuthStore((s) => s.updateCurrentUserEmail);
  const currentUser = useAuthStore((s) => s.currentUser);
  const { t } = useT();
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ForcePasswordFormValues>({
    defaultValues: {
      email: currentUser?.email ?? "",
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const newPassword = watch("newPassword") ?? "";
  const wantPassword = newPassword.length > 0;

  const onSubmit = async (values: ForcePasswordFormValues) => {
    setLoading(true);
    try {
      const emailChanged =
        values.email.trim().toLowerCase() !== (currentUser?.email ?? "").toLowerCase();

      z.string().email(t("Invalid email address", "بريد إلكتروني غير صالح")).parse(values.email);

      if (wantPassword || emailChanged) {
        if (wantPassword) {
          if (values.newPassword.length < 8) {
            throw new Error(t("New password must be at least 8 characters", "يجب ألا تقل كلمة المرور الجديدة عن 8 أحرف"));
          }
          if (values.newPassword !== values.confirmPassword) {
            throw new Error(t("Passwords do not match", "كلمتا المرور غير متطابقتين"));
          }
        }
        if (!values.currentPassword) {
          throw new Error(t("Enter your current password to make changes", "أدخل كلمة مرورك الحالية لإجراء التغييرات"));
        }
        const result = await authApi().changePassword(
          values.currentPassword,
          wantPassword ? values.newPassword : values.currentPassword,
          values.email,
        );
        setAccessToken(result.accessToken);
        updateCurrentUserEmail(result.email);
        toast.success(t("Your email and password were updated.", "تم تحديث بريدك الإلكتروني وكلمة المرور."));
      } else {
        const result = await authApi().completeSetup();
        setAccessToken(result.accessToken);
        toast.success(t("Welcome!", "مرحباً!"));
      }
      clearMustChangePassword();
      navigate("/app/dashboard", { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : t("Unable to continue", "تعذّر المتابعة");
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl border bg-card p-8 shadow-2xl">
        <div className="space-y-2 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldCheck className="size-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("Welcome — secure your account", "مرحباً — قم بتأمين حسابك")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("You are signed in. Optionally update your email or password, or continue and change them later in Settings.", "تم تسجيل دخولك. يمكنك تحديث بريدك الإلكتروني أو كلمة المرور، أو المتابعة وتغييرها لاحقاً من الإعدادات.")}
            {currentUser ? t(" Signed in as ", " تم تسجيل الدخول باسم ") + `${currentUser.email}.` : ""}
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">{t("Email address", "البريد الإلكتروني")}</Label>
            <div className="relative">
              <Mail className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                className="ps-9"
                {...register("email")}
              />
            </div>
            {errors.email ? (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="currentPassword">{t("Current password (to make changes)", "كلمة المرور الحالية (لإجراء التغييرات)")}</Label>
            <div className="relative">
              <Lock className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                className="ps-9"
                {...register("currentPassword")}
              />
            </div>
            {errors.currentPassword ? (
              <p className="text-xs text-destructive">{errors.currentPassword.message}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="newPassword">{t("New password (optional)", "كلمة المرور الجديدة (اختياري)")}</Label>
            <div className="relative">
              <Lock className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                className="ps-9"
                {...register("newPassword")}
              />
            </div>
            {errors.newPassword ? (
              <p className="text-xs text-destructive">{errors.newPassword.message}</p>
            ) : null}
          </div>

          {wantPassword ? (
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">{t("Confirm new password", "تأكيد كلمة المرور الجديدة")}</Label>
              <div className="relative">
                <Lock className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  className="ps-9"
                  {...register("confirmPassword")}
                />
              </div>
              {errors.confirmPassword ? (
                <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
              ) : null}
            </div>
          ) : null}

          <Button type="submit" className="w-full" size="lg" loading={loading}>
            {loading ? t("Please wait…", "يرجى الانتظار…") : (
              <>
                {t("Continue to dashboard", "متابعة إلى لوحة التحكم")} <ArrowRight className="ms-1 size-4" />
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
