"use client";

import { useEffect, useState, type ReactNode } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { DAY_NAMES, HOURS, TZ } from "@/lib/shop";

type DayWin = { open: string; close: string; openMins: number; closeMins: number };
type ByDay = Record<number, DayWin[]>;

type Closure = {
  id: string;
  reason: string | null;
  all_day: boolean;
  start: string;
  end: string;
};

function fallbackByDay(): ByDay {
  const out: ByDay = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  for (let d = 0; d <= 6; d++) {
    const h = HOURS[d];
    if (!h) continue;
    out[d] = [
      {
        open: `${String(Math.floor(h[0] / 60)).padStart(2, "0")}:${String(h[0] % 60).padStart(2, "0")}`,
        close: `${String(Math.floor(h[1] / 60)).padStart(2, "0")}:${String(h[1] % 60).padStart(2, "0")}`,
        openMins: h[0],
        closeMins: h[1],
      },
    ];
  }
  return out;
}

function fmtMins(m: number) {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function joinWindows(wins: DayWin[]): ReactNode {
  if (!wins?.length) return null;
  return wins.map((w, i) => (
    <span key={`${w.open}-${w.close}`}>
      {i > 0 ? " · " : null}
      <bdi dir="ltr">
        {fmtMins(w.openMins)}–{fmtMins(w.closeMins)}
      </bdi>
    </span>
  ));
}

function closureLabel(c: Closure) {
  const reason = c.reason || (c.all_day ? "סגירה" : "שעות חלקיות");
  if (c.all_day) {
    const start = formatInTimeZone(c.start, TZ, "d/M");
    const end = formatInTimeZone(c.end, TZ, "d/M");
    return start === end ? `${reason} · ${start}` : `${reason} · ${start}–${end}`;
  }
  return `${reason} · ${formatInTimeZone(c.start, TZ, "d/M HH:mm")}–${formatInTimeZone(c.end, TZ, "HH:mm")}`;
}

export function HoursDropdown({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(0);
  const [byDay, setByDay] = useState<ByDay>(fallbackByDay);
  const [closures, setClosures] = useState<Closure[]>([]);

  useEffect(() => {
    setDay(new Date().getDay());
    let cancelled = false;
    const load = () => {
      Promise.all([fetch("/api/hours"), fetch("/api/closures")])
        .then(async ([hoursRes, closuresRes]) => {
          const hoursData = await hoursRes.json().catch(() => null);
          const closuresData = await closuresRes.json().catch(() => null);
          if (cancelled) return;
          if (hoursData?.byDay) setByDay(hoursData.byDay);
          if (Array.isArray(closuresData?.closures)) setClosures(closuresData.closures);
        })
        .catch(() => {
          /* keep fallback */
        });
    };
    load();
    const onVis = () => {
      if (document.visibilityState === "visible") load();
    };
    window.addEventListener("focus", load);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", load);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const todayHours = byDay[day] || [];
  const todayParts = joinWindows(todayHours);
  const todayLabel = todayParts ? (
    <>
      {DAY_NAMES[day]} · {todayParts}
    </>
  ) : (
    <>{DAY_NAMES[day]} · סגור</>
  );

  return (
    <div className={`hours-dd ${className}${open ? " open" : ""}`}>
      <button
        type="button"
        className="hours-dd-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="hours-dd-label">{todayLabel}</span>
        <span className="hours-dd-arrow" aria-hidden="true">
          ▾
        </span>
      </button>
      {open ? (
        <div className="hours-dd-panel">
          <table className="hours hours-dd-table">
            <tbody>
              {DAY_NAMES.map((name, d) => {
                const wins = byDay[d] || [];
                const parts = joinWindows(wins);
                return (
                  <tr key={d} data-day={d} className={d === day ? "today" : undefined}>
                    <th scope="row">{name}</th>
                    <td>{parts || "סגור"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {closures.length ? (
            <div className="hours-closures">
              <strong>סגירות וחופשות קרובות</strong>
              <ul>
                {closures.slice(0, 8).map((c) => (
                  <li key={c.id}>{closureLabel(c)}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
