import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { isValidEmail, normalizePhoneIL } from "@/lib/phone";
import { rateLimit } from "@/lib/rate-limit";
import { emailConfirmation, emailReminder, smsConfirmation, smsReminder } from "@/lib/messages";
import { formatJerusalem } from "@/lib/time";
import { SHOP } from "@/lib/shop";

export const runtime = "nodejs";

const bodySchema = z.object({
  serviceId: z.string().uuid(),
  startAt: z.string().min(1),
  name: z.string().trim().min(2).max(80),
  phone: z.string().min(8).max(20),
  email: z.union([z.string().email(), z.literal("")]).optional(),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "unknown";

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "נא למלא את כל השדות" }, { status: 400 });
  }

  const phone = normalizePhoneIL(parsed.data.phone);
  if (!phone) {
    return NextResponse.json({ error: "מספר טלפון לא תקין" }, { status: 400 });
  }

  const emailRaw = parsed.data.email?.trim() || "";
  const email = emailRaw ? emailRaw.toLowerCase() : null;
  if (email && !isValidEmail(email)) {
    return NextResponse.json({ error: "אימייל לא תקין" }, { status: 400 });
  }

  if (!rateLimit(`book:ip:${ip}`, 5, 60 * 60 * 1000) || !rateLimit(`book:phone:${phone}`, 5, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "יותר מדי בקשות. נסו שוב בעוד שעה." }, { status: 429 });
  }

  const sql = getSql();
  const [service] = await sql<{
    id: string;
    name: string;
    duration_minutes: number;
    price_agorot: number;
  }[]>`
    select id, name, duration_minutes, price_agorot
    from services where id = ${parsed.data.serviceId}::uuid and active = true
  `;
  if (!service) {
    return NextResponse.json({ error: "שירות לא נמצא" }, { status: 404 });
  }

  const start = new Date(parsed.data.startAt);
  if (Number.isNaN(start.getTime())) {
    return NextResponse.json({ error: "שעה לא תקינה" }, { status: 400 });
  }
  const end = new Date(start.getTime() + service.duration_minutes * 60_000);
  const cancelToken = crypto.randomUUID();
  const origin = req.nextUrl.origin;
  const cancelUrl = `${origin}/cancel/${cancelToken}`;

  const smsConfirm = smsConfirmation({
    name: parsed.data.name,
    service: service.name,
    startAt: start,
  });
  const smsRem = smsReminder({ time: formatJerusalem(start, "HH:mm") });
  const mailConfirm = email ? emailConfirmation({
    name: parsed.data.name,
    service: service.name,
    startAt: start,
    cancelUrl,
  }) : null;
  const mailRem = email ? emailReminder({
    name: parsed.data.name,
    service: service.name,
    startAt: start,
    cancelUrl,
  }) : null;

  const reminderAt = new Date(start.getTime() - 24 * 60 * 60 * 1000);
  const reminderSend = reminderAt < new Date() ? new Date() : reminderAt;

  try {
    const rows = await sql.begin(async (tx) => {
      const [appt] = await tx<{ id: string }[]>`
        insert into appointments (
          period, service_id, service_name, duration_minutes, price_agorot,
          client_name, client_phone, client_email, cancel_token, source, status
        ) values (
          tstzrange(${start.toISOString()}::timestamptz, ${end.toISOString()}::timestamptz, '[)'),
          ${service.id}::uuid,
          ${service.name},
          ${service.duration_minutes},
          ${service.price_agorot},
          ${parsed.data.name},
          ${phone},
          ${email},
          ${cancelToken},
          'online',
          'confirmed'
        )
        returning id
      `;

      await tx`
        insert into outbox (appointment_id, kind, channel, recipient, body, send_after)
        values
          (${appt.id}::uuid, 'confirmation', 'sms', ${phone}, ${smsConfirm}, now()),
          (${appt.id}::uuid, 'reminder', 'sms', ${phone}, ${smsRem}, ${reminderSend.toISOString()}::timestamptz)
      `;

      if (email && mailConfirm && mailRem) {
        await tx`
          insert into outbox (appointment_id, kind, channel, recipient, body, send_after)
          values
            (${appt.id}::uuid, 'confirmation', 'email', ${email}, ${`${mailConfirm.subject}\n\n${mailConfirm.text}`}, now()),
            (${appt.id}::uuid, 'reminder', 'email', ${email}, ${`${mailRem.subject}\n\n${mailRem.text}`}, ${reminderSend.toISOString()}::timestamptz)
        `;
      }

      return appt;
    });

    return NextResponse.json({
      ok: true,
      id: rows.id,
      cancelToken,
      shop: SHOP.name,
    });
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string };
    if (err.code === "23P01" || /exclusion|overlap/i.test(err.message || "")) {
      return NextResponse.json({ error: "התור נתפס — בחרו שעה אחרת" }, { status: 409 });
    }
    console.error(e);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
