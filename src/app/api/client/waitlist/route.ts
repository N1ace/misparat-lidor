import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { readClientSession } from "@/lib/client-auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await readClientSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sql = getSql();
  const entries = await sql`
    select w.id, w.client_name, w.client_phone, w.target_date as preferred_date,
           w.status, w.created_at, w.any_time, s.name as service_name
    from waitlist_entries w
    left join services s on s.id = w.service_id
    where w.client_phone = ${session.phone}
      and w.status in ('waiting','offered')
    order by w.created_at
  `;
  return NextResponse.json({ entries });
}
