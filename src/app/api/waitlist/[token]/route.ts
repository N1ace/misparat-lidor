import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const sql = getSql();
  const [row] = await sql<{
    id: string;
    status: string;
    target_date: string;
    service_name: string;
  }[]>`
    select e.id, e.status, e.target_date::text, s.name as service_name
    from waitlist_entries e
    join services s on s.id = e.service_id
    where e.manage_token = ${token}
  `;
  if (!row) return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
  return NextResponse.json({
    id: row.id,
    status: row.status,
    targetDate: row.target_date,
    service: row.service_name,
  });
}

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const sql = getSql();
  const updated = await sql<{ id: string }[]>`
    update waitlist_entries
    set status = 'cancelled', updated_at = now()
    where manage_token = ${token}
      and status in ('waiting','offered')
    returning id
  `;
  if (!updated.length) {
    return NextResponse.json({ error: "לא נמצא או כבר בוטל" }, { status: 404 });
  }

  // If they had a live offer, drop the held appointment
  await sql`
    delete from appointments a
    using waitlist_offers o
    where o.appointment_id = a.id
      and o.entry_id = ${updated[0].id}::uuid
      and o.status = 'pending'
      and a.status = 'held'
  `;
  await sql`
    update waitlist_offers
    set status = 'declined', responded_at = now()
    where entry_id = ${updated[0].id}::uuid and status = 'pending'
  `;

  return NextResponse.json({ ok: true });
}
