import { SHOP, type ShopPublic } from "./shop";
import { formatJerusalem, hebrewWeekday } from "./time";

type WithShop = { shop?: ShopPublic };

function s(opts?: WithShop): ShopPublic {
  return opts?.shop || SHOP;
}

export function smsConfirmation(opts: {
  name: string;
  service: string;
  startAt: Date;
} & WithShop): string {
  const shop = s(opts);
  const day = hebrewWeekday(formatJerusalem(opts.startAt, "yyyy-MM-dd"));
  const time = formatJerusalem(opts.startAt, "HH:mm");
  return `היי ${opts.name}, נקבע לך תור ל${opts.service} ביום ${day} בשעה ${time}. ${shop.name}`;
}

export function smsReminder(opts: { time: string } & WithShop): string {
  const shop = s(opts);
  return `תזכורת: תור מחר בשעה ${opts.time}. לביטול: ${shop.phoneDisplay}`;
}

export function smsCancellation(opts: { name: string } & WithShop): string {
  const shop = s(opts);
  return `היי ${opts.name}, התור בוטל. ${shop.name} ${shop.phoneDisplay}`;
}

export function emailConfirmation(opts: {
  name: string;
  service: string;
  startAt: Date;
  cancelUrl?: string;
} & WithShop): { subject: string; text: string } {
  const shop = s(opts);
  const day = hebrewWeekday(formatJerusalem(opts.startAt, "yyyy-MM-dd"));
  const time = formatJerusalem(opts.startAt, "HH:mm");
  const date = formatJerusalem(opts.startAt, "dd/MM/yyyy");
  const subject = `אישור תור — ${shop.name}`;
  const text = [
    `שלום ${opts.name},`,
    ``,
    `התור שלך נקבע בהצלחה.`,
    `שירות: ${opts.service}`,
    `יום ${day}, ${date} בשעה ${time}`,
    `כתובת: ${shop.address}`,
    `טלפון: ${shop.phoneDisplay}`,
    opts.cancelUrl ? `` : null,
    opts.cancelUrl ? `לביטול: ${opts.cancelUrl}` : null,
    ``,
    shop.name,
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
} & WithShop): { subject: string; text: string } {
  const shop = s(opts);
  const time = formatJerusalem(opts.startAt, "HH:mm");
  const date = formatJerusalem(opts.startAt, "dd/MM/yyyy");
  return {
    subject: `תזכורת לתור מחר — ${shop.name}`,
    text: [
      `שלום ${opts.name},`,
      ``,
      `תזכורת: מחר יש לך תור ל${opts.service}`,
      `${date} בשעה ${time}`,
      `כתובת: ${shop.address}`,
      opts.cancelUrl ? `לביטול: ${opts.cancelUrl}` : null,
      ``,
      shop.name,
    ]
      .filter((l) => l !== null)
      .join("\n"),
  };
}

export function smsReschedule(opts: {
  name: string;
  service: string;
  startAt: Date;
} & WithShop): string {
  const shop = s(opts);
  const day = hebrewWeekday(formatJerusalem(opts.startAt, "yyyy-MM-dd"));
  const time = formatJerusalem(opts.startAt, "HH:mm");
  return `היי ${opts.name}, התור ל${opts.service} עודכן ליום ${day} בשעה ${time}. ${shop.name}`;
}

export function emailReschedule(opts: {
  name: string;
  service: string;
  startAt: Date;
  cancelUrl?: string;
} & WithShop): { subject: string; text: string } {
  const shop = s(opts);
  const day = hebrewWeekday(formatJerusalem(opts.startAt, "yyyy-MM-dd"));
  const time = formatJerusalem(opts.startAt, "HH:mm");
  const date = formatJerusalem(opts.startAt, "dd/MM/yyyy");
  return {
    subject: `עדכון תור — ${shop.name}`,
    text: [
      `שלום ${opts.name},`,
      ``,
      `זמן התור שלך עודכן.`,
      `שירות: ${opts.service}`,
      `יום ${day}, ${date} בשעה ${time}`,
      `כתובת: ${shop.address}`,
      opts.cancelUrl ? `לביטול: ${opts.cancelUrl}` : null,
      ``,
      shop.name,
    ]
      .filter((l) => l !== null)
      .join("\n"),
  };
}

export function smsWaitlistOffer(opts: { day: string; time: string; url: string }): string {
  return `התפנה תור ${opts.day} ${opts.time}. יש לך 15 דק' לאשר: ${opts.url}`;
}

export function smsWaitlistJoined(opts: { date: string }): string {
  return `נרשמת לרשימת המתנה ל-${opts.date}. נעדכן אם יתפנה תור.`;
}

export function smsWaitlistLost(): string {
  return `התור נתפס. נשארת ברשימה להתפנות הבא.`;
}

export function otpEmailBody(code: string, shop: ShopPublic = SHOP): { subject: string; text: string } {
  return {
    subject: `קוד לשינוי סיסמה — ${shop.name}`,
    text: `קוד האימות שלך לשינוי סיסמת מנהל: ${code}\n\nהקוד תקף ל־10 דקות.\nאם לא ביקשת שינוי — התעלם מהודעה זו.`,
  };
}
