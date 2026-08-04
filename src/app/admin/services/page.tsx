"use client";

import { useEffect, useState } from "react";

type Service = {
  id: string;
  name: string;
  duration_minutes: number;
  price_agorot: number;
  sort_order: number;
  active: boolean;
  image_path: string | null;
};

export default function AdminServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [name, setName] = useState("");
  const [duration, setDuration] = useState(30);
  const [price, setPrice] = useState(80);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/admin/services");
    const data = await res.json();
    setServices(data.services || []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(s: Service) {
    setMsg(null);
    await fetch("/api/admin/services", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(s),
    });
    setMsg("נשמר");
    await load();
  }

  async function create() {
    if (!name.trim()) return;
    await fetch("/api/admin/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        duration_minutes: duration,
        price_agorot: Math.round(price * 100),
      }),
    });
    setName("");
    await load();
  }

  async function remove(s: Service) {
    if (!confirm(`למחוק את השירות \"${s.name}\"?`)) return;
    setMsg(null);
    const res = await fetch(`/api/admin/services?id=${s.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(data.error || "שגיאה במחיקה");
      return;
    }
    setMsg(data.soft ? data.message || "סומן כלא פעיל" : "נמחק");
    await load();
  }

  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h1>שירותים</h1>
          <p>מחירון, משכי זמן ופעיל/לא פעיל.</p>
        </div>
      </div>
      {msg ? <p className="admin-ok">{msg}</p> : null}

      <ul className="admin-stack">
        {services.map((s) => (
          <li key={s.id} className="admin-card admin-form">
            <label>
              <span>שם</span>
              <input
                value={s.name}
                onChange={(e) =>
                  setServices((prev) => prev.map((x) => (x.id === s.id ? { ...x, name: e.target.value } : x)))
                }
              />
            </label>
            <div className="admin-row">
              <label>
                <span>דקות</span>
                <input
                  type="number"
                  value={s.duration_minutes}
                  onChange={(e) =>
                    setServices((prev) =>
                      prev.map((x) => (x.id === s.id ? { ...x, duration_minutes: Number(e.target.value) } : x)),
                    )
                  }
                />
              </label>
              <label>
                <span>מחיר ₪</span>
                <input
                  type="number"
                  value={s.price_agorot / 100}
                  onChange={(e) =>
                    setServices((prev) =>
                      prev.map((x) =>
                        x.id === s.id ? { ...x, price_agorot: Math.round(Number(e.target.value) * 100) } : x,
                      ),
                    )
                  }
                />
              </label>
              <label className="admin-check" style={{ alignSelf: "end", paddingBottom: "0.7rem" }}>
                <input
                  type="checkbox"
                  checked={s.active}
                  onChange={(e) =>
                    setServices((prev) => prev.map((x) => (x.id === s.id ? { ...x, active: e.target.checked } : x)))
                  }
                />
                <span>פעיל</span>
              </label>
            </div>
            <label>
              <span>נתיב תמונה (למשל /media/gallery-01.jpg)</span>
              <input
                value={s.image_path || ""}
                dir="ltr"
                placeholder="/media/gallery-01.jpg"
                onChange={(e) =>
                  setServices((prev) =>
                    prev.map((x) => (x.id === s.id ? { ...x, image_path: e.target.value || null } : x)),
                  )
                }
              />
            </label>
            <div className="admin-row" style={{ alignItems: "center" }}>
              <button type="button" onClick={() => void save(s)} className="admin-btn-primary">
                שמור
              </button>
              <button type="button" className="admin-danger-link" onClick={() => void remove(s)}>
                מחק שירות
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="admin-card admin-form" style={{ marginTop: "1rem" }}>
        <h2>שירות חדש</h2>
        <label>
          <span>שם</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="admin-row">
          <label>
            <span>דקות</span>
            <input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
          </label>
          <label>
            <span>מחיר ₪</span>
            <input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
          </label>
        </div>
        <button type="button" onClick={() => void create()} className="admin-btn-primary">
          הוסף
        </button>
      </div>
    </div>
  );
}
