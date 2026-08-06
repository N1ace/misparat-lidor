import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { autoCompletePastAppointments } from "@/lib/appointments-auto";
import { getSql } from "@/lib/db";
import { normalizePhoneIL, isValidEmail } from "@/lib/phone";
import { smsConfirmation, smsReminder, emailConfirmation, emailReminder, smsReschedule, emailReschedule } from "@/lib/messages";
import { clampName, NAME_LIMITS } from "@/lib/name-limits";
import { formatJerusalem, wallTimeToUtc } from "@/lib/time";
import { upsertClient, getClientByPhone } from "@/lib/clients";
import { getLiveShop, getShopSettings } from "@/lib/settings";
import { validateBookablePeriod } from "@/lib/availability";
import { onSlotFreed } from "@/lib/waitlist";

export const runtime = "nodejs";

const OUTSIDE_HOURS_MSG =
  "התור מחוץ לשעות הפעילות של המספרה. האם אתה בטוח שברצונך לקבוע אותו בכל זאת?";

async function guard() {
  if (!(await readSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return null;
}

export async function DELETE(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "חסר id" }, { status: 400 });
  const sql = getSql();
  const [row] = await sql<{ start: Date; end: Date; status: string }[]>`
    select lower(period) as start, upper(period) as end, status
    from appointments where id = ${id}::uuid
  `;
  await sql`delete from appointments where id = ${id}::uuid`;
  if (row && (row.status === "confirmed" || row.status === "held")) {
    try {
      await onSlotFreed(
        { start: new Date(row.start), end: new Date(row.end) },
        { origin: req.nextUrl.origin },
      );
    } catch (e) {
      console.error("[admin delete] waitlist", e);
    }
  }
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;

  const fromYmd = req.nextUrl.searchParams.get("from");
  const toYmd = req.nextUrl.searchParams.get("to");
  if (!fromYmd || !toYmd || !/^\d{4}-\d{2}-\d{2}$/.test(fromYmd) || !/^\d{4}-\d{2}-\d{2}$/.test(toYmd)) {
    return NextResponse.json({ error: "טווח תאריכים חסר" }, { status: 400 });
  }

  await autoCompletePastAppointments();

  const sql = getSql();
  const from = wallTimeToUtc(fromYmd, "00:00:00");
  const to = wallTimeToUtc(toYmd, "23:59:59");
  const rows = await sql<{
    id: string;
    service_id: string | null;
    service_name: string;
    service_color: string | null;
    client_name: string;
    client_phone: string;
    status: string;
    notes: string | null;
    start: Date;
    end: Date;
  }[]>`
    select a.id, a.service_id, a.service_name, s.color as service_color,
           a.client_name, a.client_phone, a.status, a.notes,
           lower(a.period) as start, upper(a.period) as end
    from appointments a
    left join services s on s.id = a.service_id
    where a.period && tstzrange(${from.toISOString()}::timestamptz, ${to.toISOString()}::timestamptz, '[)')
      and a.status in ('confirmed','done','no_show','held')
    order by lower(a.period)
  `;

  return NextResponse.json({
    appointments: rows.map((r) => ({
      id: r.id,
      service_id: r.service_id,
      service_name: r.service_name,
      service_color: r.service_color,
      client_name: r.client_name,
      client_phone: r.client_phone,
      status: r.status,
      notes: r.notes,
      start: r.start.toISOString(),
      end: r.end.toISOString(),
    })),
  });
}

