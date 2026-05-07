"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Fingerprint, LockKeyhole, LogIn, ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApiError, apiFetch } from "@/lib/api-client";
import { saveAuthTokens } from "@/lib/auth-client";

type LoginResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
};

export default function LoginPage() {
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
        setError(getLoginErrorMessage(err));
      } else {
        setError(err instanceof Error ? err.message : "Không thể đăng nhập. Vui lòng thử lại.");
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
              <div className="text-sm font-semibold">Face Recognition</div>
              <div className="text-xs text-slate-300">Attendance Admin</div>
            </div>
          </div>

          <div className="max-w-xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/10 px-3 py-2 text-sm text-slate-100">
              <ShieldCheck className="h-4 w-4" />
              Bảng điều khiển bảo mật
            </div>
            <h1 className="text-4xl font-semibold tracking-normal">Quản lý điểm danh bằng nhận diện khuôn mặt.</h1>
            <p className="mt-4 max-w-lg text-sm leading-6 text-slate-300">
              Đăng nhập để theo dõi camera, sự kiện nhận diện, chấm công và hồ sơ nhân sự trong cùng một dashboard.
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
              <div className="text-sm font-semibold">Face Recognition</div>
              <div className="text-xs text-slate-500">Attendance Admin</div>
            </div>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-md bg-slate-100 text-slate-700">
                  <LockKeyhole className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>Đăng nhập</CardTitle>
                  <CardDescription>Sử dụng tài khoản admin để vào dashboard.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={handleSubmit}>
                <label className="block space-y-2">
                  <span className="text-sm font-medium">Username</span>
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
                  <span className="text-sm font-medium">Mật khẩu</span>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      className="pl-9 pr-10"
                      placeholder="Nhập mật khẩu"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-1 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                      aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
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
                  {submitting ? "Đang đăng nhập..." : "Đăng nhập"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}

function getLoginErrorMessage(error: ApiError) {
  const backendMessage = String(error.message ?? "");
  const detailsText = getDetailsText(error.details);
  const source = normalizeErrorText(`${error.code ?? ""} ${backendMessage} ${detailsText}`);

  if (
    hasAny(source, [
      "user_not_found",
      "account_not_found",
      "username_not_found",
      "tai khoan khong ton tai",
      "tài khoản không tồn tại",
    ])
  ) {
    return "Tài khoản không tồn tại.";
  }

  if (
    hasAny(source, [
      "wrong_password",
      "invalid_password",
      "password_incorrect",
      "sai mat khau",
      "sai mật khẩu",
      "mat khau khong dung",
      "mật khẩu không đúng",
    ])
  ) {
    return "Mật khẩu không đúng.";
  }

  if (
    hasAny(source, [
      "inactive",
      "disabled",
      "locked",
      "blocked",
      "tam khoa",
      "tạm khóa",
      "vo hieu hoa",
      "vô hiệu hóa",
    ])
  ) {
    return "Tài khoản đã bị khóa hoặc chưa được kích hoạt.";
  }

  if (hasAny(source, ["invalid_credentials", "invalid credentials"])) {
    return "Username hoặc mật khẩu không đúng.";
  }

  if (backendMessage.trim().length > 0 && !backendMessage.startsWith("Request failed")) {
    return backendMessage;
  }

  if (error.status === 401 || error.status === 403 || error.status === 422) {
    return "Username hoặc mật khẩu không đúng.";
  }

  return "Không thể đăng nhập. Vui lòng thử lại.";
}

function getDetailsText(details: unknown): string {
  if (details == null) return "";
  if (typeof details === "string") return details;
  if (typeof details === "number" || typeof details === "boolean") return String(details);

  try {
    return JSON.stringify(details);
  } catch {
    return "";
  }
}

function normalizeErrorText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function hasAny(value: string, patterns: string[]) {
  return patterns.some((pattern) => value.includes(normalizeErrorText(pattern)));
}
