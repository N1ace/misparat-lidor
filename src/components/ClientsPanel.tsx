"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import {
  APPT_STATUS_OPTIONS,
  statusLabel,
  type ApptStatus,
} from "@/lib/appointment-status";
import type { ReliabilityColor, ReliabilityStat } from "@/lib/client-reliability";
import { NAME_LIMITS, truncateLabel } from "@/lib/name-limits";
import { formatIsraeliPhone } from "@/lib/phone";
import { TZ } from "@/lib/shop";

type Client = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  notify_channel?: string;
  created_at: string;
  updated_at: string;
  reliability?: ReliabilityStat;
};

type Appt = {
  id: string;
  service_name: string;
  status: string;
  notes: string | null;
  start: string;
  end: string;
};

type Counts = {
  total: number;
  completed: number;
  cancelled: number;
  no_show: number;
  confirmed: number;
};

type ReliabilityFilter = "all" | ReliabilityColor | "repeat_no_show";
type SortColumn = "name" | "score" | "total_bookings" | "last_booking";
type SortDirection = "asc" | "desc";

const emptyForm = { name: "", phone: "", email: "", notes: "" };

function ReliabilityDot({
  color,
  tooltip,
  size = "md",
}: {
  color: ReliabilityColor;
  tooltip: string;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={`rel-dot rel-dot--${color} rel-dot--${size}`}
      title={tooltip}
      aria-label={tooltip}
    />
  );
}

