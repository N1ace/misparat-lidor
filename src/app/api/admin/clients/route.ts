import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { autoCompletePastAppointments } from "@/lib/appointments-auto";
import { computeReliability, type ReliabilityStat } from "@/lib/client-reliability";
import { normalizePhoneIL, isValidEmail } from "@/lib/phone";

export const runtime = "nodejs";

async function guard() {
  if (!(await readSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return null;
}

type ClientRow = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  notify_channel: string | null;
  created_at: Date;
  updated_at: Date;
};

async function withReliability(clients: ClientRow[]) {
  if (!clients.length) return [];
  const sql = getSql();
  const phones = clients.map((c) => c.phone);
  const appts = await sql<{ client_phone: string; status: string }[]>`
    select client_phone, status
    from appointments
    where client_phone = any(${phones})
  `;
  const byPhone = new Map<string, { status: string }[]>();
  for (const a of appts) {
    const list = byPhone.get(a.client_phone) || [];
    list.push({ status: a.status });
    byPhone.set(a.client_phone, list);
  }
  return clients.map((c) => {
    const reliability: ReliabilityStat = computeReliability(byPhone.get(c.phone) || []);
    return { ...c, reliability };
  });
}

export async function GET(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;
  await autoCompletePastAppointments();
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  const sql = getSql();
  if (q) {
    const like = `%${q}%`;
    const clients = await sql<ClientRow[]>`
      select id, name, phone, email, notes, notify_channel, created_at, updated_at
      from clients
      where name ilike ${like} or phone ilike ${like} or coalesce(email,'') ilike ${like}
      order by updated_at desc
      limit 200
    `;
    return NextResponse.json({ clients: await withReliability(clients) });
  }
  const clients = await sql<ClientRow[]>`
    select id, name, phone, email, notes, notify_channel, created_at, updated_at
    from clients
    order by updated_at desc
    limit 200
  `;
  return NextResponse.json({ clients: await withReliability(clients) });
}

export async function POST(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    phone?: string;
    email?: string;
    notes?: string;
  };
  if (!body.name?.trim() || !body.phone) {
    return NextResponse.json({ error: "שם וטלפון חובה" }, { status: 400 });
  }
  const phone = normalizePhoneIL(body.phone);
  if (!phone) return NextResponse.json({ error: "טלפון לא תקין" }, { status: 400 });
  const email = body.email?.trim() ? body.email.trim().toLowerCase() : null;
  if (email && !isValidEmail(email)) {
    return NextResponse.json({ error: "אימייל לא תקין" }, { status: 400 });
  }
  const sql = getSql();
  try {
    const [row] = await sql`
      insert into clients (name, phone, email, notes)
      values (${body.name.trim()}, ${phone}, ${email}, ${body.notes?.trim() || null})
      returning id, name, phone, email, notes, created_at, updated_at
    `;
    return NextResponse.json({ client: row });
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === "23505") {
      return NextResponse.json({ error: "לקוח עם הטלפון הזה כבר קיים" }, { status: 409 });
    }
    throw e;
  }
}

export async function PATCH(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;
  const body = (await req.json().catch(() => ({}))) as {
    id?: string;
    name?: string;
    phone?: string;
    email?: string | null;
    notes?: string | null;
  };
  if (!body.id) return NextResponse.json({ error: "חסר id" }, { status: 400 });
  const sql = getSql();
  const phone = body.phone ? normalizePhoneIL(body.phone) : null;
  if (body.phone && !phone) return NextResponse.json({ error: "טלפון לא תקין" }, { status: 400 });
  const emailProvided = body.email !== undefined;
  const email =
    body.email === undefined
      ? null
      : body.email?.trim()
        ? body.email.trim().toLowerCase()
        : null;
  if (emailProvided && email && !isValidEmail(email)) {
    return NextResponse.json({ error: "אימייל לא תקין" }, { status: 400 });
  }
  const notesProvided = body.notes !== undefined;
  const notesValue = body.notes ?? null;
  const [row] = await sql`
    update clients set
      name = coalesce(${body.name?.trim() || null}, name),
      phone = coalesce(${phone}, phone),
      email = case when ${emailProvided} then ${email} else email end,
      notes = case when ${notesProvided} then ${notesValue} else notes end,
      updated_at = now()
    where id = ${body.id}::uuid
    returning id, name, phone, email, notes, created_at, updated_at
  `;
  if (!row) return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
  return NextResponse.json({ client: row });
}

export async function DELETE(req: NextRequest) {
  const denied = await guard();
  if (denied) return denied;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "חסר id" }, { status: 400 });
  const sql = getSql();
  await sql`delete from clients where id = ${id}::uuid`;
  return NextResponse.json({ ok: true });
}
