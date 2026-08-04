import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { expireDueOffers } from "@/lib/waitlist";

export const runtime = "nodejs";

/** Expire pending waitlist offers — run before outbox worker. */
export async function POST(req: NextRequest) {
  const secret =
    req.headers.get("x-cron-secret") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const origin = req.nextUrl.origin;
  const expired = await expireDueOffers({ origin });

  // Nightly-ish cleanup of past target dates
  try {
    const sql = getSql();
    await sql`
      update waitlist_entries
      set status = 'expired', updated_at = now()
      where status in ('waiting','offered')
        and target_date < (timezone('Asia/Jerusalem', now()))::date
    `;
  } catch (e) {
    console.error("[waitlist-expire] stale cleanup", e);
  }

  return NextResponse.json({ ok: true, expired });
}
