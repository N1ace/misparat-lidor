import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import { TZ } from "./shop";

export function jerusalemDayOfWeek(dateYmd: string): number {
  // dateYmd = YYYY-MM-DD; Sunday = 0 in Jerusalem
  const noon = fromZonedTime(`${dateYmd}T12:00:00`, TZ);
  return toZonedTime(noon, TZ).getDay();
}

export function wallTimeToUtc(dateYmd: string, hhmmss: string): Date {
  const t = hhmmss.length === 5 ? `${hhmmss}:00` : hhmmss;
  return fromZonedTime(`${dateYmd}T${t}`, TZ);
}

export function formatJerusalem(isoOrDate: string | Date, pattern: string): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return formatInTimeZone(d, TZ, pattern);
}

export function hebrewWeekday(dateYmd: string): string {
  const names = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
  return names[jerusalemDayOfWeek(dateYmd)] ?? "";
}
