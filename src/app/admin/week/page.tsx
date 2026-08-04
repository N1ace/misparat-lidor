import { getSql } from "@/lib/db";
import { formatInTimeZone } from "date-fns-tz";
import { TZ } from "@/lib/shop";
import { wallTimeToUtc } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function AdminWeekPage() {
  const start = formatInTimeZone(new Date(), TZ, "yyyy-MM-dd");
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(Date.now() + i * 86400000);
    days.push(formatInTimeZone(d, TZ, "yyyy-MM-dd"));
  }

  type Row = {
    id: string;
    client_name: string;
    service_name: string;
    status: string;
    start: Date;
  };

  let byDay: Record<string, Row[]> = {};
  try {
    const sql = getSql();
    const from = wallTimeToUtc(days[0], "00:00:00");
    const to = wallTimeToUtc(days[6], "23:59:59");
    const rows = await sql<Row[]>`
      select id, client_name, service_name, status, lower(period) as start
      from appointments
      where period && tstzrange(${from.toISOString()}::timestamptz, ${to.toISOString()}::timestamptz, '[)')
        and status in ('confirmed','done','no_show')
      order by lower(period)
    `;
    byDay = Object.fromEntries(days.map((d) => [d, []]));
    for (const r of rows) {
      const ymd = formatInTimeZone(r.start, TZ, "yyyy-MM-dd");
      if (!byDay[ymd]) byDay[ymd] = [];
      byDay[ymd].push(r);
    }
  } catch {
    byDay = Object.fromEntries(days.map((d) => [d, []]));
  }

  void start;

  return (
    <div>
      <h1 className="display text-3xl">שבוע</h1>
      <div className="mt-6 space-y-4">
        {days.map((d) => {
          const label = new Intl.DateTimeFormat("he-IL", {
            timeZone: TZ,
            weekday: "long",
            day: "numeric",
            month: "numeric",
          }).format(new Date(d + "T12:00:00"));
          const list = byDay[d] || [];
          return (
            <section key={d} className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4">
              <h2 className="font-bold">{label}</h2>
              {list.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--muted)]">אין תורים</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {list.map((a) => (
                    <li key={a.id} className="flex justify-between gap-2 text-sm">
                      <span>
                        {formatInTimeZone(a.start, TZ, "HH:mm")} · {a.client_name}
                      </span>
                      <span className="text-[var(--muted)]">{a.service_name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
