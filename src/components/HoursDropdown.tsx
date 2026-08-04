"use client";

import { useEffect, useState, type ReactNode } from "react";
import { DAY_NAMES, HOURS } from "@/lib/shop";

type DayWin = { open: string; close: string; openMins: number; closeMins: number };
type ByDay = Record<number, DayWin[]>;

function fallbackByDay(): ByDay {
  const out: ByDay = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  for (let d = 0; d <= 6; d++) {
    const h = HOURS[d];
    if (!h) continue;
    out[d] = [
      {
        open: `${Math.floor(h[0] / 60)}:${String(h[0] % 60).padStart(2, "0")}`,
        close: `${Math.floor(h[1] / 60)}:${String(h[1] % 60).padStart(2, "0")}`,
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
  return `${h}:${String(min).padStart(2, "0")}`;
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

export function HoursDropdown({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(0);
  const [byDay, setByDay] = useState<ByDay>(fallbackByDay);

  useEffect(() => {
    setDay(new Date().getDay());
    let cancelled = false;
    fetch("/api/hours")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data?.byDay) return;
        setByDay(data.byDay);
      })
      .catch(() => {
        /* keep fallback */
      });
    return () => {
      cancelled = true;
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
      ) : null}
    </div>
  );
}
