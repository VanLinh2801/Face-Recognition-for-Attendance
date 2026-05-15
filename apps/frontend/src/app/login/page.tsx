"use client";

import { FormEvent, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Fingerprint, LockKeyhole, LogIn, ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApiError, apiFetch } from "@/lib/api-client";
import { saveAuthTokens } from "@/lib/auth-client";
import { getTranslatedBackendError } from "@/lib/translated-backend-error";

type LoginResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
};

export default function LoginPage() {
  const t = useTranslations();
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const data = await apiFetch<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: username.trim(), password }),
      });
      saveAuthTokens({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        tokenType: data.token_type,
        expiresInSeconds: data.expires_in,
      });
      router.push("/");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(getTranslatedBackendError(t, err, "auth"));
      } else {
        setError(err instanceof Error ? err.message : t("errors.system.requestFailed"));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_480px]">
      <section className="relative hidden overflow-hidden bg-slate-950 text-white lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(20,184,166,0.22),transparent_34%),linear-gradient(135deg,#020617_0%,#0f172a_54%,#111827_100%)]" />
        <div className="relative flex h-full flex-col justify-between p-10">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-white text-slate-950">
              <Fingerprint className="h-6 w-6" />
            </div>
            <div>
              <div className="text-sm font-semibold">{t("layout.appName")}</div>
              <div className="text-xs text-slate-300">{t("layout.appSubtitle")}</div>
            </div>
          </div>

          <div className="max-w-xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/10 px-3 py-2 text-sm text-slate-100">
              <ShieldCheck className="h-4 w-4" />
              {t("auth.securityPanel")}
            </div>
            <h1 className="text-4xl font-semibold tracking-normal">{t("auth.heroTitle")}</h1>
            <p className="mt-4 max-w-lg text-sm leading-6 text-slate-300">
              {t("auth.heroDescription")}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 text-sm">
            {[
              ["Realtime", "Camera stream"],
              ["JWT", "Secure API"],
              ["Admin", "Local control"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="font-semibold">{label}</div>
                <div className="mt-1 text-xs text-slate-300">{value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 lg:px-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-slate-950 text-white">
              <Fingerprint className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold">{t("layout.appName")}</div>
              <div className="text-xs text-slate-500">{t("layout.appSubtitle")}</div>
            </div>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-md bg-slate-100 text-slate-700">
                  <LockKeyhole className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>{t("auth.loginTitle")}</CardTitle>
                  <CardDescription>{t("auth.loginDescription")}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={handleSubmit}>
                <label className="block space-y-2">
                  <span className="text-sm font-medium">{t("auth.username")}</span>
                  <div className="relative">
                    <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      autoComplete="username"
                      className="pl-9"
                      placeholder="admin"
                      required
                    />
                  </div>
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium">{t("auth.password")}</span>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      className="pl-9 pr-10"
                      placeholder={t("auth.passwordPlaceholder")}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-1 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                      aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </label>

                {error ? (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
                ) : null}

                <Button type="submit" className="w-full" disabled={submitting}>
                  <LogIn className="h-4 w-4" />
                  {submitting ? t("auth.submitting") : t("auth.submit")}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
