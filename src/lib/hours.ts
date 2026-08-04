import { getSql } from "./db";
import { HOURS } from "./shop";
import { formatJerusalem, jerusalemDayOfWeek, wallTimeToUtc } from "./time";

export type WorkingWindow = {
  day_of_week: number;
  open_time: string;
  close_time: string;
};

export type DayWindows = Record<
  number,
  { open: string; close: string; openMins: number; closeMins: number }[]
>;

function timeToMins(hhmm: string): number {
  const [h, m] = String(hhmm).slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

function minsToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Seed DB from website HOURS constants when the table is empty. */
export async function ensureWorkingHoursSeeded(): Promise<void> {
  const sql = getSql();
  const [row] = await sql<{ count: number }[]>`
    select count(*)::int as count from working_hours
  `;
  if (row && row.count > 0) return;

  for (let dow = 0; dow <= 6; dow++) {
    const range = HOURS[dow];
    if (!range) continue;
    const open = minsToTime(range[0]);
    const close = minsToTime(range[1]);
    await sql`
      insert into working_hours (day_of_week, open_time, close_time)
      values (${dow}, ${open}::time, ${close}::time)
    `;
  }
}

export async function getWorkingWindows(): Promise<WorkingWindow[]> {
  await ensureWorkingHoursSeeded();
  const sql = getSql();
  const rows = await sql<{ day_of_week: number; open_time: string; close_time: string }[]>`
    select day_of_week, open_time::text, close_time::text
    from working_hours
    order by day_of_week, open_time
  `;
  return rows.map((r) => ({
    day_of_week: r.day_of_week,
    open_time: String(r.open_time).slice(0, 5),
    close_time: String(r.close_time).slice(0, 5),
  }));
}

export function groupWindowsByDay(windows: WorkingWindow[]): DayWindows {
  const out: DayWindows = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  for (const w of windows) {
    out[w.day_of_week] = out[w.day_of_week] || [];
    out[w.day_of_week].push({
      open: w.open_time,
      close: w.close_time,
      openMins: timeToMins(w.open_time),
      closeMins: timeToMins(w.close_time),
    });
  }
  return out;
}

/** True if [start, end) sits fully inside a working window for that Jerusalem day. */
export function isRangeInsideWindows(
  dateYmd: string,
  startTime: string,
  endTime: string,
  windows: WorkingWindow[],
): boolean {
  const dow = jerusalemDayOfWeek(dateYmd);
  const dayWins = windows.filter((w) => w.day_of_week === dow);
  if (!dayWins.length) return false;
  const startM = timeToMins(startTime);
  const endM = timeToMins(endTime);
  if (!(startM < endM)) return false;
  return dayWins.some((w) => {
    const open = timeToMins(w.open_time);
    const close = timeToMins(w.close_time);
    return startM >= open && endM <= close;
  });
}

export async function isWithinWorkingHours(opts: {
  dateYmd: string;
  startTime: string;
  durationMinutes: number;
}): Promise<boolean> {
  const windows = await getWorkingWindows();
  const start = wallTimeToUtc(
    opts.dateYmd,
    opts.startTime.length === 5 ? `${opts.startTime}:00` : opts.startTime,
  );
  const end = new Date(start.getTime() + opts.durationMinutes * 60_000);
  const startJerusalem = formatJerusalem(start, "HH:mm");
  const endJerusalem = formatJerusalem(end, "HH:mm");
  const endYmd = formatJerusalem(end, "yyyy-MM-dd");
  if (endYmd !== opts.dateYmd) return false;
  return isRangeInsideWindows(opts.dateYmd, startJerusalem, endJerusalem, windows);
}

export { timeToMins, minsToTime };
