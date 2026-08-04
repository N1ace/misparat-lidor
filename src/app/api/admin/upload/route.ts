import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(req: NextRequest) {
  if (!(await readSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "לא נבחר קובץ" }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "פורמט לא נתמך. השתמשו ב-JPG, PNG או WEBP." }, { status: 400 });
  }
  if (file.size <= 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "הקובץ גדול מדי. עד 5 מגה." }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const sql = getSql();
  try {
    const [row] = await sql<{ id: string }[]>`
      insert into media_assets (content_type, bytes, byte_size)
      values (${file.type}, ${buf}, ${buf.length})
      returning id
    `;
    return NextResponse.json({
      ok: true,
      url: `/api/media/${row.id}`,
      id: row.id,
    });
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string };
    if (err.code === "42P01") {
      return NextResponse.json(
        { error: "טבלת מדיה חסרה — הריצו את migration 009_media_assets.sql ב-Supabase" },
        { status: 503 },
      );
    }
    console.error(e);
    return NextResponse.json({ error: "העלאה נכשלה" }, { status: 500 });
  }
}
