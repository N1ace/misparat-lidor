import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { wallTimeToUtc } from "@/lib/time";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!(await readSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    dateYmd?: string;
    startTime?: string;
    endTime?: string;
    startAt?: string;
    endAt?: string;
    reason?: string;
  };

  let start: Date;
  let end: Date;
  if (body.dateYmd && body.startTime && body.endTime) {
    start = wallTimeToUtc(body.dateYmd, body.startTime.length === 5 ? `${body.startTime}:00` : body.startTime);
    end = wallTimeToUtc(body.dateYmd, body.endTime.length === 5 ? `${body.endTime}:00` : body.endTime);
  } else if (body.startAt && body.endAt) {
    start = new Date(body.startAt);
    end = new Date(body.endAt);
  } else {
    return NextResponse.json({ error: "חסרים שדות" }, { status: 400 });
  }

  if (!(start < end)) {
    return NextResponse.json({ error: "טווח לא תקין" }, { status: 400 });
  }
  const sql = getSql();
  await sql`
    insert into blocks (period, reason)
    values (
      tstzrange(${start.toISOString()}::timestamptz, ${end.toISOString()}::timestamptz, '[)'),
      ${body.reason || null}
    )
  `;
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!(await readSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "חסר id" }, { status: 400 });
  const sql = getSql();
  await sql`delete from blocks where id = ${id}::uuid`;
  return NextResponse.json({ ok: true });
}
