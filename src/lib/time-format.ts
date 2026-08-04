/** 24-hour clock helpers — always HH:mm, never AM/PM. */

export function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** Minutes from midnight → "HH:mm" */
export function minsToHhmm(mins: number): string {
  const m = ((Math.floor(mins) % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
}

/** "HH:mm" or "H:mm" → "HH:mm" */
export function normalizeHhmm(value: string): string {
  const raw = String(value || "").trim().slice(0, 5);
  const m = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return "09:00";
  const h = Math.min(23, Math.max(0, Number(m[1])));
  const min = Math.min(59, Math.max(0, Number(m[2])));
  return `${pad2(h)}:${pad2(min)}`;
}

export function generateTimeOptions(stepMinutes = 15): string[] {
  const step = Math.max(1, Math.min(60, stepMinutes));
  const out: string[] = [];
  for (let m = 0; m < 24 * 60; m += step) {
    out.push(minsToHhmm(m));
  }
  return out;
}

/** Ensure option list includes the current value even if off-step. */
export function optionsWithValue(options: string[], value: string): string[] {
  const v = normalizeHhmm(value);
  if (options.includes(v)) return options;
  return [...options, v].sort();
}
