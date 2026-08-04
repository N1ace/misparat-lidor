"use client";

import { useCallback, useEffect, useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { TZ } from "@/lib/shop";

type Closure = {
  id: string;
  reason: string | null;
  all_day: boolean;
  start: string;
  end: string;
};

export function ClosuresPanel() {
  const [closures, setClosures] = useState<Closure[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [allDay, setAllDay] = useState(true);
  const [dateYmd, setDateYmd] = useState(() => formatInTimeZone(new Date(), TZ, "yyyy-MM-dd"));
  const [endDateYmd, setEndDateYmd] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("13:00");
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/closures");
    const data = await res.json();
    setClosures(data.closures || []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/closures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dateYmd,
          endDateYmd: endDateYmd || undefined,
          allDay,
          startTime: allDay ? undefined : startTime,
          endTime: allDay ? undefined : endTime,
          reason: reason || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "שגיאה");
        return;
      }
      setReason("");
      setEndDateYmd("");
      await load();
    } catch {
      setError("שגיאת רשת");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("למחוק סגירה?")) return;
    await fetch(`/api/admin/closures?id=${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h1>סגירות וחופשות</h1>
          <p>חסימות שלא נפתחות לתורים אונליין.</p>
        </div>
      </div>

      <form className="admin-card admin-form" onSubmit={create}>
        <h2>סגירה חדשה</h2>
        <div className="admin-choice-cards" role="radiogroup" aria-label="סוג סגירה">
          <button
            type="button"
            role="radio"
            aria-checked={allDay}
            className={`admin-choice-card${allDay ? " on" : ""}`}
            onClick={() => setAllDay(true)}
          >
            <strong>יום שלם</strong>
            <span>יום אחד או טווח ימים מלא</span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={!allDay}
            className={`admin-choice-card${!allDay ? " on" : ""}`}
            onClick={() => setAllDay(false)}
          >
            <strong>שעות חלקיות</strong>
            <span>סגירה בטווח שעות ביום</span>
          </button>
        </div>
        <label>
          <span>מתאריך</span>
          <input type="date" required value={dateYmd} onChange={(e) => setDateYmd(e.target.value)} />
        </label>
        {allDay ? (
          <label>
            <span>עד תאריך (אופציונלי)</span>
            <input type="date" value={endDateYmd} onChange={(e) => setEndDateYmd(e.target.value)} />
          </label>
        ) : (
          <div className="admin-row">
            <label>
              <span>משעה</span>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </label>
            <label>
              <span>עד שעה</span>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </label>
          </div>
        )}
        <label>
          <span>סיבה</span>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="חופשה / חג / סגירה" />
        </label>
        {error ? <p className="cal-error">{error}</p> : null}
        <button type="submit" className="admin-btn-primary" disabled={saving}>
          {saving ? "שומר…" : "הוסף סגירה"}
        </button>
      </form>

      <ul className="admin-card admin-list-plain">
        {closures.map((c) => (
          <li key={c.id}>
            <div>
              <strong>{c.reason || "סגירה"}</strong>
              <span>
                {formatInTimeZone(c.start, TZ, "dd/MM/yyyy HH:mm")} –{" "}
                {formatInTimeZone(c.end, TZ, "dd/MM/yyyy HH:mm")}
                {c.all_day ? " · יום שלם" : ""}
              </span>
            </div>
            <button type="button" className="cal-chip" onClick={() => void remove(c.id)}>
              מחק
            </button>
          </li>
        ))}
        {!closures.length ? <li className="admin-muted">אין סגירות עתידיות</li> : null}
      </ul>
    </div>
  );
}
