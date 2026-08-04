import { getSql } from "@/lib/db";
import { formatJerusalem } from "@/lib/time";
import { wallTimeToUtc } from "@/lib/time";
import { formatInTimeZone } from "date-fns-tz";
import { TZ } from "@/lib/shop";
import { TodayClient } from "@/components/TodayClient";

export const dynamic = "force-dynamic";

export default async function AdminTodayPage() {
  const today = formatInTimeZone(new Date(), TZ, "yyyy-MM-dd");
  const dayStart = wallTimeToUtc(today, "00:00:00");
  const dayEnd = wallTimeToUtc(today, "23:59:59");

  let appointments: {
    id: string;
    service_name: string;
    client_name: string;
    client_phone: string;
    status: string;
    start: string;
    end: string;
    notes: string | null;
  }[] = [];
  let services: { id: string; name: string; duration_minutes: number }[] = [];

  try {
    const sql = getSql();
    const rows = await sql<{
      id: string;
      service_name: string;
      client_name: string;
      client_phone: string;
      status: string;
      start: Date;
      end: Date;
      notes: string | null;
    }[]>`
      select id, service_name, client_name, client_phone, status, notes,
             lower(period) as start, upper(period) as end
      from appointments
      where period && tstzrange(${dayStart.toISOString()}::timestamptz, ${dayEnd.toISOString()}::timestamptz, '[)')
        and status in ('confirmed','done','no_show')
      order by lower(period)
    `;
    appointments = rows.map((r) => ({
      ...r,
      start: r.start.toISOString(),
      end: r.end.toISOString(),
    }));
    services = await sql`select id, name, duration_minutes from services where active = true order by sort_order`;
  } catch {
    /* db not configured */
  }

  const heDate = formatJerusalem(dayStart, "EEEE d/M/yyyy");

  return (
    <div>
      <h1 className="display text-3xl">היום</h1>
      <p className="mt-1 text-[var(--muted)]">{heDate}</p>
      <TodayClient initial={appointments} services={services} todayYmd={today} />
    </div>
  );
}
