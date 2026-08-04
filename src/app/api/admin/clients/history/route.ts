import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { autoCompletePastAppointments } from "@/lib/appointments-auto";
import { computeReliability } from "@/lib/client-reliability";
import { normalizePhoneIL } from "@/lib/phone";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!(await readSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const phoneRaw = req.nextUrl.searchParams.get("phone");
  if (!phoneRaw) return NextResponse.json({ error: "חסר phone" }, { status: 400 });
  const phone = normalizePhoneIL(phoneRaw) || phoneRaw;

  await autoCompletePastAppointments();

  const sql = getSql();
  const rows = await sql<{
    id: string;
    service_name: string;
    status: string;
    notes: string | null;
    start: Date;
    end: Date;
  }[]>`
    select id, service_name, status, notes, lower(period) as start, upper(period) as end
    from appointments
    where client_phone = ${phone}
    order by lower(period) desc
    limit 100
  `;

  const appointments = rows.map((r) => ({
    id: r.id,
    service_name: r.service_name,
    status: r.status,
    notes: r.notes,
    start: r.start.toISOString(),
    end: r.end.toISOString(),
  }));

  const reliability = computeReliability(appointments);

  return NextResponse.json({
    appointments,
    reliability,
    counts: {
      total: appointments.length,
      completed: reliability.completed,
      cancelled: reliability.cancelled,
      no_show: reliability.no_show,
      confirmed: reliability.confirmed,
    },
  });
}
