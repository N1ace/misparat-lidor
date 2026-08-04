import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { readClientSession } from "@/lib/client-auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await readClientSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sql = getSql();
  const rows = await sql<{
    id: string;
    service_name: string;
    status: string;
    notes: string | null;
    cancel_token: string;
    start: Date;
    end: Date;
  }[]>`
    select id, service_name, status, notes, cancel_token,
           lower(period) as start, upper(period) as end
    from appointments
    where client_phone = ${session.phone}
    order by lower(period) desc
    limit 100
  `;

  const now = Date.now();
  const appointments = rows.map((r) => ({
    id: r.id,
    service_name: r.service_name,
    status: r.status,
    notes: r.notes,
    cancel_token: r.cancel_token,
    start: r.start.toISOString(),
    end: r.end.toISOString(),
    upcoming: r.status === "confirmed" && r.start.getTime() >= now,
  }));

  return NextResponse.json({
    upcoming: appointments.filter((a) => a.upcoming),
    past: appointments.filter((a) => !a.upcoming),
  });
}
