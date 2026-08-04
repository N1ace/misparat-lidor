import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { normalizePhoneIL, isValidEmail } from "@/lib/phone";
import { smsConfirmation, smsReminder, emailConfirmation, emailReminder } from "@/lib/messages";
import { formatJerusalem, wallTimeToUtc } from "@/lib/time";

export const runtime = "nodejs";

async function guard() {
  if (!(await readSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return null;
}

export async function PATCH(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;

  const body = (await req.json().catch(() => ({}))) as {
    id?: string;
    status?: "done" | "no_show" | "cancelled" | "confirmed";
  };
  if (!body.id || !body.status) {
    return NextResponse.json({ error: "חסרים שדות" }, { status: 400 });
  }

  const sql = getSql();
  await sql`
    update appointments set status = ${body.status}
    where id = ${body.id}::uuid
  `;
  return NextResponse.json({ ok: true });
}

/** Walk-in / manual booking — bypasses lead time (caller should pick free slot). */
export async function POST(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;

  const body = (await req.json().catch(() => ({}))) as {
    serviceId?: string;
    startAt?: string;
    dateYmd?: string;
    startTime?: string;
    name?: string;
    phone?: string;
    email?: string;
    notes?: string;
  };

  if (!body.serviceId || !body.name || !body.phone) {
    return NextResponse.json({ error: "חסרים שדות" }, { status: 400 });
  }
  if (!body.startAt && !(body.dateYmd && body.startTime)) {
    return NextResponse.json({ error: "חסרים שדות" }, { status: 400 });
  }

  const phone = normalizePhoneIL(body.phone);
  if (!phone) return NextResponse.json({ error: "טלפון לא תקין" }, { status: 400 });
  const email = body.email?.trim() ? body.email.trim().toLowerCase() : null;
  if (email && !isValidEmail(email)) {
    return NextResponse.json({ error: "אימייל לא תקין" }, { status: 400 });
  }

  const sql = getSql();
  const [service] = await sql<{
    id: string;
    name: string;
    duration_minutes: number;
    price_agorot: number;
  }[]>`
    select id, name, duration_minutes, price_agorot from services
    where id = ${body.serviceId}::uuid and active = true
  `;
  if (!service) return NextResponse.json({ error: "שירות לא נמצא" }, { status: 404 });

  const start = body.startAt
    ? new Date(body.startAt)
    : wallTimeToUtc(body.dateYmd!, body.startTime!.length === 5 ? `${body.startTime}:00` : body.startTime!);
  const end = new Date(start.getTime() + service.duration_minutes * 60_000);
  const cancelToken = crypto.randomUUID();
  const origin = req.nextUrl.origin;
  const cancelUrl = `${origin}/cancel/${cancelToken}`;
  const reminderAt = new Date(start.getTime() - 24 * 60 * 60 * 1000);
  const reminderSend = reminderAt < new Date() ? new Date() : reminderAt;

  const clientName = body.name;
  const notes = body.notes ?? null;

  const smsConfirm = smsConfirmation({ name: clientName, service: service.name, startAt: start });
  const smsRem = smsReminder({ time: formatJerusalem(start, "HH:mm") });

  try {
    const saved = (await sql.begin(async (tx) => {
      const [row] = await tx<{ id: string }[]>`
        insert into appointments (
          period, service_id, service_name, duration_minutes, price_agorot,
          client_name, client_phone, client_email, cancel_token, notes, source, status
        ) values (
          tstzrange(${start.toISOString()}::timestamptz, ${end.toISOString()}::timestamptz, '[)'),
          ${service.id}::uuid, ${service.name}, ${service.duration_minutes}, ${service.price_agorot},
          ${clientName}, ${phone}, ${email}, ${cancelToken}, ${notes}, 'manual', 'confirmed'
        ) returning id
      `;
      await tx`
        insert into outbox (appointment_id, kind, channel, recipient, body, send_after)
        values
          (${row.id}::uuid, 'confirmation', 'sms', ${phone}, ${smsConfirm}, now()),
          (${row.id}::uuid, 'reminder', 'sms', ${phone}, ${smsRem}, ${reminderSend.toISOString()}::timestamptz)
      `;
      if (email) {
        const mc = emailConfirmation({ name: clientName, service: service.name, startAt: start, cancelUrl });
        const mr = emailReminder({ name: clientName, service: service.name, startAt: start, cancelUrl });
        await tx`
          insert into outbox (appointment_id, kind, channel, recipient, body, send_after)
          values
            (${row.id}::uuid, 'confirmation', 'email', ${email}, ${`${mc.subject}\n\n${mc.text}`}, now()),
            (${row.id}::uuid, 'reminder', 'email', ${email}, ${`${mr.subject}\n\n${mr.text}`}, ${reminderSend.toISOString()}::timestamptz)
        `;
      }
      return row as { id: string };
    })) as { id: string };
    return NextResponse.json({ ok: true, id: saved.id });
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string };
    if (err.code === "23P01" || /exclusion|overlap/i.test(err.message || "")) {
      return NextResponse.json({ error: "התור נתפס" }, { status: 409 });
    }
    console.error(e);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
