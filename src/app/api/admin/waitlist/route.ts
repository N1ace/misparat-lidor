import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { normalizePhoneIL } from "@/lib/phone";

export const runtime = "nodejs";

async function guard() {
  if (!(await readSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return null;
}

export async function GET() {
  const denied = await guard();
  if (denied) return denied;
  const sql = getSql();
  const entries = await sql`
    select w.id, w.client_name, w.client_phone, w.service_id, w.preferred_date,
           w.notes, w.status, w.created_at, w.updated_at, s.name as service_name
    from waitlist_entries w
    left join services s on s.id = w.service_id
    where w.status in ('waiting','offered')
    order by w.created_at
  `;
  return NextResponse.json({ entries });
}

export async function POST(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;
  // Admin may always add — waitlist_enabled only gates public-facing use.
  const body = (await req.json().catch(() => ({}))) as {
    client_name?: string;
    client_phone?: string;
    service_id?: string;
    preferred_date?: string;
    notes?: string;
  };
  if (!body.client_name?.trim() || !body.client_phone) {
    return NextResponse.json({ error: "שם וטלפון חובה" }, { status: 400 });
  }
  const phone = normalizePhoneIL(body.client_phone);
  if (!phone) return NextResponse.json({ error: "טלפון לא תקין" }, { status: 400 });
  const sql = getSql();
  const [row] = await sql`
    insert into waitlist_entries (client_name, client_phone, service_id, preferred_date, notes)
    values (
      ${body.client_name.trim()},
      ${phone},
      ${body.service_id || null}::uuid,
      ${body.preferred_date || null}::date,
      ${body.notes?.trim() || null}
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
    status?: "waiting" | "offered" | "booked" | "cancelled";
  };
  if (!body.id || !body.status) {
    return NextResponse.json({ error: "חסרים שדות" }, { status: 400 });
  }
  const sql = getSql();
  await sql`
    update waitlist_entries
    set status = ${body.status}, updated_at = now()
    where id = ${body.id}::uuid
  `;
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "חסר id" }, { status: 400 });
  const sql = getSql();
  await sql`delete from waitlist_entries where id = ${id}::uuid`;
  return NextResponse.json({ ok: true });
}
