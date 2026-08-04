"use client";

import { useCallback, useEffect, useState } from "react";

type Service = {
  id: string;
  name: string;
  duration_minutes: number;
  price_agorot: number;
  sort_order: number;
  active: boolean;
  image_path: string | null;
};

const emptyForm = {
  name: "",
  duration_minutes: 30,
  price_ils: 80,
  sort_order: 0,
  active: true,
  image_path: "",
};

const PLACEHOLDER =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400">
      <rect width="640" height="400" fill="#eef1f4"/>
      <text x="320" y="210" text-anchor="middle" fill="#94a3b8" font-family="sans-serif" font-size="28">אין תמונה</text>
    </svg>`,
  );

function priceILS(agorot: number) {
  return `₪${(agorot / 100).toFixed(agorot % 100 === 0 ? 0 : 2)}`;
}

export default function AdminServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/services");
    const data = await res.json();
    setServices(data.services || []);
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

  function openAdd() {
    setEditId(null);
    setForm(emptyForm);
    setError(null);
    setModal("add");
  }

  function openEdit(s: Service) {
    setEditId(s.id);
    setForm({
      name: s.name,
      duration_minutes: s.duration_minutes,
      price_ils: s.price_agorot / 100,
      sort_order: s.sort_order,
      active: s.active,
      image_path: s.image_path || "",
    });
    setError(null);
    setModal("edit");
  }

  async function submitModal(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("שם חובה");
      return;
    }
    setSaving(true);
    setError(null);
    setMsg(null);
    try {
      const payload = {
        name: form.name.trim(),
        duration_minutes: Number(form.duration_minutes) || 30,
        price_agorot: Math.round(Number(form.price_ils) * 100),
        sort_order: Number(form.sort_order) || 0,
        active: form.active,
        image_path: form.image_path.trim() || null,
      };
      if (modal === "add") {
        const res = await fetch("/api/admin/services", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "שגיאה");
          return;
        }
        setMsg("השירות נוסף — יופיע באתר אם הוא פעיל");
      } else if (editId) {
        const res = await fetch("/api/admin/services", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editId, ...payload }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || "שגיאה");
          return;
        }
        setMsg("נשמר — המחירון באתר ובקביעת תור מתעדכן מיד");
      }
      setModal(null);
      await load();
    } catch {
      setError("שגיאת רשת");
    } finally {
      setSaving(false);
    }
  }

  async function remove(s: Service) {
    if (!confirm(`למחוק את השירות "${s.name}"?`)) return;
    setMsg(null);
    const res = await fetch(`/api/admin/services?id=${s.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(data.error || "שגיאה במחיקה");
      return;
    }
    setMsg(data.soft ? data.message || "סומן כלא פעיל" : "נמחק מהאתר");
    if (editId === s.id) setModal(null);
    await load();
  }

  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h1>שירותים</h1>
          <p>כרטיסי שירות עם תמונה — שינויים מתעדכנים במחירון ובקביעת תור.</p>
        </div>
        <button type="button" className="admin-btn-primary" onClick={openAdd}>
          + שירות חדש
        </button>
      </div>
      {msg ? <p className="admin-ok">{msg}</p> : null}

      <div className="admin-entity-grid">
        {services.map((s) => (
          <article key={s.id} className={`admin-entity-card admin-svc-card${!s.active ? " inactive" : ""}`}>
            <button type="button" className="admin-svc-preview" onClick={() => openEdit(s)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.image_path || PLACEHOLDER} alt="" />
              <div className="admin-svc-preview-meta">
                <strong>{s.name}</strong>
                <span>
                  {s.duration_minutes} דק׳ · {priceILS(s.price_agorot)}
                  {!s.active ? " · לא פעיל" : ""}
                </span>
              </div>
            </button>
            <div className="admin-entity-actions">
              <button type="button" className="cal-chip" onClick={() => openEdit(s)}>
                עריכה
              </button>
              <button type="button" className="admin-danger-link" onClick={() => void remove(s)}>
                מחק
              </button>
            </div>
          </article>
        ))}
        {!services.length ? <p className="admin-muted">אין שירותים</p> : null}
      </div>

      {modal ? (
        <div
          className="cal-modal"
          role="dialog"
          aria-modal="true"
          aria-label={modal === "add" ? "שירות חדש" : "עריכת שירות"}
          onClick={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <form className="cal-modal-card" onSubmit={(e) => void submitModal(e)}>
            <div className="cal-modal-head">
              <h2>{modal === "add" ? "שירות חדש" : "עריכת שירות"}</h2>
              <button type="button" className="cal-chip" onClick={() => setModal(null)}>
                סגור
              </button>
            </div>
            <div className="cal-modal-body">
              <div className="admin-svc-modal-preview">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.image_path.trim() || PLACEHOLDER} alt="" />
              </div>
              <label>
                <span>שם</span>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
              <div className="admin-row">
                <label>
                  <span>דקות</span>
                  <input
                    type="number"
                    min={5}
                    required
                    value={form.duration_minutes}
                    onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })}
                  />
                </label>
                <label>
                  <span>מחיר ₪</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    required
                    value={form.price_ils}
                    onChange={(e) => setForm({ ...form, price_ils: Number(e.target.value) })}
                  />
                </label>
              </div>
              <label>
                <span>סדר תצוגה</span>
                <input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
                />
              </label>
              <label>
                <span>נתיב תמונה (למשל /media/gallery-01.jpg)</span>
                <input
                  dir="ltr"
                  placeholder="/media/gallery-01.jpg"
                  value={form.image_path}
                  onChange={(e) => setForm({ ...form, image_path: e.target.value })}
                />
              </label>
              <label className="admin-check">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                />
                <span>פעיל באתר ובקביעת תור</span>
              </label>
              {error ? <p className="cal-error">{error}</p> : null}
            </div>
            <div className="cal-modal-actions">
              {modal === "edit" && editId ? (
                <button
                  type="button"
                  className="admin-danger-link"
                  onClick={() => {
                    const s = services.find((x) => x.id === editId);
                    if (s) void remove(s);
                  }}
                >
                  מחק שירות
                </button>
              ) : (
                <span />
              )}
              <button type="submit" className="admin-btn-primary" disabled={saving}>
                {saving ? "שומר…" : modal === "add" ? "הוסף שירות" : "שמור שינויים"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
