"use client";

import { FormEvent, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Fingerprint, LockKeyhole, UserRound } from "lucide-react";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { useTheme } from "@/components/theme/theme-provider";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
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

const heroSparkles = [
  { left: "8%", top: "18%", size: "10px", delay: "0s", duration: "4.2s" },
  { left: "22%", top: "12%", size: "6px", delay: "0.8s", duration: "5.1s" },
  { left: "30%", top: "24%", size: "12px", delay: "1.6s", duration: "4.6s" },
  { left: "14%", top: "36%", size: "8px", delay: "0.4s", duration: "5.4s" },
  { left: "34%", top: "42%", size: "10px", delay: "1.2s", duration: "4.8s" },
  { left: "18%", top: "58%", size: "12px", delay: "2.1s", duration: "5.2s" },
  { left: "38%", top: "66%", size: "7px", delay: "0.6s", duration: "4.5s" },
  { left: "10%", top: "78%", size: "11px", delay: "1.8s", duration: "5.6s" },
  { left: "28%", top: "84%", size: "9px", delay: "0.9s", duration: "4.9s" },
  { left: "44%", top: "30%", size: "6px", delay: "1.4s", duration: "5.3s" },
];

const heroRightStars = Array.from({ length: 24 }, (_, index) => {
  const left = 60 + ((index * 9) % 30);
  const top = 8 + ((index * 13) % 82);
  const size = 5 + (index % 5) * 2.5;
  const delay = (index * 0.37) % 3.1;
  const duration = 3.4 + (index % 6) * 0.5;
  const drift = index % 2 === 0 ? 9 : -7;
  const glowPalette = [
    "rgba(217,32,39,0.96)",
    "rgba(231,56,63,0.92)",
    "rgba(194,22,38,0.9)",
    "rgba(255,106,46,0.76)",
  ];
  const glow = glowPalette[index % glowPalette.length];
  const shapeIndex = index % 4;

  return {
    left: `${left}%`,
    top: `${top}%`,
    size: `${size}px`,
    delay: `${delay.toFixed(2)}s`,
    duration: `${duration.toFixed(2)}s`,
    drift: `${drift}px`,
    glow,
    shape: shapeIndex === 0 ? "burst" : shapeIndex === 1 ? "dot" : "cross",
  };
});

const heroMeteorArcs = [
  {
    left: "62%",
    top: "12%",
    width: "140px",
    height: "72px",
    delay: "0.2s",
    duration: "6.6s",
    rotation: "-10deg",
    glow: "rgba(231,56,63,0.9)",
  },
  {
    left: "70%",
    top: "34%",
    width: "124px",
    height: "64px",
    delay: "2.1s",
    duration: "7.2s",
    rotation: "12deg",
    glow: "rgba(217,32,39,0.88)",
  },
  {
    left: "66%",
    top: "62%",
    width: "150px",
    height: "78px",
    delay: "4.4s",
    duration: "7.8s",
    rotation: "-14deg",
    glow: "rgba(194,22,38,0.86)",
  },
];

