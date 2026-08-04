import { getSql } from "./db";
import { LEAD_MINUTES, SLOT_STEP_MINUTES } from "./shop";
import { getShopSettings } from "./settings";
import { jerusalemDayOfWeek, wallTimeToUtc } from "./time";

export type TimeWindow = { open_time: string; close_time: string };
export type BusyPeriod = { start: Date; end: Date };

export type SlotComputeInput = {
  dateYmd: string;
  durationMinutes: number;
  windows: TimeWindow[];
  busy: BusyPeriod[];
  now?: Date;
  leadMinutes?: number;
  stepMinutes?: number;
  /** When true (admin walk-in), skip lead-time filter */
  bypassLead?: boolean;
};

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** Pure slot generator — unit-tested. Returns ISO UTC strings. */
export function computeAvailableSlots(input: SlotComputeInput): string[] {
  const {
    dateYmd,
    durationMinutes,
    windows,
    busy,
    now = new Date(),
    leadMinutes = LEAD_MINUTES,
    stepMinutes = SLOT_STEP_MINUTES,
    bypassLead = false,
  } = input;

  if (!windows.length || durationMinutes <= 0) return [];

  const earliest = bypassLead ? now : new Date(now.getTime() + leadMinutes * 60_000);
  const slots: string[] = [];

  for (const win of windows) {
    const open = wallTimeToUtc(dateYmd, String(win.open_time).slice(0, 8));
    const close = wallTimeToUtc(dateYmd, String(win.close_time).slice(0, 8));
    const stepMs = stepMinutes * 60_000;
    const durMs = durationMinutes * 60_000;

    for (let t = open.getTime(); t + durMs <= close.getTime(); t += stepMs) {
      const start = new Date(t);
      const end = new Date(t + durMs);
      if (start < earliest) continue;
      const hit = busy.some((b) => overlaps(start, end, b.start, b.end));
      if (hit) continue;
      slots.push(start.toISOString());
    }
  }

  return slots;
}

export async function getAvailableSlots(
  dateYmd: string,
  serviceId: string,
  opts?: { bypassLead?: boolean; now?: Date },
): Promise<string[]> {
  const sql = getSql();

  const [service] = await sql<{ duration_minutes: number }[]>`
    select duration_minutes from services where id = ${serviceId}::uuid and active = true
  `;
  if (!service) return [];

  const dow = jerusalemDayOfWeek(dateYmd);
  const windows = await sql<TimeWindow[]>`
    select open_time::text, close_time::text
    from working_hours
    where day_of_week = ${dow}
    order by open_time
  `;
  if (!windows.length) return [];

  const dayStart = wallTimeToUtc(dateYmd, "00:00:00");
  const dayEnd = wallTimeToUtc(dateYmd, "23:59:59");

  const appts = await sql<{ lower: Date; upper: Date }[]>`
    select lower(period) as lower, upper(period) as upper
    from appointments
    where status = 'confirmed'
      and period && tstzrange(${dayStart.toISOString()}::timestamptz, ${dayEnd.toISOString()}::timestamptz, '[)')
  `;

  const blocks = await sql<{ lower: Date; upper: Date }[]>`
    select lower(period) as lower, upper(period) as upper
    from blocks
    where period && tstzrange(${dayStart.toISOString()}::timestamptz, ${dayEnd.toISOString()}::timestamptz, '[)')
  `;

  const busy: BusyPeriod[] = [
    ...appts.map((a) => ({ start: new Date(a.lower), end: new Date(a.upper) })),
    ...blocks.map((b) => ({ start: new Date(b.lower), end: new Date(b.upper) })),
  ];

  let leadMinutes = LEAD_MINUTES;
  let stepMinutes = SLOT_STEP_MINUTES;
  let bufferMinutes = 0;
  try {
    const settings = await getShopSettings();
    leadMinutes = settings.lead_minutes;
    stepMinutes = settings.slot_step_minutes;
    bufferMinutes = settings.buffer_minutes;
  } catch {
    /* defaults */
  }

  const busyWithBuffer =
    bufferMinutes > 0
      ? busy.map((b) => ({
          start: b.start,
          // Cleanup time is added after each booking and blocks the calendar
          end: new Date(b.end.getTime() + bufferMinutes * 60_000),
        }))
      : busy;

  return computeAvailableSlots({
    dateYmd,
    durationMinutes: service.duration_minutes,
    windows,
    busy: busyWithBuffer,
    now: opts?.now,
    leadMinutes,
    stepMinutes,
    bypassLead: opts?.bypassLead,
  });
}
