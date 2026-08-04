/** Normalize Israeli phones to E.164 (+972…). Returns null if invalid. */
export function normalizePhoneIL(input: string): string | null {
  const raw = input.trim().replace(/[\s\-().]/g, "");
  if (!raw) return null;

  let digits = raw;
  if (digits.startsWith("+")) {
    digits = "+" + digits.slice(1).replace(/\D/g, "");
  } else {
    digits = digits.replace(/\D/g, "");
  }

  if (digits.startsWith("+972")) {
    const rest = digits.slice(4);
    if (/^5\d{8}$/.test(rest) || /^[2-9]\d{7,8}$/.test(rest)) return `+972${rest}`;
    return null;
  }
  if (digits.startsWith("972")) {
    const rest = digits.slice(3);
    if (/^5\d{8}$/.test(rest) || /^[2-9]\d{7,8}$/.test(rest)) return `+972${rest}`;
    return null;
  }
  if (digits.startsWith("0")) {
    const rest = digits.slice(1);
    if (/^5\d{8}$/.test(rest) || /^[2-9]\d{7,8}$/.test(rest)) return `+972${rest}`;
    return null;
  }
  if (/^5\d{8}$/.test(digits)) return `+972${digits}`;

  return null;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** Display Israeli mobile as 05X-XXX-XXXX when possible. */
export function formatIsraeliPhone(input: string): string {
  const e164 = normalizePhoneIL(input);
  if (!e164) return input;
  const local = `0${e164.slice(4)}`;
  if (/^05\d{8}$/.test(local)) {
    return `${local.slice(0, 3)}-${local.slice(3, 6)}-${local.slice(6)}`;
  }
  if (local.length === 9) {
    return `${local.slice(0, 2)}-${local.slice(2, 5)}-${local.slice(5)}`;
  }
  return local;
}
