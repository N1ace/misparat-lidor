import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { ensureWorkingHoursSeeded, invalidateWorkingHoursCache } from "@/lib/hours";

export const runtime = "nodejs";

export async function GET() {
  if (!(await readSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await ensureWorkingHoursSeeded();
  const sql = getSql();
  const rows = await sql`
    select id, day_of_week, open_time::text, close_time::text
    from working_hours order by day_of_week, open_time
  `;
  return NextResponse.json({ hours: rows });
}

export async function PUT(req: NextRequest) {
  if (!(await readSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    hours?: { day_of_week: number; open_time: string; close_time: string }[];
  };
  if (!Array.isArray(body.hours)) {
    return NextResponse.json({ error: "חסר hours" }, { status: 400 });
  }
  const sql = getSql();
  await sql.begin(async (tx) => {
    await tx`delete from working_hours`;
    for (const h of body.hours!) {
      await tx`
        insert into working_hours (day_of_week, open_time, close_time)
        values (${h.day_of_week}, ${h.open_time}::time, ${h.close_time}::time)
      `;
    }
  });
  invalidateWorkingHoursCache();
  return NextResponse.json({ ok: true });
}
