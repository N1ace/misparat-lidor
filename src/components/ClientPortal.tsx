"use client";

import { useCallback, useEffect, useState } from "react";
import { ClientIdentityForm, type ClientInfo } from "@/components/ClientIdentityForm";
import { BookingFlow, type BookingService } from "@/components/BookingFlow";
import { NAME_LIMITS, truncateLabel } from "@/lib/name-limits";
import { waMe, type ShopPublic } from "@/lib/shop";
import { useLiveShop } from "@/hooks/useLiveShop";
import { formatJerusalem } from "@/lib/time";

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
  any_time?: boolean;
};

const TABS: { id: Tab; label: string; icon: "new" | "bookings" | "settings" | "contact" }[] = [
  { id: "new", label: "תור חדש", icon: "new" },
  { id: "bookings", label: "התורים שלי", icon: "bookings" },
  { id: "settings", label: "הגדרות", icon: "settings" },
  { id: "contact", label: "יצירת קשר", icon: "contact" },
];

function TabIcon({ name }: { name: (typeof TABS)[number]["icon"] }) {
  const props = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.85,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };
  if (name === "new") {
    return (
      <svg {...props}>
        <rect x="3.5" y="5" width="17" height="15" rx="2" />
        <path d="M8 3v4M16 3v4M3.5 10h17M12 13v5M9.5 15.5h5" />
      </svg>
    );
  }
  if (name === "bookings") {
    return (
      <svg {...props}>
        <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
      </svg>
    );
  }
  if (name === "settings") {
    return (
      <svg {...props}>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3.5v2.2M12 18.3v2.2M4.9 6.5l1.6 1.6M17.5 15.9l1.6 1.6M3.5 12h2.2M18.3 12h2.2M4.9 17.5l1.6-1.6M17.5 8.1l1.6-1.6" />
      </svg>
    );
  }
  return (
    <svg {...props}>
      <path d="M21 15a3 3 0 01-3 3H8l-5 3V6a3 3 0 013-3h12a3 3 0 013 3z" />
    </svg>
  );
}

function parseTab(raw?: string | null): Tab {
  if (raw === "bookings" || raw === "settings" || raw === "contact" || raw === "new") return raw;
  return "new";
}

export function ClientPortal({
  services,
  horizonDays,
  initialTab,
  initialService,
  shop: shopProp,
}: {
  services: BookingService[];
  horizonDays: number;
  initialTab?: string;
  initialService?: string;
  shop?: ShopPublic;
}) {
  const shop = useLiveShop(shopProp);
  const [tab, setTab] = useState<Tab>(() => parseTab(initialTab));
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [upcoming, setUpcoming] = useState<Appt[]>([]);
  const [past, setPast] = useState<Appt[]>([]);
  const [waitlist, setWaitlist] = useState<WaitItem[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

  function goTab(next: Tab) {
    setTab(next);
    setMsg(null);
    setErr(null);
  }

  async function logout() {
    await fetch("/api/client/logout", { method: "POST" });
    setClient(null);
    setUpcoming([]);
    setPast([]);
    setWaitlist([]);
    goTab("new");
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

  const onAuth = useCallback(
    async (c: ClientInfo) => {
      setClient(c);
      setName(c.name);
      setEmail(c.email || "");
      setChannel(c.notify_channel);
      await loadBookings();
    },
    [loadBookings],
  );

  if (loading) {
    return <p className="bf-muted" style={{ textAlign: "center" }}>טוען…</p>;
  }

  const needsAuthGate = !client && (tab === "bookings" || tab === "settings");

  return (
    <div className="client-portal">
      <header className="client-top">
        <p className="client-brand">{shop.name}</p>
        {client ? (
          <h1 className="client-hello" title={client.name}>
            שלום, {truncateLabel(client.name, NAME_LIMITS.person)}
          </h1>
        ) : (
          <p className="client-sub">{shop.addressShort}</p>
        )}
      </header>

      <div className="client-body">
        {msg && <p className="account-ok">{msg}</p>}
        {err && <p className="err">{err}</p>}

        {needsAuthGate ? (
          <div className="account-gate">
            <ClientIdentityForm
              title={tab === "bookings" ? "כניסה לצפייה בתורים" : "כניסה להגדרות"}
              submitLabel="כניסה"
              onAuthenticated={(c) => void onAuth(c)}
            />
          </div>
        ) : null}

        {!needsAuthGate && tab === "new" && (
          <div className="account-panel">
            {services.length === 0 ? (
              <p className="bf-muted">אין שירותים זמינים כרגע.</p>
            ) : (
              <BookingFlow
                services={services}
                horizonDays={horizonDays}
                initialService={initialService}
                shop={shop}
                onClientAuthenticated={(c) => void onAuth(c)}
                onBooked={() => {
                  void loadBookings();
                }}
                onOpenBookings={() => {
                  void loadBookings().then(() => goTab("bookings"));
                }}
              />
            )}
          </div>
        )}

        {!needsAuthGate && tab === "bookings" && client && (
          <div className="account-panel">
            <h2>תורים קרובים</h2>
            {upcoming.length === 0 ? (
              <p className="bf-muted">אין תורים קרובים</p>
            ) : (
              <ul className="account-list">
                {upcoming.map((a) => (
                  <li key={a.id}>
                    <div>
                      <strong title={a.service_name}>
                        {truncateLabel(a.service_name, NAME_LIMITS.service)}
                      </strong>
                      <p className="bf-muted">
                        {formatJerusalem(a.start, "EEEE d/M/yyyy · HH:mm")}
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
                          ? `תאריך יעד: ${String(w.preferred_date).slice(0, 10).split("-").reverse().join("/")}`
                          : `סטטוס: ${w.status === "offered" ? "הוצע תור" : "ממתין"}`}
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
                      <strong title={a.service_name}>
                        {truncateLabel(a.service_name, NAME_LIMITS.service)}
                      </strong>
                      <p className="bf-muted">
                        {formatJerusalem(a.start, "d/M/yyyy · HH:mm")} ·{" "}
                        {a.status === "cancelled"
                          ? "בוטל"
                          : a.status === "done"
                            ? "בוצע"
                            : a.status}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {!needsAuthGate && tab === "settings" && client && (
          <form className="account-panel bf-identity" onSubmit={(e) => void saveSettings(e)}>
            <h2>הגדרות</h2>
            <label>
              <span>שם</span>
              <input
                required
                value={name}
                maxLength={NAME_LIMITS.person}
                onChange={(e) => setName(e.target.value.slice(0, NAME_LIMITS.person))}
              />
            </label>
            <label>
              <span>טלפון</span>
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
            <button type="button" className="btn btn-ghost client-logout" onClick={() => void logout()}>
              התנתקות
            </button>
          </form>
        )}

        {tab === "contact" && (
          <div className="account-panel account-contact">
            <h2>יצירת קשר</h2>
            <p className="bf-muted">
              {shop.name} · {shop.addressShort}
            </p>
            <a className="btn btn-primary" href={waMe("שלום, אשמח לעזרה לגבי התור שלי", shop)}>
              WhatsApp
            </a>
            <a className="btn btn-ghost" href={`tel:${shop.phoneE164}`}>
              חייגו {shop.phoneDisplay}
            </a>
          </div>
        )}
      </div>

      <nav className="client-bottom-nav" aria-label="תפריט אזור לקוח">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? "on" : undefined}
            onClick={() => {
              goTab(t.id);
              if (t.id === "bookings" && client) void loadBookings();
            }}
          >
            <TabIcon name={t.icon} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
