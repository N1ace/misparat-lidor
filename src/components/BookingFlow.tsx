"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import Link from "next/link";
import { ClientIdentityForm, type ClientInfo } from "@/components/ClientIdentityForm";
import {
  bookingCopyText,
  buildIcs,
  downloadIcs,
  googleCalendarUrl,
} from "@/lib/calendar-links";
import { SHOP } from "@/lib/shop";

export type BookingService = {
  id: string;
  name: string;
  duration_minutes: number;
  price_agorot: number;
  image_path: string | null;
};

type BookedAppt = {
  service: string;
  start: string;
  end: string;
  clientName: string;
  clientPhone: string;
  address: string;
  cancelUrl: string;
};

function priceILS(agorot: number) {
  return `₪${(agorot / 100).toFixed(agorot % 100 === 0 ? 0 : 2)}`;
}

function resolveInitialService(services: BookingService[], initial?: string) {
  if (!initial || services.length === 0) return "";
  const byId = services.find((s) => s.id === initial);
  if (byId) return byId.id;
  const decoded = decodeURIComponent(initial);
  const byName = services.find((s) => s.name === decoded || s.name === initial);
  return byName?.id ?? "";
}

function ymdInTz(d: Date, tz = "Asia/Jerusalem") {
  return formatInTimeZone(d, tz, "yyyy-MM-dd");
}

