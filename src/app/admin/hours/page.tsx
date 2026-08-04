"use client";

import { useEffect, useState } from "react";

const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

type Hour = { id?: string; day_of_week: number; open_time: string; close_time: string };

export default function AdminHoursPage() {
  const [hours, setHours] = useState<Hour[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/hours")
      .then((r) => r.json())
      .then((d) => {
        const rows = (d.hours || []).map((h: Hour) => ({
          ...h,
          open_time: String(h.open_time).slice(0, 5),
          close_time: String(h.close_time).slice(0, 5),
        }));
        setHours(rows);
      });
  }, []);

  async function save() {
    setMsg(null);
    const res = await fetch("/api/admin/hours", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hours: hours.map((h) => ({
          day_of_week: h.day_of_week,
          open_time: h.open_time.length === 5 ? `${h.open_time}:00` : h.open_time,
          close_time: h.close_time.length === 5 ? `${h.close_time}:00` : h.close_time,
        })),
      }),
    });
    setMsg(res.ok ? "נשמר" : "שגיאה");
  }

  function addRow(day: number) {
    setHours((prev) => [...prev, { day_of_week: day, open_time: "09:00", close_time: "19:00" }]);
  }

  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h1>שעות פעילות</h1>
          <p>עדכון כאן מתעדכן אוטומטית באתר (תפריט שעות ו״פתוח עכשיו״) ובזמינות הזמנה אונליין. יום בלי שורה = סגור.</p>
        </div>
      </div>
      <ul className="admin-stack">
        {hours.map((h, i) => (
          <li key={i} className="admin-card admin-row" style={{ maxWidth: 520, alignItems: "center" }}>
            <span className="w-16 font-semibold">{DAY_NAMES[h.day_of_week]}</span>
            <input
              type="time"
              value={h.open_time}
              onChange={(e) => setHours((prev) => prev.map((x, j) => (j === i ? { ...x, open_time: e.target.value } : x)))}
            />
            <input
              type="time"
              value={h.close_time}
              onChange={(e) => setHours((prev) => prev.map((x, j) => (j === i ? { ...x, close_time: e.target.value } : x)))}
            />
            <button
              type="button"
              className="admin-danger-link"
              onClick={() => setHours((prev) => prev.filter((_, j) => j !== i))}
            >
              מחק
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        {DAY_NAMES.map((n, d) => (
          <button key={n} type="button" onClick={() => addRow(d)} className="cal-chip">
            + {n}
          </button>
        ))}
      </div>
      <button type="button" onClick={save} className="admin-btn-primary" style={{ marginTop: "1rem" }}>
        שמור שעות
      </button>
      {msg && <p className="admin-ok" style={{ marginTop: "0.75rem" }}>{msg}</p>}
    </div>
  );
}
