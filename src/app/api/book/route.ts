import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { emailConfirmation, emailReminder, smsConfirmation, smsReminder } from "@/lib/messages";
import { formatJerusalem } from "@/lib/time";
import { SHOP } from "@/lib/shop";
import { getShopSettings } from "@/lib/settings";
import { readClientSession } from "@/lib/client-auth";

export const runtime = "nodejs";

const bodySchema = z.object({
  serviceId: z.string().uuid(),
  startAt: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const session = await readClientSession();
  if (!session) {
    return NextResponse.json({ error: "יש להתחבר לפני קביעת תור", code: "auth" }, { status: 401 });
  }

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

  if (
    !rateLimit(`book:ip:${ip}`, 5, 60 * 60 * 1000) ||
    !rateLimit(`book:phone:${session.phone}`, 5, 60 * 60 * 1000)
  ) {
    return NextResponse.json({ error: "יותר מדי בקשות. נסו שוב בעוד שעה." }, { status: 429 });
  }

  const sql = getSql();
  const [client] = await sql<{
    id: string;
    name: string;
    phone: string;
    email: string | null;
    notify_channel: "sms" | "email";
  }[]>`
    select id, name, phone, email, notify_channel from clients where id = ${session.clientId}::uuid
  `;
  if (!client) {
    return NextResponse.json({ error: "יש להתחבר מחדש", code: "auth" }, { status: 401 });
  }

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
  const settings = await getShopSettings();
  const horizonEnd = new Date();
  horizonEnd.setDate(horizonEnd.getDate() + settings.online_booking_horizon_days);
  if (start > horizonEnd) {
    return NextResponse.json(
      { error: `ניתן לקבוע עד ${settings.online_booking_horizon_days} ימים קדימה` },
      { status: 400 },
    );
  }
  const end = new Date(start.getTime() + service.duration_minutes * 60_000);
  const cancelToken = crypto.randomUUID();
  const origin = req.nextUrl.origin;
  const cancelUrl = `${origin}/cancel/${cancelToken}`;

  const channel = client.notify_channel || "sms";
  if (channel === "email" && !client.email) {
    return NextResponse.json({ error: "חסר אימייל להתראות — עדכנו בהגדרות החשבון" }, { status: 400 });
  }

  const smsConfirm = smsConfirmation({
    name: client.name,
    service: service.name,
    startAt: start,
  });
  const smsRem = smsReminder({ time: formatJerusalem(start, "HH:mm") });
  const mailConfirm = emailConfirmation({
    name: client.name,
    service: service.name,
    startAt: start,
    cancelUrl,
  });
  const mailRem = emailReminder({
    name: client.name,
    service: service.name,
    startAt: start,
    cancelUrl,
  });

  const reminderAt = new Date(
    start.getTime() - settings.reminder_hours_before * 60 * 60 * 1000,
  );
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
          ${client.name},
          ${client.phone},
          ${client.email},
          ${cancelToken},
          'online',
          'confirmed'
        )
        returning id
      `;

      if (channel === "sms") {
        if (settings.notify_confirmation) {
          await tx`
            insert into outbox (appointment_id, kind, channel, recipient, body, send_after)
            values (${appt.id}::uuid, 'confirmation', 'sms', ${client.phone}, ${smsConfirm}, now())
          `;
        }
        if (settings.notify_reminder) {
          await tx`
            insert into outbox (appointment_id, kind, channel, recipient, body, send_after)
            values (${appt.id}::uuid, 'reminder', 'sms', ${client.phone}, ${smsRem}, ${reminderSend.toISOString()}::timestamptz)
          `;
        }
      } else if (client.email) {
        if (settings.notify_confirmation) {
          await tx`
            insert into outbox (appointment_id, kind, channel, recipient, body, send_after)
            values (${appt.id}::uuid, 'confirmation', 'email', ${client.email}, ${`${mailConfirm.subject}\n\n${mailConfirm.text}`}, now())
          `;
        }
        if (settings.notify_reminder) {
          await tx`
            insert into outbox (appointment_id, kind, channel, recipient, body, send_after)
            values (${appt.id}::uuid, 'reminder', 'email', ${client.email}, ${`${mailRem.subject}\n\n${mailRem.text}`}, ${reminderSend.toISOString()}::timestamptz)
          `;
        }
      }

      return appt;
    });

    return NextResponse.json({
      ok: true,
      id: rows.id,
      cancelToken,
      shop: SHOP.name,
      appointment: {
        service: service.name,
        start: start.toISOString(),
        end: end.toISOString(),
        clientName: client.name,
        clientPhone: client.phone,
        address: SHOP.address,
        cancelUrl,
      },
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
