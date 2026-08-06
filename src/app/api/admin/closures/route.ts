import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { wallTimeToUtc } from "@/lib/time";

export const runtime = "nodejs";

async function guard() {
  if (!(await readSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return null;
}

export async function GET(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  const sql = getSql();
  if (from && to) {
    const fromDt = wallTimeToUtc(from, "00:00:00");
    const toDt = wallTimeToUtc(to, "23:59:59");
    const rows = await sql`
      select id, reason, all_day, lower(period) as start, upper(period) as end, created_at
      from blocks
      where period && tstzrange(${fromDt.toISOString()}::timestamptz, ${toDt.toISOString()}::timestamptz, '[)')
      order by lower(period)
    `;
    return NextResponse.json({
      closures: rows.map((r) => ({
        ...r,
        start: r.start.toISOString(),
        end: r.end.toISOString(),
      })),
    });
  }
  const rows = await sql`
    select id, reason, all_day, lower(period) as start, upper(period) as end, created_at
    from blocks
    where upper(period) >= now()
    order by lower(period)
    limit 200
  `;
  return NextResponse.json({
    closures: rows.map((r) => ({
      ...r,
      start: r.start.toISOString(),
      end: r.end.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;
  const body = (await req.json().catch(() => ({}))) as {
    dateYmd?: string;
    endDateYmd?: string;
    startTime?: string;
    endTime?: string;
    allDay?: boolean;
    reason?: string;
  };
  if (!body.dateYmd) return NextResponse.json({ error: "חסר תאריך" }, { status: 400 });

  const allDay = !!body.allDay;
  const endYmd = body.endDateYmd || body.dateYmd;
  let start: Date;
  let end: Date;
  if (allDay) {
    start = wallTimeToUtc(body.dateYmd, "00:00:00");
    end = wallTimeToUtc(endYmd, "23:59:59");
  } else {
    if (!body.startTime || !body.endTime) {
      return NextResponse.json({ error: "חסרות שעות" }, { status: 400 });
    }
    start = wallTimeToUtc(
      body.dateYmd,
      body.startTime.length === 5 ? `${body.startTime}:00` : body.startTime,
    );
    end = wallTimeToUtc(
      endYmd,
      body.endTime.length === 5 ? `${body.endTime}:00` : body.endTime,
    );
  }
  if (!(start < end)) return NextResponse.json({ error: "טווח לא תקין" }, { status: 400 });

  const sql = getSql();
  const [row] = await sql`
    insert into blocks (period, reason, all_day)
    values (
      tstzrange(${start.toISOString()}::timestamptz, ${end.toISOString()}::timestamptz, '[)'),
      ${body.reason || null},
      ${allDay}
    )
    returning id
  `;
  return NextResponse.json({ ok: true, id: row.id });
}

export async function PATCH(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;
  const body = (await req.json().catch(() => ({}))) as {
    id?: string;
    dateYmd?: string;
    endDateYmd?: string;
    startTime?: string;
    endTime?: string;
    allDay?: boolean;
    reason?: string;
  };
  if (!body.id) return NextResponse.json({ error: "חסר id" }, { status: 400 });
  if (!body.dateYmd) return NextResponse.json({ error: "חסר תאריך" }, { status: 400 });

  const allDay = !!body.allDay;
  const endYmd = body.endDateYmd || body.dateYmd;
  let start: Date;
  let end: Date;
  if (allDay) {
    start = wallTimeToUtc(body.dateYmd, "00:00:00");
    end = wallTimeToUtc(endYmd, "23:59:59");
  } else {
    if (!body.startTime || !body.endTime) {
      return NextResponse.json({ error: "חסרות שעות" }, { status: 400 });
    }
    start = wallTimeToUtc(
      body.dateYmd,
      body.startTime.length === 5 ? `${body.startTime}:00` : body.startTime,
    );
    end = wallTimeToUtc(
      endYmd,
      body.endTime.length === 5 ? `${body.endTime}:00` : body.endTime,
    );
  }
  if (!(start < end)) return NextResponse.json({ error: "טווח לא תקין" }, { status: 400 });

  const sql = getSql();
  const [row] = await sql`
    update blocks set
      period = tstzrange(${start.toISOString()}::timestamptz, ${end.toISOString()}::timestamptz, '[)'),
      reason = ${body.reason || null},
      all_day = ${allDay}
    where id = ${body.id}::uuid
    returning id
  `;
  if (!row) return NextResponse.json({ error: "סגירה לא נמצאה" }, { status: 404 });
  return NextResponse.json({ ok: true, id: row.id });
}

export async function DELETE(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "חסר id" }, { status: 400 });
  const sql = getSql();
  await sql`delete from blocks where id = ${id}::uuid`;
  return NextResponse.json({ ok: true });
}
