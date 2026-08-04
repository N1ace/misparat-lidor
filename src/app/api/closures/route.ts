import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public upcoming holidays / partial closures for the website. */
export async function GET() {
  try {
    const sql = getSql();
    const rows = await sql<{
      id: string;
      reason: string | null;
      all_day: boolean;
      start: Date;
      end: Date;
    }[]>`
      select id, reason, all_day, lower(period) as start, upper(period) as end
      from blocks
      where upper(period) >= now()
      order by lower(period)
      limit 60
    `;
    return NextResponse.json(
      {
        closures: rows.map((r) => ({
          id: r.id,
          reason: r.reason,
          all_day: r.all_day,
          start: r.start.toISOString(),
          end: r.end.toISOString(),
        })),
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
