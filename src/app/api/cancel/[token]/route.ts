import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { smsCancellation } from "@/lib/messages";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const sql = getSql();

  try {
    const result = await sql.begin(async (tx) => {
      const [appt] = await tx<{
        id: string;
        client_name: string;
        client_phone: string;
        client_email: string | null;
        status: string;
      }[]>`
        select id, client_name, client_phone, client_email, status
        from appointments where cancel_token = ${token}
        for update
      `;
      if (!appt) return { error: "not_found" as const };
      if (appt.status === "cancelled") return { error: "already" as const };

      await tx`update appointments set status = 'cancelled' where id = ${appt.id}::uuid`;

      const body = smsCancellation({ name: appt.client_name });
      await tx`
        insert into outbox (appointment_id, kind, channel, recipient, body, send_after)
        values (${appt.id}::uuid, 'cancellation', 'sms', ${appt.client_phone}, ${body}, now())
        on conflict (appointment_id, kind, channel) do nothing
      `;
      if (appt.client_email) {
        await tx`
          insert into outbox (appointment_id, kind, channel, recipient, body, send_after)
          values (
            ${appt.id}::uuid, 'cancellation', 'email', ${appt.client_email},
            ${`ביטול תור\n\nשלום ${appt.client_name},\nהתור שלך בוטל.`},
            now()
          )
          on conflict (appointment_id, kind, channel) do nothing
        `;
      }
      return { ok: true as const };
    });

    if ("error" in result) {
      if (result.error === "not_found") {
        return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
      }
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "שגיאת שרת" }, { status: 500 });
  }
}
