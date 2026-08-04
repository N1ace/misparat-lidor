import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { clampName, NAME_LIMITS } from "@/lib/name-limits";
import { isValidServiceColor, pickServiceColor } from "@/lib/service-colors";

export const runtime = "nodejs";

function resolveColor(raw: string | null | undefined, fallbackIndex = 0): string {
  if (isValidServiceColor(raw)) return raw!;
  return pickServiceColor(fallbackIndex);
}

export async function GET() {
  if (!(await readSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const sql = getSql();
  const rows = await sql`
    select id, name, duration_minutes, price_agorot, sort_order, active, image_path, color
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
    image_path?: string | null;
    color?: string | null;
  };
  if (!body.id) return NextResponse.json({ error: "חסר id" }, { status: 400 });
  const sql = getSql();
  const nameValue =
    body.name !== undefined ? clampName(body.name, NAME_LIMITS.service) || null : null;
  const imagePath =
    body.image_path === undefined
      ? null
      : body.image_path?.trim()
        ? body.image_path.trim()
        : null;
  const imageProvided = body.image_path !== undefined;
  const colorProvided = body.color !== undefined;
  const color = colorProvided ? resolveColor(body.color) : null;
  await sql`
    update services set
      name = coalesce(${nameValue}, name),
      duration_minutes = coalesce(${body.duration_minutes ?? null}, duration_minutes),
      price_agorot = coalesce(${body.price_agorot ?? null}, price_agorot),
      sort_order = coalesce(${body.sort_order ?? null}, sort_order),
      active = coalesce(${body.active ?? null}, active),
      image_path = case when ${imageProvided} then ${imagePath} else image_path end,
      color = case when ${colorProvided} then ${color} else color end
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
    sort_order?: number;
    active?: boolean;
    image_path?: string | null;
    color?: string | null;
  };
  if (!body.name?.trim() || !body.duration_minutes) {
    return NextResponse.json({ error: "חסרים שדות" }, { status: 400 });
  }
  const name = clampName(body.name, NAME_LIMITS.service);
  if (!name) return NextResponse.json({ error: "חסרים שדות" }, { status: 400 });
  const imagePath = body.image_path?.trim() ? body.image_path.trim() : null;
  const sql = getSql();
  const [{ count }] = await sql<{ count: number }[]>`
    select count(*)::int as count from services
  `;
  const color = resolveColor(body.color, count);
  const [row] = await sql`
    insert into services (name, duration_minutes, price_agorot, sort_order, active, image_path, color)
    values (
      ${name},
      ${body.duration_minutes},
      ${body.price_agorot ?? 0},
      ${body.sort_order ?? 0},
      ${body.active ?? true},
      ${imagePath},
      ${color}
    )
    returning id
  `;
  return NextResponse.json({ ok: true, id: row.id });
}

export async function DELETE(req: NextRequest) {
  if (!(await readSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "חסר id" }, { status: 400 });
  const sql = getSql();

  try {
    await sql`delete from services where id = ${id}::uuid`;
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === "23503") {
      await sql`update services set active = false where id = ${id}::uuid`;
      return NextResponse.json({
        ok: true,
        soft: true,
        message: "השירות בשימוש בתורים קיימים — סומן כלא פעיל",
      });
    }
    console.error(e);
    return NextResponse.json({ error: "שגיאת מחיקה" }, { status: 500 });
  }
}
