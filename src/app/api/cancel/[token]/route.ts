import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { getShopSettings } from "@/lib/settings";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const sql = getSql();
  const settings = await getShopSettings();

  try {
    const result = await sql.begin(async (tx) => {
      const [appt] = await tx<{
        id: string;
        status: string;
        start: Date;
      }[]>`
        select id, status, lower(period) as start
        from appointments where cancel_token = ${token}
        for update
      `;
      if (!appt) return { error: "not_found" as const };
      if (appt.status === "cancelled") return { error: "already" as const };

      const msLeft = new Date(appt.start).getTime() - Date.now();
      if (msLeft < settings.min_client_cancel_minutes * 60_000) {
        return { error: "too_late" as const };
      }

      // Client-initiated cancel: no cancellation alerts
      await tx`update appointments set status = 'cancelled' where id = ${appt.id}::uuid`;
      await tx`
        update outbox set status = 'failed', last_error = 'appointment cancelled by client'
        where appointment_id = ${appt.id}::uuid and status = 'pending'
      `;
      return { ok: true as const };
    });

    if ("error" in result) {
      if (result.error === "not_found") {
        return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
      }
      if (result.error === "too_late") {
        return NextResponse.json(
          { error: `לא ניתן לבטל פחות מ־${settings.min_client_cancel_minutes} דקות לפני התור` },
          { status: 400 },
        );
      }
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
