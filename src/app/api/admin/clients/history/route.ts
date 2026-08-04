import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!(await readSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const phone = req.nextUrl.searchParams.get("phone");
  if (!phone) return NextResponse.json({ error: "חסר phone" }, { status: 400 });

  const sql = getSql();
  const rows = await sql`
    select id, service_name, status, lower(period) as start, upper(period) as end
    from appointments
    where client_phone = ${phone}
    order by lower(period) desc
    limit 50
  `;
  return NextResponse.json({
    appointments: rows.map((r) => ({
      ...r,
      start: r.start.toISOString(),
      end: r.end.toISOString(),
    })),
  });
}
