"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { TZ } from "@/lib/shop";

type Service = {
  id: string;
  name: string;
  duration_minutes: number;
  price_agorot: number;
};

type Appt = {
  id: string;
  service_id: string | null;
  service_name: string;
  client_name: string;
  client_phone: string;
  status: string;
  notes: string | null;
  start: string;
  end: string;
};

type View = "day" | "week" | "month";
type ModalMode = "add" | "edit" | null;

const DISPLAY_PAD_START = 8; // preferred earliest hour shown (may extend earlier)
const DISPLAY_PAD_END = 22; // preferred last exclusive hour shown (may extend later)
const HOUR_PX = 56;

function timeToMins(hhmm: string): number {
  const [h, m] = String(hhmm).slice(0, 5).split(":").map(Number);
  return h * 60 + (m || 0);
}

/** Grid must cover all working hours; padding 8–22 is OK when the shop is shorter. */
function plannerHourRange(windows: { open_time: string; close_time: string }[]) {
  let earliest = Infinity;
  let latest = -Infinity;
  for (const w of windows) {
    earliest = Math.min(earliest, timeToMins(w.open_time));
    latest = Math.max(latest, timeToMins(w.close_time));
  }
  if (!Number.isFinite(earliest) || !Number.isFinite(latest)) {
    return { hourStart: DISPLAY_PAD_START, hourEnd: DISPLAY_PAD_END };
  }
  const workStartHour = Math.floor(earliest / 60);
  const workEndHour = Math.max(workStartHour + 1, Math.ceil(latest / 60));
  return {
    hourStart: Math.min(DISPLAY_PAD_START, workStartHour),
    hourEnd: Math.max(DISPLAY_PAD_END, workEndHour),
  };
}

