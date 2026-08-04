"use client";

import { useCallback, useEffect, useState } from "react";

type Service = { id: string; name: string };

type Entry = {
  id: string;
  client_name: string;
  client_phone: string;
  service_id: string | null;
  service_name: string | null;
  preferred_date: string | null;
  notes: string | null;
  status: string;
  created_at: string;
};

function formatPreferredDate(value: string | null) {
  if (!value) return "";
  const raw = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const [y, m, d] = raw.split("-");
  return `${d}/${m}/${y}`;
}

const emptyForm = {
  name: "",
  phone: "",
  serviceId: "",
  preferredDate: "",
  notes: "",
};

export function WaitlistPanel({ services }: { services: Service[] }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [modal, setModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    const [w, s] = await Promise.all([fetch("/api/admin/waitlist"), fetch("/api/admin/settings")]);
    const wd = await w.json();
    const sd = await s.json();
    setEntries(wd.entries || []);
    if (sd.settings) setEnabled(!!sd.settings.waitlist_enabled);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!modal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModal(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal]);

  function openAdd() {
    setForm(emptyForm);
    setError(null);
    setModal(true);
  }

  async function toggleEnabled() {
    setMsg(null);
    const next = !enabled;
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ waitlist_enabled: next }),
    });
    if (!res.ok) {
      setError("לא ניתן לעדכן את ההגדרה");
      return;
    }
    setEnabled(next);
    setMsg(next ? "רשימת ההמתנה הופעלה" : "רשימת ההמתנה כובתה");
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: form.name,
          client_phone: form.phone,
          service_id: form.serviceId || undefined,
          preferred_date: form.preferredDate || undefined,
          notes: form.notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "שגיאה בהוספה");
        return;
      }
      setModal(false);
      setMsg("נוסף לרשימת ההמתנה");
      await load();
    } catch {
      setError("שגיאת רשת");
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(id: string, status: string) {
    setError(null);
    await fetch("/api/admin/waitlist", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    await load();
  }

  async function remove(entry: Entry) {
    if (!confirm(`להסיר את ${entry.client_name} מרשימת ההמתנה?`)) return;
    setError(null);
    setMsg(null);
    const res = await fetch(`/api/admin/waitlist?id=${entry.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "שגיאה בהסרה");
      return;
    }
    setMsg("הוסר מרשימת ההמתנה");
    await load();
  }

  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h1>רשימת המתנה</h1>
          <p>כרטיסי ממתינים — הוספה והסרה של לקוחות שמחכים לתור פנוי.</p>
        </div>
        <div className="admin-page-head-actions">
          <button type="button" className="cal-chip" onClick={() => void toggleEnabled()}>
            {enabled ? "כבה רשימה" : "הפעל רשימה"}
          </button>
          <button type="button" className="admin-btn-primary" onClick={openAdd}>
            + הוסף לרשימה
          </button>
        </div>
      </div>

      {!enabled ? (
        <p className="cal-error" style={{ color: "var(--admin-muted)" }}>
          הרשימה כבויה להצגה ציבורית — עדיין אפשר להוסיף ולהסיר ממנה כאן.
        </p>
      ) : null}
      {msg ? <p className="admin-ok">{msg}</p> : null}
      {error && !modal ? <p className="cal-error">{error}</p> : null}

      <div className="admin-entity-grid">
        {entries.map((e) => (
          <article key={e.id} className="admin-entity-card">
            <div className="admin-entity-main" style={{ cursor: "default" }}>
              <strong>{e.client_name}</strong>
              <span className="admin-entity-meta" dir="ltr">
                {e.client_phone}
              </span>
              {e.service_name ? <span className="admin-entity-meta">{e.service_name}</span> : null}
              {e.preferred_date ? (
                <span className="admin-entity-meta">מועדף: {formatPreferredDate(e.preferred_date)}</span>
              ) : null}
              {e.notes ? <span className="admin-entity-notes">{e.notes}</span> : null}
              <span className="admin-badge">{e.status === "waiting" ? "ממתין" : "הוצע תור"}</span>
            </div>
            <div className="admin-entity-actions admin-entity-actions-wrap">
              {e.status === "waiting" ? (
                <button type="button" className="cal-chip" onClick={() => void setStatus(e.id, "offered")}>
                  סומן כהוצע
                </button>
              ) : null}
              <button type="button" className="cal-chip" onClick={() => void setStatus(e.id, "booked")}>
                נקבע תור
              </button>
              <button type="button" className="admin-danger-link" onClick={() => void remove(e)}>
                הסר
              </button>
            </div>
          </article>
        ))}
        {!entries.length ? <p className="admin-muted">אין אנשים ברשימת ההמתנה</p> : null}
      </div>

      {modal ? (
        <div
          className="cal-modal"
          role="dialog"
          aria-modal="true"
          aria-label="הוספה לרשימת המתנה"
          onClick={(ev) => {
            if (ev.target === ev.currentTarget) setModal(false);
          }}
        >
          <form className="cal-modal-card" onSubmit={(ev) => void add(ev)}>
            <div className="cal-modal-head">
              <h2>הוספה לרשימת המתנה</h2>
              <button type="button" className="cal-chip" onClick={() => setModal(false)}>
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
                  placeholder="05X-XXX-XXXX"
                />
              </label>
              <label>
                <span>שירות (אופציונלי)</span>
                <select
                  value={form.serviceId}
                  onChange={(e) => setForm({ ...form, serviceId: e.target.value })}
                >
                  <option value="">— ללא —</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>תאריך מועדף (אופציונלי)</span>
                <input
                  type="date"
                  value={form.preferredDate}
                  onChange={(e) => setForm({ ...form, preferredDate: e.target.value })}
                />
              </label>
              <label>
                <span>הערות</span>
                <input
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </label>
              {error ? <p className="cal-error">{error}</p> : null}
            </div>
            <div className="cal-modal-actions">
              <span />
              <button type="submit" className="admin-btn-primary" disabled={saving}>
                {saving ? "מוסיף…" : "הוסף לרשימה"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