export async function PATCH(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;

  const body = (await req.json().catch(() => ({}))) as {
    id?: string;
    status?: "done" | "no_show" | "cancelled" | "confirmed";
    serviceId?: string;
    dateYmd?: string;
    startTime?: string;
    name?: string;
    phone?: string;
    notes?: string | null;
    forceOutsideHours?: boolean;
  };
  if (!body.id) {
    return NextResponse.json({ error: "חסר id" }, { status: 400 });
  }

  const sql = getSql();
  const [existing] = await sql<{
    id: string;
    service_id: string | null;
    service_name: string;
    duration_minutes: number;
    client_name: string;
    client_phone: string;
    client_email: string | null;
    cancel_token: string;
    notes: string | null;
    status: string;
    start: Date;
  }[]>`
    select id, service_id, service_name, duration_minutes, client_name, client_phone, client_email,
           cancel_token, notes, status, lower(period) as start
    from appointments where id = ${body.id}::uuid
  `;
  if (!existing) return NextResponse.json({ error: "לא נמצא" }, { status: 404 });

  const previousStartMs = new Date(existing.start).getTime();
  let serviceId = existing.service_id;
  let duration = existing.duration_minutes;
  let serviceName: string | null = null;
  let price: number | null = null;

  if (body.serviceId) {
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
    serviceId = service.id;
    duration = service.duration_minutes;
    serviceName = service.name;
    price = service.price_agorot;
  }

  const phone = body.phone ? normalizePhoneIL(body.phone) : null;
  if (body.phone && !phone) return NextResponse.json({ error: "טלפון לא תקין" }, { status: 400 });

  const name = body.name ? clampName(body.name, NAME_LIMITS.person) || null : null;
  const status = body.status ?? null;
  const notesProvided = body.notes !== undefined;
  const notesValue =
    body.notes === undefined || body.notes == null
      ? null
      : clampName(body.notes, NAME_LIMITS.notes) || null;

  let start: Date | null = null;
  let end: Date | null = null;
  if (body.dateYmd && body.startTime) {
    start = wallTimeToUtc(
      body.dateYmd,
      body.startTime.length === 5 ? `${body.startTime}:00` : body.startTime,
    );
    end = new Date(start.getTime() + duration * 60_000);
  } else if (body.serviceId && !body.dateYmd) {
    start = new Date(existing.start);
    end = new Date(start.getTime() + duration * 60_000);
  }

  if (start && body.dateYmd && body.startTime && !body.forceOutsideHours) {
    const check = await validateBookablePeriod({
      serviceId: serviceId || existing.service_id || "",
      start,
      durationMinutes: duration,
      bypassLead: true,
      excludeAppointmentId: body.id,
      forceOutsideHours: false,
    });
    if (!check.ok) {
      if (check.code === "outside_hours") {
        return NextResponse.json(
          { error: OUTSIDE_HOURS_MSG, code: "outside_hours" },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: check.reason, code: check.code }, { status: 409 });
    }
  } else if (start && body.dateYmd && body.startTime && body.forceOutsideHours) {
    const check = await validateBookablePeriod({
      serviceId: serviceId || existing.service_id || "",
      start,
      durationMinutes: duration,
      bypassLead: true,
      excludeAppointmentId: body.id,
      forceOutsideHours: true,
    });
    if (!check.ok && (check.code === "overlap" || check.code === "closure")) {
      return NextResponse.json({ error: check.reason, code: check.code }, { status: 409 });
    }
  }

  try {
    const previousStatus = existing.status;
    if (start && end) {
      await sql`
        update appointments set
          period = tstzrange(${start.toISOString()}::timestamptz, ${end.toISOString()}::timestamptz, '[)'),
          service_id = coalesce(${serviceId}::uuid, service_id),
          service_name = coalesce(${serviceName}, service_name),
          duration_minutes = ${duration},
          price_agorot = coalesce(${price}, price_agorot),
          client_name = coalesce(${name}, client_name),
          client_phone = coalesce(${phone}, client_phone),
          notes = case when ${notesProvided} then ${notesValue} else notes end,
          status = coalesce(${status}, status)
        where id = ${body.id}::uuid
      `;
    } else {
      await sql`
        update appointments set
          service_id = coalesce(${serviceId}::uuid, service_id),
          service_name = coalesce(${serviceName}, service_name),
          client_name = coalesce(${name}, client_name),
          client_phone = coalesce(${phone}, client_phone),
          notes = case when ${notesProvided} then ${notesValue} else notes end,
          status = coalesce(${status}, status)
        where id = ${body.id}::uuid
      `;
    }

    if (
      status &&
      (status === "cancelled" || status === "no_show") &&
      previousStatus === "confirmed"
    ) {
      try {
        const [period] = await sql<{ start: Date; end: Date }[]>`
          select lower(period) as start, upper(period) as end
          from appointments where id = ${body.id}::uuid
        `;
        if (period) {
          await onSlotFreed(
            { start: new Date(period.start), end: new Date(period.end) },
            { origin: req.nextUrl.origin },
          );
        }
      } catch (e) {
        console.error("[admin patch] waitlist", e);
      }
    }

    const finalPhone = phone || existing.client_phone;
    const finalName = name || existing.client_name;
    try {
      await upsertClient({ name: finalName, phone: finalPhone });
    } catch {
      /* ignore client sync errors */
    }

    // Notify client when booking time changed
    if (start && start.getTime() !== previousStartMs) {
      const finalService = serviceName || existing.service_name;
      const clientRow = await getClientByPhone(finalPhone);
      const channel = clientRow?.notify_channel || (existing.client_email ? "email" : "sms");
      const email = clientRow?.email || existing.client_email;
      const origin = req.nextUrl.origin;
      const cancelUrl = `${origin}/cancel/${existing.cancel_token}`;
      try {
        if (channel === "sms") {
          const bodySms = smsReschedule({ name: finalName, service: finalService, startAt: start, shop: await getLiveShop() });
          await sql`
            insert into outbox (appointment_id, kind, channel, recipient, body, send_after)
            values (${body.id}::uuid, 'reschedule', 'sms', ${finalPhone}, ${bodySms}, now())
            on conflict (appointment_id, kind, channel) do update set
              body = excluded.body, send_after = now(), status = 'pending', attempts = 0, last_error = null
          `;
        } else if (email) {
          const mail = emailReschedule({
            name: finalName,
            service: finalService,
            startAt: start,
            cancelUrl,
            shop: await getLiveShop(),
          });
          await sql`
            insert into outbox (appointment_id, kind, channel, recipient, body, send_after)
            values (
              ${body.id}::uuid, 'reschedule', 'email', ${email},
              ${`${mail.subject}\n\n${mail.text}`}, now()
            )
            on conflict (appointment_id, kind, channel) do update set
              body = excluded.body, send_after = now(), status = 'pending', attempts = 0, last_error = null
          `;
        }
      } catch (e) {
        console.error("reschedule notify failed", e);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string };
    if (err.code === "23P01" || /exclusion|overlap/i.test(err.message || "")) {
      return NextResponse.json({ error: "השעה תפוסה בתור מאושר אחר" }, { status: 409 });
    }
    console.error(e);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
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
    forceOutsideHours?: boolean;
  };

  if (!body.serviceId || !body.name || !body.phone) {
    return NextResponse.json({ error: "חסרים שדות" }, { status: 400 });
  }
  if (!body.startAt && !(body.dateYmd && body.startTime)) {
    return NextResponse.json({ error: "חסרים שדות" }, { status: 400 });
  }

  const clientName = clampName(body.name, NAME_LIMITS.person);
  if (!clientName) return NextResponse.json({ error: "חסרים שדות" }, { status: 400 });

  const phone = normalizePhoneIL(body.phone);
  if (!phone) return NextResponse.json({ error: "טלפון לא תקין" }, { status: 400 });
  const email = body.email?.trim() ? body.email.trim().toLowerCase() : null;
  if (email && !isValidEmail(email)) {
    return NextResponse.json({ error: "אימייל לא תקין" }, { status: 400 });
  }
  const notes = body.notes?.trim() ? clampName(body.notes, NAME_LIMITS.notes) : null;

  const settings = await getShopSettings();
  const shop = await getLiveShop();
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

  const dateYmd = body.dateYmd || formatJerusalem(start, "yyyy-MM-dd");
  void dateYmd;

  if (!body.forceOutsideHours) {
    const check = await validateBookablePeriod({
      serviceId: service.id,
      start,
      durationMinutes: service.duration_minutes,
      bypassLead: true,
    });
    if (!check.ok) {
      if (check.code === "outside_hours") {
        return NextResponse.json(
          { error: OUTSIDE_HOURS_MSG, code: "outside_hours" },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: check.reason, code: check.code }, { status: 409 });
    }
  } else {
    const check = await validateBookablePeriod({
      serviceId: service.id,
      start,
      durationMinutes: service.duration_minutes,
      bypassLead: true,
      forceOutsideHours: true,
    });
    if (!check.ok && (check.code === "overlap" || check.code === "closure")) {
      return NextResponse.json({ error: check.reason, code: check.code }, { status: 409 });
    }
  }

  const horizonEnd = new Date();
  horizonEnd.setDate(horizonEnd.getDate() + settings.manual_booking_horizon_days);
  if (start > horizonEnd) {
    return NextResponse.json(
      { error: `ניתן לקבוע עד ${settings.manual_booking_horizon_days} ימים קדימה` },
      { status: 400 },
    );
  }

  const cancelToken = crypto.randomUUID();
  const origin = req.nextUrl.origin;
  const cancelUrl = `${origin}/cancel/${cancelToken}`;
  const reminderAt = new Date(
    start.getTime() - settings.reminder_hours_before * 60 * 60 * 1000,
  );
  const reminderSend = reminderAt < new Date() ? new Date() : reminderAt;

  const smsConfirm = smsConfirmation({ name: clientName, service: service.name, startAt: start, shop });
  const smsRem = smsReminder({ time: formatJerusalem(start, "HH:mm"), shop });

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

      if (settings.notify_confirmation) {
        await tx`
          insert into outbox (appointment_id, kind, channel, recipient, body, send_after)
          values (${row.id}::uuid, 'confirmation', 'sms', ${phone}, ${smsConfirm}, now())
        `;
      }
      if (settings.notify_reminder) {
        await tx`
          insert into outbox (appointment_id, kind, channel, recipient, body, send_after)
          values (${row.id}::uuid, 'reminder', 'sms', ${phone}, ${smsRem}, ${reminderSend.toISOString()}::timestamptz)
        `;
      }
      if (email && settings.notify_confirmation) {
        const mc = emailConfirmation({ name: clientName, service: service.name, startAt: start, cancelUrl, shop });
        await tx`
          insert into outbox (appointment_id, kind, channel, recipient, body, send_after)
          values (${row.id}::uuid, 'confirmation', 'email', ${email}, ${`${mc.subject}\n\n${mc.text}`}, now())
        `;
      }
      if (email && settings.notify_reminder) {
        const mr = emailReminder({ name: clientName, service: service.name, startAt: start, cancelUrl, shop });
        await tx`
          insert into outbox (appointment_id, kind, channel, recipient, body, send_after)
          values (${row.id}::uuid, 'reminder', 'email', ${email}, ${`${mr.subject}\n\n${mr.text}`}, ${reminderSend.toISOString()}::timestamptz)
        `;
      }
      return row as { id: string };
    })) as { id: string };

    try {
      await upsertClient({ name: clientName, phone, email });
    } catch {
      /* ignore */
    }

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
