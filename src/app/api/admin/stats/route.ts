import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { formatJerusalem, jerusalemDayOfWeek, wallTimeToUtc } from "@/lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function addDaysYmd(ymd: string, days: number) {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  if (!(await readSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sql = getSql();
  const now = new Date();
  const today = formatJerusalem(now, "yyyy-MM-dd");
  const dayStart = wallTimeToUtc(today, "00:00:00");
  const dayEnd = wallTimeToUtc(today, "23:59:59");
  const nowIso = now.toISOString();

  const weekStartYmd = addDaysYmd(today, -jerusalemDayOfWeek(today));
  const weekEndYmd = addDaysYmd(weekStartYmd, 6);
  const weekStart = wallTimeToUtc(weekStartYmd, "00:00:00");
  const weekEnd = wallTimeToUtc(weekEndYmd, "23:59:59");

  const [todayRow] = await sql<{
    total: number;
    active: number;
    passed: number;
    done: number;
    no_show: number;
    cancelled: number;
  }[]>`
    select
      count(*) filter (where status in ('confirmed','done','no_show'))::int as total,
      count(*) filter (
        where status = 'confirmed' and lower(period) >= ${nowIso}::timestamptz
      )::int as active,
      count(*) filter (
        where status in ('done','no_show')
           or (status = 'confirmed' and upper(period) <= ${nowIso}::timestamptz)
      )::int as passed,
      count(*) filter (where status = 'done')::int as done,
      count(*) filter (where status = 'no_show')::int as no_show,
      count(*) filter (where status = 'cancelled')::int as cancelled
    from appointments
    where period && tstzrange(
      ${dayStart.toISOString()}::timestamptz,
      ${dayEnd.toISOString()}::timestamptz,
      '[)'
    )
  `;

  const [totals] = await sql<{
    total: number;
    active: number;
    passed: number;
    cancelled: number;
  }[]>`
    select
      count(*) filter (where status in ('confirmed','done','no_show'))::int as total,
      count(*) filter (
        where status = 'confirmed' and lower(period) >= ${nowIso}::timestamptz
      )::int as active,
      count(*) filter (
        where status in ('done','no_show')
           or (status = 'confirmed' and upper(period) < ${nowIso}::timestamptz)
      )::int as passed,
      count(*) filter (where status = 'cancelled')::int as cancelled
    from appointments
  `;

  const [weekRow] = await sql<{ total: number }[]>`
    select count(*)::int as total
    from appointments
    where status in ('confirmed','done','no_show')
      and period && tstzrange(
        ${weekStart.toISOString()}::timestamptz,
        ${weekEnd.toISOString()}::timestamptz,
        '[)'
      )
  `;

  const [clientsRow] = await sql<{ total: number }[]>`
    select count(*)::int as total from clients
  `;

  const [waitlistRow] = await sql<{ total: number }[]>`
    select count(*)::int as total
    from waitlist_entries
    where status in ('waiting','offered')
  `;

  const [servicesRow] = await sql<{ active: number }[]>`
    select count(*) filter (where active)::int as active from services
  `;

  const [nextAppt] = await sql<{
    client_name: string;
    service_name: string;
    start: Date;
  }[]>`
    select client_name, service_name, lower(period) as start
    from appointments
    where status = 'confirmed' and lower(period) >= ${nowIso}::timestamptz
    order by lower(period)
    limit 1
  `;

  return NextResponse.json({
    todayYmd: today,
    today: {
      total: todayRow?.total ?? 0,
      active: todayRow?.active ?? 0,
      passed: todayRow?.passed ?? 0,
      done: todayRow?.done ?? 0,
      no_show: todayRow?.no_show ?? 0,
      cancelled: todayRow?.cancelled ?? 0,
    },
    all: {
      total: totals?.total ?? 0,
      active: totals?.active ?? 0,
      passed: totals?.passed ?? 0,
      cancelled: totals?.cancelled ?? 0,
    },
    week: weekRow?.total ?? 0,
    clients: clientsRow?.total ?? 0,
    waitlist: waitlistRow?.total ?? 0,
    servicesActive: servicesRow?.active ?? 0,
    next: nextAppt
      ? {
          client_name: nextAppt.client_name,
          service_name: nextAppt.service_name,
          start: nextAppt.start.toISOString(),
        }
      : null,
  });
}
