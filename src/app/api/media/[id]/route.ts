import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const sql = getSql();
  try {
    const [row] = await sql<{ content_type: string; bytes: Buffer }[]>`
      select content_type, bytes from media_assets where id = ${id}::uuid
    `;
    if (!row) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    const body = Buffer.isBuffer(row.bytes)
      ? row.bytes
      : Buffer.from(row.bytes as unknown as ArrayBuffer);
    return new NextResponse(new Uint8Array(body), {
      status: 200,
      headers: {
        "Content-Type": row.content_type,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": String(body.length),
      },
    });
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === "42P01") {
      return NextResponse.json({ error: "media table missing" }, { status: 503 });
    }
    console.error(e);
    return NextResponse.json({ error: "error" }, { status: 500 });
  }
}
