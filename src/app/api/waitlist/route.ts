import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { getShopSettings } from "@/lib/settings";
import { normalizePhoneIL } from "@/lib/phone";
import { clampName, NAME_LIMITS } from "@/lib/name-limits";
import { getAvailableSlots } from "@/lib/availability";
import { smsWaitlistJoined } from "@/lib/messages";
import { readClientSession } from "@/lib/client-auth";

export const runtime = "nodejs";

const bodySchema = z.object({
  serviceId: z.string().uuid(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  anyTime: z.boolean().optional(),
  windows: z
    .array(
      z.object({
        start: z.string().min(4),
        end: z.string().min(4),
      }),
    )
    .optional(),
  name: z.string().min(1).optional(),
  phone: z.string().min(7).optional(),
});

export async function POST(req: NextRequest) {
  const settings = await getShopSettings();
  if (!settings.waitlist_enabled) {
    return NextResponse.json({ error: "רשימת ההמתנה כבויה כרגע" }, { status: 403 });
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

  const session = await readClientSession();
  const name = clampName(parsed.data.name || session?.name || "", NAME_LIMITS.person);
  const phone = normalizePhoneIL(parsed.data.phone || session?.phone || "");
  if (!name || !phone) {
    return NextResponse.json({ error: "שם וטלפון חובה" }, { status: 400 });
  }

  if (
    !rateLimit(`waitlist:ip:${ip}`, 5, 60 * 60 * 1000) ||
    !rateLimit(`waitlist:phone:${phone}`, 5, 60 * 60 * 1000)
  ) {
    return NextResponse.json({ error: "יותר מדי בקשות. נסו שוב בעוד שעה." }, { status: 429 });
  }

  const anyTime = parsed.data.anyTime !== false && !(parsed.data.windows && parsed.data.windows.length);
  const windows = anyTime ? [] : parsed.data.windows || [];
  if (!anyTime && !windows.length) {
    return NextResponse.json({ error: "בחרו חלון שעות או ׳כל היום׳" }, { status: 400 });
  }

  const horizonEnd = new Date();
  horizonEnd.setDate(horizonEnd.getDate() + settings.online_booking_horizon_days);
  const target = new Date(`${parsed.data.targetDate}T12:00:00`);
  if (Number.isNaN(target.getTime()) || target > horizonEnd) {
    return NextResponse.json(
      { error: `ניתן להירשם עד ${settings.online_booking_horizon_days} ימים קדימה` },
      { status: 400 },
    );
  }

  const sql = getSql();
  const [service] = await sql<{
    id: string;
    duration_minutes: number;
    price_agorot: number;
  }[]>`
    select id, duration_minutes, price_agorot
    from services where id = ${parsed.data.serviceId}::uuid and active = true
  `;
  if (!service) return NextResponse.json({ error: "שירות לא נמצא" }, { status: 404 });

  // Only when the day has no public slots for this service
  const slots = await getAvailableSlots(parsed.data.targetDate, service.id);
  if (slots.length > 0) {
    return NextResponse.json(
      { error: "יש עדיין תורים פנויים ביום הזה — קבעו תור רגיל", code: "has_slots" },
      { status: 409 },
    );
  }

  const [countRow] = await sql<{ n: number }[]>`
    select count(*)::int as n from waitlist_entries
    where client_phone = ${phone}
      and status in ('waiting','offered')
  `;
  if ((countRow?.n || 0) >= settings.waitlist_max_per_phone) {
    return NextResponse.json(
      { error: `ניתן להירשם לעד ${settings.waitlist_max_per_phone} רשימות פעילות` },
      { status: 409 },
    );
  }

  const manageToken = crypto.randomUUID().replace(/-/g, "");
  const dateLabel = parsed.data.targetDate.split("-").reverse().join("/");

  try {
    const entryId = await sql.begin(async (tx) => {
      const [row] = await tx<{ id: string }[]>`
        insert into waitlist_entries (
          service_id, duration_minutes, price_agorot,
          client_name, client_phone, target_date, any_time, manage_token, status
        ) values (
          ${service.id}::uuid, ${service.duration_minutes}, ${service.price_agorot},
          ${name}, ${phone}, ${parsed.data.targetDate}::date, ${anyTime}, ${manageToken}, 'waiting'
        )
        returning id
      `;

      for (const w of windows) {
        const start = w.start.length === 5 ? `${w.start}:00` : w.start;
        const end = w.end.length === 5 ? `${w.end}:00` : w.end;
        await tx`
          insert into waitlist_windows (entry_id, start_time, end_time)
          values (${row.id}::uuid, ${start}::time, ${end}::time)
        `;
      }

      const sms = smsWaitlistJoined({ date: dateLabel });
      await tx`
        insert into outbox (appointment_id, kind, channel, recipient, body, send_after)
        values (null, 'waitlist_joined', 'sms', ${phone}, ${sms}, now())
      `;

      return row.id as string;
    });

    return NextResponse.json({
      ok: true,
      id: entryId,
      manageToken,
      manageUrl: `${req.nextUrl.origin}/waitlist/${manageToken}`,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
