import { getSql } from "./db";
import { ensureWorkingHoursSeeded, isWithinWorkingHours } from "./hours";
import { LEAD_MINUTES, SLOT_STEP_MINUTES } from "./shop";
import { getShopSettings } from "./settings";
import { formatJerusalem, jerusalemDayOfWeek, wallTimeToUtc } from "./time";

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

async function loadDayBusy(
  dateYmd: string,
  opts?: { excludeAppointmentId?: string },
): Promise<{ windows: TimeWindow[]; busy: BusyPeriod[]; bufferMinutes: number; leadMinutes: number; stepMinutes: number }> {
  await ensureWorkingHoursSeeded();
  const sql = getSql();

  const dow = jerusalemDayOfWeek(dateYmd);
  const windows = await sql<TimeWindow[]>`
    select open_time::text, close_time::text
    from working_hours
    where day_of_week = ${dow}
    order by open_time
  `;

  const dayStart = wallTimeToUtc(dateYmd, "00:00:00");
  const dayEnd = wallTimeToUtc(dateYmd, "23:59:59");
  const excludeId = opts?.excludeAppointmentId || null;

  const appts = await sql<{ lower: Date; upper: Date }[]>`
    select lower(period) as lower, upper(period) as upper
    from appointments
    where status in ('confirmed','held')
      and period && tstzrange(${dayStart.toISOString()}::timestamptz, ${dayEnd.toISOString()}::timestamptz, '[)')
      and (${excludeId}::uuid is null or id <> ${excludeId}::uuid)
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
          end: new Date(b.end.getTime() + bufferMinutes * 60_000),
        }))
      : busy;

  return { windows, busy: busyWithBuffer, bufferMinutes, leadMinutes, stepMinutes };
}

export async function getAvailableSlots(
  dateYmd: string,
  serviceId: string,
  opts?: { bypassLead?: boolean; now?: Date; excludeAppointmentId?: string },
): Promise<string[]> {
  const sql = getSql();

  const [service] = await sql<{ duration_minutes: number }[]>`
    select duration_minutes from services where id = ${serviceId}::uuid and active = true
  `;
  if (!service) return [];

  const { windows, busy, leadMinutes, stepMinutes } = await loadDayBusy(dateYmd, {
    excludeAppointmentId: opts?.excludeAppointmentId,
  });
  if (!windows.length) return [];

  return computeAvailableSlots({
    dateYmd,
    durationMinutes: service.duration_minutes,
    windows,
    busy,
    now: opts?.now,
    leadMinutes,
    stepMinutes,
    bypassLead: opts?.bypassLead,
  });
}

/**
 * Full bookability check used by online book, admin create/edit, and waitlist offers.
 * Respects working hours, closures/blocks, confirmed+held appointments, and buffer.
 */
export async function validateBookablePeriod(opts: {
  serviceId: string;
  start: Date;
  durationMinutes?: number;
  bypassLead?: boolean;
  /** Admin may force outside weekly hours, but still cannot overlap bookings/blocks unless forceOverlap */
  forceOutsideHours?: boolean;
  forceOverlap?: boolean;
  excludeAppointmentId?: string;
  now?: Date;
}): Promise<{ ok: true; end: Date; dateYmd: string } | { ok: false; reason: string; code?: string }> {
  const sql = getSql();
  const [service] = await sql<{ duration_minutes: number }[]>`
    select duration_minutes from services where id = ${opts.serviceId}::uuid and active = true
  `;
  if (!service) return { ok: false, reason: "שירות לא נמצא", code: "service" };

  const duration = opts.durationMinutes ?? service.duration_minutes;
  const start = opts.start;
  const end = new Date(start.getTime() + duration * 60_000);
  const dateYmd = formatJerusalem(start, "yyyy-MM-dd");
  const startTime = formatJerusalem(start, "HH:mm");
  const now = opts.now ?? new Date();

  if (!opts.forceOutsideHours) {
    const inside = await isWithinWorkingHours({
      dateYmd,
      startTime,
      durationMinutes: duration,
    });
    if (!inside) {
      return {
        ok: false,
        reason: "התור מחוץ לשעות הפעילות של המספרה",
        code: "outside_hours",
      };
    }
  }

  if (opts.forceOverlap) {
    return { ok: true, end, dateYmd };
  }

  const { busy, leadMinutes } = await loadDayBusy(dateYmd, {
    excludeAppointmentId: opts.excludeAppointmentId,
  });

  if (!opts.bypassLead) {
    const earliest = new Date(now.getTime() + leadMinutes * 60_000);
    if (start < earliest) {
      return { ok: false, reason: "השעה קרובה מדי — בחרו מועד מאוחר יותר", code: "lead" };
    }
  }

  const hit = busy.some((b) => overlaps(start, end, b.start, b.end));
  if (hit) {
    return { ok: false, reason: "התור נתפס — בחרו שעה אחרת", code: "overlap" };
  }

  return { ok: true, end, dateYmd };
}

/** True if proposed [start,end) fits entirely inside one preferred local-time window. */
export function fitsPreferredWindow(
  start: Date,
  end: Date,
  windows: { start_time: string; end_time: string }[],
): boolean {
  if (!windows.length) return false;
  const dateYmd = formatJerusalem(start, "yyyy-MM-dd");
  if (formatJerusalem(end, "yyyy-MM-dd") !== dateYmd) return false;
  const startM = timeToMins(formatJerusalem(start, "HH:mm"));
  const endM = timeToMins(formatJerusalem(end, "HH:mm"));
  return windows.some((w) => {
    const open = timeToMins(String(w.start_time).slice(0, 5));
    const close = timeToMins(String(w.end_time).slice(0, 5));
    return startM >= open && endM <= close;
  });
}

function timeToMins(hhmm: string): number {
  const [h, m] = String(hhmm).slice(0, 5).split(":").map(Number);
  return h * 60 + (m || 0);
}