export default function LoginPage() {
  const t = useTranslations();
  const router = useRouter();
  const { theme } = useTheme();
  const isLightTheme = theme !== "dark";
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const heroAsset = theme === "dark" ? "/assets/login/hero-face-dark.png" : "/assets/login/hero-face-light.png";

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
    <main className="relative min-h-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 [background:var(--login-shell-bg)]" />
        <div className="absolute inset-0 [background:var(--login-shell-glow)]" />
        <div className="absolute inset-y-0 left-[44%] hidden w-[18vw] [background:var(--login-seam-glow)] blur-2xl lg:block" />
        <div className="absolute inset-y-0 right-0 hidden w-[24vw] bg-[radial-gradient(circle_at_center,rgba(217,32,39,0.14),transparent_72%)] lg:block" />
      </div>

      <section className="absolute inset-y-0 left-0 hidden w-1/2 overflow-hidden lg:block">
        <img
          src={heroAsset}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover object-left"
        />
        {isLightTheme ? (
          <>
            <div className="pointer-events-none absolute inset-y-[8%] right-[1%] w-[34%] rounded-full [background:var(--login-light-ambient-haze)] blur-3xl" />
            <div className="pointer-events-none absolute inset-y-[16%] right-[8%] w-[26%] rounded-full [background:var(--login-light-ambient-haze-soft)] blur-[72px]" />
          </>
        ) : null}
        <div className="pointer-events-none absolute inset-y-0 right-[-2%] w-[18%] [background:var(--login-hero-edge-fade)]" />
        <div
          className="pointer-events-none absolute inset-y-[6%] right-[4%] w-[30%] rounded-full blur-2xl"
          style={{
            background:
              theme === "dark"
                ? "radial-gradient(circle at center,rgba(217,32,39,0.2),rgba(231,56,63,0.18) 24%,rgba(255,106,46,0.1) 46%,transparent 76%)"
                : "radial-gradient(circle at center,rgba(217,32,39,0.08),rgba(255,255,255,0.12) 34%,transparent 76%)",
          }}
        />
        <div className="absolute inset-0">
          {theme === "dark"
            ? heroSparkles.map((sparkle, index) => (
              <span
                key={`${sparkle.left}-${sparkle.top}-${index}`}
                className="absolute rounded-full bg-[var(--primary)] opacity-80 shadow-[0_0_14px_rgba(217,32,39,0.55)]"
                style={{
                  left: sparkle.left,
                  top: sparkle.top,
                  width: sparkle.size,
                  height: sparkle.size,
                  animation: `heroSparkle ${sparkle.duration} ease-in-out ${sparkle.delay} infinite`,
                }}
              />
            ))
            : null}
          {theme === "dark"
            ? heroRightStars.map((star, index) => (
              <span
                key={`${star.left}-${star.top}-${index}`}
                className="absolute"
                style={{
                  left: star.left,
                  top: star.top,
                  width: star.size,
                  height: star.size,
                  animation: `heroRightStar ${star.duration} ease-in-out ${star.delay} infinite`,
                  "--hero-right-star-drift": star.drift,
                  "--hero-right-star-glow": star.glow,
                } as React.CSSProperties}
              >
                <span
                  className={
                    star.shape === "cross"
                      ? "absolute inset-0 hero-right-star-cross"
                      : star.shape === "burst"
                        ? "absolute inset-0 hero-right-star-burst"
                        : "absolute inset-[22%] rounded-full bg-[color:var(--hero-right-star-glow)] shadow-[0_0_10px_var(--hero-right-star-glow)]"
                  }
                />
              </span>
            ))
            : null}
          {theme === "dark"
            ? heroMeteorArcs.map((meteor, index) => (
              <span
                key={`${meteor.left}-${meteor.top}-${index}`}
                className="pointer-events-none absolute overflow-visible"
                style={{
                  left: meteor.left,
                  top: meteor.top,
                  width: meteor.width,
                  height: meteor.height,
                  transform: `rotate(${meteor.rotation})`,
                }}
              >
                <span
                  className="hero-meteor-arc absolute inset-0"
                  style={{
                    animation: `heroMeteorArc ${meteor.duration} ease-in-out ${meteor.delay} infinite`,
                    "--hero-meteor-glow": meteor.glow,
                  } as React.CSSProperties}
                />
              </span>
            ))
            : null}
        </div>
      </section>

      <div className="relative ml-auto flex min-h-screen w-full flex-col px-4 py-4 sm:px-6 lg:w-1/2 lg:px-10 xl:px-14">
        <div className="flex justify-end gap-3">
          <LanguageSwitcher compact />
          <ThemeSwitcher compact />
        </div>

        <div className="flex flex-1 items-center justify-center py-4 lg:justify-start">
          <div className="w-full max-w-[760px]">
            <div className="mb-6 lg:mb-7">
              <div className="flex items-start gap-4">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-[18px] border border-[var(--border)] bg-[var(--background-elevated)] text-[var(--primary)] shadow-[var(--shadow-sm)] lg:h-16 lg:w-16">
                  <Fingerprint className="h-7 w-7 lg:h-8 lg:w-8" />
                </div>
                <div className="pt-0.5">
                  <div className="text-[1.75rem] font-semibold leading-none tracking-[-0.04em] text-[var(--foreground)] sm:text-[2rem] xl:text-[2.25rem]">
                    FaceID
                  </div>
                  <div className="mt-1.5 text-[0.9rem] font-medium text-[var(--foreground-soft)] sm:text-[0.96rem] xl:text-[1rem]">
                    Attendance System
                  </div>
                  <div className="mt-1.5 text-xs font-semibold tracking-[0.08em] text-[var(--primary)] xl:text-[0.85rem]">
                    Viettel Internal
                  </div>
                </div>
              </div>

              <div className="mt-5 max-w-[700px] text-[2.15rem] font-semibold leading-[1.08] tracking-[-0.05em] text-[var(--foreground)] sm:text-[2.45rem] xl:text-[2.8rem] 2xl:text-[3rem]">
                <span>{t("auth.heroTitleLine1")}</span>
                <br />
                <span className="text-[var(--primary)]">{t("auth.heroTitleLine2")}</span>
              </div>
            </div>

            <div className="rounded-[26px] border border-[var(--border)] bg-[linear-gradient(180deg,var(--background-elevated)_0%,var(--background-panel)_100%)] p-[1px] shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_0_28px_rgba(217,32,39,0.14)]">
              <Card className="overflow-hidden rounded-[25px] border-[var(--border)] bg-[linear-gradient(180deg,var(--background-elevated)_0%,var(--background-panel)_100%)] shadow-none">
                <CardHeader className="border-b border-[var(--border)] bg-transparent px-6 py-6 sm:px-7 sm:py-7 xl:px-8 xl:py-8">
                  <div className="max-w-md">
                    <CardTitle className="text-[1.55rem] leading-none tracking-[-0.04em] text-[var(--foreground)] sm:text-[1.7rem] xl:text-[1.85rem]">
                      {t("auth.loginTitle")}
                    </CardTitle>
                    <CardDescription className="mt-2.5 text-[0.9rem] leading-6 text-[var(--foreground-soft)] xl:text-[0.95rem]">
                      {t("auth.loginDescription")}
                    </CardDescription>
                  </div>
                </CardHeader>

                <CardContent className="px-6 py-6 sm:px-7 sm:py-7 xl:px-8 xl:py-8">
                  <form className="space-y-5" onSubmit={handleSubmit}>
                    <label className="block space-y-2.5">
                      <span className="text-sm font-semibold text-[var(--foreground)]">{t("auth.username")}</span>
                      <div className="relative">
                        <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--foreground-muted)]" />
                        <Input
                          value={username}
                          onChange={(event) => setUsername(event.target.value)}
                          autoComplete="username"
                          className="h-11 rounded-[14px] border-[var(--border)] bg-[var(--background)] pl-11 text-[15px] text-[var(--foreground)] placeholder:text-[var(--foreground-muted)] focus:border-[var(--primary)] focus:ring-[var(--focus-ring)] xl:h-12"
                          placeholder={t("auth.username")}
                          required
                        />
                      </div>
                    </label>

                    <label className="block space-y-2.5">
                      <span className="text-sm font-semibold text-[var(--foreground)]">{t("auth.password")}</span>
                      <div className="relative">
                        <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--foreground-muted)]" />
                        <Input
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          type={showPassword ? "text" : "password"}
                          autoComplete="current-password"
                          className="h-11 rounded-[14px] border-[var(--border)] bg-[var(--background)] pl-11 pr-12 text-[15px] text-[var(--foreground)] placeholder:text-[var(--foreground-muted)] focus:border-[var(--primary)] focus:ring-[var(--focus-ring)] xl:h-12"
                          placeholder={t("auth.passwordPlaceholder")}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((value) => !value)}
                          className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-xl text-[var(--foreground-soft)] transition hover:bg-[var(--background-muted)] hover:text-[var(--foreground)]"
                          aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </label>

                    {error ? (
                      <div className="rounded-[14px] border border-[var(--danger)] bg-[var(--danger-soft)] px-4 py-3 text-sm leading-6 text-[var(--danger)]">
                        {error}
                      </div>
                    ) : null}

                    <Button
                      type="submit"
                      className="h-11 w-full rounded-[14px] bg-[linear-gradient(180deg,#e6584d_0%,#dc473d_100%)] text-base font-semibold text-white shadow-[0_10px_28px_rgba(217,32,39,0.24)] hover:brightness-105 xl:h-12"
                      disabled={submitting}
                    >
                      <ArrowRight className="h-4 w-4" />
                      {submitting ? t("auth.submitting") : t("auth.submit")}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        <div className="pt-2 text-center text-xs text-[var(--foreground-muted)]">
          (c) 2026 Viettel Group. All rights reserved.
        </div>
      </div>
    </main>
  );
}
