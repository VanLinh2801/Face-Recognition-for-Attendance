export function validatePersonProfileFields({
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
    return "Email không đúng định dạng.";
  }

  if (phoneValue && !isValidPhone(phoneValue)) {
    return "Số điện thoại không hợp lệ. Vui lòng nhập 8-15 chữ số, có thể kèm dấu +, khoảng trắng, dấu gạch ngang hoặc ngoặc.";
  }

  if (joinedAt && joinedAt > todayValue()) {
    return "Ngày vào làm không được là ngày trong tương lai.";
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
