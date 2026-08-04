"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { ClientIdentityForm, type ClientInfo } from "@/components/ClientIdentityForm";
import { BookingFlow, type BookingService } from "@/components/BookingFlow";
import { SHOP, waMe } from "@/lib/shop";

type Tab = "new" | "bookings" | "settings" | "contact";

type Appt = {
  id: string;
  service_name: string;
  status: string;
  cancel_token: string;
  start: string;
  end: string;
};

type WaitItem = {
  id: string;
  service_name: string | null;
  preferred_date: string | null;
  status: string;
  notes: string | null;
};

const TABS: { id: Tab; label: string }[] = [
  { id: "new", label: "תור חדש" },
  { id: "bookings", label: "התורים שלי" },
  { id: "settings", label: "הגדרות" },
  { id: "contact", label: "יצירת קשר" },
];

function parseTab(raw?: string | null): Tab {
  if (raw === "bookings" || raw === "settings" || raw === "contact" || raw === "new") return raw;
  return "bookings";
}

export function AccountApp({
  services,
  horizonDays,
  initialTab,
}: {
  services: BookingService[];
  horizonDays: number;
  initialTab?: string;
}) {
  const [tab, setTab] = useState<Tab>(() => parseTab(initialTab));
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [upcoming, setUpcoming] = useState<Appt[]>([]);
  const [past, setPast] = useState<Appt[]>([]);
  const [waitlist, setWaitlist] = useState<WaitItem[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // settings form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [channel, setChannel] = useState<"sms" | "email">("sms");

  const refreshMe = useCallback(async () => {
    const res = await fetch("/api/client/me");
    if (!res.ok) {
      setClient(null);
      return null;
    }
    const data = await res.json();
    const c = data.client as ClientInfo;
    setClient(c);
    setName(c.name);
    setEmail(c.email || "");
    setChannel(c.notify_channel);
    return c;
  }, []);

  const loadBookings = useCallback(async () => {
    const [aRes, wRes] = await Promise.all([
      fetch("/api/client/appointments"),
      fetch("/api/client/waitlist"),
    ]);
    if (aRes.ok) {
      const data = await aRes.json();
      setUpcoming(data.upcoming || []);
      setPast(data.past || []);
    }
    if (wRes.ok) {
      const data = await wRes.json();
      setWaitlist(data.entries || []);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const c = await refreshMe();
        if (cancelled) return;
        if (c) await loadBookings();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshMe, loadBookings]);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState({}, "", url.pathname + "?" + url.searchParams.toString());
  }, [tab]);

  async function logout() {
    await fetch("/api/client/logout", { method: "POST" });
    setClient(null);
    setUpcoming([]);
    setPast([]);
    setWaitlist([]);
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch("/api/client/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email: email || null,
          notify_channel: channel,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "שמירה נכשלה");
        return;
      }
      setClient(data.client);
      setMsg("ההגדרות נשמרו");
    } catch {
      setErr("שגיאת רשת");
    } finally {
      setSaving(false);
    }
  }

  async function cancelAppt(token: string) {
    if (!confirm("לבטל את התור?")) return;
    setErr(null);
    const res = await fetch(`/api/cancel/${token}`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(data.error || "ביטול נכשל");
      return;
    }
    await loadBookings();
    setMsg("התור בוטל");
  }

  if (loading) {
    return <p className="bf-muted" style={{ textAlign: "center" }}>טוען…</p>;
  }

  if (!client) {
    return (
      <div className="account-gate">
        <ClientIdentityForm
          title="כניסה לאזור האישי"
          submitLabel="כניסה"
          onAuthenticated={async (c) => {
            setClient(c);
            setName(c.name);
            setEmail(c.email || "");
            setChannel(c.notify_channel);
            await loadBookings();
          }}
        />
      </div>
    );
  }

  return (
    <div className="account-app">
      <div className="account-userbar">
        <div>
          <strong>{client.name}</strong>
          <span className="bf-muted" dir="ltr">
            {" "}
            · {client.phone}
          </span>
        </div>
        <button type="button" className="bf-link-btn" onClick={() => void logout()}>
          התנתקות
        </button>
      </div>

      <nav className="account-tabs" aria-label="אזור אישי">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? "on" : undefined}
            onClick={() => {
              setTab(t.id);
              setMsg(null);
              setErr(null);
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {msg && <p className="account-ok">{msg}</p>}
      {err && <p className="err">{err}</p>}

      {tab === "new" && (
        <div className="account-panel">
          {services.length === 0 ? (
            <p className="bf-muted">
              אין שירותים זמינים.{" "}
              <Link href="/booking">לקביעת תור</Link>
            </p>
          ) : (
            <BookingFlow services={services} horizonDays={horizonDays} embedded />
          )}
        </div>
      )}

      {tab === "bookings" && (
        <div className="account-panel">
          <h2>תורים קרובים</h2>
          {upcoming.length === 0 ? (
            <p className="bf-muted">אין תורים קרובים</p>
          ) : (
            <ul className="account-list">
              {upcoming.map((a) => (
                <li key={a.id}>
                  <div>
                    <strong>{a.service_name}</strong>
                    <p className="bf-muted">
                      {formatInTimeZone(a.start, "Asia/Jerusalem", "EEEE d/M/yyyy · HH:mm")}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="bf-link-btn danger"
                    onClick={() => void cancelAppt(a.cancel_token)}
                  >
                    ביטול
                  </button>
                </li>
              ))}
            </ul>
          )}

          <h2 style={{ marginBlockStart: "1.75rem" }}>רשימת המתנה</h2>
          {waitlist.length === 0 ? (
            <p className="bf-muted">אין רישומים ברשימת המתנה</p>
          ) : (
            <ul className="account-list">
              {waitlist.map((w) => (
                <li key={w.id}>
                  <div>
                    <strong>{w.service_name || "שירות כללי"}</strong>
                    <p className="bf-muted">
                      {w.preferred_date
                        ? `מועד מועדף: ${w.preferred_date}`
                        : `סטטוס: ${w.status}`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <h2 style={{ marginBlockStart: "1.75rem" }}>היסטוריה</h2>
          {past.length === 0 ? (
            <p className="bf-muted">אין תורים קודמים</p>
          ) : (
            <ul className="account-list muted">
              {past.slice(0, 20).map((a) => (
                <li key={a.id}>
                  <div>
                    <strong>{a.service_name}</strong>
                    <p className="bf-muted">
                      {formatInTimeZone(a.start, "Asia/Jerusalem", "d/M/yyyy · HH:mm")} ·{" "}
                      {a.status === "cancelled" ? "בוטל" : a.status === "done" ? "בוצע" : a.status}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "settings" && (
        <form className="account-panel bf-identity" onSubmit={(e) => void saveSettings(e)}>
          <h2>הגדרות</h2>
          <label>
            <span>שם</span>
            <input required value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            <span>טלפון (לא ניתן לשינוי)</span>
            <input value={client.phone} disabled dir="ltr" />
          </label>
          <label>
            <span>אימייל</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              dir="ltr"
              required={channel === "email"}
            />
          </label>
          <fieldset className="bf-channel">
            <legend>ערוץ התראות מועדף</legend>
            <label className="bf-radio">
              <input
                type="radio"
                checked={channel === "sms"}
                onChange={() => setChannel("sms")}
              />
              SMS
            </label>
            <label className="bf-radio">
              <input
                type="radio"
                checked={channel === "email"}
                onChange={() => setChannel("email")}
              />
              אימייל
            </label>
          </fieldset>
          <button type="submit" className="btn btn-primary" disabled={saving} style={{ width: "100%" }}>
            {saving ? "שומר…" : "שמירה"}
          </button>
        </form>
      )}

      {tab === "contact" && (
        <div className="account-panel account-contact">
          <h2>יצירת קשר</h2>
          <p className="bf-muted">{SHOP.name} · {SHOP.addressShort}</p>
          <a className="btn btn-primary" href={waMe("שלום, אשמח לעזרה לגבי התור שלי")}>
            WhatsApp
          </a>
          <a className="btn btn-ghost" href={`tel:${SHOP.phoneE164}`}>
            חייגו {SHOP.phoneDisplay}
          </a>
        </div>
      )}
    </div>
  );
}
