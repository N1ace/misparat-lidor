import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { acceptOffer, declineOffer } from "@/lib/waitlist";
import { formatJerusalem, hebrewWeekday } from "@/lib/time";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const sql = getSql();
  const [row] = await sql<{
    status: string;
    expires_at: Date;
    client_name: string;
    service_name: string;
    price_agorot: number;
    start: Date;
    end: Date;
    offer_status: string;
  }[]>`
    select o.status as offer_status, o.expires_at,
           e.client_name, a.service_name, a.price_agorot,
           lower(a.period) as start, upper(a.period) as end, a.status
    from waitlist_offers o
    join waitlist_entries e on e.id = o.entry_id
    join appointments a on a.id = o.appointment_id
    where o.token = ${token}
  `;
  if (!row) return NextResponse.json({ error: "לא נמצא" }, { status: 404 });

  const start = new Date(row.start);
  return NextResponse.json({
    offerStatus: row.offer_status,
    apptStatus: row.status,
    expiresAt: new Date(row.expires_at).toISOString(),
    clientName: row.client_name,
    service: row.service_name,
    priceAgorot: row.price_agorot,
    start: start.toISOString(),
    end: new Date(row.end).toISOString(),
    label: `${hebrewWeekday(formatJerusalem(start, "yyyy-MM-dd"))} ${formatJerusalem(start, "d/M/yyyy · HH:mm")}`,
  });
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { action?: string };
  const origin = req.nextUrl.origin;

  if (body.action === "accept") {
    const res = await acceptOffer(token, origin);
    if (!res.ok) {
      const msg =
        res.reason === "expired"
          ? "פג תוקף ההצעה"
          : res.reason === "gone"
            ? "התור כבר נתפס"
            : res.reason === "overlap"
              ? "התור נתפס"
              : "לא נמצא";
      return NextResponse.json({ error: msg, code: res.reason }, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === "decline") {
    const res = await declineOffer(token, { origin });
    if (!res.ok) {
      return NextResponse.json({ error: "ההצעה כבר לא פעילה", code: res.reason }, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "פעולה לא תקינה" }, { status: 400 });
}
