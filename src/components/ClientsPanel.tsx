"use client";

import { useCallback, useEffect, useState } from "react";

type Client = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type Appt = {
  id: string;
  service_name: string;
  status: string;
  start: string;
  end: string;
};

const emptyForm = { name: "", phone: "", email: "", notes: "" };

export function ClientsPanel() {
  const [q, setQ] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [selected, setSelected] = useState<Client | null>(null);
  const [history, setHistory] = useState<Appt[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [createForm, setCreateForm] = useState(emptyForm);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (query = q) => {
    const res = await fetch(`/api/admin/clients${query ? `?q=${encodeURIComponent(query)}` : ""}`);
    const data = await res.json();
    setClients(data.clients || []);
  }, [q]);

  useEffect(() => {
    void load("");
  }, []);

  async function openClient(c: Client) {
    setSelected(c);
    setForm({
      name: c.name,
      phone: c.phone,
      email: c.email || "",
      notes: c.notes || "",
    });
    setEditing(false);
    setError(null);
    setHistory([]);
    try {
      const res = await fetch(`/api/admin/clients/history?phone=${encodeURIComponent(c.phone)}`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data.appointments || []);
      }
    } catch {
      /* ignore */
    }
  }

  async function createClient(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/admin/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || "שגיאה");
        return;
      }
      setCreateForm(emptyForm);
      await load();
      if (data.client) void openClient(data.client);
    } catch {
      setCreateError("שגיאת רשת");
    } finally {
      setSaving(false);
    }
  }

  async function saveClient(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
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
      setEditing(false);
      await load();
    } catch {
      setError("שגיאת רשת");
    } finally {
      setSaving(false);
    }
  }

  async function removeClient() {
    if (!selected || !confirm("למחוק לקוח?")) return;
    await fetch(`/api/admin/clients?id=${selected.id}`, { method: "DELETE" });
    setSelected(null);
    await load();
  }

  async function removeClientById(c: Client) {
    if (!confirm(`למחוק את הלקוח \"${c.name}\"?`)) return;
    await fetch(`/api/admin/clients?id=${c.id}`, { method: "DELETE" });
    if (selected?.id === c.id) setSelected(null);
    await load();
  }

  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h1>לקוחות</h1>
          <p>רשימה, חיפוש ופרטי לקוח. ייבוא יידון בהמשך.</p>
        </div>
      </div>

      <div className="admin-split">
        <div className="admin-card">
          <form
            className="admin-search"
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
          <ul className="admin-list">
            {clients.map((c) => (
              <li key={c.id} className="admin-list-row">
                <button
                  type="button"
                  className={selected?.id === c.id ? "on" : undefined}
                  onClick={() => void openClient(c)}
                >
                  <strong>{c.name}</strong>
                  <span>
                    <bdi>{c.phone}</bdi>
                  </span>
                </button>
                <button
                  type="button"
                  className="admin-list-del"
                  title="מחק לקוח"
                  aria-label={`מחק ${c.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    void removeClientById(c);
                  }}
                >
                  מחק
                </button>
              </li>
            ))}
            {!clients.length ? <li className="admin-muted">אין לקוחות</li> : null}
          </ul>
        </div>

        <div className="admin-stack">
          {selected ? (
            <div className="admin-card admin-form">
              <div className="cal-modal-head">
                <h2>{selected.name}</h2>
                {!editing ? (
                  <button type="button" className="cal-chip" onClick={() => setEditing(true)}>
                    עריכה
                  </button>
                ) : null}
              </div>
              {editing ? (
                <form onSubmit={saveClient} className="admin-form">
                  <label>
                    <span>שם</span>
                    <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </label>
                  <label>
                    <span>טלפון</span>
                    <input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </label>
                  <label>
                    <span>אימייל</span>
                    <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </label>
                  <label>
                    <span>הערות</span>
                    <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
                  </label>
                  {error ? <p className="cal-error">{error}</p> : null}
                  <div className="cal-modal-actions">
                    <button type="button" className="cal-chip" onClick={() => setEditing(false)}>
                      ביטול
                    </button>
                    <button type="submit" className="admin-btn-primary" disabled={saving}>
                      שמור
                    </button>
                  </div>
                </form>
              ) : (
                <dl className="admin-dl">
                  <div>
                    <dt>טלפון</dt>
                    <dd>
                      <bdi>{selected.phone}</bdi>
                    </dd>
                  </div>
                  <div>
                    <dt>אימייל</dt>
                    <dd>{selected.email || "—"}</dd>
                  </div>
                  <div>
                    <dt>הערות</dt>
                    <dd>{selected.notes || "—"}</dd>
                  </div>
                </dl>
              )}
              <button type="button" className="admin-danger-link" onClick={() => void removeClient()}>
                מחק לקוח
              </button>
              {history.length > 0 ? (
                <div className="admin-history">
                  <h3>היסטוריית תורים</h3>
                  <ul>
                    {history.map((a) => (
                      <li key={a.id}>
                        {new Date(a.start).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })} ·{" "}
                        {a.service_name} · {a.status}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="admin-card admin-muted">בחרו לקוח מהרשימה או הוסיפו חדש.</div>
          )}

          <form className="admin-card admin-form" onSubmit={createClient}>
            <h2>לקוח חדש</h2>
            <label>
              <span>שם</span>
              <input
                required
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              />
            </label>
            <label>
              <span>טלפון</span>
              <input
                required
                value={createForm.phone}
                onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
              />
            </label>
            <label>
              <span>אימייל</span>
              <input
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
              />
            </label>
            <label>
              <span>הערות</span>
              <input
                value={createForm.notes}
                onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
              />
            </label>
            {createError ? <p className="cal-error">{createError}</p> : null}
            <button type="submit" className="admin-btn-primary" disabled={saving}>
              הוסף
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
