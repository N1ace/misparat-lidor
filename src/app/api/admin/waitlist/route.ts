import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { clampName, NAME_LIMITS } from "@/lib/name-limits";
import { normalizePhoneIL } from "@/lib/phone";
import { getAvailableSlots, slotsInPreferredWindows } from "@/lib/availability";
import { offerToNextEligible } from "@/lib/waitlist";

export const runtime = "nodejs";

async function guard() {
  if (!(await readSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return null;
}

export async function GET(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;
  const date = req.nextUrl.searchParams.get("date");
  const sql = getSql();
  const entries = date
    ? await sql`
        select w.id, w.client_name, w.client_phone, w.service_id, w.target_date,
               w.any_time, w.status, w.seq, w.created_at, s.name as service_name,
               coalesce(
                 (select json_agg(json_build_object(
                   'start', to_char(ww.start_time, 'HH24:MI'),
                   'end', to_char(ww.end_time, 'HH24:MI')
                 ) order by ww.start_time)
                  from waitlist_windows ww where ww.entry_id = w.id),
                 '[]'::json
               ) as windows
        from waitlist_entries w
        left join services s on s.id = w.service_id
        where w.status in ('waiting','offered')
          and w.target_date = ${date}::date
        order by w.seq
      `
    : await sql`
        select w.id, w.client_name, w.client_phone, w.service_id, w.target_date,
               w.any_time, w.status, w.seq, w.created_at, s.name as service_name,
               coalesce(
                 (select json_agg(json_build_object(
                   'start', to_char(ww.start_time, 'HH24:MI'),
                   'end', to_char(ww.end_time, 'HH24:MI')
                 ) order by ww.start_time)
                  from waitlist_windows ww where ww.entry_id = w.id),
                 '[]'::json
               ) as windows
        from waitlist_entries w
        left join services s on s.id = w.service_id
        where w.status in ('waiting','offered')
        order by w.target_date, w.seq
      `;
  return NextResponse.json({ entries });
}

export async function POST(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;
  const body = (await req.json().catch(() => ({}))) as {
    client_name?: string;
    client_phone?: string;
    service_id?: string;
    target_date?: string;
    preferred_date?: string;
    any_time?: boolean;
    windows?: { start: string; end: string }[];
    notes?: string;
    offer_start?: string;
    force?: boolean;
  };

  // Manual offer push: { id, offer_start }
  if ((body as { id?: string }).id && body.offer_start) {
    const id = (body as { id: string }).id;
    const start = new Date(body.offer_start);
    if (Number.isNaN(start.getTime())) {
      return NextResponse.json({ error: "שעה לא תקינה" }, { status: 400 });
    }
    const sql = getSql();
    const [entry] = await sql<{ duration_minutes: number }[]>`
      select duration_minutes from waitlist_entries where id = ${id}::uuid and status = 'waiting'
    `;
    if (!entry) return NextResponse.json({ error: "רשומה לא ממתינה" }, { status: 404 });
    const end = new Date(start.getTime() + entry.duration_minutes * 60_000);
    const result = await offerToNextEligible(
      { start, end },
      { origin: req.nextUrl.origin, onlyEntryId: id },
    );
    if (!result.offered) {
      return NextResponse.json({ error: "לא ניתן להציע את השעה (תפוסה / מחוץ לחלונות)" }, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  }

  if (!body.client_name?.trim() || !body.client_phone || !body.service_id) {
    return NextResponse.json({ error: "שם, טלפון ושירות חובה" }, { status: 400 });
  }
  const targetDate = body.target_date || body.preferred_date;
  if (!targetDate) return NextResponse.json({ error: "תאריך יעד חובה" }, { status: 400 });

  const clientName = clampName(body.client_name, NAME_LIMITS.person);
  if (!clientName) return NextResponse.json({ error: "שם וטלפון חובה" }, { status: 400 });
  const phone = normalizePhoneIL(body.client_phone);
  if (!phone) return NextResponse.json({ error: "טלפון לא תקין" }, { status: 400 });
  const notes = body.notes?.trim() ? clampName(body.notes, NAME_LIMITS.notes) : null;
  const windows = Array.isArray(body.windows) ? body.windows : [];
  const anyTime = body.any_time !== false && !windows.length;
  const serviceId = body.service_id!;
  const targetDateFinal = targetDate;

  if (!anyTime && !windows.length) {
    return NextResponse.json({ error: "בחרו חלון שעות או ׳כל היום׳" }, { status: 400 });
  }

  const sql = getSql();
  const [service] = await sql<{ duration_minutes: number; price_agorot: number }[]>`
    select duration_minutes, price_agorot from services
    where id = ${serviceId}::uuid and active = true
  `;
  if (!service) return NextResponse.json({ error: "שירות לא נמצא" }, { status: 404 });

  if (!body.force) {
    const slots = await getAvailableSlots(targetDateFinal, serviceId, { bypassLead: true });
    const [booked] = await sql<{ n: number }[]>`
      select count(*)::int as n from appointments
      where status in ('confirmed','held','done')
        and (timezone('Asia/Jerusalem', lower(period)))::date = ${targetDateFinal}::date
    `;
    if (slots.length === 0 && !(booked?.n > 0)) {
      return NextResponse.json(
        {
          error: "ביום הזה אין תורים תפוסים — אין צורך ברשימת המתנה",
          code: "day_empty",
        },
        { status: 409 },
      );
    }
    if (anyTime && slots.length > 0) {
      return NextResponse.json(
        {
          error: "יש תורים פנויים ביום הזה — קבעו תור רגיל במקום רשימת המתנה",
          code: "has_slots",
          slots: slots.slice(0, 8),
        },
        { status: 409 },
      );
    }
    if (!anyTime && windows.length) {
      const openInPref = slotsInPreferredWindows(slots, windows);
      if (openInPref.length > 0) {
        return NextResponse.json(
          {
            error: "בחלון השעות שבחרתם יש תור פנוי — אפשר לקבוע אותו עכשיו",
            code: "open_slots",
            slots: openInPref.slice(0, 8),
          },
          { status: 409 },
        );
      }
    }
  }

  const manageToken = crypto.randomUUID().replace(/-/g, "");

  const [row] = await sql<{ id: string }[]>`
    insert into waitlist_entries (
      service_id, duration_minutes, price_agorot,
      client_name, client_phone, target_date, any_time, manage_token, notes, status
    ) values (
      ${serviceId}::uuid, ${service.duration_minutes}, ${service.price_agorot},
      ${clientName}, ${phone}, ${targetDateFinal}::date, ${anyTime}, ${manageToken}, ${notes}, 'waiting'
    )
    returning id
  `;

  for (const w of windows) {
    const start = w.start.length === 5 ? `${w.start}:00` : w.start;
    const end = w.end.length === 5 ? `${w.end}:00` : w.end;
    await sql`
      insert into waitlist_windows (entry_id, start_time, end_time)
      values (${row.id}::uuid, ${start}::time, ${end}::time)
    `;
  }

  return NextResponse.json({ ok: true, id: row.id });
}

export async function PATCH(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;
  const body = (await req.json().catch(() => ({}))) as {
    id?: string;
    status?: "waiting" | "offered" | "fulfilled" | "cancelled" | "expired";
  };
  if (!body.id || !body.status) {
    return NextResponse.json({ error: "חסרים שדות" }, { status: 400 });
  }
  const sql = getSql();
  await sql`
    update waitlist_entries
    set status = ${body.status}, updated_at = now()
    where id = ${body.id}::uuid
  `;
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "חסר id" }, { status: 400 });
  const sql = getSql();
  await sql`delete from waitlist_entries where id = ${id}::uuid`;
  return NextResponse.json({ ok: true });
}
