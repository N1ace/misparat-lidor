"use client";

import { useEffect, useState } from "react";

type Service = {
  id: string;
  name: string;
  duration_minutes: number;
  price_agorot: number;
  sort_order: number;
  active: boolean;
};

export default function AdminServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [name, setName] = useState("");
  const [duration, setDuration] = useState(30);
  const [price, setPrice] = useState(80);

  async function load() {
    const res = await fetch("/api/admin/services");
    const data = await res.json();
    setServices(data.services || []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(s: Service) {
    await fetch("/api/admin/services", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(s),
    });
    await load();
  }

  async function create() {
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

  return (
    <div>
      <h1 className="display text-3xl">שירותים</h1>
      <ul className="mt-6 space-y-3">
        {services.map((s) => (
          <li key={s.id} className="space-y-2 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4">
            <input
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2"
              value={s.name}
              onChange={(e) => setServices((prev) => prev.map((x) => (x.id === s.id ? { ...x, name: e.target.value } : x)))}
            />
            <div className="flex flex-wrap gap-2">
              <label className="text-sm">
                דקות{" "}
                <input
                  type="number"
                  className="w-20 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-2 py-1"
                  value={s.duration_minutes}
                  onChange={(e) =>
                    setServices((prev) =>
                      prev.map((x) => (x.id === s.id ? { ...x, duration_minutes: Number(e.target.value) } : x)),
                    )
                  }
                />
              </label>
              <label className="text-sm">
                ₪{" "}
                <input
                  type="number"
                  className="w-24 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-2 py-1"
                  value={s.price_agorot / 100}
                  onChange={(e) =>
                    setServices((prev) =>
                      prev.map((x) => (x.id === s.id ? { ...x, price_agorot: Math.round(Number(e.target.value) * 100) } : x)),
                    )
                  }
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={s.active}
                  onChange={(e) =>
                    setServices((prev) => prev.map((x) => (x.id === s.id ? { ...x, active: e.target.checked } : x)))
                  }
                />
                פעיל
              </label>
            </div>
            <button type="button" onClick={() => save(s)} className="rounded-xl bg-[var(--accent)] px-4 py-2 font-bold text-[#1a0f0a]">
              שמור
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-8 space-y-2 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4">
        <h2 className="font-bold">שירות חדש</h2>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="שם" className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2" />
        <div className="flex gap-2">
          <input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="w-24 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2" />
          <input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} className="w-24 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2" />
        </div>
        <button type="button" onClick={create} className="rounded-xl bg-[var(--accent)] px-4 py-2 font-bold text-[#1a0f0a]">
          הוסף
        </button>
      </div>
    </div>
  );
}
