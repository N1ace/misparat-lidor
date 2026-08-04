"use client";

import { useCallback, useEffect, useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import {
  APPT_STATUS_OPTIONS,
  statusLabel,
  type ApptStatus,
} from "@/lib/appointment-status";
import type { ReliabilityColor, ReliabilityStat } from "@/lib/client-reliability";

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

export function ClientsPanel() {
  const [q, setQ] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [selected, setSelected] = useState<Client | null>(null);
  const [history, setHistory] = useState<Appt[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [reliability, setReliability] = useState<ReliabilityStat | null>(null);
  const [statusBusy, setStatusBusy] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (query = q) => {
    const res = await fetch(`/api/admin/clients${query ? `?q=${encodeURIComponent(query)}` : ""}`);
    const data = await res.json();
    setClients(data.clients || []);
  }, [q]);

  const loadHistory = useCallback(async (phone: string) => {
    const res = await fetch(`/api/admin/clients/history?phone=${encodeURIComponent(phone)}`);
    if (!res.ok) return;
    const data = await res.json();
    setHistory(data.appointments || []);
    setCounts(data.counts || null);
    setReliability(data.reliability || null);
  }, []);

  useEffect(() => {
    void load("");
    // initial list only — search submits explicitly
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!modal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModal(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal]);

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

  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h1>לקוחות</h1>
          <p>כרטיסי לקוח, רמזור אמינות והיסטוריית תורים מלאה.</p>
        </div>
        <button type="button" className="admin-btn-primary" onClick={openAdd}>
          + לקוח חדש
        </button>
      </div>

      <form
        className="admin-search admin-card"
        style={{ marginBottom: "1rem" }}
        onSubmit={(e) => {
          e.preventDefault();
          void load(q);
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="חיפוש לפי שם / טלפון / אימייל"
        />
        <button type="submit" className="cal-chip">
          חפש
        </button>
      </form>

      <div className="admin-entity-grid">
        {clients.map((c) => {
          const rel = c.reliability;
          return (
            <article key={c.id} className="admin-entity-card">
              <button type="button" className="admin-entity-main" onClick={() => void openEdit(c)}>
                <span className="admin-entity-title-row">
                  {rel ? <ReliabilityDot color={rel.color} tooltip={rel.tooltip} /> : null}
                  <strong>{c.name}</strong>
                </span>
                <span className="admin-entity-meta" dir="ltr">
                  {c.phone}
                </span>
                {c.email ? (
                  <span className="admin-entity-meta" dir="ltr">
                    {c.email}
                  </span>
                ) : null}
                {rel ? (
                  <span className="admin-entity-meta rel-summary">
                    {rel.score != null ? `ציון ${rel.score}% · ${rel.label_he}` : rel.label_he}
                    {rel.total_bookings > 0
                      ? ` · ${rel.total_bookings} תורים`
                      : " · אין היסטוריה"}
                  </span>
                ) : null}
                {c.notes ? <span className="admin-entity-notes">{c.notes}</span> : null}
              </button>
              <div className="admin-entity-actions">
                <button type="button" className="cal-chip" onClick={() => void openEdit(c)}>
                  פרטים
                </button>
                <button
                  type="button"
                  className="admin-danger-link"
                  onClick={() => void removeClient(c)}
                >
                  מחק
                </button>
              </div>
            </article>
          );
        })}
        {!clients.length ? <p className="admin-muted">אין לקוחות</p> : null}
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
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
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
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
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
                        <ReliabilityDot color={reliability.color} tooltip={reliability.tooltip} size="sm" />
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
                    <ul className="admin-history-list">
                      {history.map((a) => (
                        <li key={a.id} className={`admin-history-row status-${a.status}`}>
                          <div className="admin-history-main">
                            <strong>
                              {formatInTimeZone(a.start, "Asia/Jerusalem", "dd/MM/yyyy HH:mm")}
                            </strong>
                            <span>
                              {a.service_name}
                              {" · "}
                              {formatInTimeZone(a.start, "Asia/Jerusalem", "HH:mm")}–
                              {formatInTimeZone(a.end, "Asia/Jerusalem", "HH:mm")}
                            </span>
                            {a.notes ? <em>{a.notes}</em> : null}
                          </div>
                          <label className="admin-history-status">
                            <span className="sr-only">סטטוס</span>
                            <select
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
                          </label>
                        </li>
                      ))}
                    </ul>
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
