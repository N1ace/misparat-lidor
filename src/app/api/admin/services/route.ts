import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  if (!(await readSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const sql = getSql();
  const rows = await sql`
    select id, name, duration_minutes, price_agorot, sort_order, active
    from services order by sort_order, name
  `;
  return NextResponse.json({ services: rows });
}

export async function PUT(req: NextRequest) {
  if (!(await readSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    id?: string;
    name?: string;
    duration_minutes?: number;
    price_agorot?: number;
    sort_order?: number;
    active?: boolean;
  };
  if (!body.id) return NextResponse.json({ error: "חסר id" }, { status: 400 });
  const sql = getSql();
  await sql`
    update services set
      name = coalesce(${body.name ?? null}, name),
      duration_minutes = coalesce(${body.duration_minutes ?? null}, duration_minutes),
      price_agorot = coalesce(${body.price_agorot ?? null}, price_agorot),
      sort_order = coalesce(${body.sort_order ?? null}, sort_order),
      active = coalesce(${body.active ?? null}, active)
    where id = ${body.id}::uuid
  `;
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  if (!(await readSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    duration_minutes?: number;
    price_agorot?: number;
  };
  if (!body.name || !body.duration_minutes) {
    return NextResponse.json({ error: "חסרים שדות" }, { status: 400 });
  }
  const sql = getSql();
  const [row] = await sql`
    insert into services (name, duration_minutes, price_agorot)
    values (${body.name}, ${body.duration_minutes}, ${body.price_agorot ?? 0})
    returning id
  `;
  return NextResponse.json({ ok: true, id: row.id });
}
