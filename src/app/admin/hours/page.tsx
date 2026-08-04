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
      <h1 className="display text-3xl">שעות פעילות</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">שבת בלי שורה = סגור</p>
      <ul className="mt-6 space-y-3">
        {hours.map((h, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--card)] p-3">
            <span className="w-16 font-semibold">{DAY_NAMES[h.day_of_week]}</span>
            <input
              type="time"
              value={h.open_time}
              onChange={(e) => setHours((prev) => prev.map((x, j) => (j === i ? { ...x, open_time: e.target.value } : x)))}
              className="rounded-lg border border-[var(--line)] bg-[var(--bg)] px-2 py-1"
            />
            <input
              type="time"
              value={h.close_time}
              onChange={(e) => setHours((prev) => prev.map((x, j) => (j === i ? { ...x, close_time: e.target.value } : x)))}
              className="rounded-lg border border-[var(--line)] bg-[var(--bg)] px-2 py-1"
            />
            <button
              type="button"
              className="text-sm text-red-300"
              onClick={() => setHours((prev) => prev.filter((_, j) => j !== i))}
            >
              מחק
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        {DAY_NAMES.map((n, d) => (
          <button key={n} type="button" onClick={() => addRow(d)} className="rounded-full border border-[var(--line)] px-3 py-1 text-sm">
            + {n}
          </button>
        ))}
      </div>
      <button type="button" onClick={save} className="mt-6 rounded-xl bg-[var(--accent)] px-5 py-3 font-bold text-[#1a0f0a]">
        שמור שעות
      </button>
      {msg && <p className="mt-2 text-sm text-[var(--muted)]">{msg}</p>}
    </div>
  );
}
