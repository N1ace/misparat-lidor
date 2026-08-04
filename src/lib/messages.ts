import { SHOP } from "./shop";
import { formatJerusalem, hebrewWeekday } from "./time";

export function smsConfirmation(opts: {
  name: string;
  service: string;
  startAt: Date;
}): string {
  const day = hebrewWeekday(formatJerusalem(opts.startAt, "yyyy-MM-dd"));
  const time = formatJerusalem(opts.startAt, "HH:mm");
  // Keep short — UCS-2 ≈ 70 chars/segment
  return `היי ${opts.name}, נקבע לך תור ל${opts.service} ביום ${day} בשעה ${time}. ${SHOP.name}`;
}

export function smsReminder(opts: { time: string }): string {
  return `תזכורת: תור מחר בשעה ${opts.time}. לביטול: ${SHOP.phoneDisplay}`;
}

export function smsCancellation(opts: { name: string }): string {
  return `היי ${opts.name}, התור בוטל. ${SHOP.name} ${SHOP.phoneDisplay}`;
}

export function emailConfirmation(opts: {
  name: string;
  service: string;
  startAt: Date;
  cancelUrl?: string;
}): { subject: string; text: string } {
  const day = hebrewWeekday(formatJerusalem(opts.startAt, "yyyy-MM-dd"));
  const time = formatJerusalem(opts.startAt, "HH:mm");
  const date = formatJerusalem(opts.startAt, "dd/MM/yyyy");
  const subject = `אישור תור — ${SHOP.name}`;
  const text = [
    `שלום ${opts.name},`,
    ``,
    `התור שלך נקבע בהצלחה.`,
    `שירות: ${opts.service}`,
    `יום ${day}, ${date} בשעה ${time}`,
    `כתובת: ${SHOP.address}`,
    `טלפון: ${SHOP.phoneDisplay}`,
    opts.cancelUrl ? `` : null,
    opts.cancelUrl ? `לביטול: ${opts.cancelUrl}` : null,
    ``,
    SHOP.name,
  ]
    .filter((l) => l !== null)
    .join("\n");
  return { subject, text };
}

export function emailReminder(opts: {
  name: string;
  service: string;
  startAt: Date;
  cancelUrl?: string;
}): { subject: string; text: string } {
  const time = formatJerusalem(opts.startAt, "HH:mm");
  const date = formatJerusalem(opts.startAt, "dd/MM/yyyy");
  return {
    subject: `תזכורת לתור מחר — ${SHOP.name}`,
    text: [
      `שלום ${opts.name},`,
      ``,
      `תזכורת: מחר יש לך תור ל${opts.service}`,
      `${date} בשעה ${time}`,
      `כתובת: ${SHOP.address}`,
      opts.cancelUrl ? `לביטול: ${opts.cancelUrl}` : null,
      ``,
      SHOP.name,
    ]
      .filter((l) => l !== null)
      .join("\n"),
  };
}

export function smsReschedule(opts: {
  name: string;
  service: string;
  startAt: Date;
}): string {
  const day = hebrewWeekday(formatJerusalem(opts.startAt, "yyyy-MM-dd"));
  const time = formatJerusalem(opts.startAt, "HH:mm");
  return `היי ${opts.name}, התור ל${opts.service} עודכן ליום ${day} בשעה ${time}. ${SHOP.name}`;
}

export function emailReschedule(opts: {
  name: string;
  service: string;
  startAt: Date;
  cancelUrl?: string;
}): { subject: string; text: string } {
  const day = hebrewWeekday(formatJerusalem(opts.startAt, "yyyy-MM-dd"));
  const time = formatJerusalem(opts.startAt, "HH:mm");
  const date = formatJerusalem(opts.startAt, "dd/MM/yyyy");
  return {
    subject: `עדכון תור — ${SHOP.name}`,
    text: [
      `שלום ${opts.name},`,
      ``,
      `זמן התור שלך עודכן.`,
      `שירות: ${opts.service}`,
      `יום ${day}, ${date} בשעה ${time}`,
      `כתובת: ${SHOP.address}`,
      opts.cancelUrl ? `לביטול: ${opts.cancelUrl}` : null,
      ``,
      SHOP.name,
    ]
      .filter((l) => l !== null)
      .join("\n"),
  };
}

export function otpEmailBody(code: string): { subject: string; text: string } {
  return {
    subject: `קוד לשינוי סיסמה — ${SHOP.name}`,
    text: `קוד האימות שלך לשינוי סיסמת מנהל: ${code}\n\nהקוד תקף ל־10 דקות.\nאם לא ביקשת שינוי — התעלם מהודעה זו.`,
  };
}
