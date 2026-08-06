"use client";

import { useCallback, useEffect, useState } from "react";
import { TimeSelect24 } from "@/components/TimeSelect24";
import { normalizeHhmm } from "@/lib/time-format";

const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

type DayState = {
  closed: boolean;
  open: string;
  close: string;
  breakOn: boolean;
  breakStart: string;
  breakEnd: string;
};

function emptyWeek(): DayState[] {
  return DAY_NAMES.map(() => ({
    closed: true,
    open: "09:00",
    close: "21:00",
    breakOn: false,
    breakStart: "13:00",
    breakEnd: "15:00",
  }));
}

function sliceTime(t: string) {
  return normalizeHhmm(String(t).slice(0, 5));
}

function windowsToDay(windows: { open_time: string; close_time: string }[]): DayState {
  const sorted = [...windows]
    .map((w) => ({ open: sliceTime(w.open_time), close: sliceTime(w.close_time) }))
    .sort((a, b) => a.open.localeCompare(b.open));
  if (!sorted.length) {
    return emptyWeek()[0];
  }
  if (sorted.length === 1) {
    return {
      closed: false,
      open: sorted[0].open,
      close: sorted[0].close,
      breakOn: false,
      breakStart: "13:00",
      breakEnd: "15:00",
    };
  }
  return {
    closed: false,
    open: sorted[0].open,
    close: sorted[sorted.length - 1].close,
    breakOn: true,
    breakStart: sorted[0].close,
    breakEnd: sorted[1].open,
  };
}

export default function AdminHoursPage() {
  const [days, setDays] = useState<DayState[]>(emptyWeek);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/hours");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "שגיאת טעינה");
        return;
      }
      const byDay: { open_time: string; close_time: string }[][] = Array.from({ length: 7 }, () => []);
      for (const h of data.hours || []) {
        const d = Number(h.day_of_week);
        if (d < 0 || d > 6) continue;
        byDay[d].push({ open_time: h.open_time, close_time: h.close_time });
      }
      setDays(
        byDay.map((wins) => {
          if (!wins.length) return emptyWeek()[0];
          return windowsToDay(wins);
        }),
      );
    } catch {
      setError("שגיאת רשת");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function patchDay(day: number, patch: Partial<DayState>) {
    setDays((prev) => prev.map((d, i) => (i === day ? { ...d, ...patch } : d)));
  }

  function daySummary(day: DayState) {
    if (day.closed) return "סגור";
    if (day.breakOn) {
      return `${day.open}–${day.breakStart} · הפסקה · ${day.breakEnd}–${day.close}`;
    }
    return `${day.open}–${day.close}`;
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    setError(null);
    try {
      const hours: { day_of_week: number; open_time: string; close_time: string }[] = [];
      for (let d = 0; d < days.length; d++) {
        const day = days[d];
        if (day.closed) continue;
        const open = normalizeHhmm(day.open);
        const close = normalizeHhmm(day.close);
        if (open >= close) {
          setError(`ביום ${DAY_NAMES[d]} בדקו שעות פתיחה וסגירה`);
          return;
        }
        if (day.breakOn) {
          const breakStart = normalizeHhmm(day.breakStart);
          const breakEnd = normalizeHhmm(day.breakEnd);
          if (!(open < breakStart && breakStart < breakEnd && breakEnd < close)) {
            setError(
              `ביום ${DAY_NAMES[d]} ההפסקה חייבת להיות בתוך שעות הפעילות (פתיחה ← התחלת הפסקה ← סוף הפסקה ← סגירה)`,
            );
            return;
          }
          hours.push({ day_of_week: d, open_time: `${open}:00`, close_time: `${breakStart}:00` });
          hours.push({ day_of_week: d, open_time: `${breakEnd}:00`, close_time: `${close}:00` });
        } else {
          hours.push({ day_of_week: d, open_time: `${open}:00`, close_time: `${close}:00` });
        }
      }
      const res = await fetch("/api/admin/hours", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hours }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "שגיאה בשמירה");
        return;
      }
      setMsg("נשמר — השעות וההפסקות מתעדכנות באתר ובקביעת תור");
      window.dispatchEvent(new Event("lidor:hours-changed"));
      await load();
    } catch {
      setError("שגיאת רשת");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="admin-muted">טוען שעות…</p>;

  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h1>שעות פעילות</h1>
          <p>
            מתג לכל יום — פתוח או סגור. השעות בפורמט 24 שעות ומתעדכנות באתר ובקביעת תור.
          </p>
        </div>
      </div>

      {msg ? <p className="admin-ok">{msg}</p> : null}
      {error ? <p className="cal-error">{error}</p> : null}

      <div className="admin-hours-day-list">
        {DAY_NAMES.map((name, d) => {
          const day = days[d];
          const isOpen = !day.closed;
          const switchId = `hours-day-${d}`;
          return (
            <article
              key={name}
              className={`admin-entity-card admin-hours-day${day.closed ? " inactive" : ""}`}
            >
              <div className="admin-hours-day-head">
                <div className="admin-hours-day-title">
                  <strong>{name}</strong>
                  <span className="admin-entity-meta" dir="ltr">
                    {daySummary(day)}
                  </span>
                </div>
                <label className="admin-switch" htmlFor={switchId}>
                  <span className="admin-switch-label">{isOpen ? "פתוח" : "סגור"}</span>
                  <input
                    id={switchId}
                    type="checkbox"
                    role="switch"
                    checked={isOpen}
                    aria-checked={isOpen}
                    aria-label={`${name}: ${isOpen ? "פתוח" : "סגור"}`}
                    onChange={(e) => patchDay(d, { closed: !e.target.checked })}
                  />
                  <span className="admin-switch-track" aria-hidden="true">
                    <span className="admin-switch-thumb" />
                  </span>
                </label>
              </div>

              <div className="admin-hours-day-body">
                {!day.closed ? (
                  <>
                    <div className="admin-hours-window">
                      <label>
                        <span>פתיחה</span>
                        <TimeSelect24 value={day.open} onChange={(v) => patchDay(d, { open: v })} />
                      </label>
                      <label>
                        <span>סגירה</span>
                        <TimeSelect24 value={day.close} onChange={(v) => patchDay(d, { close: v })} />
                      </label>
                    </div>

                    <label className="admin-check">
                      <input
                        type="checkbox"
                        checked={day.breakOn}
                        onChange={(e) => patchDay(d, { breakOn: e.target.checked })}
                      />
                      <span>הפסקה ביום זה</span>
                    </label>

                    {day.breakOn ? (
                      <div className="admin-hours-break">
                        <p className="admin-setting-hint" style={{ margin: 0 }}>
                          בשעות ההפסקה לא יוצעו תורים באתר.
                        </p>
                        <div className="admin-hours-window">
                          <label>
                            <span>תחילת הפסקה</span>
                            <TimeSelect24
                              value={day.breakStart}
                              onChange={(v) => patchDay(d, { breakStart: v })}
                            />
                          </label>
                          <label>
                            <span>סוף הפסקה</span>
                            <TimeSelect24
                              value={day.breakEnd}
                              onChange={(v) => patchDay(d, { breakEnd: v })}
                            />
                          </label>
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className="admin-muted" style={{ margin: 0 }}>
                    היום סגור — לא יוצגו תורים באתר.
                  </p>
                )}
              </div>
            </article>
          );
        })}

        <div className="admin-hours-save-row">
          <button type="button" className="admin-btn-primary" disabled={saving} onClick={() => void save()}>
            {saving ? "שומר…" : "שמור שעות"}
          </button>
        </div>
      </div>
    </div>
  );
}