const STATUS_LABEL: Record<string, string> = {
  confirmed: "מאושר",
  done: "בוצע",
  no_show: "לא הגיע",
  cancelled: "בוטל",
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function ymdInTz(d: Date) {
  return formatInTimeZone(d, TZ, "yyyy-MM-dd");
}

function parseYmd(ymd: string) {
  return new Date(`${ymd}T12:00:00`);
}

function addDaysYmd(ymd: string, days: number) {
  const d = parseYmd(ymd);
  d.setDate(d.getDate() + days);
  return ymdInTz(d);
}

function startOfWeekSunday(ymd: string) {
  const js = new Date(`${ymd}T12:00:00`);
  const day = js.getDay();
  js.setDate(js.getDate() - day);
  return ymdInTz(js);
}

function startOfMonth(ymd: string) {
  return ymd.slice(0, 8) + "01";
}

function daysInMonth(ymd: string) {
  const [y, m] = ymd.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

function minutesFromIso(iso: string) {
  const hm = formatInTimeZone(iso, TZ, "HH:mm");
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

function labelDay(ymd: string) {
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
    month: "numeric",
  })
    .format(parseYmd(ymd))
    .replace(/,/g, "");
}

function labelTitle(view: View, focus: string) {
  if (view === "day") {
    return new Intl.DateTimeFormat("he-IL", {
      timeZone: TZ,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(parseYmd(focus));
  }
  if (view === "week") {
    const start = startOfWeekSunday(focus);
    const end = addDaysYmd(start, 6);
    return `${labelDay(start)} – ${labelDay(end)}`;
  }
  const [y, m] = focus.split("-");
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: TZ,
    month: "long",
    year: "numeric",
  }).format(new Date(Number(y), Number(m) - 1, 1));
}

function rangeFor(view: View, focus: string): { from: string; to: string; columns: string[] } {
  if (view === "day") return { from: focus, to: focus, columns: [focus] };
  if (view === "week") {
    const start = startOfWeekSunday(focus);
    const columns = Array.from({ length: 7 }, (_, i) => addDaysYmd(start, i));
    return { from: columns[0], to: columns[6], columns };
  }
  const first = startOfMonth(focus);
  const last = `${focus.slice(0, 8)}${pad2(daysInMonth(focus))}`;
  const columns: string[] = [];
  const n = daysInMonth(focus);
  for (let i = 1; i <= n; i++) columns.push(`${focus.slice(0, 8)}${pad2(i)}`);
  return { from: first, to: last, columns };
}

type OverlapLayout = { column: number; columnCount: number };

function computeOverlapLayout(appts: Appt[]): Map<string, OverlapLayout> {
  const result = new Map<string, OverlapLayout>();
  if (!appts.length) return result;

  const sorted = [...appts].sort((a, b) => {
    const as = new Date(a.start).getTime();
    const bs = new Date(b.start).getTime();
    if (as !== bs) return as - bs;
    return new Date(b.end).getTime() - new Date(a.end).getTime();
  });

  const columnEnds: number[] = [];
  for (const appt of sorted) {
    const start = new Date(appt.start).getTime();
    const end = new Date(appt.end).getTime();
    let column = 0;
    while (column < columnEnds.length && columnEnds[column] > start) column++;
    if (column === columnEnds.length) columnEnds.push(end);
    else columnEnds[column] = end;
    result.set(appt.id, { column, columnCount: 1 });
  }

  for (const appt of sorted) {
    const start = new Date(appt.start).getTime();
    const end = new Date(appt.end).getTime();
    const overlapping = sorted.filter((other) => {
      const os = new Date(other.start).getTime();
      const oe = new Date(other.end).getTime();
      return os < end && start < oe;
    });
    const count = Math.max(...overlapping.map((o) => result.get(o.id)!.column)) + 1;
    for (const o of overlapping) {
      const cur = result.get(o.id)!;
      if (count > cur.columnCount) result.set(o.id, { ...cur, columnCount: count });
    }
  }
  return result;
}

export function CalendarPlanner({ services }: { services: Service[] }) {
  const today = ymdInTz(new Date());
  const [view, setView] = useState<View>("day");
  const [focus, setFocus] = useState(today);
  const [appointments, setAppointments] = useState<Appt[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalMode>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [addDate, setAddDate] = useState(today);
  const [addTime, setAddTime] = useState("10:00");
  const [addService, setAddService] = useState(services[0]?.id ?? "");
  const [addName, setAddName] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addNotes, setAddNotes] = useState("");
  const [addStatus, setAddStatus] = useState("confirmed");
  const [saving, setSaving] = useState(false);
  const [hourStart, setHourStart] = useState(DISPLAY_PAD_START);
  const [hourEnd, setHourEnd] = useState(DISPLAY_PAD_END);

  const { from, to, columns } = useMemo(() => rangeFor(view, focus), [view, focus]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/hours")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const rows = (data.hours || []) as { open_time: string; close_time: string }[];
        const range = plannerHourRange(rows);
        setHourStart(range.hourStart);
        setHourEnd(range.hourEnd);
      })
      .catch(() => {
        /* keep padded defaults */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/appointments?from=${from}&to=${to}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "שגיאה בטעינה");
        setAppointments([]);
        return;
      }
      setAppointments(data.appointments || []);
    } catch {
      setError("שגיאת רשת");
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!modal) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [modal]);

  function shift(dir: -1 | 1) {
    if (view === "day") setFocus((f) => addDaysYmd(f, dir));
    else if (view === "week") setFocus((f) => addDaysYmd(f, dir * 7));
    else {
      const [y, m] = focus.split("-").map(Number);
      const d = new Date(Date.UTC(y, m - 1 + dir, 1));
      setFocus(`${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-01`);
    }
  }

  function openAdd(dateYmd?: string, time?: string) {
    setModal("add");
    setEditId(null);
    setAddDate(dateYmd || focus);
    setAddTime(time || "10:00");
    setAddService(services[0]?.id ?? "");
    setAddName("");
    setAddPhone("");
    setAddNotes("");
    setAddStatus("confirmed");
    setError(null);
  }

  function openEdit(a: Appt) {
    setModal("edit");
    setEditId(a.id);
    setAddDate(formatInTimeZone(a.start, TZ, "yyyy-MM-dd"));
    setAddTime(formatInTimeZone(a.start, TZ, "HH:mm"));
    setAddService(a.service_id || services[0]?.id || "");
    setAddName(a.client_name);
    setAddPhone(a.client_phone);
    setAddNotes(a.notes || "");
    setAddStatus(a.status);
    setError(null);
  }

  async function submitModal(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (modal === "add") {
        const payload = {
          serviceId: addService,
          dateYmd: addDate,
          startTime: addTime,
          name: addName,
          phone: addPhone,
          notes: addNotes || undefined,
        };
        let res = await fetch("/api/admin/appointments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        let data = await res.json();
        if (res.status === 409 && data.code === "outside_hours") {
          const ok = window.confirm(
            data.error ||
              "התור מחוץ לשעות הפעילות של המספרה. האם אתה בטוח שברצונך לקבוע אותו בכל זאת?",
          );
          if (!ok) return;
          res = await fetch("/api/admin/appointments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...payload, forceOutsideHours: true }),
          });
          data = await res.json();
        }
        if (!res.ok) {
          setError(data.error || "שגיאה בקביעת תור");
          return;
        }
      } else if (modal === "edit" && editId) {
        const payload = {
          id: editId,
          serviceId: addService,
          dateYmd: addDate,
          startTime: addTime,
          name: addName,
          phone: addPhone,
          notes: addNotes || null,
          status: addStatus,
        };
        let res = await fetch("/api/admin/appointments", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        let data = await res.json();
        if (res.status === 409 && data.code === "outside_hours") {
          const ok = window.confirm(
            data.error ||
              "התור מחוץ לשעות הפעילות של המספרה. האם אתה בטוח שברצונך לקבוע אותו בכל זאת?",
          );
          if (!ok) return;
          res = await fetch("/api/admin/appointments", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...payload, forceOutsideHours: true }),
          });
          data = await res.json();
        }
        if (!res.ok) {
          setError(data.error || "שגיאה בעדכון");
          return;
        }
      }
      setModal(null);
      await load();
    } catch {
      setError("שגיאת רשת");
    } finally {
      setSaving(false);
    }
  }

  async function quickStatus(status: "done" | "no_show" | "cancelled" | "confirmed") {
    if (!editId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/appointments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editId, status }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "שגיאה");
        return;
      }
      setModal(null);
      await load();
    } catch {
      setError("שגיאת רשת");
    } finally {
      setSaving(false);
    }
  }

  async function removeAppointment() {
    if (!editId) return;
    if (!window.confirm("למחוק את התור מהיומן לצמיתות?")) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/appointments?id=${editId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "שגיאה במחיקה");
        return;
      }
      setModal(null);
      await load();
    } catch {
      setError("שגיאת רשת");
    } finally {
      setSaving(false);
    }
  }

  const hours = useMemo(() => {
    const out: number[] = [];
    for (let h = hourStart; h < hourEnd; h++) out.push(h);
    return out;
  }, [hourStart, hourEnd]);

  const gridHeight = (hourEnd - hourStart) * HOUR_PX;

  function apptsForDay(ymd: string) {
    return appointments.filter((a) => formatInTimeZone(a.start, TZ, "yyyy-MM-dd") === ymd);
  }

  function blockStyle(a: Appt, layout?: OverlapLayout) {
    const startM = minutesFromIso(a.start);
    const endM = minutesFromIso(a.end);
    const top = ((startM - hourStart * 60) / 60) * HOUR_PX;
    const height = Math.max(((endM - startM) / 60) * HOUR_PX, 22);
    const column = layout?.column ?? 0;
    const columnCount = layout?.columnCount ?? 1;
    const widthPct = 100 / columnCount;
    return {
      top,
      height,
      insetInlineStart: `calc(${column * widthPct}% + 2px)`,
      width: `calc(${widthPct}% - 4px)`,
      insetInlineEnd: "auto" as const,
    };
  }

  return (
    <div className="cal">
      <div className="admin-page-head">
        <div>
          <h1>יומן</h1>
          <p>{labelTitle(view, focus)}</p>
        </div>
        <button type="button" className="admin-btn-primary" onClick={() => openAdd()}>
          + תור חדש
        </button>
      </div>

      <div className="cal-toolbar">
        <div className="cal-nav">
          <button type="button" className="cal-icon-btn" onClick={() => shift(-1)} aria-label="הקודם">
            ‹
          </button>
          <button type="button" className="cal-chip" onClick={() => setFocus(today)}>
            היום
          </button>
          <button type="button" className="cal-icon-btn" onClick={() => shift(1)} aria-label="הבא">
            ›
          </button>
        </div>
        <div className="cal-seg" role="tablist" aria-label="תצוגה">
          {(
            [
              ["day", "יום"],
              ["week", "שבוע"],
              ["month", "חודש"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={view === id}
              className={view === id ? "on" : undefined}
              onClick={() => setView(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? <p className="cal-status">טוען…</p> : null}
      {error && !modal ? <p className="cal-error">{error}</p> : null}

      {view === "month" ? (
        <div className="cal-month admin-card">
          <div className="cal-month-head">
            {["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="cal-month-grid">
            {(() => {
              const first = startOfMonth(focus);
              const lead = parseYmd(first).getDay();
              const cells: (string | null)[] = [
                ...Array.from({ length: lead }, () => null),
                ...columns,
              ];
              while (cells.length % 7 !== 0) cells.push(null);
              return cells.map((ymd, i) => {
                if (!ymd) return <div key={`e-${i}`} className="cal-month-cell empty" />;
                const list = apptsForDay(ymd);
                const isToday = ymd === today;
                return (
                  <button
                    key={ymd}
                    type="button"
                    className={`cal-month-cell${isToday ? " today" : ""}`}
                    onClick={() => {
                      setFocus(ymd);
                      setView("day");
                    }}
                  >
                    <span className="cal-month-num">{Number(ymd.slice(8))}</span>
                    {list.length > 0 ? (
                      <span className="cal-month-count">{list.length} תורים</span>
                    ) : null}
                    <ul className="cal-month-list">
                      {list.slice(0, 3).map((a) => (
                        <li key={a.id}>
                          {formatInTimeZone(a.start, TZ, "HH:mm")} {a.client_name}
                        </li>
                      ))}
                    </ul>
                  </button>
                );
              });
            })()}
          </div>
        </div>
      ) : (
        <div className={`cal-sheet admin-card${view === "week" ? " week" : ""}`}>
          <div className="cal-sheet-head">
            <div className="cal-gutter" />
            {columns.map((ymd) => (
              <div key={ymd} className={`cal-col-head${ymd === today ? " today" : ""}`}>
                {labelDay(ymd)}
              </div>
            ))}
          </div>
          <div className="cal-sheet-body" style={{ height: gridHeight }}>
            <div className="cal-gutter hours">
              {hours.map((h) => (
                <div key={h} className="cal-hour-label" style={{ height: HOUR_PX }}>
                  <bdi>{pad2(h)}:00</bdi>
                </div>
              ))}
            </div>
            {columns.map((ymd) => {
              const dayAppts = apptsForDay(ymd);
              const layout = computeOverlapLayout(dayAppts);
              return (
                <div key={ymd} className="cal-day-col" style={{ height: gridHeight }}>
                  {hours.map((h) => (
                    <button
                      key={h}
                      type="button"
                      className="cal-slot"
                      style={{ height: HOUR_PX }}
                      aria-label={`הוסף תור ${ymd} ${pad2(h)}:00`}
                      onClick={() => openAdd(ymd, `${pad2(h)}:00`)}
                    />
                  ))}
                  {dayAppts.map((a) => {
                    const style = blockStyle(a, layout.get(a.id));
                    return (
                      <button
                        key={a.id}
                        type="button"
                        className={`cal-event status-${a.status}`}
                        style={style}
                        title={`${a.client_name} · ${a.service_name} · ${STATUS_LABEL[a.status] || a.status}`}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          openEdit(a);
                        }}
                      >
                        <strong>
                          <bdi>{formatInTimeZone(a.start, TZ, "HH:mm")}</bdi> {a.client_name}
                        </strong>
                        <span>{a.service_name}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {modal ? (
        <div
          className="cal-modal"
          role="dialog"
          aria-modal="true"
          aria-label={modal === "add" ? "תור חדש" : "עריכת תור"}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <form className="cal-modal-card" onSubmit={submitModal}>
            <div className="cal-modal-head">
              <h2>{modal === "add" ? "תור חדש" : "עריכת תור"}</h2>
              <button type="button" className="cal-icon-btn" onClick={() => setModal(null)} aria-label="סגור">
                ×
              </button>
            </div>
            <div className="cal-modal-body">
              <label>
                <span>תאריך</span>
                <input type="date" required value={addDate} onChange={(e) => setAddDate(e.target.value)} />
              </label>
              <label>
                <span>שעה</span>
                <input type="time" required value={addTime} onChange={(e) => setAddTime(e.target.value)} step={900} />
              </label>
              <label>
                <span>שירות</span>
                <select required value={addService} onChange={(e) => setAddService(e.target.value)}>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} · {s.duration_minutes} דק׳
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>שם</span>
                <input required value={addName} onChange={(e) => setAddName(e.target.value)} autoComplete="name" />
              </label>
              <label>
                <span>טלפון</span>
                <input
                  required
                  value={addPhone}
                  onChange={(e) => setAddPhone(e.target.value)}
                  inputMode="tel"
                  placeholder="05X-XXX-XXXX"
                />
              </label>
              <label>
                <span>הערות</span>
                <input value={addNotes} onChange={(e) => setAddNotes(e.target.value)} />
              </label>
              {modal === "edit" ? (
                <label>
                  <span>סטטוס</span>
                  <select value={addStatus} onChange={(e) => setAddStatus(e.target.value)}>
                    <option value="confirmed">מאושר</option>
                    <option value="done">בוצע</option>
                    <option value="no_show">לא הגיע</option>
                    <option value="cancelled">בוטל</option>
                  </select>
                </label>
              ) : null}
              {error ? <p className="cal-error">{error}</p> : null}
              {modal === "edit" ? (
                <div className="cal-status-row">
                  <button type="button" className="cal-chip" disabled={saving} onClick={() => void quickStatus("done")}>
                    בוצע
                  </button>
                  <button
                    type="button"
                    className="cal-chip"
                    disabled={saving}
                    onClick={() => void quickStatus("no_show")}
                  >
                    לא הגיע
                  </button>
                  <button
                    type="button"
                    className="cal-chip danger"
                    disabled={saving}
                    onClick={() => void quickStatus("cancelled")}
                  >
                    בטל תור
                  </button>
                  <button
                    type="button"
                    className="cal-chip danger"
                    disabled={saving}
                    onClick={() => void removeAppointment()}
                  >
                    מחק תור
                  </button>
                </div>
              ) : null}
            </div>
            <div className="cal-modal-actions">
              <button type="button" className="cal-chip" onClick={() => setModal(null)}>
                סגור
              </button>
              <button type="submit" className="admin-btn-primary" disabled={saving || !services.length}>
                {saving ? "שומר…" : modal === "add" ? "קבע תור" : "שמור שינויים"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
