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

export function WaitlistPanel({ services }: { services: Service[] }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [notes, setNotes] = useState("");

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
          client_name: name,
          client_phone: phone,
          service_id: serviceId || undefined,
          preferred_date: preferredDate || undefined,
          notes: notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "שגיאה בהוספה");
        return;
      }
      setName("");
      setPhone("");
      setServiceId("");
      setNotes("");
      setPreferredDate("");
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
          <p>הוספה והסרה של לקוחות שמחכים לתור פנוי.</p>
        </div>
        <button type="button" className="cal-chip" onClick={() => void toggleEnabled()}>
          {enabled ? "כבה רשימה" : "הפעל רשימה"}
        </button>
      </div>

      {!enabled ? (
        <p className="cal-error" style={{ color: "var(--admin-muted)" }}>
          הרשימה כבויה להצגה ציבורית — עדיין אפשר להוסיף ולהסיר ממנה כאן.
        </p>
      ) : null}
      {msg ? <p className="admin-ok">{msg}</p> : null}
      {error ? <p className="cal-error">{error}</p> : null}

      <form className="admin-card admin-form" onSubmit={add}>
        <h2>הוספת אדם לרשימה</h2>
        <label>
          <span>שם</span>
          <input required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </label>
        <label>
          <span>טלפון</span>
          <input
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            placeholder="05X-XXX-XXXX"
          />
        </label>
        <label>
          <span>שירות (אופציונלי)</span>
          <select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
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
          <input type="date" value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} />
        </label>
        <label>
          <span>הערות</span>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <button type="submit" className="admin-btn-primary" disabled={saving}>
          {saving ? "מוסיף…" : "+ הוסף לרשימה"}
        </button>
      </form>

      <div className="admin-card" style={{ marginTop: "1rem" }}>
        <h2 style={{ marginBottom: "0.85rem" }}>ברשימה עכשיו ({entries.length})</h2>
        <ul className="admin-list-plain" style={{ marginTop: 0 }}>
          {entries.map((e) => (
            <li key={e.id}>
              <div>
                <strong>{e.client_name}</strong>
                <span>
                  <bdi>{e.client_phone}</bdi>
                  {e.service_name ? ` · ${e.service_name}` : ""}
                  {e.preferred_date ? ` · ${formatPreferredDate(e.preferred_date)}` : ""}
                  {e.notes ? ` · ${e.notes}` : ""}
                </span>
                <span className="admin-badge">{e.status === "waiting" ? "ממתין" : "הוצע תור"}</span>
              </div>
              <div className="admin-row-actions">
                {e.status === "waiting" ? (
                  <button type="button" className="cal-chip" onClick={() => void setStatus(e.id, "offered")}>
                    סומן כהוצע
                  </button>
                ) : null}
                <button type="button" className="cal-chip" onClick={() => void setStatus(e.id, "booked")}>
                  נקבע תור
                </button>
                <button
                  type="button"
                  className="cal-chip danger"
                  onClick={() => void remove(e)}
                >
                  הסר מהרשימה
                </button>
              </div>
            </li>
          ))}
          {!entries.length ? <li className="admin-muted">אין אנשים ברשימת ההמתנה</li> : null}
        </ul>
      </div>
    </div>
  );
}
