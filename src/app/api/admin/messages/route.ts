import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  if (!(await readSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const sql = getSql();
  const rows = await sql`
    select o.id, o.kind, o.channel, o.recipient, o.status, o.attempts,
           o.send_after, o.sent_at, o.last_error, o.created_at,
           a.client_name, a.service_name
    from outbox o
    left join appointments a on a.id = o.appointment_id
    order by o.send_after desc
    limit 100
  `;
  return NextResponse.json({ messages: rows });
}
