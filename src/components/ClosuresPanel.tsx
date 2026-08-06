"use client";

import { useCallback, useEffect, useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { TimeSelect24 } from "@/components/TimeSelect24";
import { IconPencil, IconTrash } from "@/components/icons";
import { TZ } from "@/lib/shop";

type Closure = {
  id: string;
  reason: string | null;
  all_day: boolean;
  start: string;
  end: string;
};

function todayYmd() {
  return formatInTimeZone(new Date(), TZ, "yyyy-MM-dd");
}

export function ClosuresPanel() {
  const [closures, setClosures] = useState<Closure[]>([]);
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [allDay, setAllDay] = useState(true);
  const [dateYmd, setDateYmd] = useState(todayYmd);
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

  useEffect(() => {
    if (!modal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModal(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal]);

  function resetForm() {
    setAllDay(true);
    setDateYmd(todayYmd());
    setEndDateYmd("");
    setStartTime("09:00");
    setEndTime("13:00");
    setReason("");
    setEditId(null);
    setError(null);
  }

  function openAdd() {
    resetForm();
    setModal("add");
  }

  function openEdit(c: Closure) {
    setError(null);
    setEditId(c.id);
    setAllDay(c.all_day);
    setDateYmd(formatInTimeZone(c.start, TZ, "yyyy-MM-dd"));
    setStartTime(formatInTimeZone(c.start, TZ, "HH:mm"));
    setEndTime(formatInTimeZone(c.end, TZ, "HH:mm"));
    const endDay = formatInTimeZone(c.end, TZ, "yyyy-MM-dd");
    const startDay = formatInTimeZone(c.start, TZ, "yyyy-MM-dd");
    setEndDateYmd(c.all_day && endDay !== startDay ? endDay : "");
    setReason(c.reason || "");
    setModal("edit");
  }

  function closeModal() {
    setModal(null);
    setEditId(null);
    setError(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        id: editId || undefined,
        dateYmd,
        endDateYmd: allDay && endDateYmd ? endDateYmd : undefined,
        allDay,
        startTime: allDay ? undefined : startTime,
        endTime: allDay ? undefined : endTime,
        reason: reason || undefined,
      };
      const res = await fetch("/api/admin/closures", {
        method: modal === "edit" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "שגיאה");
        return;
      }
      closeModal();
      await load();
      window.dispatchEvent(new Event("lidor:hours-changed"));
    } catch {
      setError("שגיאת רשת");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string, label: string) {
    if (!confirm(`למחוק את הסגירה "${label}"?`)) return;
    await fetch(`/api/admin/closures?id=${id}`, { method: "DELETE" });
    await load();
    window.dispatchEvent(new Event("lidor:hours-changed"));
  }

  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h1>סגירות וחופשות</h1>
          <p>
            חגים וסגירות חלקיות — מתעדכנים באתר (רשימת שעות), ב״פתוח עכשיו״, וחוסמים תורים
            ביומן הציבורי.
          </p>
        </div>
        <button type="button" className="admin-btn-primary" onClick={openAdd}>
          + סגירה חדשה
        </button>
      </div>

      <div className="admin-entity-grid">
        {closures.map((c) => {
          const title = c.reason || "סגירה";
          const range = `${formatInTimeZone(c.start, TZ, "dd/MM/yyyy HH:mm")} – ${formatInTimeZone(c.end, TZ, "dd/MM/yyyy HH:mm")}`;
          return (
            <article key={c.id} className="admin-entity-card">
              <div className="admin-entity-main" style={{ cursor: "default" }}>
                <strong>{title}</strong>
                <span className="admin-entity-meta">{range}</span>
                <span className="admin-badge">{c.all_day ? "יום שלם" : "שעות חלקיות"}</span>
              </div>
              <div className="admin-entity-actions admin-entity-actions-wrap">
                <button
                  type="button"
                  className="admin-icon-btn"
                  title="עריכה"
                  aria-label="עריכה"
                  onClick={() => openEdit(c)}
                >
                  <IconPencil />
                </button>
                <button
                  type="button"
                  className="admin-icon-btn danger"
                  title="מחיקה"
                  aria-label="מחיקה"
                  onClick={() => void remove(c.id, title)}
                >
                  <IconTrash />
                </button>
              </div>
            </article>
          );
        })}
        {!closures.length ? <p className="admin-muted">אין סגירות עתידיות</p> : null}
      </div>

      {modal ? (
        <div
          className="cal-modal"
          role="dialog"
          aria-modal="true"
          aria-label={modal === "edit" ? "עריכת סגירה" : "סגירה חדשה"}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <form className="cal-modal-card" onSubmit={(e) => void save(e)}>
            <div className="cal-modal-head">
              <h2>{modal === "edit" ? "עריכת סגירה" : "סגירה חדשה"}</h2>
              <button type="button" className="cal-chip" onClick={closeModal}>
                סגור
              </button>
            </div>
            <div className="cal-modal-body">
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
                    <TimeSelect24 value={startTime} onChange={setStartTime} />
                  </label>
                  <label>
                    <span>עד שעה</span>
                    <TimeSelect24 value={endTime} onChange={setEndTime} />
                  </label>
                </div>
              )}
              <label>
                <span>סיבה</span>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="חופשה / חג / סגירה"
                />
              </label>
              {error ? <p className="cal-error">{error}</p> : null}
            </div>
            <div className="cal-modal-actions">
              <button type="submit" className="admin-btn-primary" disabled={saving}>
                {saving ? "שומר…" : modal === "edit" ? "שמירה" : "הוסף סגירה"}
              </button>
              <button type="button" className="admin-btn-secondary" onClick={() => setModal(null)}>
                ביטול
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
