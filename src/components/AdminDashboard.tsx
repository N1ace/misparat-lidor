"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { TZ } from "@/lib/shop";

type Stats = {
  todayYmd: string;
  today: {
    total: number;
    active: number;
    passed: number;
    done: number;
    no_show: number;
    cancelled: number;
  };
  all: {
    total: number;
    active: number;
    passed: number;
    cancelled: number;
  };
  week: number;
  clients: number;
  waitlist: number;
  servicesActive: number;
  next: { client_name: string; service_name: string; start: string } | null;
};

function StatCard({
  label,
  value,
  hint,
  href,
  tone,
}: {
  label: string;
  value: number | string;
  hint?: string;
  href?: string;
  tone?: "default" | "accent" | "ok" | "warn" | "muted";
}) {
  const inner = (
    <>
      <span className="admin-stat-label">{label}</span>
      <strong className="admin-stat-value">{value}</strong>
      {hint ? <span className="admin-stat-hint">{hint}</span> : null}
    </>
  );
  const cls = `admin-stat-card tone-${tone || "default"}`;
  if (href) {
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  }
  return <div className={cls}>{inner}</div>;
}

export function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/stats");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "שגיאה בטעינת נתונים");
        setStats(null);
        return;
      }
      setStats(data);
    } catch {
      setError("שגיאת רשת");
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const todayLabel = stats
    ? new Intl.DateTimeFormat("he-IL", {
        timeZone: TZ,
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(new Date(`${stats.todayYmd}T12:00:00`))
    : "";

  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h1>לוח בקרה</h1>
          <p>{stats ? `סטטיסטיקות מהירות · ${todayLabel}` : "סטטיסטיקות מהירות על תורים ולקוחות."}</p>
        </div>
        <div className="admin-row-actions">
          <button type="button" className="cal-chip" onClick={() => void load()} disabled={loading}>
            רענון
          </button>
          <Link className="admin-btn-primary" href="/admin/calendar">
            + תור חדש
          </Link>
        </div>
      </div>

      {loading && !stats ? <p className="admin-muted">טוען נתונים…</p> : null}
      {error ? <p className="cal-error">{error}</p> : null}

      {stats ? (
        <>
          <h2 className="admin-section-title">היום</h2>
          <div className="admin-stats-grid">
            <StatCard label="תורים היום" value={stats.today.total} hint="מאושרים / בוצעו / לא הגיעו" href="/admin/calendar" tone="accent" />
            <StatCard label="פעילים היום" value={stats.today.active} hint="עדיין לפנינו" tone="ok" />
            <StatCard label="שעברו היום" value={stats.today.passed} hint="בוצעו או הסתיימו" />
            <StatCard label="בוצעו" value={stats.today.done} />
            <StatCard label="לא הגיעו" value={stats.today.no_show} tone={stats.today.no_show ? "warn" : "muted"} />
            <StatCard label="בוטלו היום" value={stats.today.cancelled} tone="muted" />
          </div>

          <h2 className="admin-section-title">כללי</h2>
          <div className="admin-stats-grid">
            <StatCard label="סה״כ תורים" value={stats.all.total} hint="ללא בוטלים" />
            <StatCard label="תורים פעילים" value={stats.all.active} hint="מאושרים בעתיד" tone="ok" href="/admin/calendar" />
            <StatCard label="תורים שעברו" value={stats.all.passed} />
            <StatCard label="השבוע" value={stats.week} hint="א׳–ש׳" href="/admin/calendar" />
            <StatCard label="לקוחות" value={stats.clients} href="/admin/clients" />
            <StatCard label="רשימת המתנה" value={stats.waitlist} href="/admin/waitlist" tone={stats.waitlist ? "accent" : "muted"} />
            <StatCard label="שירותים פעילים" value={stats.servicesActive} href="/admin/services" tone="muted" />
            <StatCard label="בוטלו (הכל)" value={stats.all.cancelled} tone="muted" />
          </div>

          <div className="admin-card admin-next-card">
            <h2>התור הבא</h2>
            {stats.next ? (
              <p>
                <strong>{stats.next.client_name}</strong>
                {" · "}
                {stats.next.service_name}
                {" · "}
                <bdi>
                  {formatInTimeZone(stats.next.start, TZ, "dd/MM/yyyy HH:mm")}
                </bdi>
              </p>
            ) : (
              <p className="admin-muted">אין תורים מאושרים בהמשך.</p>
            )}
            <Link href="/admin/calendar" className="cal-chip" style={{ marginTop: "0.75rem", display: "inline-flex" }}>
              ליומן
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}