function IconPencil() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 6h18M8 6V4h8v2m-1 0v14a2 2 0 01-2 2H9a2 2 0 01-2-2V6h10z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function hebrewLastBooking(iso: string | null | undefined) {
  if (!iso) return null;
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

export function ClientsPanel() {
  const [q, setQ] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [relFilter, setRelFilter] = useState<ReliabilityFilter>("all");
  const [sortColumn, setSortColumn] = useState<SortColumn>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [selected, setSelected] = useState<Client | null>(null);
  const [history, setHistory] = useState<Appt[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [reliability, setReliability] = useState<ReliabilityStat | null>(null);
  const [statusBusy, setStatusBusy] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/clients");
    const data = await res.json();
    setClients(data.clients || []);
  }, []);

  const loadHistory = useCallback(async (phone: string) => {
    const res = await fetch(`/api/admin/clients/history?phone=${encodeURIComponent(phone)}`);
    if (!res.ok) return;
    const data = await res.json();
    setHistory(data.appointments || []);
    setCounts(data.counts || null);
    setReliability(data.reliability || null);
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

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    let list = clients.filter((c) => {
      if (!needle && !digits) return true;
      if (c.name.toLowerCase().includes(needle)) return true;
      if (c.email?.toLowerCase().includes(needle)) return true;
      if (digits && c.phone.replace(/\D/g, "").includes(digits)) return true;
      return false;
    });

    if (relFilter === "repeat_no_show") {
      list = list.filter((c) => c.reliability?.is_repeat_no_show);
    } else if (relFilter !== "all") {
      list = list.filter((c) => (c.reliability?.color || "grey") === relFilter);
    }

    const dir = sortDirection === "asc" ? 1 : -1;
    list = [...list].sort((a, b) => {
      const ra = a.reliability;
      const rb = b.reliability;
      if (sortColumn === "name") {
        return a.name.localeCompare(b.name, "he") * dir;
      }
      if (sortColumn === "score") {
        const sa = ra?.score ?? -1;
        const sb = rb?.score ?? -1;
        return (sa - sb) * dir;
      }
      if (sortColumn === "total_bookings") {
        return ((ra?.total_bookings ?? 0) - (rb?.total_bookings ?? 0)) * dir;
      }
      const la = ra?.last_booking_at ? new Date(ra.last_booking_at).getTime() : 0;
      const lb = rb?.last_booking_at ? new Date(rb.last_booking_at).getTime() : 0;
      return (la - lb) * dir;
    });

    return list;
  }, [clients, q, relFilter, sortColumn, sortDirection]);

  function toggleSort(col: SortColumn) {
    if (sortColumn === col) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(col);
      setSortDirection(col === "name" ? "asc" : "desc");
    }
  }

  function openAdd() {
    setSelected(null);
    setForm(emptyForm);
    setHistory([]);
    setCounts(null);
    setReliability(null);
    setError(null);
    setModal("add");
  }

  async function openEdit(c: Client) {
    setSelected(c);
    setForm({
      name: c.name,
      phone: c.phone,
      email: c.email || "",
      notes: c.notes || "",
    });
    setError(null);
    setHistory([]);
    setCounts(null);
    setReliability(c.reliability || null);
    setModal("edit");
    await loadHistory(c.phone);
  }

  async function updateApptStatus(apptId: string, status: ApptStatus) {
    setStatusBusy(apptId);
    setError(null);
    try {
      const res = await fetch("/api/admin/appointments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: apptId, status }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "שגיאה בעדכון סטטוס");
        return;
      }
      if (selected) {
        await loadHistory(selected.phone);
        await load();
      }
    } catch {
      setError("שגיאת רשת");
    } finally {
      setStatusBusy(null);
    }
  }

  async function submitModal(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (modal === "add") {
        const res = await fetch("/api/admin/clients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "שגיאה");
          return;
        }
        setModal(null);
        await load();
        if (data.client) void openEdit(data.client);
      } else if (modal === "edit" && selected) {
        const res = await fetch("/api/admin/clients", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: selected.id,
            name: form.name,
            phone: form.phone,
            email: form.email || null,
            notes: form.notes || null,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "שגיאה");
          return;
        }
        setSelected(data.client);
        setModal(null);
        await load();
      }
    } catch {
      setError("שגיאת רשת");
    } finally {
      setSaving(false);
    }
  }

  async function removeClient(c: Client) {
    if (!confirm(`למחוק את הלקוח "${c.name}"?`)) return;
    await fetch(`/api/admin/clients?id=${c.id}`, { method: "DELETE" });
    if (selected?.id === c.id) {
      setSelected(null);
      setModal(null);
    }
    await load();
  }

  function sortMark(col: SortColumn) {
    if (sortColumn !== col) return "↕";
    return sortDirection === "asc" ? "↑" : "↓";
  }

  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h1>לקוחות</h1>
          <p>
            לקוחות העסק
            {filtered.length !== clients.length
              ? ` · ${filtered.length} מתוך ${clients.length}`
              : ` · ${clients.length}`}
          </p>
        </div>
        <button type="button" className="admin-btn-primary" onClick={openAdd}>
          + הוסף לקוח
        </button>
      </div>

      <div className="clients-toolbar">
        <div className="admin-search clients-search">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="חיפוש לפי שם או טלפון"
            aria-label="חיפוש לפי שם או טלפון"
          />
        </div>
        <label className="clients-filter">
          <span className="sr-only">סינון רמזור</span>
          <select
            value={relFilter}
            onChange={(e) => setRelFilter(e.target.value as ReliabilityFilter)}
          >
            <option value="all">כל הרמזורים</option>
            <option value="green">ירוק</option>
            <option value="orange">כתום</option>
            <option value="red">אדום</option>
            <option value="grey">חדש</option>
            <option value="repeat_no_show">אי-הגעות חוזרות</option>
          </select>
        </label>
      </div>

      <div className="clients-table-wrap admin-card">
        <table className="clients-table">
          <thead>
            <tr>
              <th>
                <button type="button" className="clients-sort" onClick={() => toggleSort("name")}>
                  שם <span aria-hidden>{sortMark("name")}</span>
                </button>
              </th>
              <th>טלפון</th>
              <th className="center">רמזור</th>
              <th className="center">
                <button type="button" className="clients-sort" onClick={() => toggleSort("score")}>
                  ציון <span aria-hidden>{sortMark("score")}</span>
                </button>
              </th>
              <th className="center">
                <button
                  type="button"
                  className="clients-sort"
                  onClick={() => toggleSort("total_bookings")}
                >
                  תורים <span aria-hidden>{sortMark("total_bookings")}</span>
                </button>
              </th>
              <th className="center">
                <button
                  type="button"
                  className="clients-sort"
                  onClick={() => toggleSort("last_booking")}
                >
                  תור אחרון <span aria-hidden>{sortMark("last_booking")}</span>
                </button>
              </th>
              <th className="center">לא הגיע</th>
              <th className="center">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const rel = c.reliability;
              const last = hebrewLastBooking(rel?.last_booking_at);
              return (
                <tr key={c.id} onClick={() => void openEdit(c)}>
                  <td>
                    <div className="clients-name-cell">
                      <span className="clients-name" title={c.name}>
                        {truncateLabel(c.name, NAME_LIMITS.person)}
                      </span>
                      {rel?.label_he === "חדש" ? (
                        <span className="clients-pill">חדש</span>
                      ) : null}
                      {rel?.is_repeat_no_show ? (
                        <span className="clients-pill danger">חוזר</span>
                      ) : null}
                    </div>
                  </td>
                  <td>
                    <bdi className="clients-phone">{formatIsraeliPhone(c.phone)}</bdi>
                  </td>
                  <td className="center">
                    {rel ? (
                      <ReliabilityDot color={rel.color} tooltip={rel.tooltip} />
                    ) : (
                      <ReliabilityDot color="grey" tooltip="אין נתונים" />
                    )}
                  </td>
                  <td className="center clients-num">
                    {rel?.score != null && rel.color !== "grey" ? `${rel.score}%` : "—"}
                  </td>
                  <td className="center clients-num">{rel?.total_bookings ?? 0}</td>
                  <td className="center clients-last">
                    {last || <span className="admin-muted">—</span>}
                  </td>
                  <td
                    className={`center clients-num${(rel?.no_show ?? 0) >= 2 ? " danger" : ""}`}
                  >
                    {rel?.no_show ?? 0}
                  </td>
                  <td className="center" onClick={(e) => e.stopPropagation()}>
                    <div className="clients-row-actions">
                      <button
                        type="button"
                        className="admin-icon-btn"
                        title="עריכה"
                        aria-label="עריכה"
                        onClick={() => void openEdit(c)}
                      >
                        <IconPencil />
                      </button>
                      <button
                        type="button"
                        className="admin-icon-btn danger"
                        title="מחיקה"
                        aria-label="מחיקה"
                        onClick={() => void removeClient(c)}
                      >
                        <IconTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!filtered.length ? <p className="admin-muted clients-empty">אין לקוחות</p> : null}
      </div>

      <div className="clients-mobile-list">
        {filtered.map((c) => {
          const rel = c.reliability;
          const last = hebrewLastBooking(rel?.last_booking_at);
          return (
            <article
              key={c.id}
              className="clients-mobile-card"
              role="button"
              tabIndex={0}
              onClick={() => void openEdit(c)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  void openEdit(c);
                }
              }}
            >
              <div className="clients-mobile-top">
                <div>
                  <div className="clients-name-cell">
                    <strong title={c.name}>{truncateLabel(c.name, NAME_LIMITS.person)}</strong>
                    {rel?.label_he === "חדש" ? <span className="clients-pill">חדש</span> : null}
                    {rel?.is_repeat_no_show ? (
                      <span className="clients-pill danger">חוזר</span>
                    ) : null}
                  </div>
                  <bdi className="clients-phone">{formatIsraeliPhone(c.phone)}</bdi>
                </div>
                {rel ? <ReliabilityDot color={rel.color} tooltip={rel.tooltip} /> : null}
              </div>
              <div className="clients-mobile-meta">
                <span>תורים: {rel?.total_bookings ?? 0}</span>
                <span>
                  ציון:{" "}
                  {rel?.score != null && rel.color !== "grey" ? `${rel.score}%` : "—"}
                </span>
                <span>לא הגיע: {rel?.no_show ?? 0}</span>
                <span>תור אחרון: {last || "—"}</span>
              </div>
            </article>
          );
        })}
      </div>

      {modal ? (
        <div
          className="cal-modal"
          role="dialog"
          aria-modal="true"
          aria-label={modal === "add" ? "לקוח חדש" : "פרטי לקוח"}
          onClick={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <form
            className={`cal-modal-card${modal === "edit" ? " cal-modal-card--wide" : ""}`}
            onSubmit={submitModal}
          >
            <div className="cal-modal-head">
              <h2 className="admin-entity-title-row">
                {modal === "edit" && reliability ? (
                  <ReliabilityDot color={reliability.color} tooltip={reliability.tooltip} />
                ) : null}
                {modal === "add" ? "לקוח חדש" : selected?.name || "עריכת לקוח"}
              </h2>
              <button type="button" className="cal-chip" onClick={() => setModal(null)}>
                סגור
              </button>
            </div>
            <div className="cal-modal-body">
              <label>
                <span>שם</span>
                <input
                  required
                  value={form.name}
                  maxLength={NAME_LIMITS.person}
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value.slice(0, NAME_LIMITS.person) })
                  }
                  autoComplete="name"
                />
              </label>
              <label>
                <span>טלפון</span>
                <input
                  required
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="05X-XXX-XXXX"
                />
              </label>
              <label>
                <span>אימייל</span>
                <input
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  type="email"
                  dir="ltr"
                />
              </label>
              <label>
                <span>הערות</span>
                <textarea
                  value={form.notes}
                  maxLength={NAME_LIMITS.notes}
                  onChange={(e) =>
                    setForm({ ...form, notes: e.target.value.slice(0, NAME_LIMITS.notes) })
                  }
                  rows={3}
                />
              </label>
              {error ? <p className="cal-error">{error}</p> : null}

              {modal === "edit" ? (
                <div className="admin-history">
                  <div className="admin-history-head">
                    <h3>היסטוריית תורים</h3>
                    {reliability ? (
                      <span className="rel-badge" title={reliability.tooltip}>
                        <ReliabilityDot
                          color={reliability.color}
                          tooltip={reliability.tooltip}
                          size="sm"
                        />
                        {reliability.score != null
                          ? `${reliability.score}% · ${reliability.label_he}`
                          : reliability.label_he}
                      </span>
                    ) : null}
                  </div>
                  {counts ? (
                    <div className="admin-history-counts">
                      <span>סה״כ {counts.total}</span>
                      <span>בוצעו {counts.completed}</span>
                      <span>בוטלו {counts.cancelled}</span>
                      <span>לא הגיע {counts.no_show}</span>
                      <span>מאושרים {counts.confirmed}</span>
                    </div>
                  ) : null}
                  {history.length ? (
                    <div className="admin-history-sheet-wrap">
                      <table className="admin-history-sheet">
                        <thead>
                          <tr>
                            <th>תאריך</th>
                            <th>שירות</th>
                            <th>שעה</th>
                            <th>סטטוס</th>
                          </tr>
                        </thead>
                        <tbody>
                          {history.map((a) => (
                            <tr key={a.id} className={`status-${a.status}`}>
                              <td>
                                {formatInTimeZone(a.start, TZ, "dd/MM/yyyy")}
                              </td>
                              <td title={a.service_name}>
                                {truncateLabel(a.service_name, NAME_LIMITS.service)}
                              </td>
                              <td dir="ltr">
                                {formatInTimeZone(a.start, TZ, "HH:mm")}–
                                {formatInTimeZone(a.end, TZ, "HH:mm")}
                              </td>
                              <td>
                                <select
                                  className="admin-history-select"
                                  value={a.status}
                                  disabled={statusBusy === a.id}
                                  onChange={(e) =>
                                    void updateApptStatus(a.id, e.target.value as ApptStatus)
                                  }
                                  aria-label={`סטטוס תור ${statusLabel(a.status)}`}
                                >
                                  {APPT_STATUS_OPTIONS.map((o) => (
                                    <option key={o.value} value={o.value}>
                                      {o.label}
                                    </option>
                                  ))}
                                </select>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="admin-muted">אין תורים בהיסטוריה</p>
                  )}
                </div>
              ) : null}
            </div>
            <div className="cal-modal-actions">
              {modal === "edit" && selected ? (
                <button
                  type="button"
                  className="admin-danger-link"
                  onClick={() => void removeClient(selected)}
                >
                  מחק לקוח
                </button>
              ) : (
                <span />
              )}
              <button type="submit" className="admin-btn-primary" disabled={saving}>
                {saving ? "שומר…" : modal === "add" ? "הוסף לקוח" : "שמור שינויים"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
