export type PersonValidationKey = "invalidEmail" | "invalidPhone" | "futureJoinedAt";

export function getPersonProfileValidationKey({
  email,
  phone,
  joinedAt,
}: {
  email: string | null | undefined;
  phone: string | null | undefined;
  joinedAt: string | null | undefined;
}) {
  const emailValue = email?.trim() ?? "";
  const phoneValue = phone?.trim() ?? "";

  if (emailValue && !isValidEmail(emailValue)) {
    return "invalidEmail";
  }

  if (phoneValue && !isValidPhone(phoneValue)) {
    return "invalidPhone";
  }

  if (joinedAt && joinedAt > todayValue()) {
    return "futureJoinedAt";
  }

  return null;
}

export function validatePersonProfileFields(input: {
  email: string | null | undefined;
  phone: string | null | undefined;
  joinedAt: string | null | undefined;
}) {
  const key = getPersonProfileValidationKey(input);
  if (key === "invalidEmail") {
    return "Email khong dung dinh dang.";
  }
  if (key === "invalidPhone") {
    return "So dien thoai khong hop le. Vui long nhap 8-15 chu so, co the kem dau +, khoang trang, dau gach ngang hoac ngoac.";
  }
  if (key === "futureJoinedAt") {
    return "Ngay vao lam khong duoc la ngay trong tuong lai.";
  }
  return null;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value: string) {
  if (!/^\+?[0-9\s().-]+$/.test(value)) return false;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
}

function todayValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
