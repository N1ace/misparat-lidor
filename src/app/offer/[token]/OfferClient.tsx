"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SHOP } from "@/lib/shop";

export function OfferClient({ token }: { token: string }) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"accepted" | "declined" | null>(null);
  const [data, setData] = useState<{
    offerStatus: string;
    expiresAt: string;
    clientName: string;
    service: string;
    label: string;
    priceAgorot: number;
  } | null>(null);
  const [left, setLeft] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/offer/${token}`);
        const json = await res.json();
        if (!res.ok) {
          if (!cancelled) setError(json.error || "לא נמצא");
          return;
        }
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setError("שגיאת רשת");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!data?.expiresAt || data.offerStatus !== "pending") return;
    const tick = () => {
      setLeft(Math.max(0, Math.floor((new Date(data.expiresAt).getTime() - Date.now()) / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [data]);

  async function act(action: "accept" | "decline") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/offer/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "התור כבר נתפס");
        return;
      }
      setDone(action === "accept" ? "accepted" : "declined");
    } catch {
      setError("שגיאת רשת");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="bf-muted">טוען…</p>;

  if (done === "accepted") {
    return (
      <div className="done-card">
        <h1>התור אושר</h1>
        <p>נשמח לראותכם ב{SHOP.name}.</p>
        <Link className="btn btn-primary" href="/booking?tab=bookings">
          לתורים שלי
        </Link>
      </div>
    );
  }

  if (done === "declined") {
    return (
      <div className="done-card">
        <h1>ויתרתם על ההצעה</h1>
        <p>נשארתם ברשימת ההמתנה לתור הבא שיתפנה.</p>
        <Link className="btn btn-ghost" href="/booking">
          לקביעת תור
        </Link>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="done-card">
        <h1>התור כבר נתפס</h1>
        <p className="bf-muted">{error}</p>
        <Link className="btn btn-primary" href="/booking">
          לקביעת תור רגיל
        </Link>
      </div>
    );
  }

  if (!data || data.offerStatus !== "pending" || left <= 0) {
    return (
      <div className="done-card">
        <h1>התור כבר נתפס</h1>
        <p className="bf-muted">ההצעה פגה או כבר טופלה.</p>
        <Link className="btn btn-primary" href="/booking">
          לקביעת תור
        </Link>
      </div>
    );
  }

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  return (
    <div className="done-card" style={{ textAlign: "right" }}>
      <p className="kicker" style={{ color: "var(--brass)", fontWeight: 700, margin: 0 }}>
        {SHOP.name}
      </p>
      <h1 style={{ marginBlock: "0.5rem" }}>התפנה תור</h1>
      <p>
        שלום {data.clientName}, יש תור פנוי ל{data.service}
      </p>
      <p style={{ fontWeight: 800, fontSize: "1.2rem" }}>{data.label}</p>
      <p className="bf-muted">מחיר: ₪{(data.priceAgorot / 100).toFixed(0)}</p>
      <p style={{ fontWeight: 700 }}>נותרו {mm}:{ss} לאישור</p>
      {error ? <p className="err">{error}</p> : null}
      <div className="bf-success-actions">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void act("accept")}>
          אשר תור
        </button>
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void act("decline")}>
          ויתור
        </button>
      </div>
    </div>
  );
}
