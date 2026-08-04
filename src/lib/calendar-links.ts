function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** UTC ICS timestamp: 20260315T143000Z */
export function toIcsUtc(d: Date): string {
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

export function buildIcs(opts: {
  title: string;
  description: string;
  location: string;
  start: Date;
  end: Date;
}): string {
  const uid = `${Date.now()}@misparat-lidor`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Misparat Lidor//Booking//HE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${toIcsUtc(new Date())}`,
    `DTSTART:${toIcsUtc(opts.start)}`,
    `DTEND:${toIcsUtc(opts.end)}`,
    `SUMMARY:${escapeIcs(opts.title)}`,
    `DESCRIPTION:${escapeIcs(opts.description)}`,
    `LOCATION:${escapeIcs(opts.location)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n");
}

function escapeIcs(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function downloadIcs(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Google Calendar template link */
export function googleCalendarUrl(opts: {
  title: string;
  details: string;
  location: string;
  start: Date;
  end: Date;
}): string {
  const fmt = (d: Date) => toIcsUtc(d).replace(/Z$/, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: opts.title,
    details: opts.details,
    location: opts.location,
    dates: `${fmt(opts.start)}/${fmt(opts.end)}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function bookingCopyText(opts: {
  shop: string;
  service: string;
  whenLabel: string;
  address: string;
  cancelUrl?: string;
}): string {
  const lines = [
    `תור ב${opts.shop}`,
    `שירות: ${opts.service}`,
    `מועד: ${opts.whenLabel}`,
    `כתובת: ${opts.address}`,
  ];
  if (opts.cancelUrl) lines.push(`ביטול: ${opts.cancelUrl}`);
  return lines.join("\n");
}
