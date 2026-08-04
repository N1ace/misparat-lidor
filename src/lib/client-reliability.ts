import type { ApptStatus } from "./appointment-status";

export type ReliabilityColor = "green" | "orange" | "red" | "grey";

export type ReliabilityStat = {
  color: ReliabilityColor;
  score: number | null;
  label_he: string;
  completed: number;
  cancelled: number;
  no_show: number;
  confirmed: number;
  history_count: number;
  total_bookings: number;
  is_repeat_no_show: boolean;
  tooltip: string;
  last_booking_at: string | null;
};

const SCORE_GREEN_MIN = 85;
const SCORE_ORANGE_MIN = 60;
const MIN_HISTORY = 3;
const REPEAT_NO_SHOW_MIN = 2;

/** Damage model inspired by YeshTor traffic light. */
function damageFor(status: ApptStatus): number | null {
  if (status === "done") return 0;
  if (status === "cancelled") return 0.4;
  if (status === "no_show") return 1;
  return null; // confirmed / upcoming not scored
}

export function computeReliability(
  appointments: { status: string; start?: string | Date | null }[],
): ReliabilityStat {
  let completed = 0;
  let cancelled = 0;
  let no_show = 0;
  let confirmed = 0;
  const damages: number[] = [];
  let lastMs = -Infinity;

  for (const a of appointments) {
    if (a.start) {
      const t = new Date(a.start).getTime();
      if (Number.isFinite(t) && t > lastMs) lastMs = t;
    }
    if (a.status === "done") {
      completed += 1;
      damages.push(0);
    } else if (a.status === "cancelled") {
      cancelled += 1;
      damages.push(0.4);
    } else if (a.status === "no_show") {
      no_show += 1;
      damages.push(1);
    } else if (a.status === "confirmed") {
      confirmed += 1;
    }
  }

  const last_booking_at = lastMs > -Infinity ? new Date(lastMs).toISOString() : null;
  const history_count = damages.length;
  const total_bookings = appointments.length;
  const is_repeat_no_show = no_show >= REPEAT_NO_SHOW_MIN;

  if (history_count < MIN_HISTORY) {
    const tooltip = `חדש — ${history_count} תורים מדורגים (נדרשים ${MIN_HISTORY} לדירוג)`;
    return {
      color: "grey",
      score: null,
      label_he: "חדש",
      completed,
      cancelled,
      no_show,
      confirmed,
      history_count,
      total_bookings,
      is_repeat_no_show,
      tooltip,
      last_booking_at,
    };
  }

  const avgDamage = damages.reduce((s, d) => s + d, 0) / damages.length;
  let score = Math.round(100 * (1 - avgDamage));
  if (is_repeat_no_show) score = Math.min(score, 59);

  let color: ReliabilityColor = "green";
  if (score < SCORE_ORANGE_MIN) color = "red";
  else if (score < SCORE_GREEN_MIN) color = "orange";

  const parts: string[] = [`${history_count} תורים מדורגים`];
  if (completed) parts.push(`${completed} בוצעו`);
  if (no_show) parts.push(`${no_show} אי-הגעות`);
  if (cancelled) parts.push(`${cancelled} בוטלו`);
  if (is_repeat_no_show) parts.push("אי-הגעות חוזרות — הדירוג אדום");

  return {
    color,
    score,
    label_he: color === "green" ? "טוב" : color === "orange" ? "בינוני" : "בסיכון",
    completed,
    cancelled,
    no_show,
    confirmed,
    history_count,
    total_bookings,
    is_repeat_no_show,
    tooltip: `ציון אמינות ${score}%: ${parts.join(" · ")}`,
    last_booking_at,
  };
}

export function damageForStatus(status: string): number | null {
  if (status === "done" || status === "cancelled" || status === "no_show") {
    return damageFor(status);
  }
  return null;
}