function addMonths(ymd: string, delta: number): string {
  const [y, m] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function monthLabel(ymd: string) {
  const [y, m] = ymd.split("-").map(Number);
  return new Intl.DateTimeFormat("he-IL", { month: "long", year: "numeric" }).format(
    new Date(y, m - 1, 1),
  );
}

function daysInMonthGrid(monthStartYmd: string) {
  const [y, m] = monthStartYmd.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  // JS: Sun=0 … Sat=6 — matches our DAY_NAMES / working_hours
  const startPad = first.getDay();
  const daysCount = new Date(y, m, 0).getDate();
  const cells: ({ ymd: string; day: number } | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysCount; d++) {
    cells.push({
      ymd: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      day: d,
    });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

const PLACEHOLDER =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop stop-color="#2a2418"/><stop offset="1" stop-color="#1a1610"/>
      </linearGradient></defs>
      <rect width="640" height="400" fill="url(#g)"/>
      <text x="320" y="210" text-anchor="middle" fill="#c4a35a" font-family="sans-serif" font-size="28">שירות</text>
    </svg>`,
  );

export function BookingFlow({
  services,
  initialService,
  horizonDays = 30,
  embedded = false,
}: {
  services: BookingService[];
  initialService?: string;
  horizonDays?: number;
  embedded?: boolean;
}) {
  const preselected = resolveInitialService(services, initialService);
  const [step, setStep] = useState(preselected ? 2 : 1);
  const [serviceId, setServiceId] = useState(preselected);
  const [monthCursor, setMonthCursor] = useState(() => {
    const today = ymdInTz(new Date());
    return `${today.slice(0, 8)}01`;
  });
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [slot, setSlot] = useState<string | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [openDays, setOpenDays] = useState<Set<number> | null>(null);
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState<BookedAppt | null>(null);
  const [copied, setCopied] = useState(false);
  /** True when step 4 was reached by skipping identity (already logged in). */
  const [skippedIdentity, setSkippedIdentity] = useState(false);

  const service = services.find((s) => s.id === serviceId);
  const todayYmd = ymdInTz(new Date());
  const horizonEnd = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + Math.min(Math.max(horizonDays, 1), 60));
    return ymdInTz(d);
  }, [horizonDays]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/client/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.client) setClient(data.client as ClientInfo);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setSessionChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/hours")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const byDay = data.byDay as Record<string, unknown[]> | undefined;
        if (!byDay) {
          setOpenDays(new Set([0, 1, 2, 3, 4, 5]));
          return;
        }
        const open = new Set<number>();
        for (let d = 0; d <= 6; d++) {
          if (Array.isArray(byDay[d]) && byDay[d].length > 0) open.add(d);
        }
        setOpenDays(open);
      })
      .catch(() => setOpenDays(new Set([0, 1, 2, 3, 4, 5])));
    return () => {
      cancelled = true;
    };
  }, []);

  const isSelectableDay = useCallback(
    (ymd: string) => {
      if (ymd < todayYmd || ymd > horizonEnd) return false;
      const [y, m, d] = ymd.split("-").map(Number);
      const dow = new Date(y, m - 1, d).getDay();
      if (openDays && !openDays.has(dow)) return false;
      return true;
    },
    [todayYmd, horizonEnd, openDays],
  );

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

  function goAfterDatetime() {
    if (!slot || !serviceId) return;
    if (client) {
      setSkippedIdentity(true);
      setStep(4);
    } else {
      setSkippedIdentity(false);
      setStep(3);
    }
  }

  function goBack() {
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
    else if (step === 4) setStep(skippedIdentity ? 2 : 3);
  }

  async function confirmBook() {
    if (!slot || !serviceId || !client) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId, startAt: slot }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "שגיאה בקביעת התור");
        if (data.code === "auth") {
          setClient(null);
          setStep(3);
        }
        return;
      }
      setBooked(data.appointment as BookedAppt);
      setStep(5);
    } catch {
      setError("שגיאת רשת");
    } finally {
      setSubmitting(false);
    }
  }

  const whenLabel = booked
    ? formatInTimeZone(booked.start, "Asia/Jerusalem", "EEEE d/M/yyyy · HH:mm")
    : slot
      ? formatInTimeZone(slot, "Asia/Jerusalem", "EEEE d/M/yyyy · HH:mm")
      : "";

  const cells = daysInMonthGrid(monthCursor);

  if (!sessionChecked) {
    return <p className="bf-muted" style={{ textAlign: "center" }}>טוען…</p>;
  }

  if (step === 5 && booked) {
    const start = new Date(booked.start);
    const end = new Date(booked.end);
    const title = `${booked.service} · ${SHOP.name}`;
    const details = `תור ל${booked.clientName}\n${booked.cancelUrl}`;
    return (
      <div className="done-card bf-success">
        <h2>התור נקבע</h2>
        <p className="bf-muted">
          {booked.service}
          <br />
          {whenLabel}
        </p>
        <div className="bf-success-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              const ics = buildIcs({
                title,
                description: details,
                location: booked.address,
                start,
                end,
              });
              downloadIcs("lidor-booking.ics", ics);
            }}
          >
            הוסף ליומן (ICS)
          </button>
          <a
            className="btn btn-ghost"
            href={googleCalendarUrl({
              title,
              details,
              location: booked.address,
              start,
              end,
            })}
            target="_blank"
            rel="noopener noreferrer"
          >
            Google Calendar
          </a>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={async () => {
              const text = bookingCopyText({
                shop: SHOP.name,
                service: booked.service,
                whenLabel,
                address: booked.address,
                cancelUrl: booked.cancelUrl,
              });
              try {
                await navigator.clipboard.writeText(text);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                /* ignore */
              }
            }}
          >
            {copied ? "הועתק ✓" : "העתק פרטי התור"}
          </button>
        </div>
        {!embedded && (
          <p style={{ marginBlockStart: "1.25rem" }}>
            <Link href="/account?tab=bookings" className="bf-account-link">
              לאזור האישי
            </Link>
          </p>
        )}
      </div>
    );
  }

  const backBtn =
    step >= 2 && step <= 4 ? (
      <button type="button" className="bf-back" onClick={goBack} aria-label="חזרה לשלב הקודם">
        <span aria-hidden="true">→</span>
        חזרה
      </button>
    ) : null;

  return (
    <div className="bf">
      {backBtn}
      <ol className="bf-steps" aria-label="שלבי הזמנה">
        {["שירות", "מועד", "זיהוי", "אישור"].map((label, i) => {
          const n = i + 1;
          const active = step === n || (step === 5 && n === 4);
          const done = step > n || (client && n === 3 && step >= 4);
          return (
            <li key={label} className={active ? "on" : done ? "done" : undefined}>
              <span>{n}</span>
              {label}
            </li>
          );
        })}
      </ol>

      {step === 1 && (
        <section className="bf-section">
          <h2>בחרו שירות</h2>
          <div className="bf-svc-grid">
            {services.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`bf-svc-card${s.id === serviceId ? " on" : ""}`}
                onClick={() => {
                  setServiceId(s.id);
                  setDate("");
                  setSlot(null);
                  setStep(2);
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.image_path || PLACEHOLDER} alt="" />
                <div className="bf-svc-meta">
                  <strong>{s.name}</strong>
                  <span>
                    {s.duration_minutes} דק׳ · {priceILS(s.price_agorot)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 2 && service && (
        <section className="bf-section">
          <div className="bf-section-head">
            <h2>בחרו יום ושעה</h2>
            <p className="bf-muted" style={{ margin: 0 }}>
              {service.name}
            </p>
          </div>

          <div className="bf-cal">
            <div className="bf-cal-nav">
              <button
                type="button"
                aria-label="חודש קודם"
                onClick={() => setMonthCursor((m) => addMonths(m, -1))}
              >
                ‹
              </button>
              <strong>{monthLabel(monthCursor)}</strong>
              <button
                type="button"
                aria-label="חודש הבא"
                onClick={() => setMonthCursor((m) => addMonths(m, 1))}
              >
                ›
              </button>
            </div>
            <div className="bf-cal-weekdays">
              {["א", "ב", "ג", "ד", "ה", "ו", "ש"].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="bf-cal-grid">
              {cells.map((cell, i) => {
                if (!cell) return <span key={`e-${i}`} className="bf-cal-empty" />;
                const ok = isSelectableDay(cell.ymd);
                const on = date === cell.ymd;
                return (
                  <button
                    key={cell.ymd}
                    type="button"
                    disabled={!ok}
                    className={`bf-cal-day${on ? " on" : ""}`}
                    onClick={() => setDate(cell.ymd)}
                  >
                    {cell.day}
                  </button>
                );
              })}
            </div>
          </div>

          {date ? (
            <div className="bf-slots-block">
              <h3>
                שעות ל־
                {formatInTimeZone(`${date}T12:00:00`, "Asia/Jerusalem", "d/M/yyyy")}
              </h3>
              {loadingSlots ? (
                <p className="bf-muted">טוען תורים…</p>
              ) : slots.length === 0 ? (
                <p className="bf-muted">אין תורים פנויים ביום הזה — בחרו יום אחר</p>
              ) : (
                <div className="slot-grid">
                  {slots.map((iso) => {
                    const label = formatInTimeZone(iso, "Asia/Jerusalem", "HH:mm");
                    const on = slot === iso;
                    return (
                      <button
                        key={iso}
                        type="button"
                        onClick={() => setSlot(iso)}
                        className={`slot${on ? " on" : ""}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <p className="bf-muted">בחרו יום ביומן</p>
          )}

          <button
            type="button"
            className="btn btn-primary"
            style={{ width: "100%", marginBlockStart: "1.25rem" }}
            disabled={!slot}
            onClick={goAfterDatetime}
          >
            המשך
          </button>
        </section>
      )}

      {step === 3 && (
        <section className="bf-section">
          <ClientIdentityForm
            title="פרטי הזיהוי"
            submitLabel="המשך לאישור"
            onAuthenticated={(c) => {
              setClient(c);
              setSkippedIdentity(false);
              setStep(4);
            }}
          />
        </section>
      )}

      {step === 4 && service && client && slot && (
        <section className="bf-section">
          <div className="bf-section-head">
            <h2>אישור התור</h2>
          </div>
          <dl className="bf-summary">
            <div>
              <dt>שירות</dt>
              <dd>{service.name}</dd>
            </div>
            <div>
              <dt>מועד</dt>
              <dd>{whenLabel}</dd>
            </div>
            <div>
              <dt>שם</dt>
              <dd>{client.name}</dd>
            </div>
            <div>
              <dt>טלפון</dt>
              <dd dir="ltr">{client.phone}</dd>
            </div>
            <div>
              <dt>אישור ב־</dt>
              <dd>{client.notify_channel === "email" ? "אימייל" : "SMS"}</dd>
            </div>
          </dl>
          {error && <p className="err">{error}</p>}
          <button
            type="button"
            className="btn btn-primary"
            style={{ width: "100%" }}
            disabled={submitting}
            onClick={() => void confirmBook()}
          >
            {submitting ? "קובע תור…" : "אשרו וקבעו תור"}
          </button>
        </section>
      )}
    </div>
  );
}
