import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import { getSmsProvider } from "@/lib/sms";
import { getEmailProvider } from "@/lib/email";

export const runtime = "nodejs";

type OutboxRow = {
  id: string;
  appointment_id: string | null;
  kind: string;
  channel: "sms" | "email";
  recipient: string;
  body: string;
  appt_status: string | null;
};

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") || req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sql = getSql();
  const sms = getSmsProvider();
  const email = getEmailProvider();

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let processed = 0;

  await sql.begin(async (tx) => {
    const due = await tx<OutboxRow[]>`
      select o.id, o.appointment_id, o.kind, o.channel, o.recipient, o.body,
             a.status as appt_status
      from outbox o
      left join appointments a on a.id = o.appointment_id
      where o.status = 'pending'
        and o.send_after <= now()
        and o.attempts < 5
      order by o.send_after
      limit 20
      for update of o skip locked
    `;
    processed = due.length;

    for (const row of due) {
      if (row.appt_status === "cancelled") {
        await tx`update outbox set status = 'failed', last_error = 'appointment cancelled' where id = ${row.id}::uuid`;
        skipped += 1;
        continue;
      }

      try {
        if (row.channel === "sms") {
          await sms.send(row.recipient, row.body);
        } else {
          const [subject, ...rest] = row.body.split("\n\n");
          await email.send(row.recipient, subject || "הודעה", rest.join("\n\n") || row.body);
        }
        await tx`
          update outbox set status = 'sent', sent_at = now(), last_error = null
          where id = ${row.id}::uuid
        `;
        sent += 1;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        await tx`
          update outbox
          set attempts = attempts + 1,
              last_error = ${msg.slice(0, 500)},
              status = case when attempts + 1 >= 5 then 'failed' else 'pending' end
          where id = ${row.id}::uuid
        `;
        failed += 1;
      }
    }
  });

  return NextResponse.json({ sent, failed, skipped, processed });
}
