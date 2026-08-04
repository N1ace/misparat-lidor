"use client";

import { useEffect, useMemo, useState } from "react";
import { formatInTimeZone } from "date-fns-tz";

type Service = {
  id: string;
  name: string;
  duration_minutes: number;
  price_agorot: number;
};

function priceILS(agorot: number) {
  return `₪${(agorot / 100).toFixed(agorot % 100 === 0 ? 0 : 2)}`;
}

function nextDays(count: number) {
  const out: { ymd: string; label: string }[] = [];
  const tz = "Asia/Jerusalem";
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getTime() + i * 86400000);
    const ymd = formatInTimeZone(d, tz, "yyyy-MM-dd");
    const dow = Number(formatInTimeZone(d, tz, "i")); // 1=Mon..7=Sun in date-fns — avoid
    const label = formatInTimeZone(d, tz, "EEEE d/M");
    // Skip Saturday: getDay in Jerusalem
    const dayNum = new Date(
      formatInTimeZone(d, tz, "yyyy-MM-dd") + "T12:00:00",
    );
    // Use Intl for weekday in he
    const he = new Intl.DateTimeFormat("he-IL", {
      timeZone: tz,
      weekday: "short",
      day: "numeric",
      month: "numeric",
    }).format(d);
    const wd = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "short",
    }).format(d);
    if (wd === "Sat") continue;
    out.push({ ymd, label: he });
    void dow;
    void label;
    void dayNum;
    if (out.length >= count) break;
  }
  // ensure enough non-Sat days
  let i = 0;
  while (out.length < count && i < 40) {
    i++;
    const d = new Date(now.getTime() + i * 86400000);
    const ymd = formatInTimeZone(d, tz, "yyyy-MM-dd");
    if (out.some((x) => x.ymd === ymd)) continue;
    const wd = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(d);
    if (wd === "Sat") continue;
    const he = new Intl.DateTimeFormat("he-IL", {
      timeZone: tz,
      weekday: "short",
      day: "numeric",
      month: "numeric",
    }).format(d);
    out.push({ ymd, label: he });
  }
  return out.slice(0, count);
}

export function BookingFlow({ services }: { services: Service[] }) {
  const days = useMemo(() => nextDays(14), []);
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [date, setDate] = useState(days[0]?.ymd ?? "");
  const [slots, setSlots] = useState<string[]>([]);
  const [slot, setSlot] = useState<string | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const service = services.find((s) => s.id === serviceId);

  useEffect(() => {
    if (!serviceId || !date) return;
    let cancelled = false;
    setLoadingSlots(true);
    setSlot(null);
    setError(null);
    fetch(`/api/slots?date=${date}&serviceId=${serviceId}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setSlots(data.slots || []);
      })
      .catch(() => {
        if (!cancelled) setSlots([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });
    return () => {
      cancelled = true;
    };
  }, [serviceId, date]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!slot || !serviceId) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId,
          startAt: slot,
          name,
          phone,
          email: email || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "שגיאה בקביעת התור");
        return;
      }
      setDone(true);
    } catch {
      setError("שגיאת רשת");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-8 text-center">
        <h2 className="display text-2xl">התור נקבע</h2>
        <p className="mt-3 text-[var(--muted)]">נשלח אישור ב־SMS{email ? " ובמייל" : ""}.</p>
        <p className="mt-2 text-sm text-[var(--muted)]">נתראה במספרה.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-8">
      <section>
        <h2 className="display mb-3 text-xl">שירות</h2>
        <div className="grid gap-2">
          {services.map((s) => {
            const on = s.id === serviceId;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setServiceId(s.id)}
                className={`flex items-center justify-between rounded-xl border px-4 py-4 text-right transition ${
                  on
                    ? "border-[var(--accent)] bg-[var(--accent)] text-[#1a0f0a] font-bold"
                    : "border-[var(--line)] bg-[var(--card)]"
                }`}
              >
                <span>{s.name}</span>
                <span className="text-sm opacity-80">
                  {s.duration_minutes} דק׳ · {priceILS(s.price_agorot)}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="display mb-3 text-xl">יום</h2>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {days.map((d) => {
            const on = d.ymd === date;
            return (
              <button
                key={d.ymd}
                type="button"
                onClick={() => setDate(d.ymd)}
                className={`shrink-0 rounded-xl border px-3 py-3 text-sm ${
                  on
                    ? "border-[var(--accent)] bg-[var(--accent)] font-bold text-[#1a0f0a]"
                    : "border-[var(--line)] bg-[var(--card)]"
                }`}
              >
                {d.label}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="display mb-3 text-xl">שעה</h2>
        {loadingSlots ? (
          <p className="text-[var(--muted)]">טוען תורים…</p>
        ) : slots.length === 0 ? (
          <p className="text-[var(--muted)]">אין תורים ביום הזה</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {slots.map((iso) => {
              const label = formatInTimeZone(iso, "Asia/Jerusalem", "HH:mm");
              const on = slot === iso;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => setSlot(iso)}
                  className={`rounded-lg border py-3 text-center font-semibold transition ${
                    on
                      ? "border-[var(--accent)] bg-[var(--accent)] text-[#1a0f0a] scale-[1.03]"
                      : "border-[var(--line)] bg-[var(--card)]"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="display mb-1 text-xl">הפרטים שלכם</h2>
        <label className="block">
          <span className="mb-1 block text-sm text-[var(--muted)]">שם</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-[var(--line)] bg-[var(--card)] px-4 py-3 outline-none focus:border-[var(--accent)]"
            autoComplete="name"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-[var(--muted)]">טלפון</span>
          <input
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-xl border border-[var(--line)] bg-[var(--card)] px-4 py-3 outline-none focus:border-[var(--accent)]"
            inputMode="tel"
            autoComplete="tel"
            placeholder="05X-XXX-XXXX"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-[var(--muted)]">אימייל (אופציונלי — לטלפונים כשרים בלי SMS)</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-[var(--line)] bg-[var(--card)] px-4 py-3 outline-none focus:border-[var(--accent)]"
            type="email"
            autoComplete="email"
            dir="ltr"
          />
        </label>
      </section>

      {error && <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-200">{error}</p>}

      <button
        type="submit"
        disabled={!slot || !service || submitting}
        className="w-full rounded-2xl bg-[var(--accent)] py-4 text-lg font-extrabold text-[#1a0f0a] disabled:opacity-40"
      >
        {submitting ? "קובע תור…" : "קבע תור"}
      </button>
    </form>
  );
}
